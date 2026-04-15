/**
 * 阿里云 OSS 文件上传工具类
 * 支持文件上传并返回内网地址
 */

import * as path from 'path';
import * as fs from 'fs';
import { tokenConfigUtil } from './tokenConfig';

// ali-oss 是 CommonJS 模块，需要使用 require 或 default 导入
const OSS = require('ali-oss');

/**
 * OSS 配置接口
 */
export interface OSSConfig {
  /** AccessKey ID */
  accessKeyId: string;
  /** AccessKey Secret */
  accessKeySecret: string;
  /** Bucket 名称 */
  bucket: string;
  /** 地域，如 'oss-cn-hangzhou' */
  region: string;
  /** 是否使用内网地址（默认 true） */
  useInternal?: boolean;
  /** 上传目录前缀（可选） */
  uploadDir?: string;
  /** STS 安全令牌（可选，用于临时凭证） */
  securityToken?: string;
}

/**
 * 上传结果
 */
export interface UploadResult {
  /** 是否成功 */
  success: boolean;
  /** 文件名（包含路径） */
  name: string;
  /** 内网访问地址 */
  internalUrl: string;
  /** 外网访问地址 */
  publicUrl: string;
  /** 带签名的临时访问 URL（用于私有 bucket） */
  signedUrl: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 阿里云 OSS 工具类
 */
export class OSSUtil {
  private client: any = null;
  private config: OSSConfig | null = null;
  private bucketDomain: string = '';

  /**
   * 初始化 OSS 客户端
   * @param config OSS 配置
   */
  init(config: OSSConfig): void {
    this.config = config;

    // 创建 OSS 客户端
    // 如果 useInternal 为 true，使用内网 endpoint
    const endpoint = config.useInternal !== false
      ? `https://oss-${config.region}-internal.aliyuncs.com`
      : `https://oss-${config.region}.aliyuncs.com`;

    console.log('[OSSUtil] 初始化参数:', JSON.stringify({
      region: config.region,
      bucket: config.bucket,
      endpoint,
      hasAccessKeyId: !!config.accessKeyId,
      hasAccessKeySecret: !!config.accessKeySecret,
      hasSecurityToken: !!config.securityToken,
    }));

    const clientOptions: any = {
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      endpoint,
      secure: true,
      timeout: 300000, // 5 分钟，大文件上传需要更长时间
    };

    // 如果有 STS token，添加到配置中
    if (config.securityToken) {
      clientOptions.stsToken = config.securityToken;
    }

    try {
      this.client = new OSS(clientOptions);
      console.log('[OSSUtil] 客户端创建成功');
    } catch (error: any) {
      console.error('[OSSUtil] 客户端创建失败:', error);
      throw error;
    }

    // 构建 bucket 域名
    this.bucketDomain = `${config.bucket}.oss-${config.region}.aliyuncs.com`;
  }

  /**
   * 获取内网地址
   * @param objectName 对象名称（路径）
   */
  getInternalUrl(objectName: string): string {
    if (!this.config) {
      throw new Error('OSS 未初始化');
    }
    return `https://${this.config.bucket}.oss-${this.config.region}-internal.aliyuncs.com/${objectName}`;
  }

  /**
   * 为已存在的 OSS 对象生成带签名的内网访问 URL
   * @param objectName 对象名称（路径）
   * @param expires 有效期（秒），默认 3600
   */
  generateSignedUrl(objectName: string, expires: number = 3600): string {
    if (!this.client) {
      throw new Error('OSS 未初始化');
    }
    return this.client.signatureUrl(objectName, { expires });
  }

  /**
   * 为已存在的 OSS 对象生成带签名的内网访问 URL
   * OSS 和百炼同在北京区域，使用内网地址访问更快且免费
   * @param objectName 对象名称（路径）
   * @param expires 有效期（秒），默认 3600
   */
  generateSignedInternalUrl(objectName: string, expires: number = 3600): string {
    if (!this.client || !this.config) {
      throw new Error('OSS 未初始化');
    }
    // 先用公网客户端生成签名 URL
    const publicSignedUrl = this.client.signatureUrl(objectName, { expires });
    // 将公网域名替换为内网域名（签名基于 objectName 和参数，不包含 host，因此替换后签名仍然有效）
    const publicHost = `${this.config.bucket}.oss-${this.config.region}.aliyuncs.com`;
    const internalHost = `${this.config.bucket}.oss-${this.config.region}-internal.aliyuncs.com`;
    return publicSignedUrl.replace(publicHost, internalHost);
  }

  /**
   * 获取外网地址
   * @param objectName 对象名称（路径）
   */
  getPublicUrl(objectName: string): string {
    return `https://${this.bucketDomain}/${objectName}`;
  }

  /**
   * 生成唯一文件名
   * @param originalName 原始文件名
   * @param prefix 路径前缀
   */
  private generateObjectName(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);

    // 构建文件名
    const fileName = `${baseName}_${timestamp}_${randomStr}${ext}`;

    // 添加前缀
    if (prefix) {
      return `${prefix}/${fileName}`;
    }

    return fileName;
  }

  /**
   * 上传文件（带自动重试）
   * @param filePath 本地文件路径
   * @param options 上传选项
   */
  async uploadFile(
    filePath: string,
    options?: {
      /** 自定义文件名（不填则自动生成） */
      objectName?: string;
      /** 是否覆盖同名文件 */
      overwrite?: boolean;
      /** 签名 URL 有效期（秒），默认 3600 */
      expires?: number;
      /** 重试次数，默认 3 */
      retries?: number;
    }
  ): Promise<UploadResult> {
    if (!this.client || !this.config) {
      return {
        success: false,
        name: '',
        internalUrl: '',
        publicUrl: '',
        signedUrl: '',
        error: 'OSS 未初始化，请先调用 init 方法',
      };
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        name: '',
        internalUrl: '',
        publicUrl: '',
        signedUrl: '',
        error: `文件不存在: ${filePath}`,
      };
    }

    // 生成对象名称
    const objectName = options?.objectName
      ? options.objectName
      : this.generateObjectName(path.basename(filePath), this.config.uploadDir);

    const maxRetries = options?.retries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[OSSUtil] 上传文件尝试 ${attempt}/${maxRetries}: ${filePath}`);

        // 上传文件
        const result = await this.client.put(objectName, filePath);

        // 生成带签名的临时访问 URL（用于私有 bucket）
        const expires = options?.expires || 3600; // 默认 1 小时
        const signedUrl = this.client.signatureUrl(objectName, { expires });

        console.log('[OSSUtil] 文件上传成功，签名 URL 有效期:', expires, '秒');

        return {
          success: true,
          name: objectName,
          internalUrl: this.getInternalUrl(objectName),
          publicUrl: result.url || this.getPublicUrl(objectName),
          signedUrl,
        };
      } catch (error: any) {
        lastError = error;
        console.error(`[OSSUtil] 上传文件失败 (尝试 ${attempt}/${maxRetries}):`, error.message);

        // 如果是文件不存在，不重试
        if (error.status === 404) {
          break;
        }

        // 如果是认证相关错误（Access Key 无效、Token 过期等），尝试刷新凭证并重试
        const isAuthError = error.code === 'InvalidAccessKeyId' ||
                           error.code === 'AccessDenied' ||
                           error.message?.includes('security token') ||
                           error.message?.includes('expired') ||
                           error.message?.includes('Access Key');

        if (isAuthError) {
          console.log('[OSSUtil] 检测到认证错误，尝试刷新凭证...');

          try {
            // 强制刷新凭证
            const credentials = await tokenConfigUtil.getOSSCredentials(true);
            if (credentials) {
              // 重新初始化 OSS 客户端
              this.init({
                accessKeyId: credentials.accessKeyId,
                accessKeySecret: credentials.accessKeySecret,
                bucket: credentials.bucket,
                region: credentials.region,
                useInternal: this.config?.useInternal,
                securityToken: credentials.securityToken,
              });
              console.log('[OSSUtil] 凭证刷新成功,重新尝试上传...');

              // 重试上传（不增加 attempt 计数）
              const retryResult = await this.client.put(objectName, filePath);
              const expires = options?.expires || 3600;
              const signedUrl = this.client.signatureUrl(objectName, { expires });

              return {
                success: true,
                name: objectName,
                internalUrl: this.getInternalUrl(objectName),
                publicUrl: retryResult.url || this.getPublicUrl(objectName),
                signedUrl,
              };
            }
          } catch (refreshError: any) {
            console.error('[OSSUtil] 刷新凭证失败:', refreshError);
            // 刷新失败,继续常规重试逻辑
          }
        }

        // 如果不是最后一次尝试,等待后重试
        if (attempt < maxRetries) {
          const delay = attempt * 1000; // 1s, 2s, 3s...
          console.log(`[OSSUtil] 等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      name: '',
      internalUrl: '',
      publicUrl: '',
      signedUrl: '',
      error: lastError?.message || '上传失败（已重试）',
    };
  }

  /**
   * 上传 Buffer 数据
   * @param buffer 文件 Buffer
   * @param fileName 文件名
   * @param options 上传选项
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    options?: {
      /** 自定义对象名称 */
      objectName?: string;
      /** 签名 URL 有效期（秒），默认 3600 */
      expires?: number;
    }
  ): Promise<UploadResult> {
    if (!this.client || !this.config) {
      return {
        success: false,
        name: '',
        internalUrl: '',
        publicUrl: '',
        signedUrl: '',
        error: 'OSS 未初始化，请先调用 init 方法',
      };
    }

    try {
      // 生成对象名称
      const objectName = options?.objectName
        ? options.objectName
        : this.generateObjectName(fileName, this.config.uploadDir);

      // 上传 Buffer
      const result = await this.client.put(objectName, buffer);

      // 生成带签名的临时访问 URL
      const expires = options?.expires || 3600;
      const signedUrl = this.client.signatureUrl(objectName, { expires });

      return {
        success: true,
        name: objectName,
        internalUrl: this.getInternalUrl(objectName),
        publicUrl: result.url || this.getPublicUrl(objectName),
        signedUrl,
      };
    } catch (error: any) {
      console.error('[OSSUtil] 上传 Buffer 失败:', error);
      return {
        success: false,
        name: '',
        internalUrl: '',
        publicUrl: '',
        signedUrl: '',
        error: error.message || '上传失败',
      };
    }
  }

  /**
   * 批量上传文件
   * @param filePaths 本地文件路径列表
   */
  async uploadFiles(filePaths: string[]): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const filePath of filePaths) {
      const result = await this.uploadFile(filePath);
      results.push(result);
    }

    return results;
  }

  /**
   * 删除文件
   * @param objectName 对象名称
   */
  async deleteFile(objectName: string): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'OSS 未初始化' };
    }

    try {
      await this.client.delete(objectName);
      return { success: true };
    } catch (error: any) {
      console.error('[OSSUtil] 删除文件失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查文件是否存在
   * @param objectName 对象名称
   */
  async exists(objectName: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.head(objectName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): OSSConfig | null {
    return this.config;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.client !== null && this.config !== null;
  }
}

// 导出单例实例
export const ossUtil = new OSSUtil();