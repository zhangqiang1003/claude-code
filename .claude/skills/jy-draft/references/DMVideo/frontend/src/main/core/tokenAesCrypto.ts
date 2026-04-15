/**
 * Token AES 加密工具类
 * 与服务端 Java 版本 AES_CBC 类兼容
 * 用于 Token API 请求数据加密
 */

import * as crypto from 'crypto';

/**
 * Token 加密配置
 * 与 Java 服务端版本保持一致
 */
const TOKEN_AES_CONFIG = {
  // 加密密钥 (与 Java 版本一致)
  KEY: 'f5&8$f5b#527&eda',
  // 生成 Token 的验证值
  SAVE_TOKEN_VAL: 'DMAO10012026SAVETOKEN',
  // 更新 Token 消耗的验证值
  UPDATE_TOKEN_VAL: 'DMAO10012026UPDATETOKEN',
  // AES 块大小
  BLOCK_SIZE: 16,
} as const;

/**
 * 任务类型枚举
 */
export enum TaskType {
  /** 通用任务（每次执行需要消耗token，默认） */
  GENERAL = 1,
  /** 视频分析任务（提交任务时预扣除，查询结果时只消耗一次） */
  VIDEO_ANALYSIS = 2,
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  /** 提交任务 */
  SUBMITTED = 1,
  /** 成功 */
  SUCCESS = 2,
  /** 失败 */
  FAILED = 3,
}

/**
 * 生成 Token 的加密参数
 */
export interface GenerateTokenEncryptParams {
  /** 有效期（ISO 日期字符串） */
  expireTime: string;
  /** 总积分数 */
  totalPoints: number;
}

/**
 * 记录积分消耗的加密参数
 */
export interface RecordLogEncryptParams {
  /** Token 主键 ID */
  tokenId: number;
  /** API Token */
  apiToken: string;
  /** 本次消耗的积分数 */
  usedPoints: number;
  /** 任务类型（可选，默认1） */
  taskType?: TaskType;
  /** 任务 ID（可选，视频分析任务必填） */
  taskId?: string;
  /** 任务状态（可选，默认1） */
  taskStatus?: TaskStatus;
}

/**
 * Token AES-CBC 加密工具类
 * 实现与 Java 服务端 AES_CBC 兼容的加密逻辑
 */
export class TokenAesCrypto {
  private readonly key: Buffer;
  private readonly blockSize: number;

  constructor() {
    // 密钥转换为 Buffer (16字节用于 AES-128-CBC)
    this.key = Buffer.from(TOKEN_AES_CONFIG.KEY, 'utf-8');
    this.blockSize = TOKEN_AES_CONFIG.BLOCK_SIZE;
  }

  /**
   * 生成 UUID (去掉横线，32位)
   * @returns 32位 UUID 字符串
   */
  generateUuid(): string {
    return crypto.randomUUID().replace(/-/g, '');
  }

  /**
   * 从 UUID 提取 IV
   * Java 版本: iv = key.substring(8, 24)
   * @param uuid 32位 UUID 字符串
   * @returns 16位 IV 字符串
   */
  extractIvFromUuid(uuid: string): string {
    return uuid.substring(8, 24);
  }

  /**
   * PKCS7 填充
   * @param data 要填充的数据
   * @returns 填充后的 Buffer
   */
  private pkcs7Pad(data: Buffer): Buffer {
    const padLen = this.blockSize - (data.length % this.blockSize);
    const padding = Buffer.alloc(padLen, padLen);
    return Buffer.concat([data, padding]);
  }

  /**
   * PKCS7 去填充
   * @param data 填充后的数据
   * @returns 去填充后的 Buffer
   */
  private pkcs7Unpad(data: Buffer): Buffer {
    const padLen = data[data.length - 1];

    // 验证填充值是否有效
    if (padLen === 0 || padLen > 16 || padLen > data.length) {
      // 填充值无效，返回原始数据
      console.warn('[TokenAesCrypto] 无效的PKCS7填充值:', padLen);
      return data;
    }

    // 验证所有填充字节是否都是 padLen
    for (let i = 0; i < padLen; i++) {
      if (data[data.length - 1 - i] !== padLen) {
        // 填充验证失败，返回原始数据
        console.warn('[TokenAesCrypto] PKCS7填充验证失败');
        return data;
      }
    }

    // 移除填充字节
    return data.slice(0, data.length - padLen);
  }

  /**
   * AES-CBC 加密
   * @param plainText 明文
   * @param iv 初始化向量 (16字节字符串)
   * @returns Base64 编码的密文
   */
  encrypt(plainText: string, iv: string): string {
    try {
      const ivBuffer = Buffer.from(iv, 'utf-8');
      const dataBuffer = Buffer.from(plainText, 'utf-8');

      // PKCS7 填充
      const paddedData = this.pkcs7Pad(dataBuffer);

      // AES-CBC 加密
      const cipher = crypto.createCipheriv('aes-128-cbc', this.key, ivBuffer);
      const encrypted = Buffer.concat([cipher.update(paddedData), cipher.final()]);

      // 返回 Base64 编码
      return encrypted.toString('base64');
    } catch (error) {
      console.error('[TokenAesCrypto] 加密失败:', error);
      throw new Error('加密失败');
    }
  }

  /**
   * AES-CBC 解密
   * @param cipherText Base64 编码的密文
   * @param iv 初始化向量 (16字节字符串)
   * @returns 明文
   */
  decrypt(cipherText: string, iv: string): string {
    try {
      const ivBuffer = Buffer.from(iv, 'utf-8');
      const encryptedBuffer = Buffer.from(cipherText, 'base64');

      // AES-CBC 解密
      const decipher = crypto.createDecipheriv('aes-128-cbc', this.key, ivBuffer);
      const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

      // 去除 PKCS7 填充
      const unpaddedData = this.pkcs7Unpad(decrypted);

      return unpaddedData.toString('utf-8');
    } catch (error) {
      console.error('[TokenAesCrypto] 解密失败:', error);
      throw new Error('解密失败');
    }
  }

  /**
   * 生成 Token 的加密参数
   * @param params 生成 Token 参数
   * @returns 加密后的请求参数
   */
  generateTokenParams(params: GenerateTokenEncryptParams): { key: string; data: string } {
    // 生成 UUID
    const uuid = this.generateUuid();

    // 从 UUID 提取 IV
    const iv = this.extractIvFromUuid(uuid);

    // 构建请求参数（与服务端 GenerateTokenDTO 一致）
    const content = {
      expireTime: params.expireTime,
      totalPoints: params.totalPoints,
      val: TOKEN_AES_CONFIG.SAVE_TOKEN_VAL,
    };

    // AES 加密
    const encryptedData = this.encrypt(JSON.stringify(content), iv);

    return {
      key: uuid,
      data: encryptedData,
    };
  }

  /**
   * 生成记录积分消耗的加密参数
   * @param params 记录消耗参数
   * @returns 加密后的请求参数
   */
  generateRecordLogParams(params: RecordLogEncryptParams): { key: string; data: string } {
    // 生成 UUID
    const uuid = this.generateUuid();

    // 从 UUID 提取 IV
    const iv = this.extractIvFromUuid(uuid);

    // 构建请求参数（与服务端 UsedPointsDTO 一致）
    const content: Record<string, any> = {
      tokenId: params.tokenId,
      apiToken: params.apiToken,
      usedPoints: params.usedPoints,
      val: TOKEN_AES_CONFIG.UPDATE_TOKEN_VAL,
    };

    // 添加可选参数
    if (params.taskType !== undefined) {
      content.taskType = params.taskType;
    }
    if (params.taskId !== undefined) {
      content.taskId = params.taskId;
    }
    if (params.taskStatus !== undefined) {
      content.taskStatus = params.taskStatus;
    }

    // AES 加密
    const encryptedData = this.encrypt(JSON.stringify(content), iv);

    return {
      key: uuid,
      data: encryptedData,
    };
  }

  /**
   * 获取生成 Token 的验证值
   */
  getSaveTokenVal(): string {
    return TOKEN_AES_CONFIG.SAVE_TOKEN_VAL;
  }

  /**
   * 获取更新消耗的验证值
   */
  getUpdateTokenVal(): string {
    return TOKEN_AES_CONFIG.UPDATE_TOKEN_VAL;
  }
}

// 导出单例实例
export const tokenAesCrypto = new TokenAesCrypto();