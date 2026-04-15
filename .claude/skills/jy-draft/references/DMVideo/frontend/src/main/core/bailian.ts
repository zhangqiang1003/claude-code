/**
 * 阿里云百炼大模型工具类
 * 基于 OpenAI 兼容模式封装
 * 支持文本对话、图像理解、视频分析等功能
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { tokenConfigUtil } from './tokenConfig';

/**
 * 百炼配置常量
 */
const BAILIAN_CONSTANTS = {
  /** 默认基础地址（北京地域） */
  DEFAULT_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  /** 弗吉尼亚地域 */
  US_BASE_URL: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
  /** 新加坡地域 */
  INTL_BASE_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  /** 默认模型 */
  DEFAULT_MODEL: 'qwen2.5-vl-32b-instruct',
  /** 视频分析模型 */
  VIDEO_MODEL: 'qwen3.5-plus',
  /** 最大 Token 数 */
  MAX_TOKENS: 4096,
} as const;

/**
 * 消息角色类型
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: MessageRole;
  content: string | ContentPart[];
}

/**
 * 内容部分（支持多模态）
 */
export interface ContentPart {
  type: 'text' | 'image_url' | 'video_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
  video_url?: {
    url: string;
  };
  /** 视频帧提取频率（每秒提取帧数），仅在 type 为 video_url 时有效 */
  fps?: number;
}

/**
 * 百炼客户端配置
 */
export interface BailianClientConfig {
  /** API Key（临时或永久） */
  apiKey: string;
  /** 基础地址（可选，默认北京地域） */
  baseURL?: string;
  /** 默认模型（可选） */
  defaultModel?: string;
}

/**
 * 聊天完成选项
 */
export interface ChatCompletionOptions {
  /** 模型名称 */
  model?: string;
  /** 温度参数 (0-2) */
  temperature?: number;
  /** 最大 Token 数 */
  maxTokens?: number;
  /** Top P 参数 */
  topP?: number;
  /** 停止词 */
  stop?: string[];
  /** 是否流式输出 */
  stream?: boolean;
}

/**
 * 聊天完成响应
 */
export interface ChatCompletionResult {
  /** 是否成功 */
  success: boolean;
  /** 响应内容 */
  content?: string;
  /** 使用的 Token 数 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 错误信息 */
  error?: string;
}

/**
 * 视频分析选项
 */
export interface VideoAnalysisOptions extends ChatCompletionOptions {
  /** 分析类型 */
  analysisType?: 'summary' | 'keywords' | 'description' | 'custom';
  /** 自定义提示词 */
  customPrompt?: string;
  /** 视频帧提取频率（每秒提取帧数），默认2 */
  fps?: number;
}

/**
 * Token 使用量信息
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 视频分析结果
 */
export interface VideoAnalysisResult {
  /** 是否成功 */
  success: boolean;
  /** 分析结果 */
  result?: string;
  /** 关键词列表（当 analysisType 为 keywords 时） */
  keywords?: string[];
  /** Token 使用量统计 */
  usage?: TokenUsage;
  /** 错误信息 */
  error?: string;
}

// ==================== 批处理相关类型 ====================

/**
 * 批处理任务输入 - 单个视频
 */
export interface BatchVideoInput {
  /** 唯一标识（如数据库 ID），用于匹配结果 */
  id: string;
  /** OSS 签名 URL */
  url: string;
  /** 可选，覆盖默认提示词 */
  customPrompt?: string;
}

/**
 * 批处理单个视频的分析结果
 */
export interface BatchVideoResult {
  /** 对应 BatchVideoInput.id */
  customId: string;
  /** 是否成功 */
  success: boolean;
  /** 解析出的片段（成功时） */
  segments?: Array<{ startTime: number; endTime: number; description: string; keywords?: string }>;
  /** AI 原始响应内容 */
  rawContent?: string;
  /** 错误信息（失败时） */
  error?: string;
  /** Token 使用量（成功时） */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 批处理任务状态
 */
export type BatchStatus =
  | 'validating' | 'failed' | 'in_progress' | 'finalizing'
  | 'completed' | 'expired' | 'cancelling' | 'cancelled';

/**
 * 批处理任务摘要
 */
export interface BatchTaskInfo {
  batchId: string;
  status: BatchStatus;
  requestCounts?: { total: number; completed: number; failed: number };
  createdAt?: string;
  outputFileId?: string;
  errorFileId?: string;
}

/**
 * 阿里云百炼大模型工具类
 */
export class BailianUtil {
  private static instance: BailianUtil | null = null;
  private client: OpenAI | null = null;
  private config: BailianClientConfig | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): BailianUtil {
    if (!BailianUtil.instance) {
      BailianUtil.instance = new BailianUtil();
    }
    return BailianUtil.instance;
  }

  /**
   * 初始化客户端
   * @param config 百炼配置
   */
  public init(config: BailianClientConfig): void {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || BAILIAN_CONSTANTS.DEFAULT_BASE_URL,
    });
    console.log('[BailianUtil] 初始化成功');
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * 设置 API Key
   */
  public setApiKey(apiKey: string): void {
    if (this.config) {
      this.config.apiKey = apiKey;
    } else {
      this.config = { apiKey };
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: this.config?.baseURL || BAILIAN_CONSTANTS.DEFAULT_BASE_URL,
    });
  }

  /**
   * 获取当前配置
   */
  public getConfig(): BailianClientConfig | null {
    return this.config;
  }

  /**
   * 检查是否为 401 认证错误
   */
  private isAuthError(error: any): boolean {
    return error?.status === 401;
  }

  /**
   * 强制刷新 API Key 并重建 OpenAI 客户端
   */
  private async refreshApiKey(): Promise<boolean> {
    try {
      const apiKey = await tokenConfigUtil.getBailianApiKey(true);
      if (apiKey) {
        this.setApiKey(apiKey);
        console.log('[BailianUtil] API Key 已刷新');
        return true;
      }
    } catch (error) {
      console.error('[BailianUtil] 刷新 API Key 失败:', error);
    }
    return false;
  }

  /**
   * 执行操作，401 时自动刷新 key 并重试一次
   */
  private async withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (this.isAuthError(error)) {
        console.log('[BailianUtil] 检测到 401 错误，尝试刷新 API Key...');
        const refreshed = await this.refreshApiKey();
        if (refreshed) {
          return await operation();
        }
      }
      throw error;
    }
  }

  /**
   * 聊天完成
   * @param messages 消息列表
   * @param options 选项
   */
  public async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    if (!this.client) {
      return { success: false, error: '百炼客户端未初始化' };
    }

    try {
      const model = options.model || this.config?.defaultModel || BAILIAN_CONSTANTS.DEFAULT_MODEL;

      // 转换消息格式为 OpenAI 格式
      const openaiMessages = messages.map((msg) => {
        if (typeof msg.content === 'string') {
          return { role: msg.role, content: msg.content };
        }
        // 转换 ContentPart[] 为 OpenAI 格式
        const contentParts = msg.content.map((part) => {
          if (part.type === 'text') {
            return { type: 'text' as const, text: part.text || '' };
          } else if (part.type === 'video_url') {
            return {
              type: 'video_url' as const,
              video_url: part.video_url || { url: '' },
            };
          } else {
            return {
              type: 'image_url' as const,
              image_url: part.image_url || { url: '' },
            };
          }
        });
        return { role: msg.role, content: contentParts };
      });

      const response = await this.withAuthRetry(() =>
        this.client!.chat.completions.create({
          model,
          messages: openaiMessages as any,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? BAILIAN_CONSTANTS.MAX_TOKENS,
          top_p: options.topP,
          stop: options.stop,
          stream: false,
        })
      );

      const choice = response.choices[0];
      const content = choice?.message?.content || '';

      return {
        success: true,
        content,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      console.error('[BailianUtil] 聊天完成失败:', error);
      return { success: false, error: error.message || '请求失败' };
    }
  }

  /**
   * 简单文本对话
   * @param prompt 用户输入
   * @param systemPrompt 系统提示词（可选）
   * @param options 选项
   */
  public async chat(
    prompt: string,
    systemPrompt?: string,
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return this.chatCompletion(messages, options);
  }

  /**
   * 图像理解
   * @param imageUrl 图像 URL 或 base64
   * @param question 问题
   * @param options 选项
   */
  public async analyzeImage(
    imageUrl: string,
    question: string,
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
          {
            type: 'text',
            text: question,
          },
        ],
      },
    ];

    return this.chatCompletion(messages, {
      model: options?.model || BAILIAN_CONSTANTS.VIDEO_MODEL,
      ...options,
    });
  }

  /**
   * 视频分析（直接传入视频URL）
   * 阿里云百炼 qwen-vl 系列模型支持直接分析视频
   * @param videoUrl 视频 URL（OSS 内网地址）
   * @param options 分析选项
   */
  public async analyzeVideo(
    videoUrl: string,
    options: VideoAnalysisOptions = {}
  ): Promise<VideoAnalysisResult> {
    // 根据分析类型构建提示词
    let prompt: string;
    const analysisType = options.analysisType || 'keywords';

    switch (analysisType) {
      case 'keywords':
        prompt = "# 角色\n" +
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
            "- 关键词不超过3个，且必须为中文。"
        break;
      case 'description':
        prompt = '请详细描述这个视频的内容，包括场景、人物、动作、物体等信息。';
        break;
      case 'custom':
        prompt = options.customPrompt || '请分析这个视频。';
        break;
      case 'summary':
      default:
        prompt = '请总结这个视频的内容，提供简洁的概述。';
        break;
    }

    // 构建消息，使用 video_url 类型传入视频
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'video_url',
            video_url: {
              url: videoUrl,
            },
            fps: options.fps || 2, // fps 在顶层，与官方 Demo 一致
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ];

    const result = await this.chatCompletion(messages, {
      model: options.model || BAILIAN_CONSTANTS.VIDEO_MODEL,
      ...options,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 处理关键词提取结果
    if (analysisType === 'keywords' && result.content) {
      try {
        const keywords = this.parseKeywords(result.content);
        return { success: true, result: result.content, keywords, usage: result.usage };
      } catch {
        return { success: true, result: result.content, usage: result.usage };
      }
    }

    return { success: true, result: result.content, usage: result.usage };
  }

  /**
   * 多图像理解
   * @param imageUrls 图像 URL 列表
   * @param question 问题
   * @param options 选项
   */
  public async analyzeImages(
    imageUrls: string[],
    question: string,
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    const content: ContentPart[] = imageUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url },
    }));
    content.push({ type: 'text', text: question });

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content,
      },
    ];

    return this.chatCompletion(messages, {
      model: options?.model || BAILIAN_CONSTANTS.VIDEO_MODEL,
      ...options,
    });
  }

  /**
   * 视频分析（基于视频帧）
   * @param frameUrls 视频帧 URL 列表
   * @param options 分析选项
   */
  public async analyzeVideoFrames(
    frameUrls: string[],
    options: VideoAnalysisOptions = {}
  ): Promise<VideoAnalysisResult> {
    // 根据分析类型构建提示词
    let prompt: string;
    const analysisType = options.analysisType || 'summary';

    switch (analysisType) {
      case 'keywords':
        prompt = '请分析这些视频帧，提取出关键标签和关键词。以JSON数组格式返回关键词列表，例如：["关键词1", "关键词2"]。只返回JSON数组，不要其他内容。';
        break;
      case 'description':
        prompt = '请详细描述这些视频帧中的内容，包括场景、人物、动作、物体等信息。';
        break;
      case 'custom':
        prompt = options.customPrompt || '请分析这些视频帧。';
        break;
      case 'summary':
      default:
        prompt = '请总结这些视频帧的内容，提供简洁的概述。';
        break;
    }

    const result = await this.analyzeImages(frameUrls, prompt, {
      model: options.model || BAILIAN_CONSTANTS.VIDEO_MODEL,
      ...options,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 处理关键词提取结果
    if (analysisType === 'keywords' && result.content) {
      try {
        // 尝试解析 JSON 数组
        const keywords = this.parseKeywords(result.content);
        return { success: true, result: result.content, keywords };
      } catch {
        return { success: true, result: result.content };
      }
    }

    return { success: true, result: result.content };
  }

  /**
   * 视频内容总结
   * @param frameUrls 视频帧 URL 列表
   * @param options 选项
   */
  public async summarizeVideo(
    frameUrls: string[],
    options?: ChatCompletionOptions
  ): Promise<VideoAnalysisResult> {
    return this.analyzeVideoFrames(frameUrls, { analysisType: 'summary', ...options });
  }

  /**
   * 提取视频关键词
   * @param frameUrls 视频帧 URL 列表
   * @param options 选项
   */
  public async extractVideoKeywords(
    frameUrls: string[],
    options?: ChatCompletionOptions
  ): Promise<VideoAnalysisResult> {
    return this.analyzeVideoFrames(frameUrls, { analysisType: 'keywords', ...options });
  }

  /**
   * 视频详细描述
   * @param frameUrls 视频帧 URL 列表
   * @param options 选项
   */
  public async describeVideo(
    frameUrls: string[],
    options?: ChatCompletionOptions
  ): Promise<VideoAnalysisResult> {
    return this.analyzeVideoFrames(frameUrls, { analysisType: 'description', ...options });
  }

  /**
   * 自定义视频分析
   * @param frameUrls 视频帧 URL 列表
   * @param customPrompt 自定义提示词
   * @param options 选项
   */
  public async customVideoAnalysis(
    frameUrls: string[],
    customPrompt: string,
    options?: ChatCompletionOptions
  ): Promise<VideoAnalysisResult> {
    return this.analyzeVideoFrames(frameUrls, {
      analysisType: 'custom',
      customPrompt,
      ...options,
    });
  }

  /**
   * 文本匹配关键词
   * @param text 文本内容
   * @param availableKeywords 可选的关键词列表
   * @param options 选项
   */
  public async matchKeywords(
    text: string,
    availableKeywords?: string[],
    options?: ChatCompletionOptions
  ): Promise<{ success: boolean; keywords?: string[]; error?: string }> {
    let prompt: string;

    if (availableKeywords && availableKeywords.length > 0) {
      prompt = `请从以下关键词列表中选择与给定文本最匹配的关键词。

文本内容：
${text}

可选关键词列表：
${availableKeywords.join('、')}

请以JSON数组格式返回匹配的关键词，例如：["关键词1", "关键词2"]。只返回JSON数组，不要其他内容。`;
    } else {
      prompt = `请分析以下文本，提取出关键标签和关键词。

文本内容：
${text}

请以JSON数组格式返回关键词列表，例如：["关键词1", "关键词2"]。只返回JSON数组，不要其他内容。`;
    }

    const result = await this.chat(prompt, undefined, options);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    try {
      const keywords = this.parseKeywords(result.content || '');
      return { success: true, keywords };
    } catch {
      return { success: false, error: '解析关键词失败' };
    }
  }

  /**
   * 解析关键词 JSON
   */
  private parseKeywords(content: string): string[] {
    // 尝试提取 JSON 数组
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    }

    // 尝试直接解析
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }

    return [];
  }

  // ==================== 智能分割相关 ====================

  /**
   * 分析视频并返回时间片段（用于智能分割）
   * @param videoUrl 视频 URL
   * @param customPrompt 自定义提示词（可选，覆盖默认）
   */
  public async analyzeVideoSegments(
    videoUrl: string,
    customPrompt?: string
  ): Promise<{
    success: boolean;
    segments?: Array<{ startTime: number; endTime: number; description: string; keywords?: string }>;
    rawResult?: string;
    usage?: TokenUsage;
    error?: string;
  }> {
    const prompt = customPrompt || this.getDefaultSegmentPrompt();

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'video_url',
            video_url: { url: videoUrl },
            fps: 2,
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ];

    const result = await this.chatCompletion(messages, {
      model: BAILIAN_CONSTANTS.VIDEO_MODEL,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const segments = this.parseSegments(result.content || '');
    return {
      success: true,
      segments,
      rawResult: result.content,
      usage: result.usage,
    };
  }

  /**
   * TODO 默认智能分割提示词
   */
  private getDefaultSegmentPrompt(): string {
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
   * 从 AI 响应中解析时间片段
   */
  private parseSegments(content: string): Array<{ startTime: number; endTime: number; description: string }> {
    try {
      // 尝试提取 JSON 数组
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
      console.error('[BailianUtil] 解析片段 JSON 失败:', e);
    }
    return [];
  }

  // ==================== 异步 Batch API ====================

  // 常量：终止状态集合
  private static readonly BATCH_TERMINAL_STATES: Set<BatchStatus> = new Set([
    'completed', 'failed', 'expired', 'cancelled',
  ]);

  /**
   * 构建 Batch JSONL 内容
   * @param videos 视频输入列表
   * @param defaultPrompt 默认提示词
   * @param fps 视频帧提取频率
   * @param model 模型名称
   */
  private buildBatchJsonl(
    videos: BatchVideoInput[],
    defaultPrompt: string,
    fps: number = 2,
    model: string = BAILIAN_CONSTANTS.VIDEO_MODEL,
  ): string {
    return videos.map((video) => {
      const request = {
        custom_id: video.id,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'video_url', video_url: { url: video.url }, fps },
                { type: 'text', text: video.customPrompt || defaultPrompt },
              ],
            },
          ],
        },
      };
      return JSON.stringify(request);
    }).join('\n');
  }

  /**
   * 从 SDK batch 对象映射为 BatchTaskInfo
   */
  private mapBatchToTaskInfo(batch: any): BatchTaskInfo {
    return {
      batchId: batch.id,
      status: batch.status,
      requestCounts: batch.request_counts
        ? {
            total: batch.request_counts.total,
            completed: batch.request_counts.completed,
            failed: batch.request_counts.failed,
          }
        : undefined,
      createdAt: batch.created_at ? new Date(batch.created_at * 1000).toISOString() : undefined,
      outputFileId: batch.output_file_id || undefined,
      errorFileId: batch.error_file_id || undefined,
    };
  }

  /**
   * 创建异步批量视频分析任务
   * @param videos 视频输入列表（每个含 id 和 url）
   * @param options 可选参数（默认提示词、fps、模型）
   */
  public async createBatchVideoAnalysis(
    videos: BatchVideoInput[],
    options?: {
      defaultPrompt?: string;
      fps?: number;
      model?: string;
    }
  ): Promise<{ success: boolean; batchId?: string; fileId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: '百炼客户端未初始化' };
    }

    if (!videos || videos.length === 0) {
      return { success: false, error: '视频列表不能为空' };
    }

    try {
      const defaultPrompt = options?.defaultPrompt || this.getDefaultSegmentPrompt();
      const fps = options?.fps ?? 2;
      const model = options?.model || BAILIAN_CONSTANTS.VIDEO_MODEL;

      const jsonlContent = this.buildBatchJsonl(videos, defaultPrompt, fps, model);

      // 写入临时文件
      const tmpDir = path.join(require('os').tmpdir(), 'dmvideo-batch');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const tmpFilePath = path.join(tmpDir, `batch_${Date.now()}.jsonl`);
      fs.writeFileSync(tmpFilePath, jsonlContent, 'utf-8');

      // 上传文件并创建 batch（包装 401 重试）
      const result = await this.withAuthRetry(async () => {
        const fileStream = fs.createReadStream(tmpFilePath);
        const file = await (this.client as any).files.create({
          purpose: 'batch',
          file: fileStream,
        });

        const batch = await (this.client as any).batches.create({
          input_file_id: file.id,
          endpoint: '/v1/chat/completions',
          completion_window: '24h',
          metadata: {
            description: 'dmvideo-batch-video-analysis',
          },
        });

        return { batchId: batch.id, fileId: file.id };
      });

      // 清理临时文件
      try { fs.unlinkSync(tmpFilePath); } catch {}

      console.log(`[BailianUtil] Batch 任务已创建: ${result.batchId}, 文件ID: ${result.fileId}, 视频数: ${videos.length}`);
      return { success: true, ...result };
    } catch (error: any) {
      console.error('[BailianUtil] 创建 Batch 任务失败:', error);
      return { success: false, error: error.message || '创建 Batch 任务失败' };
    }
  }

  /**
   * 查询 Batch 任务状态
   * @param batchId 任务 ID
   */
  public async getBatchStatus(batchId: string): Promise<{
    success: boolean;
    data?: BatchTaskInfo;
    error?: string;
  }> {
    if (!this.client) {
      return { success: false, error: '百炼客户端未初始化' };
    }

    try {
      const batch = await this.withAuthRetry(() =>
        (this.client as any).batches.retrieve(batchId)
      );
      return {
        success: true,
        data: this.mapBatchToTaskInfo(batch),
      };
    } catch (error: any) {
      console.error('[BailianUtil] 查询 Batch 状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取 Batch 任务结果
   * 同时解析成功输出文件和错误文件
   * @param batchId 任务 ID
   */
  public async getBatchResults(batchId: string): Promise<{
    success: boolean;
    results?: BatchVideoResult[];
    error?: string;
  }> {
    if (!this.client) {
      return { success: false, error: '百炼客户端未初始化' };
    }

    try {
      const results: BatchVideoResult[] = [];

      await this.withAuthRetry(async () => {
        const batch = await (this.client as any).batches.retrieve(batchId);

        // 解析成功输出文件
        const outputFileId = batch.output_file_id;
        if (outputFileId) {
          const outputContent = await (this.client as any).files.content(outputFileId);
          const outputText = await outputContent.text();
          for (const line of outputText.trim().split('\n')) {
            if (!line.trim()) continue;
            try {
              const item = JSON.parse(line);
              const content = item.response?.body?.choices?.[0]?.message?.content || '';
              const segments = this.parseSegments(content);
              const usage = item.response?.body?.usage;
              results.push({
                customId: item.custom_id,
                success: true,
                segments,
                rawContent: content,
                usage: usage ? {
                  promptTokens: usage.prompt_tokens || 0,
                  completionTokens: usage.completion_tokens || 0,
                  totalTokens: usage.total_tokens || 0,
                } : undefined,
              });
            } catch (e) {
              console.warn('[BailianUtil] 解析成功结果行失败:', e);
            }
          }
        }

        // 解析错误文件
        const errorFileId = batch.error_file_id;
        if (errorFileId) {
          const errorContent = await (this.client as any).files.content(errorFileId);
          const errorText = await errorContent.text();
          for (const line of errorText.trim().split('\n')) {
            if (!line.trim()) continue;
            try {
              const item = JSON.parse(line);
              const errorMsg = item.error?.message || item.error?.code || '未知错误';
              results.push({
                customId: item.custom_id,
                success: false,
                error: errorMsg,
              });
            } catch (e) {
              console.warn('[BailianUtil] 解析错误结果行失败:', e);
            }
          }
        }
      });

      if (results.length === 0) {
        return { success: false, error: 'Batch 任务无输出文件' };
      }

      return { success: true, results };
    } catch (error: any) {
      console.error('[BailianUtil] 获取 Batch 结果失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取消 Batch 任务
   * @param batchId 任务 ID
   */
  public async cancelBatch(batchId: string): Promise<{
    success: boolean;
    status?: BatchStatus;
    error?: string;
  }> {
    if (!this.client) {
      return { success: false, error: '百炼客户端未初始化' };
    }

    try {
      const batch: any = await this.withAuthRetry(() =>
        (this.client as any).batches.cancel(batchId)
      );
      console.log(`[BailianUtil] Batch 任务 ${batchId} 已请求取消, 当前状态: ${batch.status}`);
      return { success: true, status: batch.status };
    } catch (error: any) {
      console.error('[BailianUtil] 取消 Batch 任务失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 列出最近的 Batch 任务
   * @param limit 返回数量上限，默认 20
   */
  public async listBatches(limit: number = 20): Promise<{
    success: boolean;
    batches?: BatchTaskInfo[];
    error?: string;
  }> {
    if (!this.client) {
      return { success: false, error: '百炼客户端未初始化' };
    }

    try {
      const response: any = await this.withAuthRetry(() =>
        (this.client as any).batches.list({ limit })
      );
      const batches: BatchTaskInfo[] = [];
      for (const batch of response.data || []) {
        batches.push(this.mapBatchToTaskInfo(batch));
      }
      return { success: true, batches };
    } catch (error: any) {
      console.error('[BailianUtil] 列出 Batch 任务失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 轮询等待 Batch 任务完成
   * @param batchId 任务 ID
   * @param options 轮询间隔和进度回调
   */
  public async waitForBatchCompletion(
    batchId: string,
    options?: {
      pollIntervalMs?: number;
      onProgress?: (info: BatchTaskInfo) => void;
    }
  ): Promise<{
    success: boolean;
    status?: BatchStatus;
    results?: BatchVideoResult[];
    error?: string;
  }> {
    const pollInterval = options?.pollIntervalMs ?? 30000;

    while (true) {
      const statusResult = await this.getBatchStatus(batchId);

      if (!statusResult.success) {
        return { success: false, error: statusResult.error };
      }

      const info = statusResult.data!;
      options?.onProgress?.(info);

      if (BailianUtil.BATCH_TERMINAL_STATES.has(info.status)) {
        if (info.status === 'completed') {
          const resultResponse = await this.getBatchResults(batchId);
          return {
            success: resultResponse.success,
            status: 'completed',
            results: resultResponse.results,
            error: resultResponse.error,
          };
        }

        // failed / expired / cancelled
        return {
          success: false,
          status: info.status,
          error: `Batch 任务终态: ${info.status}`,
        };
      }

      // 非终态，继续轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
}

// 导出单例实例
export const bailianUtil = BailianUtil.getInstance();
