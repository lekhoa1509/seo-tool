import axios from 'axios';

const DEFAULT_TIMEOUT = 120000;
const LONG_RUNNING_TIMEOUT = 300000;

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject(new Error('Yêu cầu xử lý quá lâu. Nếu đang tạo kèm hình ảnh, hãy thử lại bằng nút Viết trực tiếp (Stream) hoặc tắt hình ảnh.'));
    }

    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export const keywordsAPI = {
  research: (data) => api.post('/keywords/research', data),
  analyze: (data) => api.post('/keywords/analyze', data),
};

export const auditAPI = {
  auditUrl: (data) => api.post('/audit/url', data),
  quickCheck: (data) => api.post('/audit/quick', data),
};

export const competitorsAPI = {
  analyze: (data) => api.post('/competitors/analyze', data),
  backlinks: (data) => api.post('/competitors/backlinks', data),
};

export const contentAPI = {
  optimize: (data) => api.post('/content/optimize', data),
  outline: (data) => api.post('/content/outline', data),
};

export const blogAPI = {
  generate: (data) => api.post('/blog/generate', data, { timeout: LONG_RUNNING_TIMEOUT }),
  improve: (data) => api.post('/blog/improve', data),
  titles: (data) => api.post('/blog/titles', data),
  publishWordPress: (data) => api.post('/blog/publish-wordpress', data),
};

export const chatAPI = {
  message: (data) => api.post('/chat/message', data),
};

export const imageAPI = {
  generateSeo: (data) => api.post('/images/seo', data, { timeout: LONG_RUNNING_TIMEOUT }),
  editSeo: (data) => api.post('/images/seo/edit', data, { timeout: LONG_RUNNING_TIMEOUT }),
};

export const salesAPI = {
  dashboard: (data) => api.post('/sales/dashboard', data, { timeout: LONG_RUNNING_TIMEOUT }),
  intentMap: (data) => api.post('/sales/intent-map', data, { timeout: LONG_RUNNING_TIMEOUT }),
  moneyPage: (data) => api.post('/sales/money-page', data, { timeout: LONG_RUNNING_TIMEOUT }),
  internalLinks: (data) => api.post('/sales/internal-links', data, { timeout: LONG_RUNNING_TIMEOUT }),
  serpGap: (data) => api.post('/sales/serp-gap', data, { timeout: LONG_RUNNING_TIMEOUT }),
  rankOpportunities: (data) => api.post('/sales/rank-opportunities', data, { timeout: LONG_RUNNING_TIMEOUT }),
  croSchema: (data) => api.post('/sales/cro-schema', data, { timeout: LONG_RUNNING_TIMEOUT }),
};

export const gscAPI = {
  getAuthUrl: () => api.get('/gsc/auth'),
  getStatus: () => api.get('/gsc/status'),
  disconnect: () => api.post('/gsc/disconnect'),
  getSites: () => api.get('/gsc/sites'),
  getPerformance: (data) => api.post('/gsc/performance', data),
  getPages: (data) => api.post('/gsc/pages', data),
  getSummary: (data) => api.post('/gsc/summary', data),
};

export default api;
