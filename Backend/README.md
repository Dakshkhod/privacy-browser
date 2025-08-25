# Privacy Browser Backend - Secure Edition 🛡️

A military-grade secure backend for privacy policy analysis with comprehensive protection against attacks and data breaches.

## 🔒 Security Features

### **Top-Class Security Implementation**
- **AES-256 Encryption**: All sensitive data encrypted with industry-standard encryption
- **PBKDF2 Key Derivation**: 100,000 iterations for maximum key security
- **JWT Session Management**: Secure token-based authentication
- **Rate Limiting**: Advanced protection against DoS and brute-force attacks
- **Request Validation**: Comprehensive input sanitization and validation
- **Security Headers**: Full OWASP-compliant HTTP security headers
- **Secure Logging**: Sanitized logs that never expose sensitive information
- **API Key Protection**: Multiple layers of API key security and validation

### **Attack Prevention**
- ✅ **XSS Protection**: Content Security Policy and input sanitization
- ✅ **SQL Injection**: Parameterized queries and input validation
- ✅ **CSRF Protection**: Secure token validation
- ✅ **DoS Protection**: Rate limiting and request size validation
- ✅ **Data Exposure**: Encrypted storage and sanitized logging
- ✅ **Man-in-the-Middle**: HTTPS enforcement and secure headers
- ✅ **Session Hijacking**: Secure JWT tokens with expiration

## 🚀 Quick Setup

### **1. Prerequisites**
```bash
# Python 3.8+ required
python --version

# Install Python dependencies
pip install -r requirements.txt

# Download spaCy language model
python -m spacy download en_core_web_sm
```

### **2. Secure Environment Setup**
```bash
# Run the secure setup script (IMPORTANT!)
python setup_environment.py
```

This script will:
- Generate cryptographically secure keys
- Create a protected `.env` file
- Set up proper security configurations
- Verify the security setup

### **3. Start the Server**
```bash
# Development
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Production
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000
```

## 🔑 Environment Variables

The setup script creates these secure variables:

| Variable | Purpose | Security Level |
|----------|---------|----------------|
| `OPENAI_API_KEY` | OpenAI API access | 🔴 **CRITICAL** |
| `SECRET_KEY` | Application secret | 🔴 **CRITICAL** |
| `ENCRYPTION_KEY` | Data encryption | 🔴 **CRITICAL** |
| `JWT_SECRET` | Token signing | 🔴 **CRITICAL** |
| `API_KEY_HASH_SALT` | Key validation | 🔴 **CRITICAL** |

**⚠️ NEVER expose these variables or commit them to version control!**

## 🛡️ Security Architecture

### **Multi-Layer Protection**
```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Rate Limiting & DoS Protection                           │
│ 2. Request Size & Content Validation                        │
│ 3. Input Sanitization & XSS Prevention                      │
│ 4. API Key Integrity Verification                           │
│ 5. AES-256 Data Encryption                                  │
│ 6. Secure Logging & Monitoring                              │
│ 7. HTTPS & Security Headers                                 │
└─────────────────────────────────────────────────────────────┘
```

### **API Key Security**
1. **Storage**: Never stored in plain text
2. **Validation**: PBKDF2 hash verification with salt
3. **Access**: Secure retrieval with integrity checks
4. **Logging**: Automatically sanitized from all logs
5. **Transport**: Always encrypted in transit

### **Data Protection**
- **In Transit**: HTTPS with security headers
- **At Rest**: AES-256 encryption for sensitive data
- **In Memory**: Secure key management and cleanup
- **In Logs**: Automatic sanitization of sensitive patterns

## 📊 API Endpoints

### **Core Endpoints**
- `GET /` - System status with security info
- `GET /health` - Health check endpoint
- `POST /fetch-privacy-policy` - Secure policy fetching
- `POST /analyze-policy` - AI-powered policy analysis

### **Security Features per Endpoint**
- Rate limiting: 100 requests/hour per IP
- Request validation and sanitization
- Comprehensive error handling
- Security event logging
- Automatic threat detection

## 🔍 Monitoring & Logging

### **Security Events Tracked**
- API key access attempts
- Rate limit violations
- Suspicious request patterns
- Authentication failures
- System security events

### **Log Files**
- `logs/privacy_browser.log` - Application logs
- `logs/security.log` - Security events
- All logs automatically sanitized

## 🚨 Security Alerts

The system monitors for:
- **Brute Force**: Multiple failed attempts
- **Rate Limiting**: Excessive requests
- **Suspicious Patterns**: XSS, SQL injection attempts
- **Invalid URLs**: Malformed or dangerous URLs
- **Large Requests**: DoS attempt indicators

## 🔧 Configuration

### **Rate Limiting**
```env
RATE_LIMIT_REQUESTS=100    # Requests per window
RATE_LIMIT_WINDOW=3600     # Window in seconds
```

### **Security Headers**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy: restrictive policy`

### **CORS Configuration**
```env
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CORS_CREDENTIALS=true
```

## 🚀 Production Deployment

### **Security Checklist**
- [ ] Use HTTPS in production
- [ ] Set `DEBUG_MODE=false`
- [ ] Configure proper CORS origins
- [ ] Set up log rotation
- [ ] Monitor security logs
- [ ] Regular security updates
- [ ] Backup encryption keys securely

### **Recommended Production Setup**
```bash
# Use environment variables for production
export BACKEND_HOST=0.0.0.0
export BACKEND_PORT=8000
export DEBUG_MODE=false
export ALLOWED_ORIGINS=https://yourdomain.com

# Start with Gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 🆘 Security Incident Response

### **If You Suspect a Breach**
1. **Immediate**: Stop the server
2. **Check**: Review security logs
3. **Rotate**: Generate new encryption keys
4. **Update**: Change OpenAI API key
5. **Monitor**: Watch for unusual activity

### **Emergency Commands**
```bash
# Generate new security keys
python setup_environment.py

# Check security logs
tail -f logs/security.log

# Monitor active connections
netstat -an | grep :8000
```

## 🤝 Contributing

Security contributions are welcome! Please:
1. Report security issues privately
2. Follow secure coding practices
3. Add security tests for new features
4. Update security documentation

## 📞 Support

For security-related questions:
- Check the security logs first
- Review this documentation
- Test with the setup script
- Ensure all environment variables are set

## ⚠️ Important Security Notes

1. **Never commit `.env` files** to version control
2. **Rotate keys regularly** in production
3. **Monitor security logs** for anomalies
4. **Keep dependencies updated** for security patches
5. **Use HTTPS** in production environments
6. **Backup encryption keys** securely and separately

## 📜 License

This secure implementation includes additional security measures and monitoring capabilities. Use responsibly and maintain security best practices.

---

**🛡️ Your API key is protected by military-grade security. No one can access it except through the secure backend proxy.** 