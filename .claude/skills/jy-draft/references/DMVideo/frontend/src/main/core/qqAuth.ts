/**
 * QQ 扫码登录 API 工具类
 * 封装 QQ 扫码登录相关的 API 调用
 */

import axios, { AxiosInstance } from 'axios';

/**
 * QQ 扫码登录响应
 */
export interface QqQrcodeLoginResp {
  state: string;        // 二维码状态标识
  qrcodeUrl: string;    // 二维码图片URL（QQ授权链接）
  expireTime: number;   // 过期时间戳
}

/**
 * QQ 扫码登录状态响应
 */
export interface QqQrcodeLoginStatusResp {
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
 * QQ 扫码登录 API 路径常量
 */
const QQ_AUTH_API_PATHS = {
  GET_QRCODE_LOGIN: '/app-api/member/auth/qq-qrcode-login',
  CHECK_QRCODE_LOGIN_STATUS: '/app-api/member/auth/qq-qrcode-login-status',
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
 * QQ 扫码登录 API 工具类（单例模式）
 */
class QqAuthUtil {
  private static instance: QqAuthUtil | null = null;
  private http: AxiosInstance;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = process.env.QQ_API_BASE_URL || 'https://test.dmaodata.cn';

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: DEFAULT_CONFIG.timeout,
      headers: DEFAULT_CONFIG.headers,
    });

    this.setupInterceptors();
  }

  public static getInstance(): QqAuthUtil {
    if (!QqAuthUtil.instance) {
      QqAuthUtil.instance = new QqAuthUtil();
    }
    return QqAuthUtil.instance;
  }

  private setupInterceptors(): void {
    // 请求拦截器
    this.http.interceptors.request.use(
      (config) => {
        const timestamp = new Date().toISOString();
        const fullUrl = `${config.baseURL || ''}${config.url}?${new URLSearchParams(config.params || {}).toString()}`.replace(/\?$/, '');
        console.log(`[QqAuth] ${timestamp} REQUEST: ${config.method?.toUpperCase()} ${fullUrl}`);
        return config;
      },
      (error) => {
        console.error('[QqAuth] Request Error:', error.message);
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
        console.log(`[QqAuth] ${timestamp} RESPONSE: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const timestamp = new Date().toISOString();
        console.error(`[QqAuth] ${timestamp} Response Error:`, error.message);
        return Promise.reject({
          code: -1,
          msg: error.message || '请求失败',
          data: null,
        });
      }
    );
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url;
    this.http.defaults.baseURL = url;
    console.log(`[QqAuth] 基础 URL 已更新: ${url}`);
  }

  /**
   * 获取 QQ 扫码登录二维码
   */
  public async getQrcodeLogin(): Promise<ApiResponse<QqQrcodeLoginResp>> {
    try {
      const response = await this.http.get<ApiResponse<QqQrcodeLoginResp>>(
        QQ_AUTH_API_PATHS.GET_QRCODE_LOGIN
      );
      let data = response.data;
      console.log('[QqAuth] 获取二维码响应:', JSON.stringify(data, null, 2));
      console.log('[QqAuth] 扫码登录地址:', data?.data?.qrcodeUrl || '无');
      return data;
    } catch (error: any) {
      console.error('[QqAuth] 获取二维码失败:', error);
      return {
        code: -1,
        msg: error.message || '获取二维码失败',
        data: null as unknown as QqQrcodeLoginResp,
      };
    }
  }

  /**
   * 查询 QQ 扫码登录状态
   * @param state 二维码状态标识
   */
  public async checkQrcodeLoginStatus(state: string): Promise<ApiResponse<QqQrcodeLoginStatusResp>> {
    try {
      const response = await this.http.get<ApiResponse<QqQrcodeLoginStatusResp>>(
        QQ_AUTH_API_PATHS.CHECK_QRCODE_LOGIN_STATUS,
        { params: { state } }
      );
      return response.data;
    } catch (error: any) {
      console.error('[QqAuth] 查询登录状态失败:', error);
      return {
        code: -1,
        msg: error.message || '查询登录状态失败',
        data: null as unknown as QqQrcodeLoginStatusResp,
      };
    }
  }
}

// 导出单例实例
export const qqAuthUtil = QqAuthUtil.getInstance();

// 导出类以便需要时创建新实例
export { QqAuthUtil };
