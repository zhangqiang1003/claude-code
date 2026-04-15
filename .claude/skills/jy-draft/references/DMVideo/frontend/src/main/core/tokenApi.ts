/**
 * Token API 工具类
 * 封装与服务端 Token 相关的 API 调用
 */

import { httpClient, HttpClient } from './httpClient';
import { tokenAesCrypto, TaskType, TaskStatus } from './tokenAesCrypto';

// 重导出枚举类型供外部使用
export { TaskType, TaskStatus };

/**
 * Token 信息响应（服务端原始格式）
 */
export interface TokenInfoRaw {
  id: number;
  apiToken: string;
  hasUsed: boolean;
  totalPoints: number;
  usedPoints: number;
  createTime: number;  // 时间戳（毫秒）
  expireTime: number;  // 时间戳（毫秒）
}

/**
 * Token 信息响应（格式化后）
 */
export interface TokenInfo {
  id: number;
  apiToken: string;
  hasUsed: boolean;
  totalPoints: number;
  usedPoints: number;
  unusedPoints: number;
  expireTime: string;
  createTime: string;
  taskId?: string;
  taskType?: number;
  taskStatus?: number;
}

/**
 * 生成 Token 请求参数（业务层使用）
 */
export interface GenerateTokenParams {
  /** 有效期（ISO 日期字符串） */
  expireTime: string;
  /** 总积分数 */
  totalPoints: number;
}

/**
 * 扣除积分请求参数（业务层使用）
 */
export interface DeductPointsParams {
  /** API Token */
  apiToken: string;
  /** Token ID */
  tokenId: number;
  /** 本次消耗的积分数 */
  usedPoints: number;
  /** 任务类型（可选，默认 GENERAL） */
  taskType?: TaskType;
  /** 任务 ID（可选，视频分析任务必填） */
  taskId?: string;
  /** 任务状态（可选，默认 SUBMITTED） */
  taskStatus?: TaskStatus;
}

/**
 * API 响应结构
 */
export interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

/**
 * Token API 路径常量
 */
const TOKEN_API_PATHS = {
  GET_TOKEN_INFO: '/app-api/token/record/getTokenInfo',
  GENERATE_TOKEN: '/app-api/token/record/generateSelfToken',
  UNUSED_TOKEN: '/app-api/token/record/unusedToken',
  RECORD_LOG: '/app-api/token/record/recordLogToken',
} as const;

/**
 * 默认请求头
 */
const DEFAULT_HEADERS = {
  'tenant-id': '1',
};

/**
 * 格式化时间戳为日期字符串
 * @param timestamp 毫秒级时间戳
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化 Token 信息
 * @param raw 原始响应数据
 */
function formatTokenInfo(raw: TokenInfoRaw): TokenInfo {
  const totalPoints = raw.totalPoints || 0;
  const usedPoints = raw.usedPoints || 0;
  const unusedPoints = Math.max(0, totalPoints - usedPoints);

  return {
    id: raw.id,
    apiToken: raw.apiToken,
    hasUsed: raw.hasUsed,
    totalPoints,
    usedPoints,
    unusedPoints,
    createTime: formatTimestamp(raw.createTime),
    expireTime: formatTimestamp(raw.expireTime),
  };
}

/**
 * Token API 工具类（单例模式）
 */
class TokenApiUtil {
  private static instance: TokenApiUtil | null = null;
  private http: HttpClient;

  private constructor() {
    this.http = httpClient;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TokenApiUtil {
    if (!TokenApiUtil.instance) {
      TokenApiUtil.instance = new TokenApiUtil();
    }
    return TokenApiUtil.instance;
  }

  /**
   * 获取当前 API 基础地址
   */
  public getBaseUrl(): string {
    return this.http.getBaseURL();
  }

  /**
   * 设置 API 基础地址（动态配置）
   */
  public setBaseUrl(url: string): void {
    this.http.setBaseURL(url);
  }

  /**
   * 获取 Token 信息
   * @param apiToken API Token
   * @param taskId 任务ID（可选）
   */
  public async getTokenInfo(apiToken: string, taskId?: string): Promise<ApiResponse<TokenInfo>> {
    const params: Record<string, string> = { apiToken };
    if (taskId) {
      params.taskId = taskId;
    }

    // 使用原始响应类型
    const response = await this.http.get<TokenInfoRaw>(
      TOKEN_API_PATHS.GET_TOKEN_INFO,
      params,
      { headers: DEFAULT_HEADERS }
    );

    console.log("res = ", response)

    // 格式化响应数据
    if (response.code === 0 && response.data) {

      return {
        code: response.code,
        msg: response.msg,
        data: formatTokenInfo(response.data),
      };
    }

    // 即使失败也尝试格式化数据
    if (response.data) {
      return {
        code: response.code,
        msg: response.msg,
        data: formatTokenInfo(response.data),
      };
    }

    // 返回默认空数据
    return {
      code: response.code,
      msg: response.msg,
      data: null as unknown as TokenInfo,
    };
  }

  /**
   * 生成 Token（内部方法，使用加密后的参数）
   * @param encryptedData 加密后的数据
   * @param key UUID 密钥
   */
  private async generateTokenInternal(encryptedData: string, key: string): Promise<ApiResponse<string>> {
    return await this.http.post<string>(
      TOKEN_API_PATHS.GENERATE_TOKEN,
      { data: encryptedData, key },
      { headers: DEFAULT_HEADERS }
    );
  }

  /**
   * 生成 Token（业务方法，自动加密）
   * @param params 生成 Token 参数
   */
  public async generateSelfToken(params: GenerateTokenParams): Promise<ApiResponse<string>> {
    // 使用 tokenAesCrypto 生成加密参数
    const { key, data } = tokenAesCrypto.generateTokenParams(params);

    return await this.generateTokenInternal(data, key);
  }

  /**
   * 禁用指定 Token
   * @param apiToken API Token
   */
  public async unusedToken(apiToken: string): Promise<ApiResponse<boolean>> {
    return await this.http.post<boolean>(
      TOKEN_API_PATHS.UNUSED_TOKEN,
      { apiToken },
      { headers: DEFAULT_HEADERS }
    );
  }

  /**
   * 记录 Token 日志（内部方法，使用加密后的参数）
   * @param encryptedData 加密后的数据
   * @param key UUID 密钥
   */
  private async recordLogTokenInternal(encryptedData: string, key: string): Promise<ApiResponse<boolean>> {
    return await this.http.post<boolean>(
      TOKEN_API_PATHS.RECORD_LOG,
      { data: encryptedData, key },
      { headers: DEFAULT_HEADERS }
    );
  }

  /**
   * 检查 Token 是否有效
   * @param apiToken API Token
   */
  public async checkTokenValid(apiToken: string): Promise<{
    valid: boolean;
    info?: TokenInfo;
    error?: string;
  }> {
    try {
      const response = await this.getTokenInfo(apiToken);

      if (response.code !== 0) {
        return {
          valid: false,
          info: response.data,
          error: response.msg,
        };
      }

      // 检查是否已使用完
      if (response.data.hasUsed) {
        return {
          valid: false,
          info: response.data,
          error: '积分已用完',
        };
      }

      // 检查是否过期
      const expireTime = new Date(response.data.expireTime).getTime();
      if (expireTime < Date.now()) {
        return {
          valid: false,
          info: response.data,
          error: 'Token 已过期',
        };
      }

      return {
        valid: true,
        info: response.data,
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取剩余积分
   * @param apiToken API Token
   */
  public async getRemainingPoints(apiToken: string): Promise<number> {
    try {
      const response = await this.getTokenInfo(apiToken);

      if (response.code === 0 && response.data) {
        return response.data.unusedPoints || 0;
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 检查是否有足够积分
   * @param apiToken API Token
   * @param requiredPoints 所需积分
   */
  public async hasEnoughPoints(apiToken: string, requiredPoints: number): Promise<boolean> {
    const remainingPoints = await this.getRemainingPoints(apiToken);
    return remainingPoints >= requiredPoints;
  }

  /**
   * 扣除积分（记录消耗）
   * 使用 AES 加密请求数据
   * @param params 扣除积分参数
   */
  public async deductPoints(params: DeductPointsParams): Promise<ApiResponse<boolean>> {
    // 构建加密参数
    const { key, data } = tokenAesCrypto.generateRecordLogParams({
      tokenId: params.tokenId,
      apiToken: params.apiToken,
      usedPoints: params.usedPoints,
      taskType: params.taskType,
      taskId: params.taskId,
      taskStatus: params.taskStatus,
    });

    // 发送加密请求
    return await this.recordLogTokenInternal(data, key);
  }

  /**
   * 扣除积分（简化版，自动获取 tokenId）
   * @param apiToken API Token
   * @param usedPoints 本次消耗的积分数
   * @param taskType 任务类型（可选）
   * @param taskId 任务ID（可选）
   * @param taskStatus 任务状态（可选）
   */
  public async deductPointsAuto(
    apiToken: string,
    usedPoints: number,
    taskType?: TaskType,
    taskId?: string,
    taskStatus?: TaskStatus
  ): Promise<{
    success: boolean;
    remainingPoints?: number;
    error?: string;
  }> {
    try {
      // 1. 获取 Token 信息
      const tokenInfo = await this.getTokenInfo(apiToken);

      if (tokenInfo.code !== 0) {
        return {
          success: false,
          error: tokenInfo.msg || '获取 Token 信息失败',
        };
      }

      // 2. 检查积分是否足够
      if (tokenInfo.data.unusedPoints < usedPoints) {
        return {
          success: false,
          remainingPoints: tokenInfo.data.unusedPoints,
          error: `积分不足，当前剩余 ${tokenInfo.data.unusedPoints}，需要 ${usedPoints}`,
        };
      }

      // 3. 扣除积分（服务端 usedPoints 为 Integer）
      // 若消耗积分 >= 1 则向上取整，否则向下取整，最小为 1
      const roundedPoints = Math.max(1, usedPoints >= 1 ? Math.ceil(usedPoints) : Math.floor(usedPoints));
      const result = await this.deductPoints({
        apiToken,
        tokenId: tokenInfo.data.id,
        usedPoints: roundedPoints,
        taskType,
        taskId,
        taskStatus,
      });

      if (result.code !== 0) {
        return {
          success: false,
          error: result.msg || '扣除积分失败',
        };
      }

      // 4. 返回剩余积分
      return {
        success: true,
        remainingPoints: tokenInfo.data.unusedPoints - roundedPoints,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取 Token 完整信息（用于显示）
   * @param apiToken API Token
   */
  public async getTokenDisplayInfo(apiToken: string): Promise<{
    success: boolean;
    info?: {
      apiToken: string;
      totalPoints: number;
      usedPoints: number;
      unusedPoints: number;
      createTime: string;
      expireTime: string;
      hasUsed: boolean;
    };
    error?: string;
  }> {
    try {
      const response = await this.getTokenInfo(apiToken);

      if (response.code !== 0) {
        return {
          success: false,
          error: response.msg,
        };
      }

      return {
        success: true,
        info: {
          apiToken: response.data.apiToken,
          totalPoints: response.data.totalPoints,
          usedPoints: response.data.usedPoints,
          unusedPoints: response.data.unusedPoints,
          createTime: response.data.createTime,
          expireTime: response.data.expireTime,
          hasUsed: response.data.hasUsed,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// 导出单例实例
export const tokenApiUtil = TokenApiUtil.getInstance();

// 导出类以便需要时创建新实例
export { TokenApiUtil };
