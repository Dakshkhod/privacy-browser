"""
Security Middleware for Privacy Browser Backend
Implements comprehensive security measures including rate limiting, request validation, and monitoring.
"""

import time
import json
from typing import Dict, Optional
from collections import defaultdict, deque
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
import asyncio
from datetime import datetime, timedelta
import ipaddress
import re

from security_config import get_security_config, log_security_event, validate_request_size, SecurityError, is_valid_url

security_config = get_security_config()

class RateLimiter:
    """
    Advanced rate limiting with sliding window and IP-based tracking.
    Prevents abuse and DoS attacks.
    """
    
    def __init__(self):
        self.requests: Dict[str, deque] = defaultdict(lambda: deque())
        self.blocked_ips: Dict[str, datetime] = {}
        self.config = security_config.rate_limit_config
        
    def is_allowed(self, client_ip: str) -> tuple[bool, Optional[str]]:
        """Check if request is allowed based on rate limiting rules."""
        current_time = time.time()
        
        # Check if IP is temporarily blocked
        if client_ip in self.blocked_ips:
            if datetime.now() < self.blocked_ips[client_ip]:
                return False, "IP temporarily blocked due to rate limit violation"
            else:
                del self.blocked_ips[client_ip]
        
        # Clean old requests outside the window
        window_start = current_time - self.config['window']
        request_times = self.requests[client_ip]
        
        while request_times and request_times[0] < window_start:
            request_times.popleft()
        
        # Check if within rate limit
        if len(request_times) >= self.config['requests']:
            # Block IP for 15 minutes on rate limit violation
            self.blocked_ips[client_ip] = datetime.now() + timedelta(minutes=15)
            log_security_event("RATE_LIMIT_EXCEEDED", f"IP blocked for 15 minutes", client_ip)
            return False, f"Rate limit exceeded: {self.config['requests']} requests per {self.config['window']} seconds"
        
        # Add current request
        request_times.append(current_time)
        return True, None

class SecurityMiddleware:
    """
    Comprehensive security middleware that handles all security aspects.
    """
    
    def __init__(self):
        self.rate_limiter = RateLimiter()
        self.suspicious_patterns = [
            r'<script[^>]*>.*?</script>',  # XSS attempts
            r'union\s+select',  # SQL injection
            r'drop\s+table',  # SQL injection
            r'exec\s*\(',  # Command injection
            r'eval\s*\(',  # Code injection
            r'javascript:',  # JavaScript protocol
            r'data:text/html',  # Data URI XSS
        ]
        
    async def __call__(self, request: Request, call_next):
        """Main middleware function."""
        start_time = time.time()
        client_ip = self._get_client_ip(request)
        
        try:
            # 1. Validate request size
            content_length = int(request.headers.get('content-length', 0))
            if content_length > 0:
                validate_request_size(content_length)
            
            # 2. Rate limiting
            allowed, rate_limit_msg = self.rate_limiter.is_allowed(client_ip)
            if not allowed:
                log_security_event("RATE_LIMIT_BLOCKED", rate_limit_msg, client_ip)
                return JSONResponse(
                    status_code=429,
                    content={"error": "Too Many Requests", "detail": rate_limit_msg},
                    headers=self._get_security_headers()
                )
            
            # 3. Input validation and sanitization
            await self._validate_request_content(request, client_ip)
            
            # 4. Process request
            response = await call_next(request)
            
            # 5. Add security headers
            self._add_security_headers(response)
            
            # 6. Log successful request
            duration = time.time() - start_time
            if duration > 10:  # Log slow requests
                log_security_event("SLOW_REQUEST", f"Request took {duration:.2f}s", client_ip)
            
            return response
            
        except SecurityError as e:
            log_security_event("SECURITY_VIOLATION", str(e), client_ip)
            return JSONResponse(
                status_code=400,
                content={"error": "Security Violation", "detail": str(e)},
                headers=self._get_security_headers()
            )
        except Exception as e:
            log_security_event("MIDDLEWARE_ERROR", f"Unexpected error: {str(e)}", client_ip)
            return JSONResponse(
                status_code=500,
                content={"error": "Internal Server Error"},
                headers=self._get_security_headers()
            )
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address with proxy support."""
        # Check for forwarded headers (be careful with these in production)
        forwarded_for = request.headers.get('x-forwarded-for')
        if forwarded_for:
            # Take the first IP in the chain
            ip = forwarded_for.split(',')[0].strip()
            try:
                # Validate IP address
                ipaddress.ip_address(ip)
                return ip
            except ValueError:
                pass
        
        # Check real IP header
        real_ip = request.headers.get('x-real-ip')
        if real_ip:
            try:
                ipaddress.ip_address(real_ip)
                return real_ip
            except ValueError:
                pass
        
        # Fallback to direct client
        return request.client.host if request.client else "unknown"
    
    async def _validate_request_content(self, request: Request, client_ip: str):
        """Validate and sanitize request content."""
        # Check URL path for suspicious patterns
        path = str(request.url.path)
        for pattern in self.suspicious_patterns:
            if re.search(pattern, path, re.IGNORECASE):
                raise SecurityError(f"Suspicious pattern detected in URL: {pattern}")
        
        # Validate query parameters
        for key, value in request.query_params.items():
            self._validate_parameter(key, value, "query")
        
        # Validate request body for POST requests
        if request.method == "POST":
            try:
                # Read body once and store it
                body = await request.body()
                if body:
                    # Try to parse as JSON
                    try:
                        json_data = json.loads(body.decode())
                        self._validate_json_data(json_data)
                    except json.JSONDecodeError:
                        # Not JSON, validate as string
                        body_str = body.decode()
                        self._validate_string_content(body_str, "request_body")
            except Exception as e:
                raise SecurityError(f"Request body validation failed: {str(e)}")
    
    def _validate_parameter(self, key: str, value: str, param_type: str):
        """Validate individual parameters."""
        # Check for suspicious patterns
        for pattern in self.suspicious_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                raise SecurityError(f"Suspicious pattern in {param_type} parameter '{key}': {pattern}")
        
        # Validate URLs if parameter looks like a URL
        if key.lower() in ['url', 'link', 'href'] or value.startswith(('http://', 'https://')):
            if not is_valid_url(value):
                raise SecurityError(f"Invalid URL in parameter '{key}': {value}")
    
    def _validate_json_data(self, data):
        """Recursively validate JSON data."""
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, str):
                    self._validate_string_content(value, f"json_field_{key}")
                elif isinstance(value, (dict, list)):
                    self._validate_json_data(value)
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, str):
                    self._validate_string_content(item, "json_array_item")
                elif isinstance(item, (dict, list)):
                    self._validate_json_data(item)
    
    def _validate_string_content(self, content: str, context: str):
        """Validate string content for suspicious patterns."""
        for pattern in self.suspicious_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                raise SecurityError(f"Suspicious pattern in {context}: {pattern}")
        
        # Additional length checks
        if len(content) > 50000:  # 50KB limit for individual strings
            raise SecurityError(f"String too long in {context}: {len(content)} characters")
    
    def _get_security_headers(self) -> Dict[str, str]:
        """Get security headers for responses."""
        return security_config.get_security_headers()
    
    def _add_security_headers(self, response: Response):
        """Add security headers to response."""
        headers = self._get_security_headers()
        for key, value in headers.items():
            response.headers[key] = value

class RequestLoggingMiddleware:
    """
    Secure request logging middleware that logs important events without exposing sensitive data.
    """
    
    async def __call__(self, request: Request, call_next):
        """Log requests securely."""
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        
        # Log request start (only non-sensitive info)
        request_info = {
            "method": request.method,
            "path": str(request.url.path),
            "ip": client_ip,
            "user_agent": request.headers.get("user-agent", "")[:200],  # Limit length
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Sanitize user agent
        request_info["user_agent"] = security_config.sanitize_log_data(request_info["user_agent"])
        
        try:
            response = await call_next(request)
            
            # Log successful response
            duration = time.time() - start_time
            response_info = {
                **request_info,
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2)
            }
            
            # Log to appropriate level based on status code
            if response.status_code >= 500:
                log_security_event("SERVER_ERROR", json.dumps(response_info), client_ip)
            elif response.status_code >= 400:
                log_security_event("CLIENT_ERROR", json.dumps(response_info), client_ip)
            
            return response
            
        except Exception as e:
            # Log error
            duration = time.time() - start_time
            error_info = {
                **request_info,
                "error": str(e)[:500],  # Limit error message length
                "duration_ms": round(duration * 1000, 2)
            }
            
            log_security_event("REQUEST_ERROR", json.dumps(error_info), client_ip)
            raise

# Global middleware instances
security_middleware = SecurityMiddleware()
logging_middleware = RequestLoggingMiddleware()

def get_security_middleware():
    """Get the security middleware instance."""
    return security_middleware

def get_logging_middleware():
    """Get the logging middleware instance."""
    return logging_middleware 