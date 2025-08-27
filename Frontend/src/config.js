// Configuration for Privacy Browser Frontend
const config = {
  // Backend API URL - Update this after deploying to Render
  BACKEND_URL: process.env.NODE_ENV === 'production' 
    ? 'https://privacybrowser-backend.onrender.com'  // Your deployed Render backend
    : 'http://localhost:8000',
  
  // API endpoints
  ENDPOINTS: {
    FETCH_POLICY: '/fetch-privacy-policy',
    ANALYZE_DIRECT: '/analyze-direct-policy',
    HEALTH: '/',
    TEST_SIMPLE: '/test-simple',
  },
  
  // Request timeout (in milliseconds) - Increased to match backend
  TIMEOUT: 60000,  // 60 seconds to match backend timeout
  
  // Retry attempts
  MAX_RETRIES: 3,
};

export default config;
