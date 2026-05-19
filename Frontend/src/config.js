// Configuration for Privacy Browser Frontend
//
// In production, requests go to "/api/*" which Vercel rewrites to the
// HTTPS Render backend (see vercel.json). The HTTPS backend URL is also
// available as VITE_BACKEND_URL for environments without rewrites.
//
// In development, fall back to VITE_BACKEND_URL or local backend.
const PROD_BACKEND_URL = 'https://privacybrowser-backend.onrender.com';

const config = {
  BACKEND_URL: import.meta.env.PROD
    ? (import.meta.env.VITE_BACKEND_URL || '/api')
    : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'),

  // Direct HTTPS URL — used by warmers, can be hit cross-origin (CORS).
  DIRECT_BACKEND_URL: PROD_BACKEND_URL,

  ENDPOINTS: {
    FETCH_POLICY: '/fetch-privacy-policy',
    ANALYZE_DIRECT: '/analyze-direct-policy',
    ANALYZE_POLICY: '/analyze-policy',
    HEALTH: '/health',
    TEST_SIMPLE: '/test-simple',
  },

  TIMEOUT: 90000,  // matches backend cold-start budget
  MAX_RETRIES: 2,
};

export default config;
