/**
 * 基于 Axios 的 HTTP 请求封装
 * 支持 GET、POST、PUT、DELETE、PATCH 以及文件上传
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosProgressEvent,
  Method,
  InternalAxiosRequestConfig
} from 'axios';
import type {
  ApiResponse,
  RequestConfig,
  UploadFileOptions,
  HttpError
} from './types';
import cache from '../utils/cache';
import logger from '../utils/logger';

// 导出类型
export type * from './types';

// 请求时间记录（用于计算响应耗时）
const requestTimings = new Map<string, number>();

/**
 * 创建 axios 实例
 */
const httpInstance: AxiosInstance = axios.create({
  baseURL: 'http://127.0.0.1:8205',
  timeout: 60000, // 60 秒超时
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * 请求拦截器
 */
httpInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 可以在这里添加 token 等认证信息
    // const token = cache.get<string>('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }

    // 记录请求开始时间
    const requestKey = `${config.method}-${config.url}`;
    requestTimings.set(requestKey, Date.now());
    
    logger.httpRequest(
      config.method?.toUpperCase() || 'GET',
      config.url || '',
      config.data || config.params
    );
    
    return config;
  },
  (error) => {
    logger.error('[HTTP Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 */
httpInstance.interceptors.response.use(
  (response) => {
    const { data, config } = response;

    // 计算请求耗时
    const requestKey = `${config.method}-${config.url}`;
    const startTime = requestTimings.get(requestKey);
    const duration = startTime ? Date.now() - startTime : undefined;
    requestTimings.delete(requestKey);

    logger.httpResponse(
      config.url || '',
      response.status,
      data,
      duration
    );

    // 后端统一返回格式：{ code: number, msg: string, data: any }
    // code === 0 表示成功
    if (data.code === 0) {
      return response;
    }

    // 业务错误，创建 HttpError 对象
    const error = new Error(data.msg || '请求失败') as HttpError;
    error.code = data.code;
    error.data = data.data;

    logger.httpError(config.url || '', error);
    return Promise.reject(error);
  },
  (error) => {
    // HTTP 错误（网络错误、超时等）
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data, config } = error.response;

      logger.httpError(config?.url || '', `Status: ${status}, ${JSON.stringify(data)}`);

      const httpError = new Error(data?.msg || `HTTP Error ${status}`) as HttpError;
      httpError.code = status;
      httpError.data = data;

      return Promise.reject(httpError);
    } else if (error.request) {
      // 请求已发送但无响应
      logger.httpError('Unknown', '网络错误，无响应');

      const noResponseError = new Error('网络错误，请检查网络连接') as HttpError;
      noResponseError.code = -1;
      return Promise.reject(noResponseError);
    } else {
      // 请求配置错误
      logger.httpError('Unknown', error.message);

      const setupError = new Error(error.message) as HttpError;
      setupError.code = -1;
      return Promise.reject(setupError);
    }
  }
);

/**
 * 通用的请求方法
 */
async function request<T = any>(
  method: Method,
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  // 自动添加 /api/v1 前缀
  const fullUrl = url.startsWith('/api/v1') ? url : `/api/v1${url}`;

  const requestConfig: AxiosRequestConfig = {
    ...config,
    method,
    url: fullUrl
  };

  // 根据 HTTP 方法设置参数
  if (['GET', 'DELETE'].includes(method)) {
    requestConfig.params = data;
  } else {
    requestConfig.data = data;
  }

  try {
    const response = await httpInstance.request<ApiResponse<T>>(requestConfig);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * GET 请求
 */
export async function get<T = any>(
  url: string,
  params?: any,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>('GET', url, params, config);
}

/**
 * POST 请求
 */
export async function post<T = any, D = any>(
  url: string,
  data?: D,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>('POST', url, data, config);
}

/**
 * PUT 请求
 */
export async function put<T = any, D = any>(
  url: string,
  data?: D,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>('PUT', url, data, config);
}

/**
 * DELETE 请求
 */
export async function del<T = any>(
  url: string,
  params?: any,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>('DELETE', url, params, config);
}

/**
 * PATCH 请求
 */
export async function patch<T = any, D = any>(
  url: string,
  data?: D,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>('PATCH', url, data, config);
}

/**
 * 文件上传
 */
export async function uploadFile<T = any>(
  url: string,
  options: UploadFileOptions
): Promise<ApiResponse<T>> {
  const { file, fieldName = 'file', data, onUploadProgress } = options;

  // 创建 FormData 对象
  const formData = new FormData();

  // 处理文件（支持单个文件或多个文件）
  if (file instanceof File) {
    formData.append(fieldName, file);
  } else if (file instanceof FileList) {
    for (let i = 0; i < file.length; i++) {
      formData.append(`${fieldName}_${i}`, file[i]);
    }
  }

  // 添加额外的表单数据
  if (data) {
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });
  }

  // 发送请求
  return post<T>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress
  });
}

/**
 * 批量文件上传
 */
export async function uploadFiles<T = any>(
  url: string,
  files: File[],
  fieldName: string = 'files',
  data?: Record<string, any>,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
): Promise<ApiResponse<T>> {
  return uploadFile<T>(url, {
    file: files as any, // FileList 可接受数组
    fieldName,
    data,
    onUploadProgress
  });
}

/**
 * 导出默认实例（用于特殊场景）
 */
export default httpInstance;

/**
 * 导出所有方法集合
 */
export const http = {
  get,
  post,
  put,
  del,
  patch,
  uploadFile,
  uploadFiles
};
