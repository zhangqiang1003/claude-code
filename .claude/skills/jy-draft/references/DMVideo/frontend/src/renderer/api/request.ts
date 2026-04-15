import { AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth';
import cache from '../utils/cache';
import constants from "../constants";

// 从环境变量中获取
const BASE_URL = constants.SERVER_BASE_URL;

// API 基础配置
export const API_CONFIG = {
    BASE_URL: BASE_URL, // 将从应用配置获取
    TIMEOUT: 30000,
};

/**
 * 处理401认证失败
 * 清除token并显示登录弹窗
 */
const handleUnauthorized = () => {
  const authStore = useAuthStore();

  // 清除过期的认证信息
  authStore.logout();

  // 显示登录弹窗
  authStore.showLoginDialog();

  console.warn('[Request] 登录已过期，请重新登录');
};

/**
 * 处理响应
 * 检查是否需要处理特殊状态码
 */
const handleResponse = <T>(response: ApiResponse<T>): ApiResponse<T> => {
  // 检查401未授权状态 或 100需要登录状态
  if (response.code === 401 || response.code === 100) {
    handleUnauthorized();
  }

  return response;
};

// 请求响应接口
export interface ApiResponse<T = any> {
    code: number;
    msg: string;
    data: T;
    is_more?: boolean;
    page_count?: number;
    page_index?: number;
    total?: number;
}

/**
 * 获取请求头
 * 从缓存获取 token 和其他认证信息
 */
const getRequestHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json;charset=UTF-8',
    };

    // 从缓存获取 user 信息
    const user = cache.get<any>('user');
    if (user?.token) {
        headers['Authorization'] = `${user.token.type} ${user.token.access}`;
    }

    // 添加 Bench header
    const bench = cache.get<any>('bench');
    if (bench?.token) {
        headers['Bench'] = bench.token;
    }

    // 添加 Version header
    headers['Version'] = 'medical';

    return headers;
};

/**
 * PUT 请求方法 (对应原 sys.request 的 PUT 方法)
 * 通过主进程代理请求，避免 CORS 问题
 */
export const putRequest = async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
    const headers = {
        ...getRequestHeaders(),
        ...config?.headers,
    };

    // 打印请求日志
    console.log('=== PUT Request ===');
    console.log('URL:', url);
    console.log('Data:', data);
    console.log('Headers:', headers);

    const response = await window.electronAPI.httpPut<T>(url, data, headers);

    // 打印响应日志
    console.log('=== PUT Response ===');
    console.log('URL:', url);
    console.log('Response:', response);

    // 检查响应状态码（如401）
    return handleResponse<T>(response);
};

/**
 * GET 请求方法
 * 通过主进程代理请求，避免 CORS 问题
 */
export const getRequest = async <T = any>(
    url: string,
    params?: any,
    config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
    const headers = {
        ...getRequestHeaders(),
        ...config?.headers,
    };

    // 打印请求日志
    console.log('=== GET Request ===');
    console.log('URL:', url);
    console.log('Params:', params);
    console.log('Headers:', headers);

    const response = await window.electronAPI.httpGet<T>(url, params, headers);

    // 打印响应日志
    console.log('=== GET Response ===');
    console.log('URL:', url);
    console.log('Response:', response);

    // 检查响应状态码（如401）
    return handleResponse<T>(response);
};

/**
 * POST 请求方法
 * 通过主进程代理请求，避免 CORS 问题
 */
export const postRequest = async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
    const headers = {
        ...getRequestHeaders(),
        ...config?.headers,
    };

    // 打印请求日志
    console.log('=== POST Request ===');
    console.log('URL:', url);
    console.log('Data:', data);
    console.log('Headers:', headers);

    const response = await window.electronAPI.httpPost<T>(url, data, headers);

    // 打印响应日志
    console.log('=== POST Response ===');
    console.log('URL:', url);
    console.log('Response:', response);

    // 检查响应状态码（如401）
    return handleResponse<T>(response);
};

/**
 * DELETE 请求方法
 * 通过主进程代理请求，避免 CORS 问题
 */
export const deleteRequest = async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
    const headers = {
        ...getRequestHeaders(),
        ...config?.headers,
    };

    // 打印请求日志
    console.log('=== DELETE Request ===');
    console.log('URL:', url);
    console.log('Data:', data);
    console.log('Headers:', headers);

    const response = await window.electronAPI.httpDelete<T>(url, data, headers);

    // 打印响应日志
    console.log('=== DELETE Response ===');
    console.log('URL:', url);
    console.log('Response:', response);

    // 检查响应状态码（如401）
    return handleResponse<T>(response);
};

// 设置 API 基础 URL
export const setBaseUrl = async (url: string) => {
    API_CONFIG.BASE_URL = url;
    await window.electronAPI.httpSetBaseUrl(url);
};

/**
 * 上传文件
 * @param url 上传地址
 * @param fileData 文件数据
 * @param formData 额外的表单数据
 */
export const uploadFileRequest = async <T = any>(
    url: string,
    fileData: {
        base64: string;
        fileName: string;
        mimeType: string;
    },
    formData?: Record<string, any>
): Promise<ApiResponse<T>> => {
    const headers = {
        ...getRequestHeaders(),
    };

    // 打印请求日志
    console.log('=== UPLOAD File Request ===');
    console.log('URL:', url);
    console.log('FileName:', fileData.fileName);
    console.log('FileSize:', fileData.base64.length);
    console.log('FormData:', formData);
    console.log('Headers:', headers);

    const response = await window.electronAPI.httpUploadFile<T>(url, fileData, formData, headers);

    // 打印响应日志
    console.log('=== UPLOAD File Response ===');
    console.log('URL:', url);
    console.log('Response:', response);

    // 检查响应状态码（如401）
    return handleResponse<T>(response);
};
