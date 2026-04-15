/**
 * 视频分析工具类
 * 整合 OSS 上传和百炼大模型分析
 * 实现视频内容的 AI 分析功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { ossUtil } from './oss';
import { bailianUtil, TokenUsage, BatchVideoInput, BatchVideoResult, BatchStatus, BatchTaskInfo } from './bailian';
import { tokenConfigUtil } from './tokenConfig';

/**
 * 视频分析配置
 */
export interface VideoAnalysisConfig {
  /** 是否清理临时文件，默认 true（目前未使用，保留扩展） */
  cleanupTempFiles?: boolean;
  /** 视频帧提取频率（每秒提取帧数），默认2 */
  fps?: number;
}

/**
 * 视频分析选项
 */
export interface VideoAnalyzeOptions extends VideoAnalysisConfig {
  /** 分析类型 */
  analysisType?: 'summary' | 'keywords' | 'description' | 'custom';
  /** 自定义提示词（当 analysisType 为 custom 时使用） */
  customPrompt?: string;
  /** 视频帧提取频率（每秒提取帧数），默认2 */
  fps?: number;
  /** 大模型配置 */
  modelOptions?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * 视频分析结果
 */
export interface VideoAnalyzeResult {
  /** 是否成功 */
  success: boolean;
  /** 分析结果文本 */
  result?: string;
  /** 提取的关键词列表 */
  keywords?: string[];
  /** 视频 OSS 地址 */
  videoUrl?: string;
  /** Token 使用量统计 */
  usage?: TokenUsage;
  /** 错误信息 */
  error?: string;
}

/**
 * 批量分析进度信息
 */
export interface BatchProgressInfo {
  /** 当前已完成数量 */
  completed: number;
  /** 总数量 */
  total: number;
  /** 当前正在处理的视频路径 */
  currentVideo?: string;
  /** 已成功数量 */
  successCount: number;
  /** 已失败数量 */
  failCount: number;
  /** 当前视频的分析结果 */
  currentResult?: VideoAnalyzeResult;
  /** 是否完成 */
  isDone: boolean;
}

/**
 * 批量分析选项
 */
export interface BatchAnalyzeOptions extends VideoAnalysisConfig {
  /** 并发数，默认3 */
  concurrency?: number;
  /** 视频帧提取频率（每秒提取帧数），默认2 */
  fps?: number;
}

/**
 * 视频分析工具类（单例模式）
 */
export class VideoAnalysisUtil {
  private static instance: VideoAnalysisUtil | null = null;

  /** 默认配置 */
  private defaultConfig: VideoAnalysisConfig = {
    cleanupTempFiles: true,
  };

  /** 默认并发数 */
  private readonly DEFAULT_CONCURRENCY = 3;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): VideoAnalysisUtil {
    if (!VideoAnalysisUtil.instance) {
      VideoAnalysisUtil.instance = new VideoAnalysisUtil();
    }
    return VideoAnalysisUtil.instance;
  }

  /**
   * 确保依赖服务已初始化
   * 如果未初始化，则自动初始化 OSS 和百炼客户端
   */
  private async ensureInitialized(): Promise<{ success: boolean; error?: string }> {
    // 检查 OSS 是否已初始化
    if (!ossUtil.isInitialized()) {
      console.log('[VideoAnalysisUtil] OSS 未初始化，正在自动初始化...');
      try {
        const credentials = await tokenConfigUtil.getOSSCredentials();
        console.log('[VideoAnalysisUtil] 获取到的凭证:', JSON.stringify(credentials, null, 2));
        if (!credentials) {
          return { success: false, error: '获取 OSS 凭证失败，请检查 API Token 配置' };
        }
        if (!credentials.accessKeySecret) {
          console.error('[VideoAnalysisUtil] 凭证缺少 accessKeySecret');
          return { success: false, error: '凭证缺少 accessKeySecret 字段' };
        }

        console.log('[VideoAnalysisUtil] 正在调用 ossUtil.init...');
        ossUtil.init({
          accessKeyId: credentials.accessKeyId,
          accessKeySecret: credentials.accessKeySecret,
          bucket: credentials.bucket,
          region: credentials.region,
          useInternal: false,  // 使用公网地址上传
          securityToken: credentials.securityToken,
        });
        console.log('[VideoAnalysisUtil] OSS 初始化成功');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error('[VideoAnalysisUtil] OSS 初始化失败:', errorMessage);
        console.error('[VideoAnalysisUtil] 错误堆栈:', errorStack);
        return { success: false, error: `OSS 初始化失败: ${errorMessage}` };
      }
    }

    // 检查百炼客户端是否已初始化
    if (!bailianUtil.isInitialized()) {
      console.log('[VideoAnalysisUtil] 百炼客户端未初始化，正在自动初始化...');
      try {
        const apiKey = await tokenConfigUtil.getBailianApiKey();
        if (!apiKey) {
          return { success: false, error: '获取 API Key 失败，请检查 API Token 配置' };
        }
        bailianUtil.setApiKey(apiKey);
        console.log('[VideoAnalysisUtil] 百炼客户端初始化成功');
      } catch (error: any) {
        console.error('[VideoAnalysisUtil] 百炼客户端初始化失败:', error);
        return { success: false, error: `百炼客户端初始化失败: ${error.message}` };
      }
    }

    return { success: true };
  }

  /**
   * 分析视频
   * 完整的视频分析流程：上传视频到 OSS → 调用百炼分析
   * @param videoPath 视频文件路径
   * @param options 分析选项
   */
  public async analyzeVideo(
    videoPath: string,
    options: VideoAnalyzeOptions = {}
  ): Promise<VideoAnalyzeResult> {
    console.log(`[VideoAnalysisUtil] 开始分析视频: ${videoPath}`);

    // 1. 检查文件是否存在
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: `视频文件不存在: ${videoPath}` };
    }

    // 2. 确保依赖服务已初始化
    const initResult = await this.ensureInitialized();
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }

    try {
      // 2. 上传视频到 OSS
      console.log('[VideoAnalysisUtil] 正在上传视频到 OSS...');
      const uploadResult = await ossUtil.uploadFile(videoPath, {
        objectName: this.generateVideoObjectName(videoPath),
      });

      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error || '视频上传失败',
        };
      }

      // 使用内网签名 URL（OSS 和百炼同在北京区域，走内网更快且免费）
      const videoUrl = ossUtil.generateSignedInternalUrl(uploadResult.name);
      console.log(`[VideoAnalysisUtil] 视频上传成功，使用内网 URL 调用百炼`);

      // 3. 调用百炼大模型分析视频
      console.log('[VideoAnalysisUtil] 正在调用百炼大模型分析视频...');
      const analysisResult = await bailianUtil.analyzeVideo(videoUrl, {
        analysisType: options.analysisType || 'summary',
        customPrompt: options.customPrompt,
        fps: options.fps,
        ...options.modelOptions,
      });

      if (!analysisResult.success) {
        return {
          success: false,
          error: analysisResult.error || '大模型分析失败',
          videoUrl,
        };
      }

      console.log('[VideoAnalysisUtil] 视频分析完成');
      if (analysisResult.usage) {
        console.log(`[VideoAnalysisUtil] Token 使用量 - 输入: ${analysisResult.usage.promptTokens}, 输出: ${analysisResult.usage.completionTokens}, 总计: ${analysisResult.usage.totalTokens}`);
      }

      return {
        success: true,
        result: analysisResult.result,
        keywords: analysisResult.keywords,
        videoUrl,
        usage: analysisResult.usage,
      };
    } catch (error: any) {
      console.error('[VideoAnalysisUtil] 视频分析出错:', error);
      return {
        success: false,
        error: error.message || '未知错误',
      };
    }
  }

  /**
   * 分析视频并提取关键词
   * @param videoPath 视频文件路径
   * @param options 分析选项
   */
  public async extractVideoKeywords(
    videoPath: string,
    options: VideoAnalysisConfig = {}
  ): Promise<VideoAnalyzeResult> {
    return this.analyzeVideo(videoPath, {
      ...options,
      analysisType: 'keywords',
    });
  }

  /**
   * 分析视频并生成摘要
   * @param videoPath 视频文件路径
   * @param options 分析选项
   */
  public async summarizeVideo(
    videoPath: string,
    options: VideoAnalysisConfig = {}
  ): Promise<VideoAnalyzeResult> {
    return this.analyzeVideo(videoPath, {
      ...options,
      analysisType: 'summary',
    });
  }

  /**
   * 分析视频并生成详细描述
   * @param videoPath 视频文件路径
   * @param options 分析选项
   */
  public async describeVideo(
    videoPath: string,
    options: VideoAnalysisConfig = {}
  ): Promise<VideoAnalyzeResult> {
    return this.analyzeVideo(videoPath, {
      ...options,
      analysisType: 'description',
    });
  }

  /**
   * 自定义视频分析
   * @param videoPath 视频文件路径
   * @param customPrompt 自定义提示词
   * @param options 分析选项
   */
  public async customAnalyzeVideo(
    videoPath: string,
    customPrompt: string,
    options: VideoAnalysisConfig = {}
  ): Promise<VideoAnalyzeResult> {
    return this.analyzeVideo(videoPath, {
      ...options,
      analysisType: 'custom',
      customPrompt,
    });
  }

  /**
   * 批量分析视频关键词（串行，保留兼容性）
   * 用于素材库视频批量分析场景
   * @param videoPaths 视频文件路径列表
   * @param options 分析选项
   * @param onProgress 进度回调
   */
  public async batchExtractKeywords(
    videoPaths: string[],
    options: VideoAnalysisConfig = {},
    onProgress?: (current: number, total: number, result: VideoAnalyzeResult) => void
  ): Promise<Map<string, VideoAnalyzeResult>> {
    const results = new Map<string, VideoAnalyzeResult>();
    const total = videoPaths.length;

    for (let i = 0; i < videoPaths.length; i++) {
      const videoPath = videoPaths[i];
      const result = await this.extractVideoKeywords(videoPath, options);
      results.set(videoPath, result);

      if (onProgress) {
        onProgress(i + 1, total, result);
      }
    }

    return results;
  }

  /**
   * 批量分析视频关键词（并发控制）
   * 使用并发池提高批量处理效率
   * @param videoPaths 视频文件路径列表
   * @param options 批量分析选项
   * @param onProgress 进度回调（每个视频完成后触发）
   */
  public async batchExtractKeywordsConcurrent(
    videoPaths: string[],
    options: BatchAnalyzeOptions = {},
    onProgress?: (progress: BatchProgressInfo) => void
  ): Promise<Map<string, VideoAnalyzeResult>> {
    const results = new Map<string, VideoAnalyzeResult>();
    const total = videoPaths.length;
    const concurrency = options.concurrency || this.DEFAULT_CONCURRENCY;

    let completed = 0;
    let successCount = 0;
    let failCount = 0;

    console.log(`[VideoAnalysisUtil] 开始并发批量分析，总数: ${total}，并发数: ${concurrency}`);

    // 使用并发池处理
    const processVideo = async (videoPath: string): Promise<void> => {
      const result = await this.extractVideoKeywords(videoPath, { fps: options.fps });
      results.set(videoPath, result);

      completed++;
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      // 触发进度回调
      if (onProgress) {
        onProgress({
          completed,
          total,
          currentVideo: videoPath,
          successCount,
          failCount,
          currentResult: result,
          isDone: completed === total,
        });
      }
    };

    // 并发执行
    await this.runWithConcurrency(videoPaths, processVideo, concurrency);

    console.log(`[VideoAnalysisUtil] 批量分析完成，成功: ${successCount}，失败: ${failCount}`);

    return results;
  }

  /**
   * 并发执行器
   * 控制最大并发数执行任务
   * @param items 待处理的项目列表
   * @param processor 处理函数
   * @param concurrency 最大并发数
   */
  private async runWithConcurrency<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    concurrency: number
  ): Promise<void> {
    const executing: Promise<void>[] = [];
    const queue = [...items];

    const enqueue = async (): Promise<void> => {
      if (queue.length === 0) return;

      const item = queue.shift()!;
      const promise = processor(item).then(() => {
        // 完成后从执行队列中移除
        const index = executing.indexOf(promise);
        if (index > -1) {
          executing.splice(index, 1);
        }
      });

      executing.push(promise);

      // 如果达到并发上限，等待其中一个完成
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }

      // 继续处理队列
      await enqueue();
    };

    await enqueue();

    // 等待所有任务完成
    await Promise.all(executing);
  }

  /**
   * 生成视频的 OSS 对象名称
   */
  private generateVideoObjectName(videoPath: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(videoPath);
    const baseName = path.basename(videoPath, ext);
    return `videos/${baseName}_${timestamp}_${randomStr}${ext}`;
  }

  /**
   * 更新默认配置
   */
  public updateDefaultConfig(config: Partial<VideoAnalysisConfig>): void {
    this.defaultConfig = {
      ...this.defaultConfig,
      ...config,
    };
  }

  /**
   * 获取当前默认配置
   */
  public getDefaultConfig(): VideoAnalysisConfig {
    return { ...this.defaultConfig };
  }

  // ==================== 异步批量分析相关 ====================

  /**
   * 提交异步批量视频关键词分析
   * 流程：初始化 → 上传 OSS → 构建 Batch JSONL → 提交到百炼 Batch API
   * @param videos 视频列表（id = 数据库视频 ID，filePath = 本地文件路径）
   * @param options 选项（fps 等）
   */
  public async batchExtractKeywordsAsync(
    videos: Array<{ id: string; filePath: string }>,
    options?: { fps?: number }
  ): Promise<{ success: boolean; batchId?: string; error?: string }> {
    console.log(`[VideoAnalysisUtil] 开始异步批量分析，视频数: ${videos.length}`);

    if (!videos || videos.length === 0) {
      return { success: false, error: '视频列表不能为空' };
    }

    // 1. 确保依赖服务已初始化
    const initResult = await this.ensureInitialized();
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }

    try {
      // 2. 逐个上传视频到 OSS，收集 BatchVideoInput[]
      const batchInputs: BatchVideoInput[] = [];
      for (const video of videos) {
        if (!fs.existsSync(video.filePath)) {
          console.warn(`[VideoAnalysisUtil] 视频文件不存在，跳过: ${video.filePath}`);
          continue;
        }

        console.log(`[VideoAnalysisUtil] 上传视频到 OSS: ${video.filePath}`);
        const uploadResult = await ossUtil.uploadFile(video.filePath, {
          objectName: this.generateVideoObjectName(video.filePath),
        });

        if (!uploadResult.success) {
          console.warn(`[VideoAnalysisUtil] 视频上传失败: ${video.filePath}, 错误: ${uploadResult.error}`);
          continue;
        }

        const signedUrl = ossUtil.generateSignedInternalUrl(uploadResult.name);
        batchInputs.push({
          id: video.id,
          url: signedUrl,
        });
      }

      if (batchInputs.length === 0) {
        return { success: false, error: '所有视频上传失败或文件不存在' };
      }

      console.log(`[VideoAnalysisUtil] 上传完成，成功 ${batchInputs.length}/${videos.length} 个`);

      // 3. 构建关键词提取提示词
      const keywordsPrompt = "# 角色\n" +
        "你是一个旅居文案专家，请分析这个视频，提取出围绕康养旅居的关键标签和关键词。\n" +
        "\n" +
        "# 任务描述\n" +
        "给你一个视频片段，请你按如下描述理解并完成任务。\n" +
        "比如这是各种各样餐品或者吃饭的场景，你就提取出'餐食'关键词；\n" +
        "比如一群人外出游玩，你就可以提取出'游玩'关键词。\n" +
        "\n" +
        "# 限制\n" +
        "- 分析范围严格限定于提供的视频片段，不涉及视频之外的任何推测或背景信息。\n" +
        "- 总结时需严格依据视频内容，不可添加个人臆测或创意性内容。\n" +
        "- 保持对所有视频元素（尤其是文字和字幕）的高保真还原，避免信息遗漏或误解。\n" +
        "- 以JSON数组格式返回关键词列表，例如：[\"关键词1\", \"关键词2\"]。只返回JSON数组，不要其他内容。\n" +
        "- 关键词不超过3个，且必须为中文。";

      // 4. 提交 Batch 任务
      const batchResult = await bailianUtil.createBatchVideoAnalysis(batchInputs, {
        defaultPrompt: keywordsPrompt,
        fps: options?.fps ?? 2,
      });

      if (!batchResult.success) {
        return { success: false, error: batchResult.error || '创建 Batch 任务失败' };
      }

      console.log(`[VideoAnalysisUtil] Batch 任务已提交，batchId: ${batchResult.batchId}`);
      return { success: true, batchId: batchResult.batchId };
    } catch (error: any) {
      console.error('[VideoAnalysisUtil] 异步批量分析提交出错:', error);
      return { success: false, error: error.message || '未知错误' };
    }
  }

  /**
   * 查询异步批量任务状态并解析关键词
   * @param batchId 批量任务 ID
   */
  public async checkBatchResult(batchId: string): Promise<{
    status: string;
    requestCounts?: { total: number; completed: number; failed: number };
    results?: Array<{
      customId: string;
      success: boolean;
      keywords?: string;
      rawContent?: string;
      error?: string;
    }>;
    error?: string;
  }> {
    try {
      // 0. 确保依赖服务已初始化（程序重启后 bailianUtil 可能未初始化）
      const initResult = await this.ensureInitialized();
      if (!initResult.success) {
        return { status: 'unknown', error: initResult.error };
      }

      // 1. 查询状态
      const statusResult = await bailianUtil.getBatchStatus(batchId);
      if (!statusResult.success) {
        return { status: 'unknown', error: statusResult.error };
      }

      const taskInfo = statusResult.data!;
      const response: any = {
        status: taskInfo.status,
        requestCounts: taskInfo.requestCounts,
      };

      // 2. 如果非终态，直接返回状态
      const terminalStates = new Set(['completed', 'failed', 'expired', 'cancelled']);
      if (!terminalStates.has(taskInfo.status)) {
        return response;
      }

      // 3. 如果完成，获取并解析结果
      if (taskInfo.status === 'completed') {
        const resultsResponse = await bailianUtil.getBatchResults(batchId);
        if (!resultsResponse.success || !resultsResponse.results) {
          return { ...response, error: resultsResponse.error || '获取结果失败' };
        }

        const parsedResults = resultsResponse.results.map((r: BatchVideoResult) => {
          if (r.success && r.rawContent) {
            // 从 AI 响应中解析关键词
            const keywords = this.parseKeywordsFromContent(r.rawContent);
            return {
              customId: r.customId,
              success: true,
              keywords: keywords.join(','),
              rawContent: r.rawContent,
            };
          }
          return {
            customId: r.customId,
            success: false,
            error: r.error || '分析失败',
          };
        });

        return { ...response, results: parsedResults };
      }

      return response;
    } catch (error: any) {
      console.error('[VideoAnalysisUtil] 查询 Batch 结果出错:', error);
      return { status: 'unknown', error: error.message || '未知错误' };
    }
  }

  /**
   * 取消异步批量任务
   * @param batchId 批量任务 ID
   */
  public async cancelBatchTask(batchId: string): Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }> {
    const initResult = await this.ensureInitialized();
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }
    return await bailianUtil.cancelBatch(batchId);
  }

  /**
   * 从 AI 响应内容中解析关键词 JSON 数组
   */
  private parseKeywordsFromContent(content: string): string[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => String(item));
        }
      }
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => String(item));
      }
    } catch {}
    return [];
  }

  // ==================== 智能分割相关 ====================

  /**
   * 智能分割：分析视频并返回时间片段
   * 流程：ensureInitialized → 上传 OSS → 调用 bailianUtil.analyzeVideoSegments
   */
  public async analyzeVideoSegments(
    videoPath: string,
    options?: {
      customPrompt?: string;
      /** 已上传的 OSS object name，若提供则跳过上传 */
      ossObjectName?: string;
    }
  ): Promise<{
    success: boolean;
    segments?: Array<{ startTime: number; endTime: number; description: string; keywords?: string }>;
    videoUrl?: string;
    ossObjectName?: string;
    rawResult?: string;
    error?: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    console.log(`[VideoAnalysisUtil] 开始智能分割分析: ${videoPath}`);

    // 1. 检查文件是否存在
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: `视频文件不存在: ${videoPath}` };
    }

    // 2. 确保依赖服务已初始化
    const initResult = await this.ensureInitialized();
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }

    try {
      let videoUrl: string;
      let ossObjectName: string;

      if (options?.ossObjectName) {
        // 已上传过，直接生成内网签名 URL
        console.log('[VideoAnalysisUtil] 视频已上传过 OSS，直接生成内网签名 URL...');
        ossObjectName = options.ossObjectName;
        videoUrl = ossUtil.generateSignedInternalUrl(ossObjectName, 3600);
        console.log('[VideoAnalysisUtil] 内网签名 URL 生成成功');
      } else {
        // 3. 上传视频到 OSS
        console.log('[VideoAnalysisUtil] 正在上传视频到 OSS...');
        const uploadResult = await ossUtil.uploadFile(videoPath, {
          objectName: this.generateVideoObjectName(videoPath),
        });

        if (!uploadResult.success) {
          return {
            success: false,
            error: uploadResult.error || '视频上传失败',
          };
        }

        videoUrl = ossUtil.generateSignedInternalUrl(uploadResult.name);
        ossObjectName = uploadResult.name;
        console.log('[VideoAnalysisUtil] 视频上传成功，使用内网 URL 开始 AI 分析...');
      }

      // 4. 调用百炼 AI 分析视频片段
      const analysisResult = await bailianUtil.analyzeVideoSegments(
        videoUrl,
        options?.customPrompt
      );

      if (!analysisResult.success) {
        return {
          success: false,
          error: analysisResult.error || 'AI 分析失败',
          videoUrl,
        };
      }

      console.log(`[VideoAnalysisUtil] 智能分割分析完成，识别到 ${analysisResult.segments?.length || 0} 个片段`);
      if (analysisResult.usage) {
        console.log(`[VideoAnalysisUtil] Token 使用量 - 输入: ${analysisResult.usage.promptTokens}, 输出: ${analysisResult.usage.completionTokens}, 总计: ${analysisResult.usage.totalTokens}`);
      }

      return {
        success: true,
        segments: analysisResult.segments,
        videoUrl,
        ossObjectName,
        rawResult: analysisResult.rawResult,
        usage: analysisResult.usage,
      };
    } catch (error: any) {
      console.error('[VideoAnalysisUtil] 智能分割分析出错:', error);
      return {
        success: false,
        error: error.message || '未知错误',
      };
    }
  }

  // ==================== 异步智能分割相关（Batch API） ====================

  /**
   * 智能分割：异步分析视频（使用 Batch API）
   * 流程：ensureInitialized → 上传 OSS → 构建 Batch JSONL → 提交异步任务
   */
  public async analyzeVideoSegmentsAsync(
    videoPath: string,
    options?: {
      customPrompt?: string;
      /** 已上传的 OSS object name，若提供则跳过上传 */
      ossObjectName?: string;
    }
  ): Promise<{
    success: boolean;
    batchId?: string;
    ossObjectName?: string;
    error?: string;
  }> {
    console.log(`[VideoAnalysisUtil] 开始异步智能分割: ${videoPath}`);

    if (!fs.existsSync(videoPath)) {
      return { success: false, error: `视频文件不存在: ${videoPath}` };
    }

    const initResult = await this.ensureInitialized();
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }

    try {
      let signedUrl: string;
      let ossObjectName: string;

      if (options?.ossObjectName) {
        console.log('[VideoAnalysisUtil] 视频已上传 OSS，跳过上传');
        ossObjectName = options.ossObjectName;
        signedUrl = ossUtil.generateSignedInternalUrl(ossObjectName, 3600);
      } else {
        console.log('[VideoAnalysisUtil] 正在上传视频到 OSS...');
        const uploadResult = await ossUtil.uploadFile(videoPath, {
          objectName: this.generateVideoObjectName(videoPath),
        });

        if (!uploadResult.success) {
          return { success: false, error: uploadResult.error || '视频上传失败' };
        }

        signedUrl = ossUtil.generateSignedInternalUrl(uploadResult.name!);
        ossObjectName = uploadResult.name!;
        console.log('[VideoAnalysisUtil] 视频上传成功，使用内网 URL 提交 Batch 任务...');
      }

      // 构建智能分割提示词
      const segmentPrompt = options?.customPrompt || this.getSmartSplitPrompt();

      // 提交 Batch 任务（单视频）
      const batchResult = await bailianUtil.createBatchVideoAnalysis(
        [{ id: '1', url: signedUrl, customPrompt: segmentPrompt }],
        { defaultPrompt: segmentPrompt, fps: 2 }
      );

      if (!batchResult.success) {
        return { success: false, error: batchResult.error || '创建 Batch 任务失败' };
      }

      console.log(`[VideoAnalysisUtil] 异步智能分割已提交, batchId: ${batchResult.batchId}`);
      return { success: true, batchId: batchResult.batchId, ossObjectName };
    } catch (error: any) {
      console.error('[VideoAnalysisUtil] 异步智能分割出错:', error);
      return { success: false, error: error.message || '未知错误' };
    }
  }

  /**
   * 查询异步智能分割 Batch 任务结果
   */
  public async checkVideoSegmentsBatchResult(batchId: string): Promise<{
    status: string;
    requestCounts?: { total: number; completed: number; failed: number };
    segments?: Array<{ startTime: number; endTime: number; description: string; keywords?: string }>;
    rawResult?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    error?: string;
  }> {
    try {
      const initResult = await this.ensureInitialized();
      if (!initResult.success) {
        return { status: 'unknown', error: initResult.error };
      }

      const statusResult = await bailianUtil.getBatchStatus(batchId);
      if (!statusResult.success) {
        return { status: 'unknown', error: statusResult.error };
      }

      const taskInfo = statusResult.data!;

      const response: any = {
        status: taskInfo.status,
        requestCounts: taskInfo.requestCounts,
      };

      const terminalStates = new Set(['completed', 'failed', 'expired', 'cancelled']);
      if (!terminalStates.has(taskInfo.status)) {
        return response;
      }

      if (taskInfo.status === 'completed') {
        const resultsResponse = await bailianUtil.getBatchResults(batchId);
        if (!resultsResponse.success || !resultsResponse.results) {
          return { ...response, error: resultsResponse.error || '获取结果失败' };
        }

        for (const r of resultsResponse.results) {
          if (r.success) {
            // getBatchResults 已通过 parseSegments 解析了 segments
            if (r.segments && r.segments.length > 0) {
              return {
                ...response,
                segments: r.segments,
                rawResult: r.rawContent,
                usage: r.usage,
              };
            }
            // 如果 parseSegments 未解析出结果，从 rawContent 手动解析
            if (r.rawContent) {
              const segments = this.parseSegmentsFromContent(r.rawContent);
              return {
                ...response,
                segments,
                rawResult: r.rawContent,
                usage: r.usage,
              };
            }
            return { ...response, error: 'AI 未返回有效片段数据' };
          }
          return { ...response, error: r.error || '分析失败' };
        }
      }

      return { ...response, error: `Batch 任务终态: ${taskInfo.status}` };
    } catch (error: any) {
      console.error('[VideoAnalysisUtil] 查询异步智能分割结果出错:', error);
      return { status: 'unknown', error: error.message || '未知错误' };
    }
  }

  /**
   * 智能分割默认提示词
   */
  private getSmartSplitPrompt(): string {
    return `你是一个专业的视频编辑助手。请分析这个视频，识别其中不同的场景/主题片段，返回每个片段的起止时间。

要求：
1. 根据视频内容的变化（场景切换、主题变化等）划分片段
2. 每个片段的描述要简洁准确
3. 片段时间必须连续覆盖整个视频，不得遗漏或重叠
4. 每个片段的关键词要简洁准确

请严格以如下JSON数组格式返回，不要返回任何其他内容：
[{"startTime": 0, "endTime": 15.5, "description": "场景描述", "keywords": "场景关键词1,..."}, {"startTime": 15.5, "endTime": 32.0, "description": "场景描述", "keywords": "场景关键词1,..."}]

其中 startTime 和 endTime 为秒数（支持小数），description 为该片段的中文描述，keywords 为该片段的关键词描述，提练总结1-3个场景关键词。`;
  }

  /**
   * 从 AI 响应内容中解析视频片段
   */
  private parseSegmentsFromContent(content: string): Array<{ startTime: number; endTime: number; description: string; keywords?: string }> {
    try {
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item: any) =>
              typeof item.startTime === 'number' &&
              typeof item.endTime === 'number' &&
              item.endTime > item.startTime
            )
            .map((item: any) => ({
              startTime: item.startTime,
              endTime: item.endTime,
              description: String(item.description || ''),
              keywords: String(item.keywords || '').replace(/，/g, ','),
            }));
        }
      }
    } catch (e) {
      console.error('[VideoAnalysisUtil] 解析片段 JSON 失败:', e);
    }
    return [];
  }
}

// 导出单例实例
export const videoAnalysisUtil = VideoAnalysisUtil.getInstance();