"""
Optimized Privacy Browser Backend - Fast and Lightweight
"""
import os
import sys
import time
import logging
from datetime import datetime
from typing import Optional, Dict
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Import optimized modules
from main_fast import fetch_privacy_policy_fast
from security_config import get_security_config, log_security_event, is_valid_url

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Privacy Browser Backend API",
    description="Fast privacy policy analysis tool",
    version="2.0.0"
)

# Security and CORS configuration
security_config = get_security_config()
app.add_middleware(
    CORSMiddleware,
    allow_origins=security_config["cors_config"]["origins"],
    allow_credentials=security_config["cors_config"]["credentials"],
    allow_methods=security_config["cors_config"]["methods"],
    allow_headers=security_config["cors_config"]["headers"],
)

# Request models
class URLRequest(BaseModel):
    url: str

class AnalysisRequest(BaseModel):
    policy_text: str

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint for health checks and basic API information."""
    return {
        "status": "ok",
        "message": "Privacy Browser Backend API",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "health": "/health",
            "test": "/test-simple",
            "fetch_policy": "/fetch-privacy-policy",
            "analyze_direct": "/analyze-direct-policy"
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
    """Fast privacy policy fetching optimized for production speed"""
    return await fetch_privacy_policy_fast(request, http_request)

@app.post("/analyze-direct-policy")
async def analyze_direct_policy(request: AnalysisRequest, http_request: Request):
    """Analyze privacy policy text directly (basic analysis without LLM)"""
    client_ip = http_request.client.host if http_request.client else "unknown"
    
    try:
        if not request.policy_text or len(request.policy_text.strip()) < 100:
            raise HTTPException(status_code=400, detail="Policy text is required and must be at least 100 characters")
        
        log_security_event("DIRECT_ANALYSIS_REQUEST", "Direct policy analysis requested", client_ip)
        
        # Basic privacy analysis without LLM
        analysis = analyze_policy_basic(request.policy_text)
        
        log_security_event("DIRECT_ANALYSIS_SUCCESS", "Direct analysis completed", client_ip)
        
        return {
            "success": True,
            "analysis": analysis,
            "method": "basic_analysis",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("DIRECT_ANALYSIS_ERROR", f"Analysis error: {str(e)[:100]}", client_ip)
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

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
    logger.info("Optimized for fast performance and minimal resource usage")
    
if __name__ == "__main__":
    import uvicorn
    
    # Get configuration
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("BACKEND_PORT", 8000)))
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "main_optimized:app",
        host=host,
        port=port,
        log_level="info",
        access_log=True
    )
