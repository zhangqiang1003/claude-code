/**
 * 客户端信息工具类
 * 封装 TokenClientInfo 相关的 API 请求
 */

import { httpClient } from "./httpClient";
import { CLIENT_ID } from "./clientIdentity";

/**
 * 客户端信息常量
 */
const CLIENT_INFO_CONSTANTS = {
  /** 默认 API 基础地址 */
  DEFAULT_BASE_URL: "https://test.dmaodata.cn",
  // DEFAULT_BASE_URL: "http://127.0.0.1:38080",
  /** API 路径：获取二维码地址 */
  QRCODE_PATH: "/app-api/token/client-info/qrcode",
} as const;

/**
 * 二维码响应
 */
export interface QrcodeResponse {
  /** 二维码地址 */
  data: string;
}

/**
 * 二维码完整结果（含 base64）
 */
export interface QrcodeResult {
  /** 图片 URL */
  url: string;
  /** base64 data URL */
  base64: string;
}

/**
 * 客户端信息工具类
 * 封装与后端 TokenClientInfoController 的交互
 */
export class ClientInfoUtil {
  private static instance: ClientInfoUtil | null = null;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = CLIENT_INFO_CONSTANTS.DEFAULT_BASE_URL;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ClientInfoUtil {
    if (!ClientInfoUtil.instance) {
      ClientInfoUtil.instance = new ClientInfoUtil();
    }
    return ClientInfoUtil.instance;
  }

  /**
   * 设置 API 基础地址
   */
  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * 获取 API 基础地址
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * 根据 client-id 获取二维码地址
   * 对应后端接口：GET /token/client-info/qrcode
   * @returns 二维码地址，失败返回 null
   */
  public async getQrcodeUrl(): Promise<string | null> {
    try {
      // 临时设置 API 基础地址
      const originalUrl = httpClient.getBaseURL();
      httpClient.setBaseURL(this.baseUrl);

      const response = await httpClient.get<QrcodeResponse>(
        CLIENT_INFO_CONSTANTS.QRCODE_PATH,
        undefined,
        {
          headers: {
            "x-client-id": CLIENT_ID,
            "tenant-id": "1",
          },
        },
      );

      // 恢复原来的 URL
      httpClient.setBaseURL(originalUrl);

      if (response.code !== 0 || !response.data?.data) {
        console.error("[ClientInfoUtil] 获取二维码地址失败:", response.msg);
        return null;
      }

      console.log("[ClientInfoUtil] 获取二维码地址成功");
      return response.data.data;
    } catch (error: any) {
      console.error("[ClientInfoUtil] 获取二维码地址失败:", error);
      return null;
    }
  }

  /**
   * 仅获取二维码 URL（快速返回，不下载图片）
   */
  public async getQrcode(): Promise<string | null> {
    return this.getQrcodeUrl();
  }

  /**
   * 下载指定 URL 的图片并转为 base64
   * 在主进程中下载，避免渲染进程 CORS 限制
   */
  public async downloadImageAsBase64(imageUrl: string): Promise<string | null> {
    try {
      const axios = require('axios');
      const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const contentType = resp.headers['content-type'] || 'image/png';
      const base64 = Buffer.from(resp.data, 'binary').toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch (error: any) {
      console.error("[ClientInfoUtil] 下载图片失败:", error.message);
      return null;
    }
  }
}

// 导出单例实例
export const clientInfoUtil = ClientInfoUtil.getInstance();
