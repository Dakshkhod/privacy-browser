// Configuration for Privacy Browser Frontend
const config = {
  // Backend API URL - Uses VITE_BACKEND_URL if set, otherwise defaults
  // For Vercel + EC2 setup: use '/api' in production to leverage Vercel rewrites proxy
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || (
    import.meta.env.PROD
      ? '/api'  // Production: Use Vercel rewrites proxy (see vercel.json)
      : 'http://localhost:5001'  // Development default
  ),

  // API endpoints
  ENDPOINTS: {
    FETCH_POLICY: '/fetch-privacy-policy',
    ANALYZE_DIRECT: '/analyze-direct-policy',
    ANALYZE_POLICY: '/analyze-policy',
    HEALTH: '/',
    TEST_SIMPLE: '/test-simple',
  },

  // Request timeout (in milliseconds) - Increased to match backend
  TIMEOUT: 60000,  // 60 seconds to match backend timeout

  // Retry attempts
  MAX_RETRIES: 3,
};

export default config;
