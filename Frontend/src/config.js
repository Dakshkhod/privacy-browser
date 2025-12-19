// Configuration for Privacy Browser Frontend
const config = {
  // Backend API URL - For Vercel + EC2 setup: use '/api' in production to leverage Vercel rewrites proxy
  // In production, always use '/api' proxy (ignores VITE_BACKEND_URL to prevent mixed content)
  // In development, use VITE_BACKEND_URL if set, otherwise default to localhost
  BACKEND_URL: import.meta.env.PROD
    ? '/api'  // Production: Always use Vercel rewrites proxy (see vercel.json)
    : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'),  // Development: Use env var or localhost

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
