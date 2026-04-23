import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
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
  generate: (data) => api.post('/blog/generate', data),
  improve: (data) => api.post('/blog/improve', data),
  titles: (data) => api.post('/blog/titles', data),
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
