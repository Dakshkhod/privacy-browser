"""
Optimized Privacy Browser Backend - Ultra-Fast and Comprehensive
Version 3.0 - Next Generation with Advanced Fetching
"""
import os
import logging
from datetime import datetime
from typing import Optional, Dict, List
from urllib.parse import urlparse

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import ultra-advanced fetcher
try:
    from ultra_fetcher import get_ultra_fetcher, UltraPrivacyFetcher
    ULTRA_FETCHER_AVAILABLE = True
    logger.info("Ultra fetcher module loaded successfully")
except ImportError as e:
    ULTRA_FETCHER_AVAILABLE = False
    logger.warning(f"Ultra fetcher not available, falling back to fast fetcher: {e}")

# Fast fetcher removed - using ultra_fetcher only
FAST_FETCHER_AVAILABLE = False

# Import LLM analyzer
try:
    from llm_analyzer import get_llm_analyzer, LLMPrivacyAnalyzer
    LLM_ANALYZER_AVAILABLE = True
    logger.info("LLM analyzer module loaded successfully")
except ImportError as e:
    LLM_ANALYZER_AVAILABLE = False
    logger.warning(f"LLM analyzer not available: {e}")

from security_config import get_security_config, log_security_event, is_valid_url

# Initialize FastAPI app
app = FastAPI(
    title="Privacy Browser Backend API",
    description="Ultra-fast privacy policy analysis with advanced detection",
    version="3.0.0"
)

# Global instances
ultra_fetcher_instance = None
llm_analyzer_instance = None

# Security and CORS configuration
security_config = get_security_config()
# Correctly read CORS values from SecurityConfig.cors_config
cors = security_config.cors_config
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors["allow_origins"],
    allow_credentials=cors["allow_credentials"],
    allow_methods=cors["allow_methods"],
    allow_headers=cors["allow_headers"],
)

# Request models
class URLRequest(BaseModel):
    url: str

class AnalysisRequest(BaseModel):
    policy_text: str
    website_url: Optional[str] = None

class DirectAnalysisRequest(BaseModel):
    url: Optional[str] = None
    policy_text: Optional[str] = None

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint for health checks and basic API information."""
    global ultra_fetcher_instance
    fetcher_status = "ultra" if ULTRA_FETCHER_AVAILABLE and ultra_fetcher_instance else "fast"
    
    return {
        "status": "ok",
        "message": "Privacy Browser Backend API - Next Generation",
        "version": "3.0.0",
        "fetcher": fetcher_status,
        "timestamp": datetime.utcnow().isoformat(),
        "features": [
            "Multi-strategy privacy policy detection",
            "Advanced caching (memory + disk)",
            "Domain-specific optimizations",
            "Sitemap & robots.txt parsing",
            "NLP-based content analysis",
            "Parallel processing"
        ],
        "endpoints": {
            "health": "/health",
            "test": "/test-simple",
            "fetch_policy": "/fetch-privacy-policy",
            "analyze_direct": "/analyze-direct-policy",
            "analyze_policy": "/analyze-policy",
            "stats": "/stats"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": time.time()
    }

@app.get("/test-simple")
async def test_simple():
    """Very simple test endpoint to verify basic functionality."""
    return {
        "status": "ok",
        "message": "Simple test successful",
        "test": True,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/fetch-privacy-policy")
async def fetch_privacy_policy(request: URLRequest, http_request: Request):
    """Ultra-fast privacy policy fetching with advanced multi-strategy detection"""
    client_ip = http_request.client.host if http_request.client else "unknown"
    start_time = time.time()
    
    try:
        # Validate URL
        if not request.url or not request.url.strip():
            raise HTTPException(status_code=400, detail="URL is required")
        
        if not is_valid_url(request.url):
            log_security_event("INVALID_URL", f"Invalid URL submitted: {request.url}", client_ip)
            raise HTTPException(status_code=400, detail="Invalid URL format")
        
        log_security_event("POLICY_FETCH_REQUEST", f"Privacy policy fetch requested for: {request.url}", client_ip)
        
        # Try ultra fetcher first (if available)
        if ULTRA_FETCHER_AVAILABLE:
            try:
                global ultra_fetcher_instance
                if ultra_fetcher_instance is None:
                    ultra_fetcher_instance = await get_ultra_fetcher()
                
                result = await ultra_fetcher_instance.fetch_privacy_policy(request.url)
                
                if result.get('success'):
                    total_time = time.time() - start_time
                    log_security_event("POLICY_FETCH_SUCCESS", 
                                     f"Ultra fetcher found privacy policy for: {request.url} in {total_time:.2f}s", 
                                     client_ip)
                    return {
                        'success': True,
                        'policy_text': result['policy_text'],
                        'policy_url': result['policy_url'],
                        'method': f"ultra_fetcher_{result.get('strategy', 'unknown')}",
                        'fetch_time': total_time,
                        'privacy_score': result.get('score', 0),
                        'content_length': len(result['policy_text']),
                        'cached': result.get('cached', False),
                        'cache_type': result.get('cache_type', 'none')
                    }
            except Exception as e:
                logger.error(f"Ultra fetcher error: {e}")
        
        # If all fetchers fail
        total_time = time.time() - start_time
        log_security_event("POLICY_FETCH_FAILED", 
                          f"All fetchers failed for: {request.url} in {total_time:.2f}s", 
                          client_ip)
        raise HTTPException(status_code=404, detail="Privacy policy not found")
        
    except HTTPException:
        raise
    except Exception as e:
        total_time = time.time() - start_time
        log_security_event("POLICY_FETCH_ERROR", f"Unexpected error for {request.url} after {total_time:.2f}s: {str(e)}", client_ip)
        raise HTTPException(status_code=500, detail=f"Error fetching privacy policy: {str(e)}")

@app.post("/analyze-direct-policy")
async def analyze_direct_policy(request: DirectAnalysisRequest, http_request: Request):
    """Analyze privacy policy from a direct policy URL or provided text, returns UI-ready analysis."""
    client_ip = http_request.client.host if http_request.client else "unknown"

    try:
        log_security_event("DIRECT_ANALYSIS_REQUEST", "Direct policy analysis requested", client_ip)

        policy_text: Optional[str] = None
        policy_url: Optional[str] = None

        # If URL provided, fetch policy first (ultra-fast path)
        if request.url:
            if not is_valid_url(request.url):
                raise HTTPException(status_code=400, detail="Invalid URL format")
            
            # Try ultra fetcher first
            if ULTRA_FETCHER_AVAILABLE:
                try:
                    global ultra_fetcher_instance
                    if ultra_fetcher_instance is None:
                        ultra_fetcher_instance = await get_ultra_fetcher()
                    
                    result = await ultra_fetcher_instance.fetch_privacy_policy(request.url)
                    
                    if result.get('success'):
                        policy_text = result.get('policy_text')
                        policy_url = result.get('policy_url')
                    else:
                        detail = result.get('error', 'Privacy policy not found')
                        raise HTTPException(status_code=404, detail=detail)
                except Exception as e:
                    logger.error(f"Ultra fetcher error in direct analysis: {e}")
                    raise HTTPException(status_code=404, detail="Privacy policy not found")
            else:
                raise HTTPException(status_code=500, detail="No fetcher available")

        # If policy text is provided directly
        if not policy_text and request.policy_text:
            policy_text = request.policy_text

        if not policy_text or len(policy_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Policy text is required and must be at least 50 characters")

        # Advanced privacy analysis with LLM
        llm_analysis = await analyze_policy_with_llm(policy_text, policy_url)
        
        # If LLM analysis succeeded, transform to UI format
        if llm_analysis.get('analysis_method') in ['groq_llm', 'enhanced_heuristics']:
            analysis = transform_llm_to_ui_analysis(llm_analysis, policy_url)
        else:
            # Fallback to basic analysis
            basic = analyze_policy_basic(policy_text)
            analysis = transform_basic_to_ui_analysis(basic, policy_url)

        # Add policy length for UI transparency
        analysis['policy_length'] = len(policy_text) if policy_text else 0
        analysis['confidence'] = llm_analysis.get('confidence', 'High')
        
        log_security_event("DIRECT_ANALYSIS_SUCCESS", "Direct analysis completed", client_ip)
        return analysis  # UI expects analysis object at root

    except HTTPException:
        raise
    except Exception as e:
        log_security_event("DIRECT_ANALYSIS_ERROR", f"Analysis error: {str(e)[:100]}", client_ip)
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

@app.post("/analyze-policy")
async def analyze_policy_endpoint(request: AnalysisRequest, http_request: Request):
    """Analyze provided privacy policy text (used after fetching). Returns UI-ready analysis."""
    client_ip = http_request.client.host if http_request.client else "unknown"
    try:
        if not request.policy_text or len(request.policy_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="policy_text is required and must be at least 50 characters")

        # Use LLM analyzer
        llm_analysis = await analyze_policy_with_llm(request.policy_text, request.website_url)
        
        # Transform based on analysis method
        if llm_analysis.get('analysis_method') in ['groq_llm', 'enhanced_heuristics']:
            analysis = transform_llm_to_ui_analysis(llm_analysis, request.website_url)
        else:
            # Fallback to basic
            basic = analyze_policy_basic(request.policy_text)
            analysis = transform_basic_to_ui_analysis(basic, request.website_url)
            
        log_security_event("POLICY_ANALYSIS_SUCCESS", "Policy analysis completed", client_ip)
        return analysis
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("POLICY_ANALYSIS_ERROR", f"Analysis error: {str(e)[:100]}", client_ip)
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

async def analyze_policy_with_llm(policy_text: str, website_url: Optional[str] = None) -> Dict:
    """Analyze policy using LLM if available, fallback to enhanced heuristics"""
    global llm_analyzer_instance
    
    if LLM_ANALYZER_AVAILABLE:
        if llm_analyzer_instance is None:
            llm_analyzer_instance = get_llm_analyzer()
        
        try:
            # Use LLM analyzer (Groq or enhanced heuristics)
            analysis = await llm_analyzer_instance.analyze_policy(policy_text, website_url)
            return analysis
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            # Continue to fallback
    
    # Fallback to basic analysis
    return analyze_policy_basic(policy_text)

def analyze_policy_basic(policy_text: str) -> Dict:
    """Basic privacy policy analysis without LLM"""
    try:
        text_lower = policy_text.lower()
        word_count = len(policy_text.split())
        
        # Data collection indicators
        collection_terms = [
            'collect', 'gather', 'obtain', 'receive', 'acquire',
            'personal information', 'personal data', 'user data'
        ]
        data_collection = sum(1 for term in collection_terms if term in text_lower)
        
        # Data sharing indicators
        sharing_terms = [
            'share', 'disclose', 'transfer', 'third party', 'third parties',
            'partners', 'affiliates', 'service providers'
        ]
        data_sharing = sum(1 for term in sharing_terms if term in text_lower)
        
        # User rights indicators
        rights_terms = [
            'delete', 'access', 'modify', 'opt-out', 'opt out', 'unsubscribe',
            'rights', 'control', 'manage', 'update', 'correct'
        ]
        user_rights = sum(1 for term in rights_terms if term in text_lower)
        
        # Privacy-specific terms
        privacy_terms = [
            'cookie', 'tracking', 'analytics', 'advertising', 'marketing',
            'encryption', 'security', 'retention', 'storage'
        ]
        privacy_indicators = sum(1 for term in privacy_terms if term in text_lower)
        
        # Calculate scores
        collection_score = min(data_collection, 5)
        sharing_score = min(data_sharing, 5)
        rights_score = min(user_rights, 5)
        privacy_score = min(privacy_indicators, 5)
        
        # Overall assessment
        total_score = collection_score + sharing_score + rights_score + privacy_score
        
        if total_score >= 15:
            assessment = "Comprehensive"
        elif total_score >= 10:
            assessment = "Moderate"
        elif total_score >= 5:
            assessment = "Basic"
        else:
            assessment = "Limited"
        
        return {
            "data_collection": {
                "detected": data_collection > 0,
                "indicators": data_collection,
                "score": collection_score
            },
            "data_sharing": {
                "detected": data_sharing > 0,
                "indicators": data_sharing,
                "score": sharing_score
            },
            "user_rights": {
                "detected": user_rights > 0,
                "indicators": user_rights,
                "score": rights_score
            },
            "privacy_features": {
                "detected": privacy_indicators > 0,
                "indicators": privacy_indicators,
                "score": privacy_score
            },
            "overall": {
                "assessment": assessment,
                "total_score": total_score,
                "word_count": word_count,
                "completeness": min(100, (total_score / 20) * 100)
            }
        }
        
    except Exception as e:
        logger.error(f"Basic analysis failed: {e}")
        return {
            "error": "Analysis failed",
            "message": "Could not analyze the policy text"
        }

def transform_llm_to_ui_analysis(llm_analysis: Dict, policy_url: Optional[str]) -> Dict:
    """Transform LLM analysis to UI-expected format with enhanced detail"""
    try:
        # Extract data types and convert to UI format
        data_types_ui = {}
        
        # Check both data_types_collected (raw LLM) and data_types (normalized)
        data_types_collected = llm_analysis.get('data_types_collected', {})
        data_types_normalized = llm_analysis.get('data_types', {})
        
        # Map internal names to user-friendly names
        friendly_names = {
            'personal_info': 'Personal Information',
            'contact': 'Contact Information',
            'location': 'Location Data',
            'device_info': 'Device Information',
            'usage_data': 'Usage Data',
            'financial': 'Financial Data',
            'biometric': 'Biometric Data',
            'health': 'Health Data',
            'social': 'Social Data',
            'behavioral': 'Behavioral/Profiling',
            'cookies_tracking': 'Cookies & Tracking',
            'cookies': 'Cookies & Tracking',
            'children_data': "Children's Data",
            'communication': 'Communication Data',
            'media': 'Media Data',
            'advertising': 'Advertising Data',
            'camera': 'Camera Access',
            'microphone': 'Microphone Access'
        }
        
        total_data_types = 0
        high_risk_count = 0
        
        # Process data_types_collected (raw format from LLM)
        for data_type, info in data_types_collected.items():
            if isinstance(info, dict):
                # Include if collected is True OR if it has details/severity indicating collection
                is_collected = info.get('collected', False)
                has_details = info.get('details') and len(info.get('details', [])) > 0
                has_severity = info.get('severity', 0) > 0
                
                if is_collected or has_details or has_severity:
                    severity = info.get('severity', 1)
                    details = info.get('details', [])
                    friendly_name = friendly_names.get(data_type, data_type.replace('_', ' ').title())
                    data_types_ui[friendly_name] = {
                        'severity': severity,
                        'details': details
                    }
                    total_data_types += 1
                    if severity >= 4:
                        high_risk_count += 1
        
        # Also include any normalized data_types that weren't already added
        for data_type, info in data_types_normalized.items():
            if data_type not in data_types_ui:
                if isinstance(info, dict):
                    severity = info.get('severity', 1)
                    details = info.get('details', [])
                    if severity > 0 or details:
                        data_types_ui[data_type] = {
                            'severity': severity,
                            'details': details
                        }
                        total_data_types += 1
                        if severity >= 4:
                            high_risk_count += 1
                elif isinstance(info, (int, float)) and info > 0:
                    data_types_ui[data_type] = {
                        'severity': int(info),
                        'details': []
                    }
                    total_data_types += 1
        
        # Build warnings from risk factors
        warnings = llm_analysis.get('risk_factors', [])
        
        # Build summary from user rights and security
        user_rights = llm_analysis.get('user_rights', {})
        security = llm_analysis.get('security_measures', {})
        
        your_rights = []
        if user_rights.get('access'):
            your_rights.append("Access your data")
        if user_rights.get('deletion'):
            your_rights.append("Request deletion")
        if user_rights.get('correction'):
            your_rights.append("Correct inaccuracies")
        if user_rights.get('opt_out'):
            your_rights.append("Opt-out of marketing")
        if user_rights.get('portability'):
            your_rights.append("Data portability")
        if user_rights.get('restriction'):
            your_rights.append("Restrict processing")
        if user_rights.get('objection'):
            your_rights.append("Object to processing")
        if user_rights.get('appeal'):
            your_rights.append("Lodge complaints")
        
        security_list = security.get('details', [])
        
        # Determine compliance level
        rights_count = len(your_rights)
        if rights_count >= 6:
            compliance = "GDPR/CCPA Compliant"
        elif rights_count >= 4:
            compliance = "Good Compliance"
        elif rights_count >= 2:
            compliance = "Basic Compliance"
        else:
            compliance = "Limited Rights"
        
        return {
            "risk_level": llm_analysis.get('risk_level', 'Medium'),
            "data_types": data_types_ui,
            "data_types_count": total_data_types,
            "high_risk_data_count": high_risk_count,
            "warnings": warnings,
            "summary": {
                "your_rights": your_rights,
                "security": security_list,
                "compliance": compliance
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
                "user_rights": user_rights
            }
        }
    except Exception as e:
        logger.error(f"Error transforming LLM analysis: {e}")
        # Fallback to basic transformation
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
            "analysis_method": "error"
        }

def transform_basic_to_ui_analysis(basic: Dict, policy_url: Optional[str]) -> Dict:
    """Map basic analysis into the frontend's expected schema."""
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

    if total_score >= 15:
        risk_level = "Low"  # comprehensive policy implies lower risk
    elif total_score >= 8:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # Heuristics to populate UI-friendly fields
    data_types: Dict[str, int] = {}
    if basic.get("data_collection", {}).get("detected"):
        data_types.update({"email": 2, "usage": 1, "device": 1})
    if basic.get("data_sharing", {}).get("detected"):
        data_types["advertising"] = 1
        data_types["third_parties"] = 1 if "third_parties" in data_types else 1  # placeholder key
    if basic.get("privacy_features", {}).get("detected"):
        data_types.setdefault("security", 1)

    warnings: List[str] = []
    if basic.get("data_sharing", {}).get("indicators", 0) >= 2:
        warnings.append("Your data may be shared with third parties and service providers.")
    if basic.get("privacy_features", {}).get("indicators", 0) == 0:
        warnings.append("Limited information about security and privacy features.")

    summary = {
        "your_rights": [
            "Access your data",
            "Request deletion",
            "Correct inaccuracies",
            "Opt-out of marketing",
        ] if basic.get("user_rights", {}).get("detected") else [],
        "security": [
            "Encryption and secure storage",
            "Access controls"
        ] if basic.get("privacy_features", {}).get("detected") else [],
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

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Endpoint not found", "path": str(request.url.path)}
    )

@app.exception_handler(500)
async def server_error_handler(request: Request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "message": "Something went wrong"}
    )

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("Privacy Browser Backend API starting up...")
    logger.info("Version 3.0 - Ultra-optimized with advanced multi-strategy detection")
    
    # Initialize ultra fetcher
    if ULTRA_FETCHER_AVAILABLE:
        global ultra_fetcher_instance
        try:
            ultra_fetcher_instance = await get_ultra_fetcher()
            logger.info("Ultra fetcher initialized successfully")
        except Exception as e:
            logger.error(f"Ultra fetcher initialization failed: {e}")
            logger.info("Falling back to fast fetcher")
    else:
        logger.warning("Ultra fetcher not available, using fast fetcher")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean shutdown"""
    global ultra_fetcher_instance
    if ultra_fetcher_instance:
        try:
            await ultra_fetcher_instance.__aexit__(None, None, None)
            logger.info("Ultra fetcher shut down gracefully")
        except:
            pass

@app.get("/stats")
async def get_stats():
    """Get performance statistics"""
    global ultra_fetcher_instance
    if ultra_fetcher_instance:
        return {
            "status": "ok",
            "version": "3.0.0",
            "fetcher": "ultra",
            "stats": ultra_fetcher_instance.get_stats()
        }
    return {
        "status": "ok",
        "version": "3.0.0",
        "fetcher": "fast",
        "stats": {"message": "Stats not available for current fetcher"}
    }
    
if __name__ == "__main__":
    import uvicorn
    
    # Get configuration
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("PORT", os.getenv("BACKEND_PORT", 5001)))
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "main_optimized:app",
        host=host,
        port=port,
        log_level="info",
        access_log=True
    )
