import React, { useState, useEffect, useMemo } from "react";
import './App.css';
import { Doughnut } from "react-chartjs-2";
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
} from "chart.js";

Chart.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// Modern icons as React components
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15,3 21,3 21,9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

// Utility functions for safe data handling
const safeString = (value) => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.text) return String(value.text);
    if (value.right) return String(value.right);
    if (value.practice) return String(value.practice);
    if (value.measure) return String(value.measure);
    if (value.type) return String(value.type);
    if (value.purpose) return String(value.purpose);
    return '';
  }
  return String(value);
};

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  return [];
};

const safeObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
};

// Helper functions
const getFriendlyLabel = (dataType) => {
  if (!dataType || typeof dataType !== 'string') return 'Unknown Data Type';
  
  const friendlyLabels = {
    phone: 'Phone Numbers',
    browsing: 'Browsing & Device Info',
    id: 'Government/ID Documents',
    social: 'Social Media Accounts',
    email: 'Email Addresses',
    location: 'Location Information',
    payment: 'Payment & Financial Info',
    name: 'Name/Username',
    age: 'Age/Birthdate',
    biometric: 'Biometric Data',
    health: 'Health/Medical Info',
    education: 'Education Details',
    employment: 'Employment Details',
    behavior: 'Preferences & Interests',
    content: 'Photos & Videos',
    communication: 'Messages & Chats',
    device: 'Device Information',
    demographic: 'Demographic Data',
    advertising: 'Advertising Data',
    usage: 'Usage Patterns',
    network: 'Network Information',
    camera: 'Camera Access',
    microphone: 'Microphone Access',
    calendar: 'Calendar Data',
    contacts: 'Contact List',
    files: 'Files & Documents',
    app_usage: 'App Usage Data',
    purchase: 'Purchase History',
    search: 'Search History',
    profile: 'Profile Information',
    account: 'Account Data',
    login: 'Login Information',
    activity: 'Activity Data',
    preferences: 'User Preferences',
    interests: 'Interests & Hobbies',
    relationships: 'Relationship Data',
    political: 'Political Views',
    religious: 'Religious Beliefs',
    sexual_orientation: 'Sexual Orientation',
    ethnicity: 'Ethnicity & Race',
    gender: 'Gender Identity',
    income: 'Income & Financial Status',
    family: 'Family Information',
    travel: 'Travel Data',
    shopping: 'Shopping Behavior',
    entertainment: 'Entertainment Preferences',
    news: 'News Preferences',
    sports: 'Sports Data',
    music: 'Music Preferences',
    gaming: 'Gaming Data',
    search_history: 'Search History',
    location_history: 'Location History',
    browsing_history: 'Browsing History',
    voice_data: 'Voice Data',
    social_graph: 'Social Graph',
    content_analysis: 'Content Analysis',
    behavioral_targeting: 'Behavioral Targeting',
    cross_platform_tracking: 'Cross-Platform Tracking',
    purchase_history: 'Purchase History',
    shopping_behavior: 'Shopping Behavior',
    product_preferences: 'Product Preferences',
    voice_commands: 'Voice Commands'
  };
  
  return friendlyLabels[dataType] || dataType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getDataTypeSummary = (dataType) => {
  if (!dataType || typeof dataType !== 'string') return 'General data collection';
  
  const summaries = {
    email: 'Used for communication, account management, and notifications',
    phone: 'For verification, support, and security purposes',
    location: 'To provide location-based services and analytics',
    payment: 'To process transactions and manage billing',
    browsing: 'To analyze usage patterns and improve user experience',
    name: 'For personalization and account identification',
    age: 'For age verification and compliance with regulations',
    id: 'For identity verification and regulatory compliance',
    biometric: 'For advanced security and authentication',
    social: 'To connect with friends and social features',
    health: 'For health-related services and recommendations',
    education: 'For educational services and certifications',
    employment: 'For professional networking and job-related features',
    behavior: 'To personalize content and improve recommendations'
  };
  
  return summaries[dataType] || 'General data processing and service provision';
};

const getDataTypeWeight = (dataType) => {
  if (!dataType || typeof dataType !== 'string') return 1;
  
  const weights = {
    // Highly sensitive data (highest weight)
    biometric: 15, political: 14, religious: 14, sexual_orientation: 14,
    health: 13, id: 12, payment: 11,
    
    // Sensitive tracking data (high weight)
    location: 10, browsing: 9, advertising: 9, demographic: 9,
    communication: 8, content: 8, social: 8, behavior: 8,
    
    // Personal data (medium weight)
    device: 7, camera: 7, microphone: 7, contacts: 7,
    calendar: 6, files: 6, app_usage: 6, purchase: 6,
    search: 6, profile: 6, account: 6, activity: 6,
    
    // Standard personal data (lower weight)
    phone: 5, email: 4, name: 3, age: 3,
    preferences: 4, interests: 4, relationships: 5,
    ethnicity: 6, gender: 5, income: 8, family: 7,
    
    // Activity and preference data (lowest weight)
    usage: 3, network: 3, login: 3, travel: 4, shopping: 4,
    entertainment: 3, news: 3, sports: 3, music: 3, gaming: 3,
    education: 4, employment: 5,
    
    // Platform-specific data types (high weight due to sensitivity)
    search_history: 12, location_history: 11, browsing_history: 10,
    voice_data: 13, social_graph: 12, content_analysis: 11,
    behavioral_targeting: 14, cross_platform_tracking: 13,
    purchase_history: 9, shopping_behavior: 8, product_preferences: 7,
    voice_commands: 12
  };
  
  return weights[dataType] || 1;
};

const getDataTypeIcon = (dataType) => {
  if (!dataType || typeof dataType !== 'string') return '📄';
  
  const icons = {
    // Core personal data
    'email': '📧', 'phone': '📱', 'name': '👤', 'age': '🎂', 'id': '🆔',
    
    // Location and tracking
    'location': '📍', 'browsing': '🌐', 'network': '🌍',
    
    // Financial and sensitive
    'payment': '💳', 'biometric': '🫵', 'health': '🏥',
    
    // Social and communication
    'social': '👥', 'communication': '💬', 'content': '📸', 'relationships': '💕',
    
    // Device and technical
    'device': '📱', 'camera': '📷', 'microphone': '🎤', 'files': '📁',
    
    // Activity and behavior
    'behavior': '🧠', 'activity': '📊', 'usage': '📈', 'app_usage': '📱',
    'preferences': '⚙️', 'interests': '🎯', 'search': '🔍',
    
    // Demographics and profiling
    'demographic': '📊', 'advertising': '📢', 'profile': '👤', 'account': '🔐',
    
    // Sensitive personal information
    'political': '🗳️', 'religious': '⛪', 'sexual_orientation': '🏳️‍🌈',
    'ethnicity': '🌍', 'gender': '⚧', 'income': '💰', 'family': '👨‍👩‍👧‍👦',
    
    // Activity categories
    'travel': '✈️', 'shopping': '🛒', 'entertainment': '🎬', 'news': '📰',
    'sports': '⚽', 'music': '🎵', 'gaming': '🎮', 'calendar': '📅',
    
    // Other
    'contacts': '📞', 'purchase': '🛍️', 'login': '🔑', 'education': '🎓',
    'employment': '💼',
    
    // Platform-specific data types
    'search_history': '🔍', 'location_history': '📍', 'browsing_history': '🌐',
    'voice_data': '🎤', 'social_graph': '👥', 'content_analysis': '📊',
    'behavioral_targeting': '🎯', 'cross_platform_tracking': '🔄',
    'purchase_history': '🛒', 'shopping_behavior': '🛍️', 'product_preferences': '⭐',
    'voice_commands': '🎙️'
  };
  return icons[dataType] || '📄';
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>⚠️ Something went wrong</h2>
          <p>The application encountered an error. Please refresh the page to try again.</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [url, setUrl] = useState("");
  const [rawResult, setRawResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);
  const [analysisType, setAnalysisType] = useState(''); // 'website' or 'direct'
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);

  const steps = useMemo(() => [
    "Connecting to website...",
    "Searching for privacy policy...",
    "Extracting policy content...",
    "Analyzing data collection...",
    "Generating insights..."
  ], []);

  const directSteps = useMemo(() => [
    "Connecting to privacy policy...",
    "Fetching policy content...",
    "Analyzing data collection...",
    "Generating insights..."
  ], []);



  // Progress simulation
  useEffect(() => {
    if (loading) {
      const currentSteps = analysisType === 'direct' ? directSteps : steps;
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 800);

      const stepInterval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev < currentSteps.length - 1) return prev + 1;
          return prev;
        });
      }, 2000);

      return () => {
        clearInterval(interval);
        clearInterval(stepInterval);
      };
    } else {
      setProgress(0);
      setCurrentStep(0);
    }
  }, [loading, steps, directSteps, analysisType]);

  const chartColors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", 
    "#06b6d4", "#84cc16", "#f97316", "#ef4444", "#6b7280"
  ];

  // Safe data access helper with comprehensive error handling
  const getSafeAnalysisData = () => {
    try {
      if (!analysis || typeof analysis !== 'object') {
        return {
          data_types: {},
          warnings: [],
          summary: {},
          risk_level: 'Unknown',
          risk_factors: [],
          user_friendly_summary: '',
          confidence: {},
          safer_alternatives: null
        };
      }
      

      
      return {
        data_types: safeObject(analysis.data_types),
        warnings: safeArray(analysis.warnings),
        summary: safeObject(analysis.summary),
        risk_level: safeString(analysis.risk_level) || 'Unknown',
        risk_factors: safeArray(analysis.risk_factors),
        user_friendly_summary: safeString(analysis.user_friendly_summary),
        confidence: safeObject(analysis.confidence),
        safer_alternatives: analysis.safer_alternatives || null
      };
    } catch (e) {
      console.error('Error in getSafeAnalysisData:', e);
      return {
        data_types: {},
        warnings: [],
        summary: {},
        risk_level: 'Unknown',
        risk_factors: [],
        user_friendly_summary: '',
        confidence: {},
        safer_alternatives: null
      };
    }
  };

  const safeAnalysis = getSafeAnalysisData();

  // Calculate available data types for charts with error handling
  const availableTypes = (() => {
    try {
      const dataTypes = safeAnalysis.data_types || {};
      return Object.keys(dataTypes).filter(type => 
        type && typeof type === 'string' && (dataTypes[type] || 0) > 0
      );
    } catch (e) {
      console.error('Error calculating available types:', e);
      return [];
    }
  })();
  
  // Backend URL - dynamically determine based on environment
  const BACKEND_URL = window.location.hostname === 'localhost' 
    ? "http://localhost:8000" 
    : window.location.origin;

  // Safe URL validation
  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  // Smart URL type detection
  const detectUrlType = (inputUrl) => {
    if (!inputUrl || !inputUrl.trim()) return null;
    
    const url = inputUrl.toLowerCase().trim();
    
    // Check for direct privacy policy indicators
    const privacyIndicators = [
      'privacy', 'policy', 'data-protection', 'gdpr', 'ccpa',
      'cookie-policy', 'legal/privacy', 'terms-privacy'
    ];
    
    const hasPrivacyIndicator = privacyIndicators.some(indicator => 
      url.includes(indicator)
    );
    
    // If URL contains privacy-related terms, treat as direct policy
    if (hasPrivacyIndicator) {
      return 'direct';
    }
    
    // Otherwise, treat as website for automatic discovery
    return 'website';
  };

  // Unified analysis function that routes to appropriate endpoint
  const analyzePrivacyPolicy = async (inputUrl = null) => {
    const urlToAnalyze = inputUrl || url;
    
    if (!urlToAnalyze || !urlToAnalyze.trim()) {
      setError("Please enter a website URL or privacy policy URL");
      return;
    }

    // Handle demo URLs - ensure they have proper protocol
    let processedUrl = urlToAnalyze.trim();
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = `https://${processedUrl}`;
    }

    if (!isValidUrl(processedUrl)) {
      setError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    const urlType = detectUrlType(processedUrl);
    setAnalysisType(urlType);
    
    setLoading(true);
    setError("");
    setShowResults(false);
    setAnalysis(null);
    setRawResult(null);

    try {
      const timeoutId = setTimeout(() => {
        throw new Error('Request timed out after 30 seconds');
      }, 30000);

      let endpoint, requestBody;
      
      if (urlType === 'direct') {
        // Use direct policy analysis endpoint
        endpoint = `${BACKEND_URL}/analyze-direct-policy`;
        requestBody = { url: processedUrl };
      } else {
        // Use website scanner endpoint
        endpoint = `${BACKEND_URL}/fetch-privacy-policy`;
        requestBody = { url: processedUrl };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          if (urlType === 'direct') {
            throw new Error("Unable to fetch the privacy policy from this URL. Please check the URL and try again.");
          } else {
            throw new Error("Privacy policy not found on this website");
          }
        } else if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          const detail = errorData.detail || "Invalid URL or website not accessible";
          throw new Error(`Privacy policy not found or website not accessible: ${detail}`);
        } else if (response.status === 408) {
          throw new Error("Request timed out. The website may be slow to respond.");
        } else if (response.status === 500) {
          throw new Error("Server error while analyzing the policy");
        } else {
          throw new Error(`Request failed with status ${response.status}`);
        }
      }

      const result = await response.json();
      
      // Check if the response contains an error even with 200 status
      if (result.error) {
        if (result.error === 'not_found') {
          throw new Error("Privacy policy not found on this website");
        } else {
          throw new Error(`Website error: ${result.error}`);
        }
      }
      
      if (urlType === 'direct') {
        // Direct analysis returns the full analysis
        setAnalysis(result);
      } else {
        // Website scanner returns policy text that needs to be analyzed
        setRawResult(result);
        await analyzePolicy(result.policy_text, processedUrl);
      }

      setShowResults(true);

    } catch (err) {
      console.error("Error analyzing privacy policy:", err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError("Network error: Unable to connect to the server");
      } else if (err.name === 'AbortError' || err.message.includes('timed out')) {
        setError("Request timed out. The website may be slow to respond.");
      } else {
        setError(err.message || "Failed to analyze privacy policy");
      }
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };

  // Safe analysis function for website scanner results
  const analyzePolicy = async (policyText, websiteUrl) => {
    try {
      const response = await fetch(`${BACKEND_URL}/analyze-policy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          policy_text: policyText,
          website_url: websiteUrl // Pass the processed URL for context-aware alternatives
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.detail || `Analysis failed with status ${response.status}`;
        throw new Error(`Policy analysis failed: ${detail}`);
      }

      const analysisResult = await response.json();
      setAnalysis(analysisResult);
    } catch (err) {
      console.error("Error analyzing policy:", err);
      setError(`Analysis failed: ${err.message}`);
    }
  };

  // Get analysis type display text
  const getAnalysisTypeText = () => {
    if (analysisType === 'direct') {
      return "Direct Privacy Policy Analysis";
    } else if (analysisType === 'website') {
      return "Website Privacy Policy Search & Analysis";
    }
    return "Smart Privacy Policy Analysis";
  };

  // Get current steps based on analysis type
  const getCurrentSteps = () => {
    return analysisType === 'direct' ? directSteps : steps;
  };

  // Demo URLs for quick testing
  const demoUrls = [
    { url: "https://facebook.com", label: "Facebook", description: "Social media privacy policy" },
    { url: "https://google.com", label: "Google", description: "Search engine data collection" },
    { url: "https://amazon.com", label: "Amazon", description: "E-commerce privacy practices" },
    { url: "https://github.com", label: "GitHub", description: "Developer platform privacy" }
  ];

  // Handle demo URL selection
  const handleDemoClick = (demoUrl) => {
    setUrl(demoUrl);
    setShowWelcomeModal(false);
    // Auto-trigger analysis with the demo URL directly
    setTimeout(() => {
      analyzePrivacyPolicy(demoUrl);
    }, 500);
  };

  // Handle welcome modal close
  const handleWelcomeClose = () => {
    setShowWelcomeModal(false);
  };

  // Safe text extraction helper
  const extractDisplayText = (item) => {
    try {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        if (item.right) return safeString(item.right);
        if (item.practice) return safeString(item.practice);
        if (item.measure) return safeString(item.measure);
        if (item.text) return safeString(item.text);
        if (item.type) return safeString(item.type);
      }
      return safeString(item);
    } catch {
      return 'Error displaying text';
    }
  };

  // Smart URL suggestions for better user experience
  const getSmartSuggestions = (inputUrl, errorType) => {
    if (!inputUrl) return [];
    
    try {
      const urlObj = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
      const domain = urlObj.hostname;
      
      const suggestions = [];
      
      if (errorType === 'not_found') {
        // Suggest direct privacy policy URLs
        const privacyPaths = [
          '/privacy',
          '/privacy-policy', 
          '/legal/privacy',
          '/policy/privacy',
          '/privacy-notice'
        ];
        
        privacyPaths.forEach(path => {
          suggestions.push({
            url: `https://${domain}${path}`,
            label: `Try ${domain}${path}`,
            type: 'direct'
          });
        });
        
        // Suggest alternative subdomains
        if (!domain.startsWith('www.')) {
          suggestions.push({
            url: `https://www.${domain}`,
            label: `Try www.${domain}`,
            type: 'subdomain'
          });
        }
        
        // Suggest help/legal subdomains
        ['help', 'legal', 'policies'].forEach(sub => {
          if (!domain.startsWith(`${sub}.`)) {
            suggestions.push({
              url: `https://${sub}.${domain.replace(/^www\./, '')}`,
              label: `Try ${sub}.${domain.replace(/^www\./, '')}`,
              type: 'subdomain'
            });
          }
        });
        
        // Special suggestions for specific domains
        if (domain.includes('whatsapp')) {
          suggestions.push({
            url: 'https://www.whatsapp.com/legal/privacy-policy',
            label: 'Try WhatsApp Privacy Policy',
            type: 'direct'
          });
          suggestions.push({
            url: 'https://www.whatsapp.com/legal',
            label: 'Try WhatsApp Legal',
            type: 'direct'
          });
        } else if (domain.includes('facebook')) {
          suggestions.push({
            url: 'https://www.facebook.com/privacy/policy/',
            label: 'Try Facebook Privacy Policy',
            type: 'direct'
          });
        } else if (domain.includes('google')) {
          suggestions.push({
            url: 'https://policies.google.com/privacy',
            label: 'Try Google Privacy Policy',
            type: 'direct'
          });
        }
      }
      
      return suggestions.slice(0, 6); // Limit to 6 suggestions
         } catch {
       return [];
     }
  };

  // Enhanced error handling with smart suggestions
  const renderErrorSection = () => {
    // Show suggestions for various error types, not just "not found"
    const shouldShowSuggestions = error.includes('not found') || 
                                 error.includes('status 400') || 
                                 error.includes('status 404') || 
                                 error.includes('not accessible') ||
                                 error.includes('Unable to fetch') ||
                                 error.includes('Invalid URL');
    
    const suggestions = getSmartSuggestions(url, shouldShowSuggestions ? 'not_found' : 'other');
    
    return (
      <div className="error-section">
        <div className="error-card">
          <div className="error-content">
            <AlertIcon />
            <div className="error-text">
              <h3>Analysis Failed</h3>
              <p>{error}</p>
            </div>
          </div>

          {shouldShowSuggestions && (
            <div className="error-suggestions">
              <h4>💡 Smart Suggestions:</h4>
              
              {suggestions.length > 0 && (
                <div className="smart-suggestions">
                  <p>Try these direct privacy policy URLs:</p>
                  <div className="suggestion-buttons">
                    {suggestions.filter(s => s.type === 'direct').slice(0, 3).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setUrl(suggestion.url)}
                        className="suggestion-btn direct-suggestion"
                        title={`Test ${suggestion.url}`}
                      >
                        🔗 {suggestion.label}
                      </button>
                    ))}
                  </div>
                  
                  {suggestions.filter(s => s.type === 'subdomain').length > 0 && (
                    <>
                      <p>Or try these alternative domains:</p>
                      <div className="suggestion-buttons">
                        {suggestions.filter(s => s.type === 'subdomain').slice(0, 2).map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => setUrl(suggestion.url)}
                            className="suggestion-btn subdomain-suggestion"
                            title={`Test ${suggestion.url}`}
                          >
                            🌐 {suggestion.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              
              <div className="general-suggestions">
                <h5>General tips:</h5>
                <ul>
                  <li>Check the website's footer for privacy links</li>
                  <li>Look for "Legal" or "Policies" sections in the menu</li>
                  <li>Try adding "/privacy" to the end of the URL</li>
                  <li>Search for "[company name] privacy policy" on Google</li>
                  <li>Try the website's help or support section</li>
                  <li>Check if the website has a mobile app with privacy settings</li>
                </ul>
              </div>
              
              <div className="alternative-actions">
                <p>You can also:</p>
                <div className="action-buttons">
                  <button 
                    onClick={() => {
                      try {
                        const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
                        window.open(`https://www.google.com/search?q=${encodeURIComponent(domain + ' privacy policy')}`, '_blank');
                             } catch {
         window.open(`https://www.google.com/search?q=${encodeURIComponent(url + ' privacy policy')}`, '_blank');
       }
                    }}
                    className="search-btn"
                  >
                    🔍 Search Google
                  </button>
                  <button 
                    onClick={() => setError("")} 
                    className="retry-btn"
                  >
                    🔄 Try Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Enhanced input section with better UX
  const renderInputSection = () => {
    const placeholder = analysisType === 'direct' 
      ? "https://example.com/privacy-policy" 
      : "https://example.com or https://example.com/privacy-policy";
    
    return (
      <div className="input-section">
        <h2 className="section-title">Smart Privacy Policy Analysis</h2>
        <p className="section-description">
          Enter any website URL or direct privacy policy link. Our AI will automatically detect the best approach and provide comprehensive analysis.
        </p>
        
        <div className="features-preview">
          <div className="feature-item">
            <span className="feature-icon">🧠</span>
            <span className="feature-text">Intelligent URL Detection</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <span className="feature-text">Fast Analysis (3-10 seconds)</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <span className="feature-text">Comprehensive Risk Assessment</span>
          </div>
        </div>
        
        <form className="modern-form" onSubmit={(e) => { e.preventDefault(); analyzePrivacyPolicy(); }}>
          <div className={`input-group ${isInputFocused ? 'focused' : ''} ${loading ? 'loading' : ''}`}>
            <SearchIcon />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder={placeholder}
              className="modern-input"
              disabled={loading}
            />
            {url && !loading && (
              <button 
                type="button" 
                className="clear-btn"
                onClick={() => setUrl('')}
                title="Clear URL"
              >
                ✕
              </button>
            )}
          </div>
          
          <button 
            type="submit" 
            className={`analyze-btn ${loading ? 'loading' : ''} ${!url.trim() ? 'disabled' : ''}`}
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Analyzing...
              </>
            ) : (
              <>
                <ShieldIcon />
                Analyze Privacy Policy
              </>
            )}
          </button>
        </form>
        
        {url && !loading && !error && !showResults && (
          <div className="url-preview">
            <div className="preview-header">
              <span className="preview-icon">
                {detectUrlType(url) === 'direct' ? '🔗' : '🌐'}
              </span>
              <span className="preview-text">
                {detectUrlType(url) === 'direct' 
                  ? 'Direct Privacy Policy Analysis' 
                  : 'Website Privacy Policy Discovery'}
              </span>
            </div>
            <div className="preview-url">{url}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <ErrorBoundary>
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal">
            <div className="welcome-header">
              <div className="welcome-logo">
                <ShieldIcon />
                <h1>PrivacyLens</h1>
              </div>
              <button className="welcome-close" onClick={handleWelcomeClose}>
                ✕
              </button>
            </div>
            
            <div className="welcome-content">
              <h2>Welcome to PrivacyLens! 🔍</h2>
              <p className="welcome-subtitle">
                Understand privacy policies in seconds with AI-powered analysis
              </p>
              
              <div className="welcome-features">
                <div className="welcome-feature">
                  <span className="feature-icon">📊</span>
                  <div>
                    <h4>Data Collection Analysis</h4>
                    <p>See exactly what personal data companies collect</p>
                  </div>
                </div>
                <div className="welcome-feature">
                  <span className="feature-icon">⚠️</span>
                  <div>
                    <h4>Privacy Risk Assessment</h4>
                    <p>Get instant insights into privacy risks and concerns</p>
                  </div>
                </div>
                <div className="welcome-feature">
                  <span className="feature-icon">⚖️</span>
                  <div>
                    <h4>Your Legal Rights</h4>
                    <p>Understand your privacy rights and how to exercise them</p>
                  </div>
                </div>
                <div className="welcome-feature">
                  <span className="feature-icon">🛡️</span>
                  <div>
                    <h4>Safer Alternatives</h4>
                    <p>Discover privacy-focused alternatives to popular services</p>
                  </div>
                </div>
              </div>
              
              <div className="welcome-demo">
                <h3>Try it now with a popular website:</h3>
                <div className="demo-buttons">
                  {demoUrls.map((demo, index) => (
                    <button
                      key={index}
                      className="demo-btn"
                      onClick={() => handleDemoClick(demo.url)}
                    >
                      <span className="demo-label">{demo.label}</span>
                      <span className="demo-description">{demo.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="welcome-trust">
                <div className="trust-badges">
                  <span className="trust-badge">🔒 No data stored</span>
                  <span className="trust-badge">🤖 AI-powered analysis</span>
                  <span className="trust-badge">⚡ 3-12 second results</span>
                </div>
                <p className="trust-note">
                  We don't store your data. Analysis happens in real-time and is not saved.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="app-container">
        <div className="background-elements">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
        </div>

        <header className="app-header">
          <div className="header-content">
            <div className="logo-section">
              <ShieldIcon />
              <h1 className="app-title">PrivacyLens</h1>
            </div>
            <p className="app-subtitle">AI-Powered Privacy Policy Analysis</p>
          </div>
        </header>

        <main className="main-content">
          {renderInputSection()}

          {/* Loading Animation */}
          {loading && (
            <div className="loading-section">
              <div className="loading-content">
                <div className="progress-container">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{Math.round(progress)}%</span>
                </div>
                
                <div className="status-text">
                  <span className="current-step">{getCurrentSteps()[currentStep]}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && renderErrorSection()}

          {/* Results Display */}
          {showResults && analysis && (
            <ErrorBoundary>
              <div className="results-section">
                                    <div className="results-header">
                      <h2>✨ Analysis Complete!</h2>
                      <p>Privacy insights for <strong>{rawResult?.policy_url ? (() => {
                        try {
                          return new URL(rawResult.policy_url).hostname;
                        } catch {
                          return 'the website';
                        }
                      })() : analysis?.policy_url ? (() => {
                        try {
                          return new URL(analysis.policy_url).hostname;
                        } catch {
                          return 'the website';
                        }
                      })() : 'the website'}</strong></p>
                      <div className="analysis-type-badge">
                        <span className="analysis-type">{getAnalysisTypeText()}</span>
                      </div>
                    </div>

                {/* Key Metrics Dashboard */}
                <div className="metrics-dashboard">
                  <div className="metric-card risk-metric">
                    <div className="metric-icon">
                      {safeAnalysis.risk_level === 'Low' && '🟢'}
                      {safeAnalysis.risk_level === 'Medium' && '🟡'}
                      {safeAnalysis.risk_level === 'High' && '🔴'}
                    </div>
                    <div className="metric-content">
                      <h3>Privacy Risk</h3>
                      <div className={`risk-level ${safeAnalysis.risk_level.toLowerCase()}`}>
                        {safeAnalysis.risk_level}
                      </div>
                    </div>
                  </div>

                  <div className="metric-card data-metric">
                    <div className="metric-icon">📊</div>
                    <div className="metric-content">
                      <h3>Data Types</h3>
                      <div className="metric-value">{Object.keys(safeAnalysis.data_types || {}).length}</div>
                      <div className="metric-label">types collected</div>
                    </div>
                  </div>

                  <div className="metric-card warnings-metric">
                    <div className="metric-icon">⚠️</div>
                    <div className="metric-content">
                      <h3>Warnings</h3>
                      <div className="metric-value">{safeArray(safeAnalysis.warnings).length}</div>
                      <div className="metric-label">concerns found</div>
                    </div>
                  </div>

                  <div className="metric-card rights-metric">
                    <div className="metric-icon">⚖️</div>
                    <div className="metric-content">
                      <h3>Your Rights</h3>
                      <div className="metric-value">{safeArray(safeAnalysis.summary?.your_rights).length}</div>
                      <div className="metric-label">rights listed</div>
                    </div>
                  </div>
                </div>

                {/* GPT-Powered Key Insights */}
                <div className="result-card insights-card">
                  <h2>🎯 Key Insights</h2>
                  <div className="insights-grid">
                    {safeAnalysis.risk_level === 'High' && (
                      <div className="insight-item critical">
                        <div className="insight-icon">🚨</div>
                        <div className="insight-content">
                          <h4>High Privacy Risk</h4>
                          <p>This service has concerning data collection practices. Consider alternatives or limit your data sharing.</p>
                        </div>
                      </div>
                    )}
                    
                    {Object.keys(safeAnalysis.data_types || {}).length > 5 && (
                      <div className="insight-item warning">
                        <div className="insight-icon">📋</div>
                        <div className="insight-content">
                          <h4>Extensive Data Collection</h4>
                          <p>They collect {Object.keys(safeAnalysis.data_types || {}).length} different types of personal data. Review what you're comfortable sharing.</p>
                        </div>
                      </div>
                    )}

                    {safeArray(safeAnalysis.warnings).length > 0 && (
                      <div className="insight-item warning">
                        <div className="insight-icon">⚠️</div>
                        <div className="insight-content">
                          <h4>Privacy Concerns</h4>
                          <p>{safeArray(safeAnalysis.warnings)[0]}</p>
                        </div>
                      </div>
                    )}

                    {safeArray(safeAnalysis.summary?.your_rights).length > 3 && (
                      <div className="insight-item positive">
                        <div className="insight-icon">✅</div>
                        <div className="insight-content">
                          <h4>Good Rights Protection</h4>
                          <p>You have {safeArray(safeAnalysis.summary?.your_rights).length} clearly stated privacy rights, including data access and deletion.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Data Collection Chart */}
                {availableTypes.length > 0 && (
                  <div className="result-card chart-card">
                    <h2>📊 Data Collection Breakdown</h2>
                    <div className="chart-container">
                      <div className="chart-wrapper">
                        <Doughnut
                          data={{
                            labels: availableTypes.map(type => getFriendlyLabel(type)),
                            datasets: [{
                              data: availableTypes.map(type => {
                                const baseValue = safeAnalysis.data_types[type] || 1;
                                const weight = getDataTypeWeight(type);
                                return Math.max(baseValue * weight, 1);
                              }),
                              backgroundColor: chartColors.slice(0, availableTypes.length),
                              borderWidth: 3,
                              borderColor: '#ffffff',
                              hoverBorderWidth: 4,
                              hoverOffset: 10
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                display: false
                              },
                              tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                borderWidth: 1,
                                cornerRadius: 8,
                                callbacks: {
                                  title: (context) => {
                                    const type = availableTypes[context[0].dataIndex];
                                    return getFriendlyLabel(type);
                                  },
                                  label: (context) => {
                                    const type = availableTypes[context.dataIndex];
                                    return getDataTypeSummary(type);
                                  }
                                }
                              }
                            },
                            onHover: (event, elements) => {
                              event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                            },
                            animation: {
                              animateRotate: true,
                              animateScale: true,
                              duration: 1000
                            }
                          }}
                        />
                      </div>
                      
                      <div className="data-types-legend">
                        {availableTypes.map((type, index) => (
                          <div key={type} className="legend-item">
                            <div 
                              className="legend-color" 
                              style={{ backgroundColor: chartColors[index] }}
                            ></div>
                            <div className="legend-content">
                              <span className="legend-icon">{getDataTypeIcon(type)}</span>
                              <span className="legend-label">{getFriendlyLabel(type)}</span>
                              <span className="legend-risk">
                                {getDataTypeWeight(type) > 6 ? '🔴' : getDataTypeWeight(type) > 3 ? '🟡' : '🟢'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="result-card actions-card">
                  <h2>🎯 What Should You Do?</h2>
                  <div className="actions-grid">
                    {safeAnalysis.risk_level === 'High' && (
                      <div className="action-item critical">
                        <div className="action-icon">🛑</div>
                        <div className="action-content">
                          <h4>Consider Alternatives</h4>
                          <p>High privacy risk detected. Look for services with better privacy practices.</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="action-item">
                      <div className="action-icon">📋</div>
                      <div className="action-content">
                        <h4>Review Settings</h4>
                        <p>Check privacy settings and limit data sharing where possible.</p>
                      </div>
                    </div>

                    <div className="action-item">
                      <div className="action-icon">🔒</div>
                      <div className="action-content">
                        <h4>Know Your Rights</h4>
                        <p>Contact them to access, correct, or delete your data when needed.</p>
                      </div>
                    </div>

                    <div className="action-item">
                      <div className="action-icon">🔄</div>
                      <div className="action-content">
                        <h4>Regular Review</h4>
                        <p>Check privacy policies periodically as they can change over time.</p>
                      </div>
                    </div>
                  </div>
                </div>

                                    {/* Expandable Detailed Analysis */}
                    <div className="result-card expandable-card">
                      <div className="expandable-header" onClick={() => setShowDetailed(!showDetailed)}>
                        <h2>📄 Detailed Analysis</h2>
                        <div className={`expand-icon ${showDetailed ? 'expanded' : ''}`}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                        </div>
                      </div>
                      
                      {showDetailed && (
                        <div className="detailed-content">
                          {/* Warnings Section - Only if warnings exist */}
                          {safeArray(safeAnalysis.warnings).length > 0 && (
                            <div className="detail-section">
                              <h3><span className="section-icon">⚠️</span>Privacy Warnings</h3>
                              <div className="warnings-compact">
                                {safeArray(safeAnalysis.warnings).map((warning, index) => {
                                  const w = safeString(warning).toLowerCase();
                                  let icon = '⚠️';
                                  if (w.includes('payment')) icon = '💳';
                                  else if (w.includes('biometric')) icon = '🫵';
                                  else if (w.includes('location')) icon = '📍';
                                  else if (w.includes('extensive')) icon = '⚠️';
                                  else if (w.includes('children')) icon = '🧒';
                                  return (
                                    <div key={index} className="warning-item-compact">
                                      <span>{icon}</span> {safeString(warning)}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Your Rights - Only if rights exist */}
                          {safeArray(safeAnalysis.summary?.your_rights).length > 0 && (
                            <div className="detail-section">
                              <h3><span className="section-icon">⚖️</span>Your Privacy Rights</h3>
                              <div className="rights-compact">
                                {safeArray(safeAnalysis.summary.your_rights).map((right, index) => {
                                  const text = extractDisplayText(right).toLowerCase();
                                  let icon = '✓';
                                  if (text.includes('download')) icon = '📥';
                                  else if (text.includes('delete')) icon = '🗑️';
                                  else if (text.includes('access')) icon = '👁️';
                                  else if (text.includes('correct')) icon = '✏️';
                                  else if (text.includes('opt-out')) icon = '🚫';
                                  return (
                                    <div key={index} className="right-item-compact">
                                      <span>{icon}</span> {extractDisplayText(right)}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Security Measures - Only if security info exists */}
                          {safeArray(safeAnalysis.summary?.security).length > 0 && (
                            <div className="detail-section">
                              <h3><span className="section-icon">🛡️</span>Security Measures</h3>
                              <div className="security-compact">
                                {safeArray(safeAnalysis.summary.security).map((measure, index) => (
                                  <div key={index} className="security-item-compact">
                                    <span>🛡️</span> {extractDisplayText(measure)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Safer Alternatives Section */}
                    {safeAnalysis.safer_alternatives && safeAnalysis.safer_alternatives.alternatives && safeAnalysis.safer_alternatives.alternatives.length > 0 && (
                      <div className="result-card alternatives-card">
                        <h2>🛡️ Safer Alternatives</h2>
                        <div className="alternatives-intro">
                          <p>{safeAnalysis.safer_alternatives.reasoning || "Based on our privacy analysis, here are some safer alternatives that serve similar purposes:"}</p>
                        </div>
                        
                        <div className="alternatives-grid">
                          {safeAnalysis.safer_alternatives.alternatives.map((alternative, index) => (
                            <div key={index} className="alternative-item">
                              <div className="alternative-header">
                                <h3>{alternative.name}</h3>
                                <div className="alternative-badge">🔒 Privacy-Focused</div>
                              </div>
                              
                              <p className="alternative-description">{alternative.description}</p>
                              
                              <div className="alternative-benefits">
                                <h4>Privacy Benefits:</h4>
                                <p>{alternative.privacy_benefits}</p>
                              </div>
                              
                              {alternative.url && (
                                <div className="alternative-actions">
                                  <button 
                                    onClick={() => window.open(alternative.url, '_blank')}
                                    className="visit-alternative-btn"
                                  >
                                    <ExternalLinkIcon />
                                    Visit Alternative
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {safeAnalysis.safer_alternatives.privacy_focus && (
                          <div className="alternatives-footer">
                            <p><strong>Privacy Focus:</strong> {safeAnalysis.safer_alternatives.privacy_focus}</p>
                            <p className="source-note">💡 Powered by AI analysis of privacy practices</p>
                          </div>
                        )}
                      </div>
                    )}
                    

              </div>
            </ErrorBoundary>
          )}
        </main>

        <footer className="app-footer">
          <p>
            <ShieldIcon /> 
            Powered by AI • No data stored • Open source privacy analysis
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
