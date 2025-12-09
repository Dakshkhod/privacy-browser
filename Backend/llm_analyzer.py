"""
LLM-Powered Privacy Policy Analyzer
Uses Groq API (free tier: 30 requests/minute)
Provides comprehensive analysis of privacy policies
"""

import os
import json
import logging
from typing import Dict, Optional, List
import re

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not required if env vars are set elsewhere

logger = logging.getLogger(__name__)

# Try to import Groq
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    logger.warning("Groq not available - install with: pip install groq")


class LLMPrivacyAnalyzer:
    """Advanced privacy policy analyzer using Groq's free LLM API"""
    
    def __init__(self):
        self.groq_client = None
        self.groq_available = False
        
        # Initialize Groq if API key is available
        if GROQ_AVAILABLE:
            api_key = os.getenv('GROQ_API_KEY')
            if api_key:
                # Try multiple initialization methods for compatibility
                # Method 1: Try with api_key as keyword argument
                try:
                    self.groq_client = Groq(api_key=api_key)
                    self.groq_available = True
                    logger.info("Groq LLM initialized successfully (method 1: keyword arg)")
                except Exception as e1:
                    logger.debug(f"Method 1 failed: {e1}")
                    # Method 2: Try with api_key as positional argument
                    try:
                        self.groq_client = Groq(api_key)
                        self.groq_available = True
                        logger.info("Groq LLM initialized successfully (method 2: positional arg)")
                    except Exception as e2:
                        logger.debug(f"Method 2 failed: {e2}")
                        # Method 3: Try with no arguments and set API key via environment
                        # Some versions require API key to be set via environment variable
                        original_key = os.environ.get('GROQ_API_KEY')
                        os.environ['GROQ_API_KEY'] = api_key
                        try:
                            self.groq_client = Groq()
                            self.groq_available = True
                            logger.info("Groq LLM initialized successfully (method 3: env var)")
                            # Restore original environment variable value on success
                            if original_key is not None:
                                os.environ['GROQ_API_KEY'] = original_key
                            else:
                                # If it didn't exist, remove it to restore original state
                                os.environ.pop('GROQ_API_KEY', None)
                        except Exception as e3:
                            # Restore original environment variable on failure
                            if original_key is not None:
                                os.environ['GROQ_API_KEY'] = original_key
                            else:
                                # If it didn't exist, remove it to restore original state
                                os.environ.pop('GROQ_API_KEY', None)
                            logger.warning(f"Groq initialization failed with all 3 methods. Method 1: {e1}, Method 2: {e2}, Method 3: {e3}")
                            self.groq_available = False
            else:
                logger.info("Groq API key not found. Get one free at: https://console.groq.com")
    
    async def analyze_policy(self, policy_text: str, website_url: Optional[str] = None) -> Dict:
        """
        Analyze privacy policy using LLM (Groq) or enhanced heuristics as fallback
        
        Returns comprehensive analysis including:
        - Data types collected (detailed breakdown)
        - Risk level
        - User rights
        - Third-party sharing
        - Data retention
        - Security measures
        """
        
        # Try Groq first if available
        if self.groq_available and self.groq_client:
            try:
                return await self._analyze_with_groq(policy_text, website_url)
            except Exception as e:
                logger.warning(f"Groq analysis failed, falling back to enhanced heuristics: {e}")
        
        # Fallback to enhanced heuristic analysis
        return self._analyze_with_enhanced_heuristics(policy_text, website_url)
    
    async def _analyze_with_groq(self, policy_text: str, website_url: Optional[str] = None) -> Dict:
        """Analyze using Groq's LLM (llama-3.3-70b-versatile - FREE)"""
        
        # Truncate policy text to fit in context (Groq free tier has limits)
        max_chars = 15000  # Leave room for prompt and response
        truncated_text = policy_text[:max_chars]
        if len(policy_text) > max_chars:
            truncated_text += "\n\n[... policy continues ...]"
        
        prompt = f"""Analyze this privacy policy and provide a comprehensive JSON response.

Privacy Policy Text:
{truncated_text}

Provide analysis in this exact JSON format:
{{
    "data_types_collected": {{
        "personal_info": {{"collected": true/false, "details": ["list", "of", "items"], "severity": 1-5}},
        "contact": {{"collected": true/false, "details": ["list"], "severity": 1-5}},
        "location": {{"collected": true/false, "details": ["list"], "severity": 1-5}},
        "device_info": {{"collected": true/false, "details": ["list"], "severity": 1-5}},
        "usage_data": {{"collected": true/false, "details": ["list"], "severity": 1-5}},
        "financial": {{"collected": true/false, "details": ["list"], "severity": 1-5}},
        "biometric": {{"collected": true/false, "details": ["list"], "severity": 1-5}},
        "health": {{"collected": true/false, "details": ["list"], "severity": 1-5}},
        "social": {{"collected": true/false, "details": ["list"], "severity": 1-5}},
        "behavioral": {{"collected": true/false, "details": ["list"], "severity": 1-5}}
    }},
    "third_party_sharing": {{
        "shares_data": true/false,
        "recipients": ["list", "of", "recipients"],
        "purposes": ["list", "of", "purposes"],
        "severity": 1-5
    }},
    "user_rights": {{
        "access": true/false,
        "deletion": true/false,
        "correction": true/false,
        "opt_out": true/false,
        "portability": true/false,
        "details": "brief description"
    }},
    "data_retention": {{
        "specified": true/false,
        "duration": "duration if specified",
        "details": "brief description"
    }},
    "security_measures": {{
        "encryption": true/false,
        "details": ["list", "of", "measures"],
        "adequate": true/false
    }},
    "dark_patterns": {{
        "detected": true/false,
        "patterns": [
            {{
                "type": "vague_language/unlimited_retention/broad_sharing/unclear_optout/weak_consent",
                "severity": "high/medium/low",
                "title": "Brief title with emoji",
                "description": "Description of the dark pattern",
                "examples": ["quotes from policy"],
                "recommendation": "What user should do"
            }}
        ],
        "severity": "critical/high/medium/low/none"
    }},
    "risk_level": "Low/Medium/High/Critical",
    "risk_factors": ["list", "of", "specific", "concerns"],
    "positive_aspects": ["list", "of", "good", "practices"],
    "summary": "2-3 sentence summary of key points",
    "confidence": "High/Medium/Low"
}}

Look for dark patterns including: vague language (may/might/sometimes), unlimited retention, broad partner sharing, unclear opt-out, and weak/implied consent.
Be thorough and specific. Focus on actual data collection practices."""

        try:
            # Call Groq API (using fastest free model)
            chat_completion = self.groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a privacy policy analysis expert. Provide detailed, accurate analysis in JSON format."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model="llama-3.3-70b-versatile",  # Free tier, very capable
                temperature=0.3,  # Lower temperature for more consistent output
                max_tokens=2000,  # Enough for detailed analysis
                response_format={"type": "json_object"}  # Force JSON response
            )
            
            # Parse response
            response_text = chat_completion.choices[0].message.content
            analysis = json.loads(response_text)
            
            # Normalize data_types format for UI compatibility
            analysis = self._normalize_groq_response(analysis)
            
            # Add metadata
            analysis['analysis_method'] = 'groq_llm'
            analysis['model'] = 'llama-3.3-70b-versatile'
            analysis['website_url'] = website_url
            
            logger.info("✅ Groq LLM analysis completed successfully")
            return analysis
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq response as JSON: {e}")
            raise
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            raise
    
    def _normalize_groq_response(self, analysis: Dict) -> Dict:
        """Normalize Groq LLM response to match UI expected format"""
        
        # Convert data_types_collected to simplified data_types format
        if 'data_types_collected' in analysis and 'data_types' not in analysis:
            data_types = {}
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
                'behavioral': 'Behavioral Data',
                'communication': 'Communication Data',
                'media': 'Media Data',
                'camera': 'Camera Data',
                'microphone': 'Audio Data',
                'cookies': 'Cookies & Tracking',
                'advertising': 'Advertising Data'
            }
            
            for key, value in analysis['data_types_collected'].items():
                if isinstance(value, dict) and value.get('collected', False):
                    friendly_name = friendly_names.get(key, key.replace('_', ' ').title())
                    severity = value.get('severity', 3)
                    details = value.get('details', [])
                    data_types[friendly_name] = {
                        'severity': severity,
                        'details': details
                    }
                elif isinstance(value, (int, float)) and value > 0:
                    friendly_name = friendly_names.get(key, key.replace('_', ' ').title())
                    data_types[friendly_name] = {
                        'severity': value,
                        'details': []
                    }
            
            analysis['data_types'] = data_types
        
        # Normalize user_rights to array format if needed
        if 'user_rights' in analysis and isinstance(analysis['user_rights'], dict):
            rights_list = []
            rights_map = {
                'access': 'Access your data',
                'deletion': 'Request deletion',
                'correction': 'Correct inaccuracies',
                'opt_out': 'Opt-out of marketing',
                'portability': 'Data portability',
                'restriction': 'Restrict processing',
                'objection': 'Object to processing'
            }
            for right, granted in analysis['user_rights'].items():
                if granted and right in rights_map:
                    rights_list.append(rights_map[right])
            analysis['user_rights_list'] = rights_list
        
        # Ensure warnings array exists
        if 'risk_factors' in analysis and 'warnings' not in analysis:
            analysis['warnings'] = analysis['risk_factors']
        
        # Normalize summary
        if 'summary' not in analysis or not isinstance(analysis['summary'], dict):
            summary = analysis.get('summary', '')
            if isinstance(summary, str):
                analysis['summary'] = {
                    'your_rights': analysis.get('user_rights_list', []),
                    'security': [],
                    'compliance': 'See analysis'
                }
            else:
                analysis['summary'] = {'your_rights': [], 'security': [], 'compliance': 'See analysis'}
        
        return analysis
    
    def _analyze_with_enhanced_heuristics(self, policy_text: str, website_url: Optional[str] = None) -> Dict:
        """Enhanced heuristic analysis with comprehensive data type detection"""
        
        text_lower = policy_text.lower()
        
        # Detailed data type detection
        data_types = {
            "personal_info": self._detect_personal_info(text_lower),
            "contact": self._detect_contact_info(text_lower),
            "location": self._detect_location_data(text_lower),
            "device_info": self._detect_device_info(text_lower),
            "usage_data": self._detect_usage_data(text_lower),
            "financial": self._detect_financial_data(text_lower),
            "biometric": self._detect_biometric_data(text_lower),
            "health": self._detect_health_data(text_lower),
            "social": self._detect_social_data(text_lower),
            "behavioral": self._detect_behavioral_data(text_lower),
            "cookies_tracking": self._detect_cookies_tracking(text_lower),
            "children_data": self._detect_children_data(text_lower)
        }
        
        # Third-party sharing analysis
        third_party = self._detect_third_party_sharing(text_lower)
        
        # User rights detection
        user_rights = self._detect_user_rights(text_lower)
        
        # Data retention
        data_retention = self._detect_data_retention(text_lower)
        
        # Security measures
        security = self._detect_security_measures(text_lower)
        
        # Dark patterns detection
        dark_patterns = self._detect_dark_patterns(text_lower)
        
        # Calculate risk level
        risk_level, risk_factors = self._calculate_risk_level(
            data_types, third_party, user_rights, security
        )
        
        # Add dark pattern warnings to risk factors
        if dark_patterns['detected']:
            for pattern in dark_patterns['patterns']:
                if pattern['severity'] == 'high':
                    risk_factors.append(f"Dark Pattern: {pattern['title']}")
        
        # Find positive aspects
        positive_aspects = self._find_positive_aspects(
            user_rights, security, data_retention
        )
        
        # Generate summary
        summary = self._generate_summary(data_types, third_party, user_rights, risk_level)
        
        return {
            "data_types_collected": data_types,
            "third_party_sharing": third_party,
            "user_rights": user_rights,
            "data_retention": data_retention,
            "security_measures": security,
            "dark_patterns": dark_patterns,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "positive_aspects": positive_aspects,
            "summary": summary,
            "confidence": "Medium",
            "analysis_method": "enhanced_heuristics",
            "website_url": website_url
        }
    
    def _detect_personal_info(self, text: str) -> Dict:
        """Detect personal information collection with enhanced patterns"""
        terms = {
            'name': ['full name', 'first name', 'last name', 'username', 'legal name', 'real name', 
                     'display name', 'nickname', 'alias', 'name you provide', 'your name'],
            'email': ['email address', 'e-mail', 'email id', 'electronic mail', 'contact email',
                      'your email', 'email you provide'],
            'phone': ['phone number', 'telephone', 'mobile number', 'cell phone', 'contact number',
                      'sms', 'text message', 'mobile phone', 'landline', 'phone you provide'],
            'address': ['postal address', 'mailing address', 'street address', 'physical address',
                        'home address', 'billing address', 'shipping address', 'residential address',
                        'delivery address', 'zip code', 'postal code', 'city', 'state', 'country'],
            'age': ['date of birth', 'age', 'birthday', 'birth date', 'dob', 'year of birth',
                    'age range', 'how old'],
            'gender': ['gender', 'sex', 'male or female', 'gender identity', 'pronouns'],
            'government_id': ['government id', 'passport', 'driver license', 'ssn', 'social security',
                              'national id', 'tax id', 'identification number', 'id card', 'ein',
                              'voter id', 'aadhaar', 'pan card', 'national insurance'],
            'photo': ['profile photo', 'profile picture', 'avatar', 'photograph', 'selfie',
                      'photo id', 'face image', 'your photo', 'picture you upload'],
            'signature': ['signature', 'electronic signature', 'e-signature', 'digital signature'],
            'employment': ['employer', 'job title', 'occupation', 'workplace', 'company name',
                           'professional information', 'work history', 'employment status'],
            'education': ['education', 'school', 'university', 'college', 'degree', 'academic'],
            'marital': ['marital status', 'spouse', 'family status', 'dependents']
        }
        
        details = []
        severity = 0
        severity_weights = {'government_id': 3, 'photo': 2, 'signature': 2, 'address': 1}
        
        for category, keywords in terms.items():
            if any(keyword in text for keyword in keywords):
                details.append(category)
                severity += severity_weights.get(category, 1)
        
        return {
            "collected": len(details) > 0,
            "details": details,
            "severity": min(severity, 5)
        }
    
    def _detect_contact_info(self, text: str) -> Dict:
        """Detect contact information collection"""
        keywords = ['email', 'phone', 'contact', 'telephone', 'address', 'messaging']
        count = sum(1 for kw in keywords if kw in text)
        
        return {
            "collected": count > 0,
            "details": ["email", "phone", "address"] if count > 2 else ["email"] if count > 0 else [],
            "severity": min(count, 5)
        }
    
    def _detect_location_data(self, text: str) -> Dict:
        """Detect location data collection with enhanced patterns"""
        keywords = ['location', 'gps', 'geolocation', 'ip address', 'geographic', 'coordinates', 
                   'whereabouts', 'latitude', 'longitude', 'region', 'timezone', 'time zone',
                   'country', 'locale', 'area', 'neighborhood', 'proximity', 'nearby',
                   'location history', 'places you visit', 'where you are', 'wifi location',
                   'cell tower', 'beacon', 'check-in', 'geo-tag', 'location services']
        precise_keywords = ['precise location', 'exact location', 'gps', 'coordinates', 
                           'real-time location', 'continuous location', 'background location',
                           'latitude', 'longitude', 'location tracking']
        
        count = sum(1 for kw in keywords if kw in text)
        precise = any(kw in text for kw in precise_keywords)
        
        details = []
        if precise:
            details.append("precise location (GPS)")
        if 'ip address' in text or 'ip-based' in text:
            details.append("IP-based location")
        if 'geolocation' in text or 'geographic' in text:
            details.append("geolocation data")
        if 'wifi' in text or 'cell tower' in text or 'beacon' in text:
            details.append("network-based location")
        if 'location history' in text or 'places you visit' in text:
            details.append("location history")
        if 'timezone' in text or 'time zone' in text:
            details.append("timezone/region")
        
        return {
            "collected": count > 0,
            "details": details if details else ["location data"] if count > 0 else [],
            "severity": 5 if precise else min(count + 1, 4)
        }
    
    def _detect_device_info(self, text: str) -> Dict:
        """Detect device information collection with enhanced patterns"""
        keywords = ['device', 'browser', 'operating system', 'hardware', 'device id', 'imei',
                   'mac address', 'device model', 'screen resolution', 'user agent',
                   'device type', 'mobile device', 'tablet', 'desktop', 'device fingerprint',
                   'advertising id', 'idfa', 'gaid', 'android id', 'device token',
                   'push token', 'hardware id', 'serial number', 'cpu', 'memory',
                   'storage', 'battery', 'sensor data', 'accelerometer', 'gyroscope']
        
        details = []
        if any(x in text for x in ['device id', 'imei', 'mac address', 'device fingerprint',
                                    'advertising id', 'idfa', 'gaid', 'android id']):
            details.append("device identifiers")
        if 'browser' in text or 'user agent' in text:
            details.append("browser information")
        if 'operating system' in text or 'os version' in text:
            details.append("OS information")
        if any(x in text for x in ['hardware', 'device model', 'cpu', 'memory', 'storage']):
            details.append("hardware specifications")
        if any(x in text for x in ['sensor', 'accelerometer', 'gyroscope', 'motion']):
            details.append("sensor data")
        if 'screen' in text or 'display' in text or 'resolution' in text:
            details.append("screen/display info")
        
        count = len(details)
        has_fingerprint = 'fingerprint' in text or 'advertising id' in text
        
        return {
            "collected": count > 0,
            "details": details,
            "severity": 5 if has_fingerprint else min(count + 1, 4)
        }
    
    def _detect_usage_data(self, text: str) -> Dict:
        """Detect usage data collection with enhanced patterns"""
        keywords = ['usage', 'activity', 'interaction', 'behavior', 'browsing', 'clicks',
                   'views', 'session', 'engagement', 'analytics', 'page views', 'time spent',
                   'frequency', 'features you use', 'actions you take', 'how you use',
                   'usage patterns', 'app usage', 'service usage', 'usage statistics',
                   'log data', 'access logs', 'error logs', 'performance data', 'crash data']
        
        count = sum(1 for kw in keywords if kw in text)
        
        details = []
        if 'browsing' in text or 'pages' in text or 'visited' in text:
            details.append("browsing history")
        if any(x in text for x in ['clicks', 'tap', 'interaction', 'actions']):
            details.append("interaction data")
        if 'analytics' in text or 'statistics' in text:
            details.append("analytics data")
        if 'session' in text or 'time spent' in text or 'duration' in text:
            details.append("session information")
        if any(x in text for x in ['search', 'query', 'searched']):
            details.append("search history")
        if any(x in text for x in ['log', 'error', 'crash', 'performance']):
            details.append("log/diagnostic data")
        if 'feature' in text or 'how you use' in text:
            details.append("feature usage")
        
        return {
            "collected": count > 0,
            "details": details if details else ["usage patterns"] if count > 0 else [],
            "severity": min(count, 5)
        }
    
    def _detect_financial_data(self, text: str) -> Dict:
        """Detect financial data collection with enhanced patterns"""
        keywords = ['credit card', 'debit card', 'payment', 'financial', 'bank account',
                   'transaction', 'billing', 'purchase history', 'payment method',
                   'wallet', 'paypal', 'venmo', 'stripe', 'credit score', 'income',
                   'salary', 'revenue', 'cryptocurrency', 'bitcoin', 'crypto wallet',
                   'routing number', 'account number', 'cvv', 'expiration date', 'iban']
        
        details = []
        severity = 0
        
        if any(x in text for x in ['credit card', 'debit card', 'payment card', 'cvv', 'card number']):
            details.append("payment card information")
            severity += 3
        if any(x in text for x in ['bank account', 'routing number', 'account number', 'iban']):
            details.append("bank account details")
            severity += 3
        if 'transaction' in text or 'purchase history' in text or 'order history' in text:
            details.append("transaction history")
            severity += 2
        if 'billing' in text or 'invoice' in text:
            details.append("billing information")
            severity += 1
        if any(x in text for x in ['income', 'salary', 'earnings', 'revenue', 'credit score']):
            details.append("income/financial status")
            severity += 2
        if any(x in text for x in ['cryptocurrency', 'bitcoin', 'crypto', 'wallet address']):
            details.append("cryptocurrency data")
            severity += 2
        if any(x in text for x in ['paypal', 'venmo', 'stripe', 'payment method']):
            details.append("payment service accounts")
            severity += 1
        
        return {
            "collected": len(details) > 0,
            "details": details,
            "severity": min(severity, 5)
        }
    
    def _detect_biometric_data(self, text: str) -> Dict:
        """Detect biometric data collection with enhanced patterns"""
        keywords = ['biometric', 'fingerprint', 'face recognition', 'facial', 'voice',
                   'retina', 'iris', 'voiceprint', 'face id', 'touch id', 'palm print',
                   'hand geometry', 'vein pattern', 'gait analysis', 'keystroke dynamics',
                   'facial geometry', 'faceprint', 'voice recognition', 'speaker recognition',
                   'eye scan', 'facial scan', 'biometric template', 'biometric identifier']
        
        details = []
        if any(x in text for x in ['fingerprint', 'touch id', 'palm print']):
            details.append("fingerprint data")
        if any(x in text for x in ['face', 'facial', 'face id', 'faceprint']):
            details.append("facial recognition data")
        if any(x in text for x in ['voice', 'voiceprint', 'speaker recognition']):
            details.append("voice biometrics")
        if any(x in text for x in ['retina', 'iris', 'eye scan']):
            details.append("eye/retina scan")
        if 'biometric' in text and not details:
            details.append("biometric identifiers")
        
        return {
            "collected": len(details) > 0,
            "details": details,
            "severity": 5 if len(details) > 0 else 0
        }
    
    def _detect_health_data(self, text: str) -> Dict:
        """Detect health data collection with enhanced patterns"""
        keywords = ['health', 'medical', 'fitness', 'wellness', 'diagnosis', 'prescription',
                   'health condition', 'medical history', 'healthcare', 'doctor', 'hospital',
                   'treatment', 'medication', 'symptoms', 'disease', 'disability', 'allergy',
                   'blood type', 'genetic', 'dna', 'mental health', 'psychological',
                   'heart rate', 'blood pressure', 'steps', 'calories', 'sleep',
                   'weight', 'bmi', 'body measurements', 'reproductive health', 'pregnancy']
        
        details = []
        if any(x in text for x in ['medical', 'health condition', 'medical history', 'diagnosis', 'treatment']):
            details.append("medical records")
        if any(x in text for x in ['fitness', 'steps', 'calories', 'workout', 'exercise']):
            details.append("fitness/activity data")
        if any(x in text for x in ['heart rate', 'blood pressure', 'sleep', 'weight', 'bmi']):
            details.append("health metrics")
        if 'prescription' in text or 'medication' in text:
            details.append("prescription/medication data")
        if any(x in text for x in ['mental health', 'psychological', 'therapy', 'counseling']):
            details.append("mental health information")
        if any(x in text for x in ['genetic', 'dna', 'genome']):
            details.append("genetic information")
        if 'disability' in text or 'accommodation' in text:
            details.append("disability information")
        
        return {
            "collected": len(details) > 0,
            "details": details,
            "severity": 5 if len(details) > 0 else 0
        }
    
    def _detect_social_data(self, text: str) -> Dict:
        """Detect social data collection with enhanced patterns"""
        keywords = ['social', 'friends', 'contacts', 'connections', 'social network',
                   'social media', 'profile', 'followers', 'following', 'likes',
                   'posts', 'comments', 'messages', 'groups', 'communities',
                   'address book', 'phone contacts', 'facebook', 'twitter', 'instagram',
                   'linkedin', 'tiktok', 'social login', 'social sign-in', 'public profile']
        
        count = sum(1 for kw in keywords if kw in text)
        
        details = []
        if any(x in text for x in ['social media', 'social network', 'facebook', 'twitter', 'instagram']):
            details.append("social media connections")
        if any(x in text for x in ['contacts', 'friends', 'address book', 'phone contacts']):
            details.append("contact lists")
        if any(x in text for x in ['profile', 'public profile', 'bio']):
            details.append("social profile information")
        if any(x in text for x in ['posts', 'comments', 'likes', 'shares']):
            details.append("social activity/engagement")
        if any(x in text for x in ['followers', 'following', 'connections']):
            details.append("social graph")
        if any(x in text for x in ['messages', 'direct message', 'chat']):
            details.append("private messages")
        
        return {
            "collected": count > 0,
            "details": details if details else ["social data"] if count > 0 else [],
            "severity": min(count + 1, 5) if 'messages' in text else min(count, 4)
        }
    
    def _detect_behavioral_data(self, text: str) -> Dict:
        """Detect behavioral/profiling data collection with enhanced patterns"""
        keywords = ['profiling', 'preferences', 'interests', 'habits', 'patterns',
                   'targeting', 'personalization', 'recommendations', 'infer', 'predict',
                   'machine learning', 'ai', 'artificial intelligence', 'algorithm',
                   'automated decision', 'behavioral', 'audience', 'segment',
                   'lookalike', 'retargeting', 'remarketing', 'cross-device tracking']
        
        count = sum(1 for kw in keywords if kw in text)
        
        details = []
        if 'profiling' in text or 'profile' in text:
            details.append("user profiling")
        if any(x in text for x in ['preferences', 'interests', 'likes']):
            details.append("user preferences/interests")
        if any(x in text for x in ['targeting', 'retargeting', 'remarketing']):
            details.append("advertising targeting")
        if any(x in text for x in ['recommendations', 'personalization', 'personalize']):
            details.append("personalization data")
        if any(x in text for x in ['infer', 'predict', 'derive']):
            details.append("inferred information")
        if any(x in text for x in ['machine learning', 'ai', 'artificial intelligence', 'algorithm']):
            details.append("AI/ML processing")
        if any(x in text for x in ['automated decision', 'automated processing']):
            details.append("automated decision-making")
        
        return {
            "collected": count > 0,
            "details": details if details else ["behavioral data"] if count > 0 else [],
            "severity": min(count + 1, 5)
        }
    
    def _detect_third_party_sharing(self, text: str) -> Dict:
        """Detect third-party data sharing with enhanced patterns"""
        sharing_keywords = ['share', 'disclose', 'transfer', 'third party', 'third parties',
                           'partners', 'affiliates', 'service providers', 'vendors',
                           'data broker', 'sell your', 'sell personal', 'data sale',
                           'business transfer', 'merger', 'acquisition', 'bankruptcy',
                           'law enforcement', 'government', 'legal request', 'subpoena']
        
        shares_data = any(kw in text for kw in sharing_keywords)
        
        recipients = []
        if 'third party' in text or 'third parties' in text:
            recipients.append("third parties")
        if 'partners' in text or 'business partner' in text:
            recipients.append("business partners")
        if 'affiliates' in text or 'subsidiary' in text:
            recipients.append("affiliates/subsidiaries")
        if any(x in text for x in ['service providers', 'vendors', 'contractors']):
            recipients.append("service providers")
        if any(x in text for x in ['advertisers', 'advertising', 'ad network']):
            recipients.append("advertisers")
        if any(x in text for x in ['data broker', 'sell your', 'sell personal']):
            recipients.append("data brokers")
        if any(x in text for x in ['government', 'law enforcement', 'legal', 'court']):
            recipients.append("government/legal")
        if any(x in text for x in ['analytics', 'measurement']):
            recipients.append("analytics providers")
        
        purposes = []
        if any(x in text for x in ['marketing', 'advertising', 'promotional']):
            purposes.append("marketing/advertising")
        if 'analytics' in text or 'measurement' in text:
            purposes.append("analytics")
        if 'service' in text or 'operate' in text:
            purposes.append("service operation")
        if any(x in text for x in ['legal', 'comply', 'law enforcement']):
            purposes.append("legal compliance")
        if 'research' in text:
            purposes.append("research")
        if any(x in text for x in ['merger', 'acquisition', 'business transfer']):
            purposes.append("business transactions")
        
        severity = len(recipients) + len(purposes)
        has_sale = 'sell' in text and ('data' in text or 'personal' in text)
        
        return {
            "shares_data": shares_data,
            "recipients": recipients,
            "purposes": purposes,
            "severity": 5 if has_sale else min(severity, 5)
        }
    
    def _detect_user_rights(self, text: str) -> Dict:
        """Detect user rights with enhanced GDPR/CCPA patterns"""
        rights = {
            "access": any(x in text for x in ['access your', 'access to your', 'request access', 'right to access',
                                               'obtain a copy', 'access the data', 'view your']),
            "deletion": any(x in text for x in ['delete', 'deletion', 'remove', 'erase', 'right to be forgotten',
                                                  'request deletion', 'delete your account']),
            "correction": any(x in text for x in ['correct', 'update', 'modify', 'rectify', 'amend', 'change your',
                                                   'fix inaccuracies']),
            "opt_out": any(x in text for x in ['opt-out', 'opt out', 'unsubscribe', 'withdraw consent',
                                                'do not sell', 'stop receiving', 'disable']),
            "portability": any(x in text for x in ['portability', 'export', 'download your data', 'receive a copy',
                                                    'transfer your data', 'data portability']),
            "restriction": any(x in text for x in ['restrict', 'restriction', 'limit processing', 'stop processing']),
            "objection": any(x in text for x in ['object', 'objection', 'right to object', 'oppose']),
            "appeal": any(x in text for x in ['appeal', 'complaint', 'lodge a complaint', 'supervisory authority'])
        }
        
        rights_count = sum(1 for v in rights.values() if v)
        
        if rights_count >= 5:
            details = "Comprehensive user rights (GDPR/CCPA compliant)"
        elif rights_count >= 3:
            details = "Good user rights coverage"
        elif rights_count >= 1:
            details = "Basic user rights mentioned"
        else:
            details = "Limited or no user rights disclosed"
        
        rights["details"] = details
        return rights
    
    def _detect_cookies_tracking(self, text: str) -> Dict:
        """Detect cookies and tracking technologies"""
        keywords = ['cookie', 'cookies', 'tracking', 'pixel', 'beacon', 'web beacon',
                   'local storage', 'session storage', 'fingerprinting', 'tracker',
                   'google analytics', 'facebook pixel', 'advertising cookie',
                   'session cookie', 'persistent cookie', 'first-party cookie',
                   'third-party cookie', 'tracking technology', 'similar technologies',
                   'tag', 'sdk', 'clear gif', 'web bug', 'tracking pixel']
        
        count = sum(1 for kw in keywords if kw in text)
        
        details = []
        if any(x in text for x in ['session cookie', 'essential cookie', 'necessary cookie']):
            details.append("essential cookies")
        if any(x in text for x in ['analytics', 'google analytics', 'performance cookie']):
            details.append("analytics cookies")
        if any(x in text for x in ['advertising', 'marketing cookie', 'targeting cookie', 'facebook pixel']):
            details.append("advertising/tracking cookies")
        if any(x in text for x in ['third-party cookie', 'third party cookie']):
            details.append("third-party cookies")
        if any(x in text for x in ['fingerprint', 'device fingerprint']):
            details.append("device fingerprinting")
        if any(x in text for x in ['pixel', 'beacon', 'web beacon', 'tracking pixel']):
            details.append("tracking pixels/beacons")
        if any(x in text for x in ['local storage', 'session storage']):
            details.append("browser storage")
        
        has_advertising = any(x in text for x in ['advertising', 'marketing', 'targeting', 'retargeting'])
        
        return {
            "collected": count > 0,
            "details": details if details else ["cookies/tracking"] if count > 0 else [],
            "severity": 4 if has_advertising else min(count, 3)
        }
    
    def _detect_children_data(self, text: str) -> Dict:
        """Detect children's data collection practices"""
        keywords = ['children', 'child', 'minor', 'minors', 'coppa', 'under 13', 'under 16',
                   'parental consent', 'parent', 'guardian', "children's privacy",
                   'age verification', 'minimum age', 'kids', 'teen', 'adolescent']
        
        count = sum(1 for kw in keywords if kw in text)
        
        details = []
        collects_children = False
        
        # Check if they explicitly don't collect from children (positive)
        not_for_children = any(x in text for x in ['not intended for children', 'not directed to children',
                                                     'do not knowingly collect', 'not collect from children',
                                                     'not designed for children'])
        
        if any(x in text for x in ['parental consent', 'verifiable parental consent']):
            details.append("requires parental consent")
            collects_children = True
        if 'coppa' in text:
            details.append("COPPA compliance mentioned")
        if any(x in text for x in ['under 13', 'under 16', 'minimum age']):
            details.append("age restrictions specified")
        if not_for_children:
            details.append("not intended for children")
        
        return {
            "collected": collects_children,
            "not_for_children": not_for_children,
            "details": details if details else ["children's privacy mentioned"] if count > 0 else [],
            "severity": 5 if collects_children else 0
        }
    
    def _detect_data_retention(self, text: str) -> Dict:
        """Detect data retention information"""
        retention_keywords = ['retention', 'retain', 'keep', 'store', 'period', 'duration']
        time_keywords = ['days', 'months', 'years', 'indefinitely', 'until']
        
        specified = any(kw in text for kw in retention_keywords) and any(kw in text for kw in time_keywords)
        
        duration = "specified" if specified else "not clearly specified"
        if 'indefinitely' in text:
            duration = "indefinite"
        
        return {
            "specified": specified,
            "duration": duration,
            "details": "Data retention period is specified" if specified else "Data retention period not clearly specified"
        }
    
    def _detect_security_measures(self, text: str) -> Dict:
        """Detect security measures"""
        security_keywords = ['encryption', 'secure', 'security', 'protect', 'safeguard', 
                            'ssl', 'tls', 'https', 'firewall', 'access controls']
        
        measures = []
        if 'encryption' in text or 'encrypted' in text:
            measures.append("encryption")
        if 'ssl' in text or 'tls' in text or 'https' in text:
            measures.append("secure transmission")
        if 'access controls' in text or 'access control' in text:
            measures.append("access controls")
        if 'firewall' in text:
            measures.append("firewall protection")
        
        encryption = 'encryption' in text or 'encrypted' in text
        adequate = len(measures) >= 2
        
        return {
            "encryption": encryption,
            "details": measures,
            "adequate": adequate
        }
    
    def _calculate_risk_level(self, data_types: Dict, third_party: Dict, 
                             user_rights: Dict, security: Dict) -> tuple:
        """Calculate overall risk level"""
        risk_score = 0
        risk_factors = []
        
        # Check for sensitive data collection
        for data_type, info in data_types.items():
            if info['collected']:
                risk_score += info['severity']
                if info['severity'] >= 4:
                    risk_factors.append(f"Collects {data_type} ({', '.join(info['details'])})")
        
        # Third-party sharing is a major risk
        if third_party['shares_data']:
            risk_score += third_party['severity'] * 2
            risk_factors.append(f"Shares data with: {', '.join(third_party['recipients'])}")
        
        # Lack of user rights increases risk
        rights_count = sum(1 for v in user_rights.values() if isinstance(v, bool) and v)
        if rights_count < 3:
            risk_score += 3
            risk_factors.append("Limited user rights (access, deletion, correction)")
        
        # Lack of security measures increases risk
        if not security['adequate']:
            risk_score += 5
            risk_factors.append("Inadequate security measures described")
        
        # Determine risk level
        if risk_score >= 30:
            risk_level = "Critical"
        elif risk_score >= 20:
            risk_level = "High"
        elif risk_score >= 10:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        
        return risk_level, risk_factors
    
    def _find_positive_aspects(self, user_rights: Dict, security: Dict, 
                              data_retention: Dict) -> List[str]:
        """Find positive aspects of the policy"""
        positives = []
        
        rights_count = sum(1 for v in user_rights.values() if isinstance(v, bool) and v)
        if rights_count >= 3:
            positives.append("Strong user rights (access, deletion, correction)")
        
        if security['adequate']:
            positives.append("Adequate security measures in place")
        
        if security['encryption']:
            positives.append("Uses encryption to protect data")
        
        if data_retention['specified']:
            positives.append("Clear data retention policy")
        
        return positives
    
    def _generate_summary(self, data_types: Dict, third_party: Dict, 
                         user_rights: Dict, risk_level: str) -> str:
        """Generate summary text"""
        collected_types = [k for k, v in data_types.items() if v['collected']]
        
        summary = f"This service collects {len(collected_types)} types of data. "
        
        if third_party['shares_data']:
            summary += f"Data is shared with {len(third_party['recipients'])} types of third parties. "
        else:
            summary += "Data sharing with third parties is limited. "
        
        rights_count = sum(1 for v in user_rights.values() if isinstance(v, bool) and v)
        if rights_count >= 3:
            summary += "Users have good control over their data."
        else:
            summary += "User rights are limited."
        
        return summary
    
    def _detect_dark_patterns(self, text: str) -> Dict:
        """
        Detect dark patterns and problematic practices in privacy policies.
        
        Detects:
        - Vague wording ("may", "might", "sometimes")
        - Unlimited/unclear data retention
        - Broad sharing with "partners"
        - Unclear opt-out mechanisms
        - Weak consent sections
        - Other manipulative practices
        """
        dark_patterns = []
        severity_score = 0
        
        # 1. VAGUE LANGUAGE DETECTION
        vague_phrases = [
            ('may share', 'Vague language about data sharing'),
            ('may collect', 'Vague language about data collection'),
            ('might share', 'Vague language about data sharing'),
            ('might collect', 'Vague language about data collection'),
            ('could share', 'Vague language about data sharing'),
            ('could collect', 'Vague language about data collection'),
            ('sometimes share', 'Vague language about data sharing'),
            ('sometimes collect', 'Vague language about data collection'),
            ('possibly share', 'Vague language about data sharing'),
            ('may use', 'Vague language about data usage'),
            ('might use', 'Vague language about data usage'),
            ('from time to time', 'Vague timing language'),
            ('at our discretion', 'Discretionary language without user control'),
            ('we reserve the right', 'Broad reserved rights'),
            ('as we see fit', 'Discretionary language without user control'),
            ('without notice', 'Changes without user notification'),
            ('at any time', 'Unlimited timing for changes'),
        ]
        
        vague_count = 0
        vague_examples = []
        for phrase, description in vague_phrases:
            if phrase in text:
                vague_count += 1
                if len(vague_examples) < 3:
                    vague_examples.append(f'"{phrase}"')
        
        if vague_count >= 3:
            dark_patterns.append({
                'type': 'vague_language',
                'severity': 'high',
                'title': '🌫️ Excessive Vague Language',
                'description': f'Policy uses vague wording {vague_count} times, making it unclear what data is actually collected.',
                'examples': vague_examples,
                'recommendation': 'Look for specific statements about exact data collected.'
            })
            severity_score += 4
        elif vague_count >= 1:
            dark_patterns.append({
                'type': 'vague_language',
                'severity': 'medium',
                'title': '🌫️ Vague Language Used',
                'description': 'Policy contains vague language that could be interpreted broadly.',
                'examples': vague_examples,
                'recommendation': 'Request clarification on specific data practices.'
            })
            severity_score += 2
        
        # 2. UNLIMITED/UNCLEAR RETENTION
        unlimited_retention = ['indefinitely', 'as long as necessary', 'as long as needed',
                               'for as long as', 'permanently stored', 'retain your information',
                               'store indefinitely', 'foreseeable future']
        
        has_unlimited = any(phrase in text for phrase in unlimited_retention)
        has_retention_policy = any(x in text for x in ['retain for', 'deleted after', 'retention period'])
        
        if has_unlimited and not has_retention_policy:
            dark_patterns.append({
                'type': 'unlimited_retention',
                'severity': 'high',
                'title': '♾️ Unlimited Data Retention',
                'description': 'Data may be kept indefinitely without a clear retention limit.',
                'examples': [p for p in unlimited_retention if p in text][:2],
                'recommendation': 'Request specific data retention periods and request deletion.'
            })
            severity_score += 4
        elif has_unlimited:
            dark_patterns.append({
                'type': 'unclear_retention',
                'severity': 'medium',
                'title': '⏳ Unclear Data Retention',
                'description': 'Retention policy uses vague language.',
                'examples': [p for p in unlimited_retention if p in text][:2],
                'recommendation': 'Request clarification on how long data is kept.'
            })
            severity_score += 2
        
        # 3. BROAD PARTNER SHARING
        broad_sharing = [('business partners', 'Vague business partners'),
                        ('trusted partners', 'Vague trusted partners'),
                        ('affiliated companies', 'Undefined affiliates'),
                        ('third-party partners', 'Broad third-party sharing'),
                        ('selected third parties', 'Vague selected third parties'),
                        ('our partners', 'Vague partners')]
        
        broad_found = [(p, d) for p, d in broad_sharing if p in text]
        
        if len(broad_found) >= 2:
            dark_patterns.append({
                'type': 'broad_sharing',
                'severity': 'high',
                'title': '🤝 Broad Third-Party Sharing',
                'description': 'Data shared with vaguely defined "partners" without specific identification.',
                'examples': [f'"{p[0]}"' for p in broad_found[:3]],
                'recommendation': 'Request a complete list of third parties receiving your data.'
            })
            severity_score += 4
        elif broad_found:
            dark_patterns.append({
                'type': 'partner_sharing',
                'severity': 'medium',
                'title': '🤝 Vague Partner Sharing',
                'description': 'Data sharing with "partners" mentioned without clear definition.',
                'examples': [f'"{p[0]}"' for p in broad_found],
                'recommendation': 'Look for specific partner lists.'
            })
            severity_score += 2
        
        # 4. UNCLEAR OPT-OUT
        complex_optout = [('contact us to opt out', 'Requires contacting company'),
                         ('email us to', 'Requires emailing'),
                         ('write to us', 'Requires physical mail'),
                         ('submit a request', 'Requires formal request')]
        
        optout_found = [(p, d) for p, d in complex_optout if p in text]
        has_easy_optout = any(x in text for x in ['unsubscribe link', 'settings page', 'privacy dashboard'])
        
        if len(optout_found) >= 2 and not has_easy_optout:
            dark_patterns.append({
                'type': 'complex_optout',
                'severity': 'high',
                'title': '🚫 Complex Opt-Out Process',
                'description': 'Opting out requires complex steps.',
                'examples': [p[1] for p in optout_found[:3]],
                'recommendation': 'Look for simpler opt-out mechanisms.'
            })
            severity_score += 4
        elif optout_found:
            dark_patterns.append({
                'type': 'unclear_optout',
                'severity': 'medium',
                'title': '🚫 Unclear Opt-Out',
                'description': 'Opt-out process is not straightforward.',
                'examples': [p[1] for p in optout_found],
                'recommendation': 'Check for account settings.'
            })
            severity_score += 2
        
        # 5. WEAK CONSENT
        weak_consent = [('by using our service', 'Implied consent through use'),
                       ('by continuing to use', 'Continued use implies consent'),
                       ('deemed to accept', 'Automatic consent assumption'),
                       ('pre-selected', 'Pre-checked consent boxes'),
                       ('pre-checked', 'Pre-checked consent boxes'),
                       ('unless you opt out', 'Opt-out rather than opt-in')]
        
        consent_found = [(p, d) for p, d in weak_consent if p in text]
        
        if len(consent_found) >= 2:
            dark_patterns.append({
                'type': 'weak_consent',
                'severity': 'high',
                'title': '✍️ Weak Consent Practices',
                'description': 'Consent is implied rather than explicitly obtained.',
                'examples': [f'"{p[0]}"' for p in consent_found[:3]],
                'recommendation': 'Consent may have been assumed - consider revoking.'
            })
            severity_score += 4
        elif consent_found:
            dark_patterns.append({
                'type': 'implied_consent',
                'severity': 'medium',
                'title': '✍️ Implied Consent',
                'description': 'Some consent may be assumed through use.',
                'examples': [f'"{p[0]}"' for p in consent_found],
                'recommendation': 'Look for explicit consent options.'
            })
            severity_score += 2
        
        # 6. OTHER PATTERNS
        if any(x in text for x in ['required to agree', 'must accept']):
            dark_patterns.append({
                'type': 'forced_consent',
                'severity': 'high',
                'title': '⚠️ Forced Consent',
                'description': 'Consent required to use the service.',
                'recommendation': 'Consider alternatives.'
            })
            severity_score += 3
        
        if any(x in text for x in ['update this policy at any time', 'right to amend']):
            dark_patterns.append({
                'type': 'unilateral_changes',
                'severity': 'medium',
                'title': '📝 Unilateral Policy Changes',
                'description': 'Policy can change without your consent.',
                'recommendation': 'Check policy regularly.'
            })
            severity_score += 2
        
        # Calculate overall severity
        if severity_score >= 12:
            overall_severity = 'critical'
        elif severity_score >= 8:
            overall_severity = 'high'
        elif severity_score >= 4:
            overall_severity = 'medium'
        elif severity_score > 0:
            overall_severity = 'low'
        else:
            overall_severity = 'none'
        
        return {
            'detected': len(dark_patterns) > 0,
            'patterns': dark_patterns,
            'count': len(dark_patterns),
            'severity': overall_severity,
            'score': severity_score
        }


# Global instance
_llm_analyzer = None

def get_llm_analyzer() -> LLMPrivacyAnalyzer:
    """Get or create global LLM analyzer instance"""
    global _llm_analyzer
    if _llm_analyzer is None:
        _llm_analyzer = LLMPrivacyAnalyzer()
    return _llm_analyzer
