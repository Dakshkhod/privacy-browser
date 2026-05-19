"""
Optimized Privacy Browser Backend - Ultra-Fast and Comprehensive.

Version 3.1 — security-hardened, middleware-wired, SSRF-safe.
"""

import os
import re
import time
import logging
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional, Dict, List

# Load environment variables from .env file in dev. In production secrets
# come from the platform (Render env-vars) and dotenv is a no-op.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, HTTPException, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ultra fetcher
try:
    from ultra_fetcher import get_ultra_fetcher, UltraPrivacyFetcher
    ULTRA_FETCHER_AVAILABLE = True
    logger.info("Ultra fetcher module loaded successfully")
except ImportError as e:
    ULTRA_FETCHER_AVAILABLE = False
    logger.warning("Ultra fetcher not available: %s", e)

# LLM analyzer
try:
    from llm_analyzer import get_llm_analyzer, LLMPrivacyAnalyzer
    LLM_ANALYZER_AVAILABLE = True
    logger.info("LLM analyzer module loaded successfully")
except ImportError as e:
    LLM_ANALYZER_AVAILABLE = False
    logger.warning("LLM analyzer not available: %s", e)

from security_config import get_security_config, log_security_event, is_valid_url
from middleware import SecurityMiddleware, RequestLoggingMiddleware


# ----------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------
MAX_POLICY_TEXT_CHARS = int(os.getenv('MAX_POLICY_TEXT_CHARS', '60000'))
MIN_POLICY_TEXT_CHARS = 50
STATS_TOKEN = os.getenv('STATS_TOKEN', '')   # if unset, /stats is locked down


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip_html(s: str) -> str:
    if not isinstance(s, str):
        return s
    return re.sub(r'<[^>]*>', '', s)


def _sanitize_value(v):
    """Recursively strip HTML tags from string values in LLM output."""
    if isinstance(v, str):
        return _strip_html(v)
    if isinstance(v, list):
        return [_sanitize_value(x) for x in v]
    if isinstance(v, dict):
        return {k: _sanitize_value(val) for k, val in v.items()}
    return v


# ----------------------------------------------------------------------
# Lifespan
# ----------------------------------------------------------------------
ultra_fetcher_instance: Optional[UltraPrivacyFetcher] = None
llm_analyzer_instance: Optional[LLMPrivacyAnalyzer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ultra_fetcher_instance, llm_analyzer_instance
    logger.info("Privacy Browser Backend starting up...")

    if ULTRA_FETCHER_AVAILABLE:
        try:
            ultra_fetcher_instance = await get_ultra_fetcher()
            logger.info("Ultra fetcher initialized successfully")
        except Exception as e:
            logger.error("Ultra fetcher initialization failed: %s", e)

    if LLM_ANALYZER_AVAILABLE:
        try:
            llm_analyzer_instance = get_llm_analyzer()
            logger.info("LLM analyzer initialized successfully")
        except Exception as e:
            logger.error("LLM analyzer initialization failed: %s", e)

    yield

    if ultra_fetcher_instance:
        try:
            await ultra_fetcher_instance.__aexit__(None, None, None)
            logger.info("Ultra fetcher shut down gracefully")
        except Exception:
            pass


# ----------------------------------------------------------------------
# FastAPI app
# ----------------------------------------------------------------------
app = FastAPI(
    title="Privacy Browser Backend API",
    description="Ultra-fast privacy policy analysis with advanced detection",
    version="3.1.0",
    lifespan=lifespan,
)

security_config = get_security_config()
cors = security_config.cors_config

# Order matters: outermost runs first.  Security headers + rate limiting first,
# then logging, then CORS.
app.add_middleware(SecurityMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors['allow_origins'],
    allow_origin_regex=cors.get('allow_origin_regex'),
    allow_credentials=cors['allow_credentials'],
    allow_methods=cors['allow_methods'],
    allow_headers=cors['allow_headers'],
)


# ----------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------
class URLRequest(BaseModel):
    url: str = Field(..., max_length=2000)


class AnalysisRequest(BaseModel):
    policy_text: str = Field(..., min_length=MIN_POLICY_TEXT_CHARS, max_length=MAX_POLICY_TEXT_CHARS)
    website_url: Optional[str] = Field(None, max_length=2000)


class DirectAnalysisRequest(BaseModel):
    url: Optional[str] = Field(None, max_length=2000)
    policy_text: Optional[str] = Field(None, max_length=MAX_POLICY_TEXT_CHARS)


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
@app.get("/")
async def root():
    fetcher_status = "ultra" if ULTRA_FETCHER_AVAILABLE and ultra_fetcher_instance else "none"
    return {
        "status": "ok",
        "message": "Privacy Browser Backend API",
        "version": "3.1.0",
        "fetcher": fetcher_status,
        "timestamp": _utcnow_iso(),
        "endpoints": {
            "health": "/health",
            "fetch_policy": "/fetch-privacy-policy",
            "analyze_direct": "/analyze-direct-policy",
            "analyze_policy": "/analyze-policy",
            "stats": "/stats",
        },
    }


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": _utcnow_iso()}


@app.get("/test-simple")
async def test_simple():
    return {"status": "ok", "message": "Simple test successful", "test": True, "timestamp": _utcnow_iso()}


@app.post("/fetch-privacy-policy")
async def fetch_privacy_policy(request: URLRequest, http_request: Request):
    client_ip = http_request.client.host if http_request.client else "unknown"
    start_time = time.time()
    try:
        if not request.url or not request.url.strip():
            raise HTTPException(status_code=400, detail="URL is required")
        if not is_valid_url(request.url):
            log_security_event("INVALID_URL", f"Invalid/forbidden URL: {request.url}", client_ip)
            raise HTTPException(status_code=400, detail="Invalid URL")

        log_security_event("POLICY_FETCH_REQUEST", f"url={request.url}", client_ip)

        global ultra_fetcher_instance
        if ULTRA_FETCHER_AVAILABLE and ultra_fetcher_instance is None:
            ultra_fetcher_instance = await get_ultra_fetcher()

        if not ULTRA_FETCHER_AVAILABLE or ultra_fetcher_instance is None:
            return JSONResponse(status_code=503, content={
                'success': False,
                'error': 'Privacy policy fetcher unavailable',
                'error_code': 'NO_FETCHER',
                'user_message': 'Service temporarily unavailable. Please try again later.',
                'suggestions': ['Try again in a few moments'],
            })

        try:
            result = await ultra_fetcher_instance.fetch_privacy_policy(request.url)
        except Exception as e:
            logger.error("Ultra fetcher error: %s", e)
            return JSONResponse(status_code=502, content={
                'success': False,
                'error': 'Fetcher error',
                'error_code': 'FETCH_ERROR',
                'user_message': 'We encountered an error while fetching the privacy policy. Please try again.',
                'suggestions': ['Try again in a few moments'],
            })

        total_time = time.time() - start_time

        if result.get('success'):
            log_security_event("POLICY_FETCH_SUCCESS", f"url={request.url} in {total_time:.2f}s", client_ip)
            response_data = {
                'success': True,
                'policy_text': result['policy_text'],
                'policy_url': result['policy_url'],
                'method': f"ultra_fetcher_{result.get('strategy', 'unknown')}",
                'fetch_time': total_time,
                'privacy_score': result.get('score', 0),
                'content_length': len(result['policy_text']),
                'cached': result.get('cached', False),
                'cache_type': result.get('cache_type', 'none'),
            }
            if result.get('is_fallback'):
                response_data['is_fallback'] = True
                response_data['fallback_note'] = result.get('fallback_note', 'Using pre-analyzed summary')
            return response_data

        # Fetch failed
        error_response = {
            'success': False,
            'error': result.get('error', 'Privacy policy not found'),
            'error_code': result.get('error_code', 'UNKNOWN'),
            'error_reason': result.get('error_reason', 'Unable to fetch the privacy policy'),
            'user_message': result.get('user_message', 'We could not find or access the privacy policy for this website.'),
            'suggestions': result.get('suggestions', []),
            'domain': result.get('domain', ''),
            'fetch_time': total_time,
            'strategies_tried': result.get('strategies_tried', 0),
        }
        log_security_event(
            "POLICY_FETCH_FAILED",
            f"url={request.url} code={result.get('error_code')}",
            client_ip,
        )
        return JSONResponse(status_code=404, content=error_response)

    except HTTPException:
        raise
    except Exception as e:
        total_time = time.time() - start_time
        log_security_event("POLICY_FETCH_ERROR", f"err={e} url={request.url} {total_time:.2f}s", client_ip)
        return JSONResponse(status_code=500, content={
            'success': False,
            'error': 'Server error',
            'error_code': 'SERVER_ERROR',
            'user_message': 'An unexpected error occurred. Please try again.',
            'suggestions': ['Try again in a few moments'],
        })


@app.post("/analyze-direct-policy")
async def analyze_direct_policy(request: DirectAnalysisRequest, http_request: Request):
    client_ip = http_request.client.host if http_request.client else "unknown"
    try:
        log_security_event("DIRECT_ANALYSIS_REQUEST", "request", client_ip)

        policy_text: Optional[str] = None
        policy_url: Optional[str] = None

        if request.url:
            if not is_valid_url(request.url):
                raise HTTPException(status_code=400, detail="Invalid URL")
            global ultra_fetcher_instance
            if not ULTRA_FETCHER_AVAILABLE:
                return JSONResponse(status_code=503, content={
                    'success': False,
                    'error': 'No fetcher available',
                    'error_code': 'NO_FETCHER',
                    'user_message': 'Service temporarily unavailable.',
                    'suggestions': ['Try again later'],
                })
            if ultra_fetcher_instance is None:
                ultra_fetcher_instance = await get_ultra_fetcher()
            try:
                result = await ultra_fetcher_instance.fetch_privacy_policy(request.url)
            except Exception as e:
                logger.error("Ultra fetcher error in direct analysis: %s", e)
                return JSONResponse(status_code=502, content={
                    'success': False,
                    'error': 'Fetcher error',
                    'error_code': 'FETCH_ERROR',
                    'user_message': 'We encountered an error while fetching.',
                    'suggestions': ['Try again later'],
                })
            if result.get('success'):
                policy_text = result.get('policy_text')
                policy_url = result.get('policy_url')
            else:
                return JSONResponse(status_code=404, content={
                    'success': False,
                    'error': result.get('error', 'Privacy policy not found'),
                    'error_code': result.get('error_code', 'UNKNOWN'),
                    'error_reason': result.get('error_reason'),
                    'user_message': result.get('user_message', 'We could not find or access the privacy policy.'),
                    'suggestions': result.get('suggestions', []),
                    'domain': result.get('domain', ''),
                    'strategies_tried': result.get('strategies_tried', 0),
                })

        if not policy_text and request.policy_text:
            policy_text = request.policy_text

        if not policy_text or len(policy_text.strip()) < MIN_POLICY_TEXT_CHARS:
            raise HTTPException(status_code=400, detail=f"Policy text required (>= {MIN_POLICY_TEXT_CHARS} chars)")

        llm_analysis = await analyze_policy_with_llm(policy_text, policy_url)
        if llm_analysis.get('analysis_method') in ('groq_llm', 'enhanced_heuristics'):
            analysis = transform_llm_to_ui_analysis(llm_analysis, policy_url)
        else:
            basic = analyze_policy_basic(policy_text)
            analysis = transform_basic_to_ui_analysis(basic, policy_url)

        analysis['policy_length'] = len(policy_text)
        analysis['confidence'] = llm_analysis.get('confidence', 'High')
        analysis = _sanitize_value(analysis)

        log_security_event("DIRECT_ANALYSIS_SUCCESS", "ok", client_ip)
        return analysis

    except HTTPException:
        raise
    except Exception as e:
        log_security_event("DIRECT_ANALYSIS_ERROR", f"err={str(e)[:200]}", client_ip)
        return JSONResponse(status_code=500, content={
            'success': False,
            'error_code': 'ANALYSIS_ERROR',
            'user_message': 'Analysis failed unexpectedly.',
            'suggestions': ['Try again in a moment'],
        })


@app.post("/analyze-policy")
async def analyze_policy_endpoint(request: AnalysisRequest, http_request: Request):
    client_ip = http_request.client.host if http_request.client else "unknown"
    try:
        if not request.policy_text or len(request.policy_text.strip()) < MIN_POLICY_TEXT_CHARS:
            raise HTTPException(status_code=400, detail=f"policy_text required (>= {MIN_POLICY_TEXT_CHARS} chars)")

        if request.website_url and not is_valid_url(request.website_url):
            raise HTTPException(status_code=400, detail="Invalid website_url")

        llm_analysis = await analyze_policy_with_llm(request.policy_text, request.website_url)
        if llm_analysis.get('analysis_method') in ('groq_llm', 'enhanced_heuristics'):
            analysis = transform_llm_to_ui_analysis(llm_analysis, request.website_url)
        else:
            basic = analyze_policy_basic(request.policy_text)
            analysis = transform_basic_to_ui_analysis(basic, request.website_url)

        analysis = _sanitize_value(analysis)
        log_security_event("POLICY_ANALYSIS_SUCCESS", "ok", client_ip)
        return analysis
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("POLICY_ANALYSIS_ERROR", f"err={str(e)[:200]}", client_ip)
        return JSONResponse(status_code=500, content={
            'success': False,
            'error_code': 'ANALYSIS_ERROR',
            'user_message': 'Analysis failed unexpectedly.',
            'suggestions': ['Try again in a moment'],
        })


# ----------------------------------------------------------------------
# LLM glue
# ----------------------------------------------------------------------
async def analyze_policy_with_llm(policy_text: str, website_url: Optional[str] = None) -> Dict:
    global llm_analyzer_instance
    if LLM_ANALYZER_AVAILABLE:
        if llm_analyzer_instance is None:
            llm_analyzer_instance = get_llm_analyzer()
        try:
            return await llm_analyzer_instance.analyze_policy(policy_text, website_url)
        except Exception as e:
            logger.error("LLM analysis failed: %s", e)
    return analyze_policy_basic(policy_text)


def analyze_policy_basic(policy_text: str) -> Dict:
    try:
        text_lower = policy_text.lower()
        word_count = len(policy_text.split())

        collection_terms = ['collect', 'gather', 'obtain', 'receive', 'acquire',
                            'personal information', 'personal data', 'user data']
        sharing_terms = ['share', 'disclose', 'transfer', 'third party', 'third parties',
                         'partners', 'affiliates', 'service providers']
        rights_terms = ['delete', 'access', 'modify', 'opt-out', 'opt out', 'unsubscribe',
                        'rights', 'control', 'manage', 'update', 'correct']
        privacy_terms = ['cookie', 'tracking', 'analytics', 'advertising', 'marketing',
                         'encryption', 'security', 'retention', 'storage']

        data_collection = sum(1 for t in collection_terms if t in text_lower)
        data_sharing = sum(1 for t in sharing_terms if t in text_lower)
        user_rights = sum(1 for t in rights_terms if t in text_lower)
        privacy_indicators = sum(1 for t in privacy_terms if t in text_lower)

        scores = {
            "collection": min(data_collection, 5),
            "sharing": min(data_sharing, 5),
            "rights": min(user_rights, 5),
            "privacy": min(privacy_indicators, 5),
        }
        total = sum(scores.values())
        if total >= 15: assessment = "Comprehensive"
        elif total >= 10: assessment = "Moderate"
        elif total >= 5: assessment = "Basic"
        else: assessment = "Limited"

        return {
            "data_collection": {"detected": data_collection > 0, "indicators": data_collection, "score": scores["collection"]},
            "data_sharing": {"detected": data_sharing > 0, "indicators": data_sharing, "score": scores["sharing"]},
            "user_rights": {"detected": user_rights > 0, "indicators": user_rights, "score": scores["rights"]},
            "privacy_features": {"detected": privacy_indicators > 0, "indicators": privacy_indicators, "score": scores["privacy"]},
            "overall": {"assessment": assessment, "total_score": total, "word_count": word_count,
                        "completeness": min(100, (total / 20) * 100)},
        }
    except Exception as e:
        logger.error("Basic analysis failed: %s", e)
        return {"error": "Analysis failed", "message": "Could not analyze the policy text"}


def transform_llm_to_ui_analysis(llm_analysis: Dict, policy_url: Optional[str]) -> Dict:
    try:
        data_types_ui = {}
        data_types_collected = llm_analysis.get('data_types_collected', {})
        data_types_normalized = llm_analysis.get('data_types', {})

        friendly_names = {
            'personal_info': 'Personal Information', 'contact': 'Contact Information',
            'location': 'Location Data', 'device_info': 'Device Information',
            'usage_data': 'Usage Data', 'financial': 'Financial Data',
            'biometric': 'Biometric Data', 'health': 'Health Data',
            'social': 'Social Data', 'behavioral': 'Behavioral/Profiling',
            'cookies_tracking': 'Cookies & Tracking', 'cookies': 'Cookies & Tracking',
            'children_data': "Children's Data", 'communication': 'Communication Data',
            'media': 'Media Data', 'advertising': 'Advertising Data',
            'camera': 'Camera Access', 'microphone': 'Microphone Access',
        }
        total_data_types = 0
        high_risk_count = 0

        for data_type, info in data_types_collected.items():
            if not isinstance(info, dict):
                continue
            is_collected = info.get('collected', False)
            has_details = info.get('details') and len(info.get('details', [])) > 0
            has_severity = info.get('severity', 0) > 0
            if is_collected or has_details or has_severity:
                severity = info.get('severity', 1)
                details = info.get('details', [])
                friendly_name = friendly_names.get(data_type, data_type.replace('_', ' ').title())
                data_types_ui[friendly_name] = {'severity': severity, 'details': details}
                total_data_types += 1
                if severity >= 4:
                    high_risk_count += 1

        for data_type, info in data_types_normalized.items():
            if data_type in data_types_ui:
                continue
            if isinstance(info, dict):
                severity = info.get('severity', 1)
                details = info.get('details', [])
                if severity > 0 or details:
                    data_types_ui[data_type] = {'severity': severity, 'details': details}
                    total_data_types += 1
                    if severity >= 4:
                        high_risk_count += 1
            elif isinstance(info, (int, float)) and info > 0:
                data_types_ui[data_type] = {'severity': int(info), 'details': []}
                total_data_types += 1

        warnings = llm_analysis.get('risk_factors', [])
        user_rights = llm_analysis.get('user_rights', {})
        security = llm_analysis.get('security_measures', {})

        your_rights = []
        rights_keys = (
            ('access', "Access your data"),
            ('deletion', "Request deletion"),
            ('correction', "Correct inaccuracies"),
            ('opt_out', "Opt-out of marketing"),
            ('portability', "Data portability"),
            ('restriction', "Restrict processing"),
            ('objection', "Object to processing"),
            ('appeal', "Lodge complaints"),
        )
        for key, label in rights_keys:
            if user_rights.get(key):
                your_rights.append(label)

        compliance = (
            "GDPR/CCPA Compliant" if len(your_rights) >= 6
            else "Good Compliance" if len(your_rights) >= 4
            else "Basic Compliance" if len(your_rights) >= 2
            else "Limited Rights"
        )

        return {
            "risk_level": llm_analysis.get('risk_level', 'Medium'),
            "data_types": data_types_ui,
            "data_types_count": total_data_types,
            "high_risk_data_count": high_risk_count,
            "warnings": warnings,
            "summary": {
                "your_rights": your_rights,
                "security": security.get('details', []),
                "compliance": compliance,
            },
            "risk_factors": warnings,
            "user_friendly_summary": llm_analysis.get('summary', 'Privacy policy analyzed successfully.'),
            "confidence": {"level": llm_analysis.get('confidence', 'Medium')},
            "safer_alternatives": None,
            "policy_url": policy_url,
            "positive_aspects": llm_analysis.get('positive_aspects', []),
            "analysis_method": llm_analysis.get('analysis_method', 'unknown'),
            "detailed_analysis": {
                "data_types_collected": llm_analysis.get('data_types_collected', {}),
                "third_party_sharing": llm_analysis.get('third_party_sharing', {}),
                "data_retention": llm_analysis.get('data_retention', {}),
                "user_rights": user_rights,
            },
            "dark_patterns": llm_analysis.get('dark_patterns'),
        }
    except Exception as e:
        logger.error("Error transforming LLM analysis: %s", e)
        return {
            "risk_level": "Unknown",
            "data_types": {},
            "warnings": ["Analysis transformation failed"],
            "summary": {},
            "risk_factors": [],
            "user_friendly_summary": "Analysis completed with limited detail.",
            "confidence": {"level": "Low"},
            "safer_alternatives": None,
            "policy_url": policy_url,
            "analysis_method": "error",
        }


def transform_basic_to_ui_analysis(basic: Dict, policy_url: Optional[str]) -> Dict:
    if not basic or basic.get("error"):
        return {
            "risk_level": "Unknown",
            "data_types": {},
            "warnings": [basic.get("message", "Analysis failed")] if basic else [],
            "summary": {},
            "risk_factors": [],
            "user_friendly_summary": "Analysis could not be completed.",
            "confidence": {"level": "Low"},
            "safer_alternatives": None,
            "policy_url": policy_url,
        }

    overall = basic.get("overall", {})
    total_score = overall.get("total_score", 0)
    if total_score >= 15: risk_level = "Low"
    elif total_score >= 8: risk_level = "Medium"
    else: risk_level = "High"

    data_types: Dict[str, int] = {}
    if basic.get("data_collection", {}).get("detected"):
        data_types.update({"email": 2, "usage": 1, "device": 1})
    if basic.get("data_sharing", {}).get("detected"):
        data_types["advertising"] = 1
        data_types["third_parties"] = 1
    if basic.get("privacy_features", {}).get("detected"):
        data_types.setdefault("security", 1)

    warnings: List[str] = []
    if basic.get("data_sharing", {}).get("indicators", 0) >= 2:
        warnings.append("Your data may be shared with third parties and service providers.")
    if basic.get("privacy_features", {}).get("indicators", 0) == 0:
        warnings.append("Limited information about security and privacy features.")

    summary = {
        "your_rights": ["Access your data", "Request deletion", "Correct inaccuracies", "Opt-out of marketing"]
                       if basic.get("user_rights", {}).get("detected") else [],
        "security": ["Encryption and secure storage", "Access controls"]
                    if basic.get("privacy_features", {}).get("detected") else [],
    }

    user_friendly_summary = (
        "The policy describes what data is collected, how it is used, and your rights."
        if total_score >= 8 else
        "This policy provides limited details about data practices. Consider caution."
    )

    return {
        "risk_level": risk_level,
        "data_types": data_types,
        "warnings": warnings,
        "summary": summary,
        "risk_factors": warnings,
        "user_friendly_summary": user_friendly_summary,
        "confidence": {"level": "Medium" if total_score >= 8 else "Low"},
        "safer_alternatives": None,
        "policy_url": policy_url,
    }


# ----------------------------------------------------------------------
# Stats endpoint (auth-gated when STATS_TOKEN is set)
# ----------------------------------------------------------------------
def _verify_stats_token(authorization: Optional[str] = Header(None)) -> None:
    if not STATS_TOKEN:
        # No token configured -> stats are disabled in this env.
        raise HTTPException(status_code=404, detail="Not found")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    presented = authorization.split(" ", 1)[1].strip()
    if not secrets.compare_digest(presented, STATS_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/stats", dependencies=[Depends(_verify_stats_token)])
async def get_stats():
    global ultra_fetcher_instance
    if ultra_fetcher_instance:
        return {
            "status": "ok",
            "version": "3.1.0",
            "fetcher": "ultra",
            "stats": ultra_fetcher_instance.get_stats(),
        }
    return {
        "status": "ok",
        "version": "3.1.0",
        "fetcher": "none",
        "stats": {"message": "Fetcher not initialized"},
    }


# ----------------------------------------------------------------------
# Error handlers
# ----------------------------------------------------------------------
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(status_code=404, content={"error": "Endpoint not found", "path": str(request.url.path)})


@app.exception_handler(500)
async def server_error_handler(request: Request, exc):
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("PORT", os.getenv("BACKEND_PORT", "5001")))
    logger.info("Starting server on %s:%s", host, port)
    uvicorn.run("main_optimized:app", host=host, port=port, log_level="info", access_log=True)
