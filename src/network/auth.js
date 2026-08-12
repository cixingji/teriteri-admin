import axios from 'axios';

let refreshPromise = null;

const refreshClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
  headers: { 'X-Auth-Scope': 'admin' },
});

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshClient.post('/auth/refresh')
      .then((response) => {
        const token = response.data?.data?.accessToken || response.data?.data?.token;
        if (!token) throw new Error('刷新响应中没有访问令牌');
        localStorage.setItem('teri_token', token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function clearAdminSession() {
  localStorage.removeItem('teri_token');
  localStorage.removeItem('teri_role');
}

export function installAuthInterceptors(instance) {
  instance.defaults.withCredentials = true;
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('teri_token');
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    response => response,
    async (error) => {
      const request = error.config || {};
      const url = request.url || '';
      const authenticationRequest = /\/auth\/refresh|\/account\/login/.test(url);
      if (error.response?.status !== 401 || request.__authRetried || authenticationRequest) {
        return Promise.reject(error);
      }
      request.__authRetried = true;
      try {
        const token = await refreshAccessToken();
        request.headers = request.headers || {};
        request.headers.Authorization = `Bearer ${token}`;
        return instance(request);
      } catch (refreshError) {
        clearAdminSession();
        return Promise.reject(refreshError);
      }
    },
  );
  return instance;
}
