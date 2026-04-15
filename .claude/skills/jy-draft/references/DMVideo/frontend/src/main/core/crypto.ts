/**
 * 加密工具类
 * 使用 AES-256-CBC 算法实现可逆加密
 * 用于对敏感数据进行加密存储和解密使用
 */

import * as crypto from 'crypto';

/**
 * 加密配置
 */
interface CryptoConfig {
  /** 加密密钥（32字节用于AES-256） */
  key: string;
  /** 初始化向量（16字节） */
  iv?: string;
}

/**
 * 加密结果
 */
interface EncryptedData {
  /** 加密后的数据（Base64编码） */
  encrypted: string;
  /** 初始化向量（Base64编码） */
  iv: string;
  /** 认证标签（用于GCM模式） */
  authTag?: string;
}

/**
 * 加密工具类
 * 使用 AES-256-CBC 算法进行对称加密和解密
 */
export class CryptoUtil {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;
  private readonly ivLength = 16; // AES块大小

  /**
   * 创建加密工具实例
   * @param config 加密配置
   */
  constructor(config?: CryptoConfig) {
    // 使用提供的密钥或默认密钥
    const secretKey = config?.key || this.getDefaultKey();

    // 确保密钥长度为32字节（256位）
    this.key = this.deriveKey(secretKey);
  }

  /**
   * 获取默认密钥
   * 基于应用特征生成固定密钥
   */
  private getDefaultKey(): string {
    // 使用应用标识作为默认密钥种子
    // 生产环境建议使用配置文件或环境变量中的密钥
    return 'DMVideo-Secret-Key-2024';
  }

  /**
   * 从密码派生密钥
   * @param password 密码字符串
   * @returns 32字节的密钥Buffer
   */
  private deriveKey(password: string): Buffer {
    return crypto.createHash('sha256').update(password).digest();
  }

  /**
   * 生成随机初始化向量
   * @returns 16字节的随机IV
   */
  private generateIV(): Buffer {
    return crypto.randomBytes(this.ivLength);
  }

  /**
   * 加密字符串
   * @param plainText 明文
   * @returns 加密后的Base64字符串
   */
  encrypt(plainText: string): string {
    if (!plainText) {
      return plainText;
    }

    try {
      // 生成随机IV
      const iv = this.generateIV();

      // 创建加密器
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // 加密数据
      let encrypted = cipher.update(plainText, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // 将IV和加密数据组合，以便解密时使用
      // 格式: iv:encrypted (都是Base64编码)
      const result = `${iv.toString('base64')}:${encrypted}`;

      return result;
    } catch (error) {
      console.error('[Crypto] 加密失败:', error);
      throw new Error('加密失败');
    }
  }

  /**
   * 解密字符串
   * @param encryptedText 加密的字符串（格式: iv:encrypted）
   * @returns 解密后的明文
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) {
      return encryptedText;
    }

    try {
      // 分离IV和加密数据
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('无效的加密数据格式');
      }

      const iv = Buffer.from(parts[0], 'base64');
      const encrypted = parts[1];

      // 创建解密器
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

      // 解密数据
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[Crypto] 解密失败:', error);
      throw new Error('解密失败');
    }
  }

  /**
   * 加密对象
   * @param obj 要加密的对象
   * @returns 加密后的Base64字符串
   */
  encryptObject(obj: object): string {
    const jsonStr = JSON.stringify(obj);
    return this.encrypt(jsonStr);
  }

  /**
   * 解密对象
   * @param encryptedText 加密的字符串
   * @returns 解密后的对象
   */
  decryptObject<T = any>(encryptedText: string): T {
    const jsonStr = this.decrypt(encryptedText);
    return JSON.parse(jsonStr);
  }

  /**
   * 加密并返回结构化数据
   * @param plainText 明文
   * @returns 加密结果对象
   */
  encryptWithDetails(plainText: string): EncryptedData {
    if (!plainText) {
      return { encrypted: '', iv: '' };
    }

    const iv = this.generateIV();
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return {
      encrypted,
      iv: iv.toString('base64')
    };
  }

  /**
   * 使用指定的IV解密
   * @param encryptedData 加密数据对象
   * @returns 解密后的明文
   */
  decryptWithDetails(encryptedData: EncryptedData): string {
    if (!encryptedData.encrypted || !encryptedData.iv) {
      return '';
    }

    const iv = Buffer.from(encryptedData.iv, 'base64');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 对字符串进行哈希（不可逆）
   * @param text 原始字符串
   * @param algorithm 哈希算法，默认sha256
   * @returns 哈希后的十六进制字符串
   */
  hash(text: string, algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'sha256'): string {
    return crypto.createHash(algorithm).update(text).digest('hex');
  }

  /**
   * 生成随机字符串
   * @param length 字符串长度，默认32
   * @returns 随机字符串
   */
  randomString(length: number = 32): string {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  /**
   * 检查字符串是否为加密数据
   * @param text 要检查的字符串
   * @returns 是否为加密数据
   */
  isEncrypted(text: string): boolean {
    if (!text) return false;

    // 加密数据格式: iv:encrypted (两部分都是Base64)
    const parts = text.split(':');
    if (parts.length !== 2) return false;

    // 检查两部分是否都是有效的Base64
    try {
      Buffer.from(parts[0], 'base64');
      Buffer.from(parts[1], 'base64');
      return true;
    } catch {
      return false;
    }
  }
}

// 导出默认实例（使用默认密钥）
export const cryptoUtil = new CryptoUtil();