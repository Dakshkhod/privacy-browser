"""
Fast replacement for the main privacy policy endpoint
"""
from fastapi import Request, HTTPException
import time
import logging
from fast_fetcher import fast_fetcher
from security_config import is_valid_url, log_security_event

logger = logging.getLogger(__name__)

async def fetch_privacy_policy_fast(request, http_request: Request):
    """Fast privacy policy fetching optimized for production speed"""
    client_ip = http_request.client.host if http_request.client else "unknown"
    start_time = time.time()
    
    try:
        # Validate URL
        if not request.url or not request.url.strip():
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Security validation
        if not is_valid_url(request.url):
            log_security_event("INVALID_URL", f"Invalid URL submitted: {request.url}", client_ip)
            raise HTTPException(status_code=400, detail="Invalid URL format")
        
        log_security_event("POLICY_FETCH_REQUEST", f"Fast privacy policy fetch requested for: {request.url}", client_ip)
        
        # Use fast fetcher for optimal performance
        result = await fast_fetcher.fetch_privacy_policy(request.url)
        
        if result['success']:
            total_time = time.time() - start_time
            log_security_event("POLICY_FETCH_SUCCESS", 
                             f"Fast fetcher found privacy policy for: {request.url} in {total_time:.2f}s", 
                             client_ip)
            return {
                'success': True,
                'policy_text': result['policy_text'],
                'policy_url': result['policy_url'],
                'method': result.get('method', 'fast_fetcher'),
                'fetch_time': total_time,
                'privacy_score': result.get('privacy_score', 0),
                'content_length': len(result['policy_text'])
            }
        
        # If fast fetcher fails
        total_time = time.time() - start_time
        log_security_event("POLICY_FETCH_FAILED", 
                          f"Fast fetcher failed for: {request.url} in {total_time:.2f}s - {result.get('error', 'Unknown error')}", 
                          client_ip)
        raise HTTPException(status_code=404, detail=f"Privacy policy not found: {result.get('error', 'No policy detected')}")
        
    except HTTPException:
        raise
    except Exception as e:
        total_time = time.time() - start_time
        log_security_event("POLICY_FETCH_ERROR", f"Unexpected error for {request.url} after {total_time:.2f}s: {str(e)}", client_ip)
        raise HTTPException(status_code=500, detail=f"Error fetching privacy policy: {str(e)}")
