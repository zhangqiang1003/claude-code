/**
 * HTTP 请求工具类
 * 基于 axios 封装的通用 HTTP 客户端
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosError,
} from "axios";
import { CLIENT_ID } from "./clientIdentity";

/**
 * 请求配置扩展
 */
export interface HttpRequestConfig extends AxiosRequestConfig {
  skipErrorHandler?: boolean; // 是否跳过错误处理
}

/**
 * 响应结构
 */
export interface HttpResponse<T = any> {
  code: number;
  data: T;
  msg: string;
}

/**
 * HTTP 客户端配置
 */
export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * HTTP 客户端类
 */
class HttpClient {
  private instance: AxiosInstance;
  private baseURL: string;

  constructor(config: HttpClientConfig = {}) {
    this.baseURL =
      config.baseURL || process.env.API_BASE_URL || "https://test.dmaodata.cn";

    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
    });

    this.setupInterceptors();
  }

  /**
   * 配置请求/响应拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const timestamp = new Date().toISOString();
        // 构建完整的请求 URL
        const fullURL = config.url?.startsWith('http')
          ? config.url
          : `${config.baseURL || this.baseURL}${config.url}`;
        console.log(
          `[HttpClient] ${timestamp} REQUEST: ${config.method?.toUpperCase()} ${fullURL}`,
        );
        if (config.data) {
          console.log(
            "[HttpClient] Request Data:",
            JSON.stringify(config.data, null, 2),
          );
        }
        // 仅对自家后端 (dmaodata.cn) 的请求携带客户端标识
        if (CLIENT_ID && CLIENT_ID !== '__CLIENT_ID_PLACEHOLDER__' && fullURL.includes('dmaodata.cn')) {
          config.headers['X-Client-ID'] = CLIENT_ID;
        }
        return config;
      },
      (error: AxiosError) => {
        console.error("[HttpClient] Request Error:", error.message);
        return Promise.reject({
          code: -1,
          msg: error.message,
          data: null,
        });
      },
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const timestamp = new Date().toISOString();
        // 构建完整的请求 URL
        const fullURL = response.config.url?.startsWith('http')
          ? response.config.url
          : `${response.config.baseURL || this.baseURL}${response.config.url}`;
        console.log(
          `[HttpClient] ${timestamp} RESPONSE: ${response.status} ${fullURL}`,
        );
        return response;
      },
      (error: AxiosError) => {
        const timestamp = new Date().toISOString();
        // 构建完整的请求 URL
        const config = error.config;
        const fullURL = config ? (config.url?.startsWith('http')
          ? config.url
          : `${config.baseURL || this.baseURL}${config.url}`) : 'unknown';
        console.error(
          `[HttpClient] ${timestamp} Response Error for ${fullURL}:`,
          error.message,
        );

        // 统一错误处理
        if (error.response) {
          // 服务器返回错误状态码
          const status = error.response.status;
          let errorMessage = "请求失败";

          switch (status) {
            case 400:
              errorMessage = "请求参数错误";
              break;
            case 401:
              errorMessage = "未授权，请检查 Token";
              break;
            case 403:
              errorMessage = "拒绝访问";
              break;
            case 404:
              errorMessage = "请求的资源不存在";
              break;
            case 500:
              errorMessage = "服务器内部错误";
              break;
            case 502:
              errorMessage = "网关错误";
              break;
            case 503:
              errorMessage = "服务不可用";
              break;
            case 504:
              errorMessage = "网关超时";
              break;
            default:
              errorMessage = `请求失败 (${status})`;
          }

          console.error(`[HttpClient] HTTP ${status}: ${errorMessage} - ${fullURL}`);
        } else if (error.request) {
          // 请求已发送但没有收到响应
          console.error(`[HttpClient] 网络错误: 无法连接到服务器 - ${fullURL}`);
        } else {
          // 请求配置错误
          console.error("[HttpClient] 请求配置错误:", error.message);
        }

        return Promise.reject({
          code: -1,
          msg: error.message,
          data: null,
        });
      },
    );
  }

  /**
   * 获取当前基础 URL
   */
  public getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * 设置基础 URL
   */
  public setBaseURL(url: string): void {
    this.baseURL = url;
    this.instance.defaults.baseURL = url;
    console.log(`[HttpClient] 基础 URL 已更新: ${url}`);
  }

  /**
   * 获取 axios 实例
   */
  public getInstance(): AxiosInstance {
    return this.instance;
  }

  /**
   * GET 请求
   */
  public async get<T = any>(
    url: string,
    params?: Record<string, any>,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>> {
    try {
      const response: AxiosResponse<HttpResponse<T>> = await this.instance.get(
        url,
        {
          params,
          ...config,
        },
      );
      return response.data;
    } catch (error) {
      // throw error;
      console.error("[HttpClient] GET 请求失败:", error);
      return Promise.reject({
        code: -1,
        msg: error instanceof Error ? error.message : "GET 请求失败",
        data: null,
      });
    }
  }

  /**
   * POST 请求
   */
  public async post<T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>> {
    try {
      const response: AxiosResponse<HttpResponse<T>> = await this.instance.post(
        url,
        data,
        config,
      );
      return response.data;
    } catch (error) {
      // throw error;
      console.error("[HttpClient] POST 请求失败:", error);
      return Promise.reject({
        code: -1,
        msg: error instanceof Error ? error.message : "POST 请求失败",
        data: null,
      });
    }
  }

  /**
   * PUT 请求
   */
  public async put<T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>> {
    try {
      const response: AxiosResponse<HttpResponse<T>> = await this.instance.put(
        url,
        data,
        config,
      );
      return response.data;
    } catch (error) {
      // throw error;
      console.error("[HttpClient] PUT 请求失败:", error);
      return Promise.reject({
        code: -1,
        msg: error instanceof Error ? error.message : "PUT 请求失败",
        data: null,
      });
    }
  }

  /**
   * DELETE 请求
   */
  public async delete<T = any>(
    url: string,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>> {
    try {
      const response: AxiosResponse<HttpResponse<T>> =
        await this.instance.delete(url, config);
      return response.data;
    } catch (error) {
      // throw error;
      console.error("[HttpClient] DELETE 请求失败:", error);
      return Promise.reject({
        code: -1,
        msg: error instanceof Error ? error.message : "DELETE 请求失败",
        data: null,
      });
    }
  }

  /**
   * 上传文件
   */
  public async upload<T = any>(
    url: string,
    file: File | Blob,
    fieldName: string = "file",
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>> {
    try {
      const formData = new FormData();
      formData.append(fieldName, file);

      const response: AxiosResponse<HttpResponse<T>> = await this.instance.post(
        url,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          ...config,
        },
      );
      return response.data;
    } catch (error) {
      // throw error;
      console.error("[HttpClient] 上传文件失败:", error);
      return Promise.reject({
        code: -1,
        msg: error instanceof Error ? error.message : "上传文件失败",
        data: null,
      });
    }
  }

  /**
   * 下载文件
   */
  public async download(
    url: string,
    params?: Record<string, any>,
    config?: HttpRequestConfig,
  ): Promise<Blob> {
    try {
      const response: AxiosResponse = await this.instance.get(url, {
        params,
        responseType: "blob",
        ...config,
      });
      return response.data;
    } catch (error) {
      // throw error;
      console.error("[HttpClient] 下载文件失败:", error);
      return Promise.reject({
        code: -1,
        msg: error instanceof Error ? error.message : "下载文件失败",
        data: null,
      });
    }
  }

  /**
   * 设置请求头
   */
  public setHeader(key: string, value: string): void {
    this.instance.defaults.headers.common[key] = value;
  }

  /**
   * 移除请求头
   */
  public removeHeader(key: string): void {
    delete this.instance.defaults.headers.common[key];
  }

  /**
   * 设置 Authorization 头
   */
  public setAuthorization(token: string): void {
    this.setHeader("Authorization", `Bearer ${token}`);
  }

  /**
   * 移除 Authorization 头
   */
  public removeAuthorization(): void {
    this.removeHeader("Authorization");
  }

  /**
   * 原始请求（支持完整自定义配置）
   * 用于特殊情况，如第三方 API、二进制响应等
   */
  public async request<T = any>(config: {
    url: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    baseURL?: string;
    params?: Record<string, any>;
    data?: any;
    headers?: Record<string, string>;
    responseType?: "json" | "blob" | "arraybuffer" | "stream";
    timeout?: number;
  }): Promise<T> {
    try {
      // 如果 URL 以 http 开头（绝对路径），需要避免 axios 拼接实例默认的 baseURL
      // 关键：axios 在合并 config 时，undefined 会 fallback 到实例默认值
      // 所以必须显式设置 baseURL 为 false 或删除该字段来阻止拼接
      const isAbsoluteURL = config.url.startsWith('http');
      const axiosConfig: any = {
        url: config.url,
        method: config.method || "GET",
        params: config.params,
        data: config.data,
        headers: config.headers,
        responseType: config.responseType || "json",
        timeout: config.timeout,
      };
      // 仅在非绝对路径时才传递 baseURL
      if (!isAbsoluteURL && config.baseURL !== undefined) {
        axiosConfig.baseURL = config.baseURL;
      }

      const response: AxiosResponse<T> = await this.instance.request(axiosConfig);
      return response.data;
    } catch (error) {
      // throw error;
      console.error("[HttpClient] 原始请求失败:", error);
      return Promise.reject({
        code: -1,
        msg: error instanceof Error ? error.message : "原始请求失败",
        data: null,
      });
    }
  }

  /**
   * 下载二进制数据（返回 Buffer）
   */
  public async downloadBuffer(
    url: string,
    params?: Record<string, any>,
    config?: {
      headers?: Record<string, string>;
      baseURL?: string;
      timeout?: number;
    },
  ): Promise<Buffer> {
    try {
      const response: AxiosResponse = await this.instance.get(url, {
        params,
        responseType: "arraybuffer",
        ...config,
      });
      return Buffer.from(response.data);
    } catch (error) {
      // throw error;
      console.error("[HttpClient] 下载二进制数据失败:", error);
      return Promise.reject({
        code: -1,
        msg: error instanceof Error ? error.message : "下载二进制数据失败",
        data: null,
      });
    }
  }

  /**
   * 上传表单数据（支持 Node.js form-data）
   */
  public async uploadFormData<T = any>(
    url: string,
    formData: any,
    config?: {
      headers?: Record<string, string>;
      baseURL?: string;
      timeout?: number;
    },
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.instance.post(
        url,
        formData,
        {
          headers: {
            ...config?.headers,
          },
          timeout: config?.timeout,
          baseURL: config?.baseURL,
        },
      );
      return response.data;
    } catch (error) {
      // throw error;
      console.error("[HttpClient] 上传表单数据失败:", error);
      return Promise.reject({
        code: -1,
        msg: error instanceof Error ? error.message : "上传表单数据失败",
        data: null,
      });
    }
  }
}

// 创建默认实例
const httpClient = new HttpClient();

// 导出
export { HttpClient, httpClient };
