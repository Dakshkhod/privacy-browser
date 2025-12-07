// Configuration for Privacy Browser Frontend
const config = {
  // Backend API URL - Uses VITE_BACKEND_URL if set, otherwise defaults
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || (
    import.meta.env.PROD
      ? 'https://privacybrowser-backend.onrender.com'  // Production default
      : 'http://localhost:5001'  // Development default
  ),

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
