"""
Security Configuration Module.

- AES-256 encryption helpers
- Per-instance secret material (does not pollute os.environ in production)
- Strict prod-vs-dev enforcement: refuses to start in production without secrets
- SSRF-safe URL validation (`is_valid_url` resolves DNS and rejects private,
  loopback, link-local, reserved, multicast addresses)
"""

import os
import re
import socket
import base64
import secrets
import ipaddress
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from urllib.parse import urlparse

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import jwt

# Stdout/stderr logging only (Render captures these automatically).
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
security_logger = logging.getLogger('security')


REQUIRED_PROD_SECRETS = ('SECRET_KEY', 'ENCRYPTION_KEY', 'JWT_SECRET', 'API_KEY_HASH_SALT')


def _is_production() -> bool:
    env = (os.getenv('ENV') or os.getenv('ENVIRONMENT') or '').lower()
    if env in ('production', 'prod'):
        return True
    # Render sets RENDER=true on deploys.
    if os.getenv('RENDER', '').lower() in ('true', '1'):
        return True
    return False


class SecurityError(Exception):
    """Custom exception for security-related errors."""


class SecurityConfig:
    """Centralized security configuration with strict production posture."""

    def __init__(self):
        self._encryption_key: Optional[bytes] = None
        self._fernet: Optional[Fernet] = None
        self._secret_key: Optional[str] = None
        self._jwt_secret: Optional[str] = None
        self._salt: Optional[bytes] = None
        self._api_key_hash: Optional[str] = None
        self._production = _is_production()

        self._initialize_security()

    # ------------------------------------------------------------------
    # Bootstrap
    # ------------------------------------------------------------------
    def _initialize_security(self):
        try:
            self._validate_environment()
            self._setup_encryption()
            self._setup_api_key_protection()
            self._setup_jwt()
            security_logger.info("Security configuration initialized (production=%s)", self._production)
        except Exception as e:
            security_logger.critical("Failed to initialize security: %s", e)
            raise

    def _validate_environment(self):
        """Refuse to start in production without explicit secrets."""
        missing = [k for k in REQUIRED_PROD_SECRETS if not os.getenv(k)]
        if self._production and missing:
            raise RuntimeError(
                f"Refusing to start in production: missing required env vars: {missing}"
            )

        # In dev, generate ephemeral per-boot defaults but DO NOT mutate os.environ.
        # We keep them on the instance instead.
        self._secret_key = os.getenv('SECRET_KEY') or secrets.token_urlsafe(48)
        self._jwt_secret = os.getenv('JWT_SECRET') or secrets.token_urlsafe(48)
        salt_value = os.getenv('API_KEY_HASH_SALT') or secrets.token_urlsafe(32)
        self._salt = salt_value.encode() if isinstance(salt_value, str) else salt_value

        # Validate OpenAI API key format if user-provided.
        openai_key = os.getenv('OPENAI_API_KEY')
        if openai_key and not openai_key.startswith('sk-'):
            raise ValueError("Invalid OpenAI API key format")

    def _setup_encryption(self):
        try:
            encryption_key_value = os.getenv('ENCRYPTION_KEY', '') or secrets.token_urlsafe(48)

            # Allow base64-encoded 32-byte raw key.
            try:
                decoded = base64.b64decode(encryption_key_value, validate=True)
            except Exception:
                decoded = b''

            if len(decoded) == 32:
                derived_key = decoded
            else:
                password = encryption_key_value.encode() if isinstance(encryption_key_value, str) else encryption_key_value
                kdf = PBKDF2HMAC(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=self._salt or b'pbkdf2-default-salt',
                    iterations=100_000,
                )
                derived_key = kdf.derive(password)

            self._encryption_key = derived_key
            self._fernet = Fernet(base64.urlsafe_b64encode(derived_key))
        except Exception as e:
            security_logger.error("Encryption setup failed: %s", e)
            raise

    def _setup_api_key_protection(self):
        openai_key = os.getenv('OPENAI_API_KEY')
        if openai_key:
            self._api_key_hash = self._hash_api_key(openai_key)

    def _setup_jwt(self):
        # _jwt_secret already set in _validate_environment
        pass

    # ------------------------------------------------------------------
    # Public utilities
    # ------------------------------------------------------------------
    def _hash_api_key(self, api_key: str) -> str:
        return hashlib.pbkdf2_hmac('sha256', api_key.encode(), self._salt, 100_000).hex()

    def encrypt_sensitive_data(self, data: str) -> str:
        return base64.b64encode(self._fernet.encrypt(data.encode())).decode()

    def decrypt_sensitive_data(self, encrypted_data: str) -> str:
        decoded = base64.b64decode(encrypted_data.encode())
        return self._fernet.decrypt(decoded).decode()

    def get_openai_api_key(self) -> Optional[str]:
        return os.getenv('OPENAI_API_KEY') or None

    def generate_session_token(self, user_data: Dict[str, Any]) -> str:
        payload = {
            'user_data': user_data,
            'exp': datetime.utcnow() + timedelta(seconds=int(os.getenv('SESSION_TIMEOUT', '3600'))),
            'iat': datetime.utcnow(),
            'jti': secrets.token_hex(16),
        }
        return jwt.encode(payload, self._jwt_secret, algorithm='HS256')

    def validate_session_token(self, token: str) -> Dict[str, Any]:
        try:
            return jwt.decode(token, self._jwt_secret, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            raise SecurityError("Session token has expired")
        except jwt.InvalidTokenError:
            raise SecurityError("Invalid session token")

    def get_security_headers(self) -> Dict[str, str]:
        return {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': (
                "default-src 'self'; script-src 'self'; style-src 'self'; "
                "img-src 'self' data:; connect-src 'self'"
            ),
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        }

    def sanitize_log_data(self, data: str) -> str:
        try:
            patterns = [
                r'sk-[a-zA-Z0-9_-]{20,}',     # OpenAI / various sk- tokens
                r'gsk_[a-zA-Z0-9_-]{20,}',    # Groq tokens
                r'fc-[a-zA-Z0-9_-]{20,}',     # Firecrawl tokens
                r'Bearer\s+[a-zA-Z0-9._\-=]+',
                r'password["\']?\s*[:=]\s*["\']?[^"\'}\s]+',
                r'secret["\']?\s*[:=]\s*["\']?[^"\'}\s]+',
                r'token["\']?\s*[:=]\s*["\']?[^"\'}\s]+',
                r'api[_-]?key["\']?\s*[:=]\s*["\']?[^"\'}\s]+',
            ]
            sanitized = data or ''
            for p in patterns:
                sanitized = re.sub(p, '[REDACTED]', sanitized, flags=re.IGNORECASE)
            return sanitized
        except Exception:
            return (data or '')[:200]

    @property
    def rate_limit_config(self) -> Dict[str, int]:
        return {
            'requests': int(os.getenv('RATE_LIMIT_REQUESTS', '60')),
            'window': int(os.getenv('RATE_LIMIT_WINDOW', '3600')),
        }

    @property
    def cors_config(self) -> Dict[str, Any]:
        raw = os.getenv('ALLOWED_ORIGINS', '')
        origins = [o.strip() for o in raw.split(',') if o.strip()]
        # Sensible dev defaults — only used when ALLOWED_ORIGINS is unset.
        if not origins and not self._production:
            origins = ['http://localhost:5173', 'http://localhost:3000']

        credentials = os.getenv('CORS_CREDENTIALS', 'false').lower() == 'true'
        if credentials and '*' in origins:
            raise RuntimeError("Cannot combine ALLOWED_ORIGINS=* with CORS_CREDENTIALS=true")

        # Accept regex for chrome-extension origins via ALLOWED_ORIGIN_REGEX
        return {
            'allow_origins': origins,
            'allow_origin_regex': os.getenv('ALLOWED_ORIGIN_REGEX') or None,
            'allow_credentials': credentials,
            'allow_methods': ['GET', 'POST', 'OPTIONS'],
            'allow_headers': ['Content-Type'],
        }


# ----------------------------------------------------------------------
# SSRF-safe URL validation
# ----------------------------------------------------------------------
_BLOCKED_NETS = [
    ipaddress.ip_network(n) for n in (
        '0.0.0.0/8',
        '10.0.0.0/8',
        '100.64.0.0/10',          # CGNAT
        '127.0.0.0/8',
        '169.254.0.0/16',         # Link-local / cloud metadata
        '172.16.0.0/12',
        '192.0.0.0/24',
        '192.168.0.0/16',
        '198.18.0.0/15',
        '224.0.0.0/3',            # Multicast + reserved
        '::1/128',
        'fc00::/7',
        'fe80::/10',
        '::/128',
        '64:ff9b::/96',
    )
]


def _is_blocked_ip(ip: ipaddress._BaseAddress) -> bool:
    if ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_private:
        return True
    return any(ip in net for net in _BLOCKED_NETS)


def is_valid_url(url: str) -> bool:
    """Strict URL validation with SSRF protection.

    Rejects: javascript:/data:/file: schemes; hostnames that resolve to private,
    loopback, link-local, multicast, reserved, or cloud-metadata addresses.
    """
    if not url or not isinstance(url, str):
        return False

    url = url.strip()
    if len(url) > 2000:
        return False

    try:
        p = urlparse(url)
    except Exception:
        return False

    if p.scheme not in ('http', 'https'):
        return False

    host = (p.hostname or '').strip().lower()
    if not host:
        return False

    # Block well-known cloud-metadata hostnames + localhost aliases.
    blocked_hosts = {
        'localhost', 'localhost.localdomain', 'ip6-localhost',
        'metadata.google.internal', 'metadata.aws',
        'instance-data', 'metadata.azure.com',
    }
    if host in blocked_hosts:
        return False

    # Block raw IP literal that resolves to a private/reserved range.
    try:
        ip_obj = ipaddress.ip_address(host)
        return not _is_blocked_ip(ip_obj)
    except ValueError:
        pass  # not an IP literal — DNS check below.

    # Resolve all A/AAAA records and reject if any is private.
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for family, *_, sockaddr in infos:
        try:
            ip_obj = ipaddress.ip_address(sockaddr[0])
        except ValueError:
            continue
        if _is_blocked_ip(ip_obj):
            return False

    return True


# ----------------------------------------------------------------------
# Global accessors
# ----------------------------------------------------------------------
security_config = SecurityConfig()


def get_security_config() -> SecurityConfig:
    return security_config


def log_security_event(event_type: str, details: str, ip_address: Optional[str] = None) -> None:
    try:
        sanitized = security_config.sanitize_log_data(details or '')
        security_logger.warning(
            "SECURITY_EVENT type=%s ip=%s details=%s", event_type, ip_address, sanitized
        )
    except Exception:
        security_logger.warning("SECURITY_EVENT type=%s ip=%s", event_type, ip_address)


def validate_request_size(content_length: int, max_size: int = None) -> None:
    if max_size is None:
        max_size = int(os.getenv('MAX_REQUEST_SIZE', '262144'))  # 256 KB default
    if content_length and content_length > max_size:
        raise SecurityError(f"Request too large: {content_length} bytes (max: {max_size})")


def generate_secure_filename(original_filename: str) -> str:
    safe_chars = re.sub(r'[^a-zA-Z0-9._-]', '_', original_filename or 'file')
    return safe_chars[:100]
