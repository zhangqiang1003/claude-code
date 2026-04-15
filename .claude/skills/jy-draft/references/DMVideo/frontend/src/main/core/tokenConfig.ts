/**
 * Token 配置工具类
 * 用于获取临时的 OSS 和百炼凭证
 */

import * as crypto from "crypto";
import { httpClient } from "./httpClient";

/**
 * Token 配置常量
 */
const TOKEN_CONFIG_CONSTANTS = {
  /** 盐值（与服务端一致） */
  SLAT: "019cecd4a2fc713fbb19c0851e7b0987",
  /** AES 密钥（与服务端一致） */
  AES_KEY: "f5&8$f5b#527&eda",
  /** AES 块大小 */
  BLOCK_SIZE: 16,
  /** 默认 API 基础地址 */
  DEFAULT_BASE_URL: 'https://test.dmaodata.cn',
  // DEFAULT_BASE_URL: "http://127.0.0.1:38080",
  /** API 路径 */
  API_PATH: "/app-api/token/config/getInfo",
} as const;

/**
 * OSS 临时凭证
 */
export interface OSSCredentials {
  /** 临时 AccessKey ID */
  accessKeyId: string;
  /** 临时 AccessKey Secret */
  accessKeySecret: string;
  /** 安全令牌 */
  securityToken: string;
  /** 过期时间 */
  expiration: string;
  /** Bucket 名称 */
  bucket: string;
  /** 地域 */
  region: string;
}

/**
 * 百炼配置
 */
export interface BailianConfig {
  /** 临时 API Key */
  apiKey: string;
}

/**
 * 飞书配置
 */
export interface FeishuConfig {
  /** 飞书应用 ID */
  app_id: string;
  /** 飞书应用密钥 */
  app_secret: string;
}

/**
 * 模型价格档位
 */
export interface ModelPriceTier {
  /** 输入最小 token 数 */
  input_min_tokens: number;
  /** 输入最大 token 数 */
  input_max_tokens: number;
  /** 每百万输入 token 价格 */
  input_price_per_million: number;
  /** 每百万输出 token 价格 */
  output_price_per_million: number;
  /** 货币单位 */
  currency: string;
  /** 备注 */
  note: string;
}

/**
 * 应用配置
 */
export interface AppConfig {
  /** 仿写文案表格地址 */
  rewriteTableUrl: string;
  /** 源视频素材表格地址 */
  sourceTableUrl: string;
  /** 模型名称 */
  modelName: string;
  /** 模型价格（JSON 数组字符串） */
  modelPrice: string;
  /** 解析后的模型价格档位列表 */
  modelPriceTiers?: ModelPriceTier[];
  /** 飞书配置（JSON 字符串） */
  feishu: string;
  /** 解析后的飞书配置 */
  feishuConfig?: FeishuConfig;
}

/**
 * Token 配置信息（解密后）
 */
export interface TokenConfigInfo {
  /** OSS 配置 */
  oss?: OSSCredentials;
  /** 百炼配置 */
  bailian?: BailianConfig;
  /** 应用配置 */
  config?: AppConfig;
}

/**
 * 服务端响应结构
 */
interface TokenConfigResponse {
  code: number;
  data: {
    data: string;
    key: string;
  };
  msg: string;
}

/**
 * Token 配置工具类
 * 封装获取临时凭证的业务逻辑
 */
export class TokenConfigUtil {
  private static instance: TokenConfigUtil | null = null;
  private baseUrl: string;
  private cachedConfig: TokenConfigInfo | null = null;
  private cacheExpireTime: number = 0;
  /** 百炼 API Key 独立 TTL：9 分钟（提前 1 分钟刷新，key 有效期 10 分钟） */
  private static readonly BAILIAN_KEY_TTL = 9 * 60 * 1000;
  /** 百炼 API Key 上次获取时间 */
  private bailianKeyFetchTime: number = 0;

  private constructor() {
    this.baseUrl = TOKEN_CONFIG_CONSTANTS.DEFAULT_BASE_URL;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TokenConfigUtil {
    if (!TokenConfigUtil.instance) {
      TokenConfigUtil.instance = new TokenConfigUtil();
    }
    return TokenConfigUtil.instance;
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
   * 生成 32 位 UUID（去掉横线）
   */
  private generateUuid(): string {
    return crypto.randomUUID().replace(/-/g, "");
  }

  /**
   * 生成随机字符串
   * @param length 长度
   */
  private randomString(length: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 计算 MD5
   * @param content 内容
   */
  private md5(content: string): string {
    return crypto.createHash("md5").update(content).digest("hex");
  }

  /**
   * 生成请求参数
   * key 格式：prefix.reversed_uuid.suffix
   * sign 格式：MD5(content + slat)，content 是原始 UUID 的中间 16 位
   */
  private generateRequestParams(): { key: string; sign: string } {
    // 1. 生成 32 位 UUID
    const uuid = this.generateUuid();

    // 2. 反转 UUID
    const reversedUuid = uuid.split("").reverse().join("");

    // 3. 从原始 UUID 中取中间 16 位（8-24位）
    const content = uuid.substring(8, 24);

    // 4. 生成随机前缀和后缀
    const prefix = this.randomString(8);
    const suffix = this.randomString(12);

    // 5. 拼接 key：prefix.reversed_uuid.suffix
    const key = `${prefix}.${reversedUuid}.${suffix}`;

    // 6. 计算 sign：MD5(content + slat)
    const sign = this.md5(content + TOKEN_CONFIG_CONSTANTS.SLAT);

    return { key, sign };
  }

  /**
   * AES-CBC 解密
   * @param cipherText Base64 编码的密文
   * @param iv 初始化向量
   */
  private decrypt(cipherText: string, iv: string): string {
    try {
      const keyBuffer = Buffer.from(TOKEN_CONFIG_CONSTANTS.AES_KEY, "utf-8");
      const ivBuffer = Buffer.from(iv, "utf-8");
      const encryptedBuffer = Buffer.from(cipherText, "base64");

      console.log("[TokenConfigUtil] 加密数据长度:", encryptedBuffer.length);

      const decipher = crypto.createDecipheriv(
        "aes-128-cbc",
        keyBuffer,
        ivBuffer,
      );

      let decrypted = decipher.update(encryptedBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      console.log("[TokenConfigUtil] 解密后 Buffer 长度:", decrypted.length);

      // 检查 PKCS7 填充
      const padLen = decrypted[decrypted.length - 1];
      console.log("[TokenConfigUtil] PKCS7 填充长度:", padLen);

      // 验证填充是否有效
      if (padLen > 0 && padLen <= 16) {
        // 检查最后 padLen 个字节是否都是 padLen
        let validPadding = true;
        for (let i = 0; i < padLen; i++) {
          if (decrypted[decrypted.length - 1 - i] !== padLen) {
            validPadding = false;
            break;
          }
        }
        if (validPadding) {
          decrypted = decrypted.slice(0, decrypted.length - padLen);
          console.log("[TokenConfigUtil] 去除填充后长度:", decrypted.length);
        } else {
          console.log("[TokenConfigUtil] 填充无效，保留原始数据");
        }
      }

      return decrypted.toString("utf-8");
    } catch (error) {
      console.error("[TokenConfigUtil] 解密失败:", error);
      throw new Error("解密失败");
    }
  }

  /**
   * 获取 Token 配置信息
   * @param forceRefresh 是否强制刷新缓存
   */
  public async getConfigInfo(
    forceRefresh: boolean = false,
  ): Promise<TokenConfigInfo | null> {
    // 检查缓存是否有效（提前 60 秒刷新）
    if (
      !forceRefresh &&
      this.cachedConfig &&
      Date.now() < this.cacheExpireTime - 60000
    ) {
      return this.cachedConfig;
    }

    try {
      // 1. 生成请求参数
      const { key, sign } = this.generateRequestParams();

      // 2. 临时设置 API 基础地址
      const originalUrl = httpClient.getBaseURL();
      httpClient.setBaseURL(this.baseUrl);

      // 3. 发送请求
      const response = await httpClient.post<TokenConfigResponse["data"]>(
        TOKEN_CONFIG_CONSTANTS.API_PATH,
        { key, sign },
        { headers: { "tenant-id": "1" } },
      );

      // 恢复原来的 URL
      httpClient.setBaseURL(originalUrl);

      // 4. 检查响应
      if (response.code !== 0 || !response.data) {
        console.error("[TokenConfigUtil] 获取配置失败:", response.msg);
        return this.cachedConfig; // 返回缓存的配置
      }

      const { data: encryptedData, key: iv } = response.data;

      // 调试：打印加密数据信息
      console.log("[TokenConfigUtil] 加密数据长度:", encryptedData.length);
      console.log("[TokenConfigUtil] IV 长度:", iv.length);

      // 5. 解密数据
      const decryptedStr = this.decrypt(encryptedData, iv);

      // 调试：打印解密后的原始字符串
      console.log("[TokenConfigUtil] 解密后字符串长度:", decryptedStr.length);
      console.log(
        "[TokenConfigUtil] 解密后字符串前100字符:",
        decryptedStr.substring(0, 100),
      );
      console.log(
        "[TokenConfigUtil] 解密后字符串后100字符:",
        decryptedStr.substring(decryptedStr.length - 100),
      );

      // 清理可能的无效字符（去除前后空白和控制字符）
      const cleanedStr = decryptedStr
        .trim()
        .replace(/[\x00-\x1F\x7F]/g, (char) => {
          // 只保留换行符、制表符和回车符
          if (char === "\n" || char === "\t" || char === "\r") return char;
          return "";
        });

      let configInfo: TokenConfigInfo;
      try {
        configInfo = JSON.parse(cleanedStr);
      } catch (parseError: any) {
        console.error(
          "[TokenConfigUtil] JSON 解析失败，原始字符串:",
          cleanedStr,
        );
        throw parseError;
      }

      // 解析模型价格 JSON 字符串
      if (configInfo.config?.modelPrice) {
        try {
          configInfo.config.modelPriceTiers = JSON.parse(
            configInfo.config.modelPrice,
          );
        } catch (parseError: any) {
          console.error("[TokenConfigUtil] 模型价格解析失败:", parseError);
          configInfo.config.modelPriceTiers = [];
        }
      }

      // 解析飞书配置 JSON 字符串
      if (configInfo.config?.feishu) {
        console.log('[TokenConfigUtil] 原始 feishu 字段:', configInfo.config.feishu);
        try {
          configInfo.config.feishuConfig = JSON.parse(configInfo.config.feishu);
          console.log('[TokenConfigUtil] 解析后的飞书配置:', configInfo.config.feishuConfig);
        } catch (parseError: any) {
          console.error("[TokenConfigUtil] 飞书配置解析失败:", parseError);
          configInfo.config.feishuConfig = undefined;
        }
      } else {
        console.log('[TokenConfigUtil] config.feishu 字段不存在或为空');
        console.log('[TokenConfigUtil] config 对象:', JSON.stringify(configInfo.config, null, 2));
      }

      // 6. 缓存配置（根据 OSS 凭证过期时间设置缓存时间）
      this.cachedConfig = configInfo;
      if (configInfo.oss?.expiration) {
        // 解析 ISO 格式的过期时间
        const expireTime = new Date(configInfo.oss.expiration).getTime();
        this.cacheExpireTime = expireTime;
      } else {
        // 默认缓存 10 分钟
        this.cacheExpireTime = Date.now() + 10 * 60 * 1000;
      }

      console.log("[TokenConfigUtil] 成功获取配置信息");
      return configInfo;
    } catch (error: any) {
      console.error("[TokenConfigUtil] 获取配置信息失败:", error);
      return this.cachedConfig; // 返回缓存的配置
    }
  }

  /**
   * 获取 OSS 临时凭证
   * @param forceRefresh 是否强制刷新
   */
  public async getOSSCredentials(
    forceRefresh: boolean = false,
  ): Promise<OSSCredentials | null> {
    const config = await this.getConfigInfo(forceRefresh);
    return config?.oss || null;
  }

  /**
   * 获取百炼临时 API Key
   * 百炼 key 有效期 10 分钟，独立于全局缓存（基于 OSS 过期时间）
   * @param forceRefresh 是否强制刷新
   */
  public async getBailianApiKey(
    forceRefresh: boolean = false,
  ): Promise<string | null> {
    // 如果有缓存的 Bailian key，检查是否超过 9 分钟（提前 1 分钟刷新）
    if (
      !forceRefresh &&
      this.cachedConfig?.bailian?.apiKey &&
      this.bailianKeyFetchTime > 0
    ) {
      const elapsed = Date.now() - this.bailianKeyFetchTime;
      if (elapsed >= TokenConfigUtil.BAILIAN_KEY_TTL) {
        console.log("[TokenConfigUtil] 百炼 API Key 已接近过期，强制刷新");
        forceRefresh = true;
      }
    }

    const config = await this.getConfigInfo(forceRefresh);
    if (config?.bailian?.apiKey) {
      // 仅在刷新了配置或首次获取时更新时间
      if (forceRefresh || this.bailianKeyFetchTime === 0) {
        this.bailianKeyFetchTime = Date.now();
      }
      return config.bailian.apiKey;
    }
    return null;
  }

  /**
   * 获取应用配置
   * @param forceRefresh 是否强制刷新
   */
  public async getAppConfig(
    forceRefresh: boolean = false,
  ): Promise<AppConfig | null> {
    const config = await this.getConfigInfo(forceRefresh);
    return config?.config || null;
  }

  /**
   * 获取仿写文案表格地址
   * @param forceRefresh 是否强制刷新
   */
  public async getRewriteTableUrl(
    forceRefresh: boolean = false,
  ): Promise<string | null> {
    const config = await this.getConfigInfo(forceRefresh);
    return config?.config?.rewriteTableUrl || null;
  }

  /**
   * 获取源视频素材表格地址
   * @param forceRefresh 是否强制刷新
   */
  public async getSourceTableUrl(
    forceRefresh: boolean = false,
  ): Promise<string | null> {
    const config = await this.getConfigInfo(forceRefresh);
    return config?.config?.sourceTableUrl || null;
  }

  /**
   * 获取模型名称
   * @param forceRefresh 是否强制刷新
   */
  public async getModelName(
    forceRefresh: boolean = false,
  ): Promise<string | null> {
    const config = await this.getConfigInfo(forceRefresh);
    return config?.config?.modelName || null;
  }

  /**
   * 获取模型价格档位列表
   * @param forceRefresh 是否强制刷新
   */
  public async getModelPriceTiers(
    forceRefresh: boolean = false,
  ): Promise<ModelPriceTier[]> {
    const config = await this.getConfigInfo(forceRefresh);
    return config?.config?.modelPriceTiers || [];
  }

  /**
   * 获取飞书配置
   * @param forceRefresh 是否强制刷新
   */
  public async getFeishuConfig(
    forceRefresh: boolean = false,
  ): Promise<FeishuConfig | null> {
    const config = await this.getConfigInfo(forceRefresh);
    return config?.config?.feishuConfig || null;
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cachedConfig = null;
    this.cacheExpireTime = 0;
    this.bailianKeyFetchTime = 0;
  }

  /**
   * 检查缓存是否有效
   */
  public isCacheValid(): boolean {
    return this.cachedConfig !== null && Date.now() < this.cacheExpireTime;
  }
}

// 导出单例实例
export const tokenConfigUtil = TokenConfigUtil.getInstance();
