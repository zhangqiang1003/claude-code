/**
 * 视频素材匹配工具类
 * 调用 pyJianYingDraft 的 generate_data 接口
 * 用于生成与文案匹配的视频素材时间线信息
 */

import * as crypto from 'crypto';
import { httpClient } from './httpClient';
import { tokenAesCrypto } from './tokenAesCrypto';

/**
 * 视频匹配配置常量
 */
const VIDEO_MATCH_CONSTANTS = {
  /** 默认 API 地址 */
  DEFAULT_API_URL: 'https://draft.dmaodata.cn',
  /** API 路径 */
  API_PATH: '/draft/generate-data',
  /** Content 前缀 */
  CONTENT_PREFIX: 'dmaogeneratedata',
  /** Content 盐值 */
  CONTENT_SALT: 'dmao_salt_2026',
  /** 消耗积分数 */
  REQUIRED_POINTS: 15,
  /** 请求超时 */
  REQUEST_TIMEOUT: 60000,
} as const;

/**
 * 记录信息
 */
export interface RecordInfo {
  /** 关键词 */
  keywords: string;
  /** 使用次数 */
  used_count: number;
  /** 视频时长 */
  video_duration: number;
}

/**
 * 短句信息
 */
export interface ShortSentence {
  /** 记录 ID 列表 */
  record_ids: string[];
  /** 文本内容 */
  text: string;
  /** 时长（微秒） */
  duration: number;
  /** 结束时间（微秒） */
  end_time: number;
  /** 开始时间（微秒） */
  begin_time: number;
  /**字幕对应视频片段的开始时间 （微妙） */
  video_begin_time: number;
  /**字幕对应视频片段的结束时间 （微妙） */
  video_end_time: number;
  /**字幕对应视频片段的持续时长 （微妙） */
  videoDuration: number;
  /** 记录信息列表 */
  record_infos: RecordInfo[];
  /** 句子 ID */
  sentence_id: number;
  /** 关键词 */
  keywords: string;
}

/**
 * 匹配配置
 */
export interface MatchingConfig {
  /** 随机种子 */
  random_seed?: number;
  /** 时长权重 */
  weight_duration?: number;
  /** 关键词权重 */
  weight_keyword?: number;
  /** 不重复权重 */
  weight_no_repeat?: number;
  /** 使用次数权重 */
  weight_usage?: number;
  /** 合并权重 */
  weight_merge?: number;
  /** 合并阈值 */
  merge_threshold?: number;
}

/**
 * 视频片段信息
 */
export interface RecordSegment {
  /** 视频记录 ID */
  record_id: string;
  /** 片段开始时间（微秒） */
  start_time: number;
  /** 片段结束时间（微秒） */
  end_time: number;
}

/**
 * 匹配结果项
 */
export interface MatchResult {
  /** 句子 ID */
  sentence_id: number;
  /** 文本内容 */
  text: string;
  /** 匹配的视频记录 ID 列表 */
  record_ids: string[];
  /** 视频片段信息列表 */
  record_segments: RecordSegment[];
  /** 关键词（逗号分隔） */
  keywords: string;
  /** 匹配分数 */
  score: number;
  /** 开始时间（微秒） */
  begin_time: number;
  /** 结束时间（微秒） */
  end_time: number;
  /** 时长（微秒） */
  duration: number;
}

/**
 * 结果分析
 */
export interface ResultAnalysis {
  /** 总句子数 */
  total_sentences: number;
  /** 总片段数 */
  total_segments: number;
  /** 使用的唯一记录数 */
  unique_records_used: number;
  /** 平均片段时长（微秒） */
  avg_segment_duration_us: number;
  /** 每句平均片段数 */
  segments_per_sentence: number;
}

/**
 * 视频匹配响应数据
 */
export interface VideoMatchResponse {
  /** 匹配结果列表 */
  results: MatchResult[];
  /** 结果分析 */
  analysis: ResultAnalysis;
}

/**
 * 请求参数
 */
export interface VideoMatchRequest {
  /** 短句列表 */
  short_sentences: ShortSentence[];
  /** 可选配置 */
  config?: MatchingConfig;
}

/**
 * 视频匹配选项
 */
export interface VideoMatchOptions {
  /** API Token */
  apiToken: string;
  /** API 基础地址（可选） */
  baseUrl?: string;
}

/**
 * API 响应结构
 */
interface ApiResponse {
  code: number;
  message: string;
  data: {
    key: string;
    data: string;
  } | null;
}

/**
 * 视频素材匹配工具类
 */
export class VideoMatchUtil {
  private static instance: VideoMatchUtil | null = null;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = VIDEO_MATCH_CONSTANTS.DEFAULT_API_URL;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): VideoMatchUtil {
    if (!VideoMatchUtil.instance) {
      VideoMatchUtil.instance = new VideoMatchUtil();
    }
    return VideoMatchUtil.instance;
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
   * 生成 UUID
   */
  private generateUuid(): string {
    return crypto.randomUUID().replace(/-/g, '');
  }

  /**
   * 计算 MD5
   */
  private md5(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 生成随机字符串
   */
  private randomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成 content 字段的 hash 值
   * 格式: MD5("dmaogeneratedata#yyyymmdd" + salt)
   * @param dateStr 日期字符串 yyyymmdd，默认当天
   */
  public generateContentHash(dateStr?: string): string {
    const date = dateStr || this.formatDate(new Date());
    const rawString = `${VIDEO_MATCH_CONSTANTS.CONTENT_PREFIX}#${date}${VIDEO_MATCH_CONSTANTS.CONTENT_SALT}`;
    return this.md5(rawString);
  }

  /**
   * 格式化日期为 yyyymmdd
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * 修复常见的 JSON 格式问题
   */
  private fixJsonString(jsonStr: string): string {
    // 移除可能存在的 markdown 代码块标记
    let fixed = jsonStr.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

    // 移除控制字符
    fixed = fixed.replace(/[\x00-\x1F\x7F]/g, (char) => {
      if (char === "\n" || char === "\r" || char === "\t") return char;
      return "";
    });

    // 修复末尾多余的逗号（数组中的）
    fixed = fixed.replace(/,\s*\]/g, "]");
    fixed = fixed.replace(/,\s*\}/g, "}");

    return fixed;
  }

  /**
   * 更激进的 JSON 修复
   */
  private aggressiveFixJson(jsonStr: string): string {
    let fixed = jsonStr;

    // 修复中文引号
    fixed = fixed.replace(/[""]/g, '"');
    fixed = fixed.replace(/['']/g, "'");

    // 修复可能缺失的引号（属性名）
    fixed = fixed.replace(/\{\s*([^":]+)\s*:/g, '{ "$1":');
    fixed = fixed.replace(/,\s*([^":]+)\s*:/g, ', "$1":');

    console.log(
      `[VideoMatchUtil] 激进修复后的JSON（前300字符）: ${fixed.substring(0, 300)}`,
    );
    return fixed;
  }

  /**
   * 生成请求的加密参数
   */
  private generateEncryptedRequest(requestData: VideoMatchRequest): { key: string; data: string } {
    // 生成 IV
    const iv = this.randomString(16);

    // 添加 content 字段
    const dataWithContent = {
      ...requestData,
      content: this.generateContentHash(),
    };

    // 加密数据 - 复用 tokenAesCrypto
    const jsonStr = JSON.stringify(dataWithContent);
    const encryptedData = tokenAesCrypto.encrypt(jsonStr, iv);

    // 构建 key: prefix + iv + suffix (总共 32 位)
    const prefix = this.randomString(8);
    const suffix = this.randomString(8);
    const key = prefix + iv + suffix;

    return { key, data: encryptedData };
  }

  /**
   * 解密响应数据
   */
  private decryptResponse(responseData: { key: string; data: string }): VideoMatchResponse {
    // 从 key 中提取 IV (第8-24位)
    const iv = responseData.key.substring(8, 24);
    console.log(`[VideoMatchUtil] 解密响应 - IV: ${iv}, key长度: ${responseData.key.length}, data长度: ${responseData.data.length}`);

    // 解密数据 - 复用 tokenAesCrypto
    let decryptedStr: string;
    try {
      decryptedStr = tokenAesCrypto.decrypt(responseData.data, iv);
    } catch (decryptError: any) {
      console.error('[VideoMatchUtil] AES解密失败:', decryptError);
      throw new Error(`AES解密失败: ${decryptError.message}`);
    }

    console.log(`[VideoMatchUtil] 解密后字符串长度: ${decryptedStr.length}`);
    console.log(`[VideoMatchUtil] 解密后字符串（前300字符）: ${decryptedStr.substring(0, Math.min(300, decryptedStr.length))}`);

    // 检查字符串是否看起来像有效的 JSON
    if (!decryptedStr.trim().startsWith('{') && !decryptedStr.trim().startsWith('[')) {
      console.error('[VideoMatchUtil] 解密后字符串不是有效的JSON格式');
      console.log(`[VideoMatchUtil] 解密后字符串（完整）: ${decryptedStr}`);
      throw new Error('解密后数据不是有效的JSON格式');
    }

    // 尝试修复 JSON 字符串
    let jsonStr = this.fixJsonString(decryptedStr);

    try {
      const parsed = JSON.parse(jsonStr);
      console.log(`[VideoMatchUtil] JSON解析成功`);
      console.log(`[VideoMatchUtil] 解析后的完整响应: ${JSON.stringify(parsed)}`);
      return parsed;
    } catch (parseError: any) {
      console.error('[VideoMatchUtil] JSON解析失败:', parseError);
      // 尝试找出问题位置附近的字符
      const errorPos = (parseError as any)?.pos;
      if (errorPos !== undefined && errorPos < decryptedStr.length) {
        const start = Math.max(0, errorPos - 50);
        const end = Math.min(decryptedStr.length, errorPos + 50);
        const contextStr = decryptedStr.substring(start, end);
        console.error(`[VideoMatchUtil] 错误位置附近内容 (pos ${errorPos}): ${contextStr}`);
      }


      // 尝试更激进的修复
      console.log('[VideoMatchUtil] 尝试激进修复 JSON...');
      jsonStr = this.aggressiveFixJson(jsonStr);
      try {
        const parsed = JSON.parse(jsonStr);
        console.log(`[VideoMatchUtil] 激进修复后 JSON 解析成功`);
        return parsed;
      } catch (secondError: any) {
        console.error('[VideoMatchUtil] 激进修复后仍然失败:', secondError);
        throw new Error(`JSON解析失败: ${parseError.message}`);
      }
    }
  }

  /**
   * 执行视频素材匹配
   * @param request 请求参数
   * @param options 选项
   */
  public async matchVideos(
    request: VideoMatchRequest,
    options: VideoMatchOptions
  ): Promise<{
    success: boolean;
    data?: VideoMatchResponse;
    error?: string;
  }> {
    try {
      // 1. 生成加密请求参数
      const { key, data } = this.generateEncryptedRequest(request);

      // 2. 发送请求
      const apiUrl = options.baseUrl || this.baseUrl;
      const response = await httpClient.request<ApiResponse>({
        url: `${apiUrl}${VIDEO_MATCH_CONSTANTS.API_PATH}`,
        method: 'POST',
        data: {
          key,
          data,
          api_token: options.apiToken,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: VIDEO_MATCH_CONSTANTS.REQUEST_TIMEOUT,
      });

      // 3. 检查响应
      if (response.code !== 0) {
        return {
          success: false,
          error: response.message || '请求失败',
        };
      }

      if (!response.data) {
        return {
          success: false,
          error: '响应数据为空',
        };
      }

      // 4. 解密响应数据
      const decryptedData = this.decryptResponse(response.data);

      return {
        success: true,
        data: decryptedData,
      };
    } catch (error: any) {
      console.error('[VideoMatchUtil] 视频匹配失败:', error);
      return {
        success: false,
        error: error.message || '请求失败',
      };
    }
  }

  /**
   * 构建短句数据
   * @param text 文本内容
   * @param sentenceId 句子 ID
   * @param duration 时长（毫秒）
   * @param recordIds 记录 ID 列表
   * @param recordInfos 记录信息列表
   * @param keywords 关键词
   */
  public buildShortSentence(
    text: string,
    sentenceId: number,
    duration: number,
    recordIds: string[],
    recordInfos: RecordInfo[],
    keywords: string
  ): ShortSentence {
    // 将毫秒转换为微秒
    const durationMicro = duration * 1000;

    return {
      text,
      sentence_id: sentenceId,
      duration: durationMicro,
      begin_time: 0,
      end_time: durationMicro,
      video_begin_time: 0,
      video_end_time: durationMicro,
      videoDuration: durationMicro,
      record_ids: recordIds,
      record_infos: recordInfos,
      keywords,
    };
  }

  /**
   * 批量构建短句数据
   * @param sentences 句子列表
   */
  public buildShortSentences(
    sentences: Array<{
      text: string;
      duration: number;
      recordIds: string[];
      recordInfos: RecordInfo[];
      keywords: string;
    }>
  ): ShortSentence[] {
    let currentTime = 0;

    return sentences.map((item, index) => {
      const durationMicro = item.duration * 1000;
      const sentence: ShortSentence = {
        text: item.text,
        sentence_id: index + 1,
        duration: durationMicro,
        begin_time: currentTime,
        end_time: currentTime + durationMicro,
        video_begin_time: currentTime,
        video_end_time: currentTime + durationMicro,
        videoDuration: durationMicro,
        record_ids: item.recordIds,
        record_infos: item.recordInfos,
        keywords: item.keywords,
      };
      currentTime += durationMicro;
      return sentence;
    });
  }
}

// 导出单例实例
export const videoMatchUtil = VideoMatchUtil.getInstance();
