/**
 * 微信扫码登录 API 工具类
 * 封装微信扫码登录相关的 API 调用
 */

import axios, { AxiosInstance } from 'axios';

/**
 * 微信扫码登录响应
 */
export interface WechatQrcodeLoginResp {
  state: string;        // 二维码状态标识
  qrcodeUrl: string;    // 二维码图片URL（微信授权链接）
  expireTime: number;   // 过期时间戳
}

/**
 * 微信扫码登录状态响应
 */
export interface WechatQrcodeLoginStatusResp {
  status: number;       // 0-等待扫码 1-已扫码 2-已确认 3-已取消 4-已过期
  loginResult?: {       // 登录结果（仅status=2时存在）
    accessToken: string;
    refreshToken: string;
    expiresTime: number;
    userId: number;
    nickname: string;
    avatar: string;
  };
}

/**
 * API 响应结构
 */
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

/**
 * 微信扫码登录 API 路径常量
 */
const WECHAT_AUTH_API_PATHS = {
  GET_QRCODE_LOGIN: '/app-api/member/auth/wechat-qrcode-login',
  CHECK_QRCODE_LOGIN_STATUS: '/app-api/member/auth/wechat-qrcode-login-status',
} as const;

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'tenant-id': 1
  },
};

/**
 * 微信扫码登录 API 工具类（单例模式）
 */
class WechatAuthUtil {
  private static instance: WechatAuthUtil | null = null;
  private http: AxiosInstance;
  private baseUrl: string;

  private constructor() {
    // 默认基础 URL，可通过 setBaseUrl 动态配置
    this.baseUrl = process.env.WECHAT_API_BASE_URL || 'https://test.dmaodata.cn';
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: DEFAULT_CONFIG.timeout,
      headers: DEFAULT_CONFIG.headers,
    });

    this.setupInterceptors();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): WechatAuthUtil {
    if (!WechatAuthUtil.instance) {
      WechatAuthUtil.instance = new WechatAuthUtil();
    }
    return WechatAuthUtil.instance;
  }

  /**
   * 配置请求/响应拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.http.interceptors.request.use(
      (config) => {
        const timestamp = new Date().toISOString();
        const fullUrl = `${config.baseURL || ''}${config.url}?${new URLSearchParams(config.params || {}).toString()}`.replace(/\?$/, '');
        console.log(`[WechatAuth] ${timestamp} REQUEST: ${config.method?.toUpperCase()} ${fullUrl}`);
        return config;
      },
      (error) => {
        console.error('[WechatAuth] Request Error:', error.message);
        return Promise.reject({
          code: -1,
          msg: error.message || '请求失败',
          data: null,
        });
      }
    );

    // 响应拦截器
    this.http.interceptors.response.use(
      (response) => {
        const timestamp = new Date().toISOString();
        console.log(`[WechatAuth] ${timestamp} RESPONSE: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const timestamp = new Date().toISOString();
        console.error(`[WechatAuth] ${timestamp} Response Error:`, error.message);

        return Promise.reject({
          code: -1,
          msg: error.message || '请求失败',
          data: null,
        });
      }
    );
  }

  /**
   * 获取当前 API 基础地址
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * 设置 API 基础地址（动态配置）
   */
  public setBaseUrl(url: string): void {
    this.baseUrl = url;
    this.http.defaults.baseURL = url;
    console.log(`[WechatAuth] 基础 URL 已更新: ${url}`);
  }

  /**
   * 获取微信扫码登录二维码
   * @returns 二维码信息（包含 state、二维码 URL、过期时间）
   */
  public async getQrcodeLogin(): Promise<ApiResponse<WechatQrcodeLoginResp>> {
    try {
      const response = await this.http.get<ApiResponse<WechatQrcodeLoginResp>>(
        WECHAT_AUTH_API_PATHS.GET_QRCODE_LOGIN
      );
      let data = response.data;
      console.log('[WechatAuth] 获取二维码响应:', JSON.stringify(data, null, 2));
      console.log('[WechatAuth] 扫码登录地址:', data?.data?.qrcodeUrl || '无');
      return data;
    } catch (error: any) {
      console.error('[WechatAuth] 获取二维码失败:', error);
      return {
        code: -1,
        msg: error.message || '获取二维码失败',
        data: null as unknown as WechatQrcodeLoginResp,
      };
    }
  }

  /**
   * 查询微信扫码登录状态
   * @param state 二维码状态标识
   * @returns 扫码状态
   */
  public async checkQrcodeLoginStatus(state: string): Promise<ApiResponse<WechatQrcodeLoginStatusResp>> {
    try {
      const response = await this.http.get<ApiResponse<WechatQrcodeLoginStatusResp>>(
        WECHAT_AUTH_API_PATHS.CHECK_QRCODE_LOGIN_STATUS,
        { params: { state } }
      );
      return response.data;
    } catch (error: any) {
      console.error('[WechatAuth] 查询登录状态失败:', error);
      return {
        code: -1,
        msg: error.message || '查询登录状态失败',
        data: null as unknown as WechatQrcodeLoginStatusResp,
      };
    }
  }

  /**
   * 通用 GET 请求（用于调用其他微信相关 API）
   * @param url 请求路径
   * @param params 查询参数
   * @param headers 额外请求头
   */
  public async get<T = any>(
    url: string,
    params?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    try {
      const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
      const response = await this.http.get<ApiResponse<T>>(fullUrl, {
        params,
        headers: { ...DEFAULT_CONFIG.headers, ...headers },
      });
      return response.data;
    } catch (error: any) {
      console.error('[WechatAuth] GET 请求失败:', error);
      return {
        code: -1,
        msg: error.message || '请求失败',
        data: null as unknown as T,
      };
    }
  }

  /**
   * 通用 POST 请求（用于调用其他微信相关 API）
   * @param url 请求路径
   * @param data 请求体
   * @param headers 额外请求头
   */
  public async post<T = any>(
    url: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    try {
      const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
      const response = await this.http.post<ApiResponse<T>>(fullUrl, data, {
        headers: { ...DEFAULT_CONFIG.headers, ...headers },
      });
      return response.data;
    } catch (error: any) {
      console.error('[WechatAuth] POST 请求失败:', error);
      return {
        code: -1,
        msg: error.message || '请求失败',
        data: null as unknown as T,
      };
    }
  }
}

// 导出单例实例
export const wechatAuthUtil = WechatAuthUtil.getInstance();

// 导出类以便需要时创建新实例
export { WechatAuthUtil };
