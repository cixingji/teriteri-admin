import axios from 'axios';
import { ElMessage } from 'element-plus';
import { installAuthInterceptors } from './auth';

function createInstance() {
  const instance = axios.create({
    baseURL: '/api',
    timeout: 30000,
    withCredentials: true,
  });
  installAuthInterceptors(instance);
  instance.interceptors.response.use(
    (response) => {
      if (response.data?.code !== undefined && response.data.code !== 200) {
        ElMessage.error(response.data.message || '请求失败');
      }
      return response;
    },
    (error) => {
      if (error.response?.status !== 401) {
        ElMessage.error(error.response?.data?.message || '网络请求失败');
      }
      return Promise.reject(error);
    },
  );
  return instance;
}

export function get(url, config = {}) {
  return createInstance().get(url, config);
}

export function post(url, data, config = {}) {
  return createInstance().post(url, data, config);
}
