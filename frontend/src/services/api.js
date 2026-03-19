import axios from 'axios';

const baseURL =
  process.env.REACT_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000';

const api = axios.create({
  baseURL,
});

// Ngrok free tier shows an HTML interstitial in browser/WebView; this header skips it
if (baseURL && baseURL.includes('ngrok')) {
  api.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
}

// Attach admin JWT when present (for admin dashboard requests)
try {
  const getAdminToken = () => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('bingo_admin_token');
    } catch {
      return null;
    }
  };
  api.interceptors.request.use((config) => {
    const token = getAdminToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  api.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 503 && err.response?.data?.maintenance) {
        try {
          window.dispatchEvent(new CustomEvent('bingo-maintenance'));
        } catch (_) {}
      }
      return Promise.reject(err);
    }
  );
} catch {
  // ignore
}

export default api;

