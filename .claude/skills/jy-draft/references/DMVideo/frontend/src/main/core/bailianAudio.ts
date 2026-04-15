/**
 * 阿里云百炼语音工具类
 * 支持音色克隆和语音合成
 * 基于 DashScope CosyVoice 模型
 *
 * 声音复刻：HTTP API
 * 语音合成：WebSocket API
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import { httpClient } from './httpClient';
import { tokenConfigUtil } from './tokenConfig';

// 导入 ws 模块（使用 any 类型避免 ESM 互操作问题）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WS = require('ws');
type WebSocketType = any;
type WebSocketRawData = any;

// 使用 Node.js 内置的 crypto.randomUUID() 生成 UUID
const uuidv4 = () => crypto.randomUUID();

/**
 * 百炼语音配置常量
 */
export const BAILIAN_AUDIO_CONSTANTS = {
  /** API 基础地址 */
  BASE_URL: 'https://dashscope.aliyuncs.com/api/v1' as const,
  /** WebSocket 基础地址 */
  WS_URL: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/' as const,
  /** 音色克隆模型 */
  VOICE_CLONE_MODEL: 'voice-enrollment' as const,
  /** 支持的语音合成模型 */
  TTS_MODELS: {
    V35_PLUS: 'cosyvoice-v3.5-plus',
    V35_FLASH: 'cosyvoice-v3.5-flash',
    V3_PLUS: 'cosyvoice-v3-plus',
    V3_FLASH: 'cosyvoice-v3-flash',
  } as const,
  /** 语音识别模型 */
  ASR_MODEL: 'fun-asr' as const,
  /** ASR 默认语言提示 */
  ASR_DEFAULT_LANGUAGE_HINTS: ['zh'] as const,
  /** 默认采样率 */
  DEFAULT_SAMPLE_RATE: 16000 as const,
  /** 默认格式 */
  DEFAULT_FORMAT: 'mp3',
  /** 请求超时 */
  REQUEST_TIMEOUT: 60000,
  /** WebSocket 连接超时 */
  WS_CONNECT_TIMEOUT: 10000,
} as const;

/** 支持的音色模型类型 */
export type VoiceModelId = typeof BAILIAN_AUDIO_CONSTANTS.TTS_MODELS[keyof typeof BAILIAN_AUDIO_CONSTANTS.TTS_MODELS];

/**
 * 语音配置
 */
export interface BailianAudioConfig {
  /** API Key */
  apiKey: string;
  /** 基础地址（可选） */
  baseURL?: string;
}

/**
 * 音色克隆选项
 */
export interface VoiceCloneOptions {
  /** 音色名称前缀 */
  voiceName: string;
  /** 音色描述（可选） */
  description?: string;
  /** 目标模型（必填，音色将由哪个模型驱动） */
  targetModel?: VoiceModelId;
  /** 语言提示（默认 ['zh']） */
  languageHints?: string[];
}

/**
 * 音色克隆结果
 */
export interface VoiceCloneResult {
  /** 是否成功 */
  success: boolean;
  /** 音色 ID */
  voiceId?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 语音合成选项
 */
export interface SpeechSynthesisOptions {
  /** 语音模型 */
  model?: VoiceModelId;
  /** 输出格式（默认 mp3） */
  format?: 'mp3' | 'wav' | 'pcm';
  /** 采样率（默认 22050） */
  sampleRate?: number;
  /** 语速（0.5-2.0，默认 1.0） */
  rate?: number;
  /** 音量（0-100，默认 50） */
  volume?: number;
  /** 音调（默认 1.0） */
  pitch?: number;
}

/**
 * 语音合成结果
 */
export interface SpeechSynthesisResult {
  /** 是否成功 */
  success: boolean;
  /** 输出文件路径 */
  outputPath?: string;
  /** 音频数据（Buffer） */
  audioData?: Buffer;
  /** 错误信息 */
  error?: string;
}

/**
 * ASR 句子结果
 */
export interface AsrSentence {
  /** 文本内容 */
  text: string;
  /** 开始时间（毫秒） */
  begin_time: number;
  /** 结束时间（毫秒） */
  end_time: number;
  /** 说话人ID（可选） */
  speaker_id?: string;
  /** 句子ID */
  sentence_id?: number;
  /** 词语列表 */
  words?: AsrWord[];
}

/**
 * ASR 词语结果
 */
export interface AsrWord {
  /** 开始时间（毫秒） */
  begin_time: number;
  /** 结束时间（毫秒） */
  end_time: number;
  /** 文本内容 */
  text: string;
  /** 标点符号 */
  punctuation?: string;
}

/**
 * ASR 音轨结果
 */
export interface AsrChannel {
  /** 音轨ID */
  channel_id: number;
  /** 内容时长（毫秒） */
  content_duration_in_milliseconds?: number;
  /** 完整文本 */
  text: string;
  /** 句子列表 */
  sentences: AsrSentence[];
}

/**
 * ASR 文件转录结果
 */
export interface AsrTranscript {
  /** 文件URL */
  file_url: string;
  /** 音频属性 */
  properties?: {
    audio_format: string;
    channels: number[];
    original_sampling_rate: number;
    original_duration_in_milliseconds: number;
  };
  /** 转录结果 */
  transcripts: AsrChannel[];
}

/**
 * ASR 任务提交结果
 */
export interface AsrTaskSubmitResult {
  /** 是否成功 */
  success: boolean;
  /** 任务ID */
  taskId?: string;
  /** 任务状态 */
  taskStatus?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * ASR 任务状态
 */
export type AsrTaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

/**
 * ASR 任务查询结果
 */
export interface AsrTaskQueryResult {
  /** 是否成功 */
  success: boolean;
  /** 任务ID */
  taskId?: string;
  /** 任务状态 */
  taskStatus: AsrTaskStatus;
  /** 提交时间 */
  submitTime?: string;
  /** 调度时间 */
  scheduledTime?: string;
  /** 结束时间 */
  endTime?: string;
  /** 识别结果列表 */
  results?: AsrTaskSubResult[];
  /** 任务统计 */
  taskMetrics?: {
    TOTAL: number;
    SUCCEEDED: number;
    FAILED: number;
  };
  /** 使用量 */
  usage?: {
    duration: number;
  };
  /** 错误信息 */
  error?: string;
}

/**
 * ASR 子任务结果
 */
export interface AsrTaskSubResult {
  /** 文件URL */
  file_url?: string;
  /** 转录结果URL */
  transcription_url?: string;
  /** 子任务状态 */
  subtask_status: AsrTaskStatus;
  /** 错误码 */
  code?: string;
  /** 错误信息 */
  message?: string;
}

/**
 * ASR 结果（兼容旧接口）
 */
export interface AsrResult {
  /** 是否成功 */
  success: boolean;
  /** 句子列表 */
  sentences: AsrSentence[];
  /** 完整文本 */
  fullText?: string;
  /** 语音内容总时长（毫秒），用于计费 */
  contentDuration?: number;
  /** 转录结果列表 */
  transcripts?: AsrTranscript[];
  /** 错误信息 */
  error?: string;
}

/**
 * ASR 选项
 */
export interface AsrOptions {
  /** 是否启用说话人分离 */
  diarization_enabled?: boolean;
  /** 说话人数量(启用说话人分离时有效） */
  speaker_count?: number;
  /** 是否启用时间戳校准 */
  timestamp_alignment_enabled?: boolean;
  /** 是否过滤语气词 */
  disfluency_removal_enabled?: boolean;
  /** 语言提示列表（如 ["zh"] 表示中文） */
  language_hints?: string[];
  /** 热词ID */
  vocabulary_id?: string;
  /** 音轨索引 */
  channel_id?: number[];
  /** 敏感词过滤 */
  special_word_filter?: string;
}

/**
 * 预设音色列表
 */
export const PRESET_VOICES = {
  /** 龙昂扬（男声） */
  LONGANYANG: 'longanyang',
  /** 小燕（女声） */
  XIAOYAN: 'xiaoyan',
  /** 知性女声 */
  ZHICHU: 'zhichu',
  /** 活力男声 */
  CHUNHUI: 'chunhui',
} as const;

/**
 * 音色克隆 API 响应结构
 */
interface VoiceCloneResponse {
  output?: {
    voice_id?: string;
  };
  usage?: {
    count: number;
  };
  request_id?: string;
  code?: string | number;
  message?: string;
}

/**
 * WebSocket 任务状态
 */
type WsTaskState = 'idle' | 'connecting' | 'running' | 'finished' | 'failed';

/**
 * WebSocket TTS 客户端
 * 用于管理单个语音合成任务
 */
class WsTtsClient {
  private ws: WebSocketType | null = null;
  private taskId: string;
  private apiKey: string;
  private voiceId: string;
  private options: SpeechSynthesisOptions;
  private state: WsTaskState = 'idle';
  private audioChunks: Buffer[] = [];
  private taskStartedResolve: (() => void) | null = null;
  private taskFinishedResolve: (() => void) | null = null;
  private taskFailedReject: ((error: Error) => void) | null = null;

  constructor(apiKey: string, voiceId: string, options: SpeechSynthesisOptions = {}) {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.options = options;
    this.taskId = uuidv4();
  }

  /**
   * 启动语音合成任务
   */
  async start(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.taskFailedReject = reject;
      this.taskFinishedResolve = () => {
        resolve(Buffer.concat(this.audioChunks));
      };

      this.state = 'connecting';
      this.audioChunks = [];

      // 建立 WebSocket 连接
      this.ws = new WS(BAILIAN_AUDIO_CONSTANTS.WS_URL, {
        headers: {
          'Authorization': `bearer ${this.apiKey}`,
        },
      });

      this.ws.on('open', () => this.onOpen(text));
      this.ws.on('message', (data: WebSocketRawData) => this.onMessage(data));
      this.ws.on('error', (error: Error) => this.onError(error));
      this.ws.on('close', (code: number, reason: Buffer) => this.onClose(code, reason));
    });
  }

  /**
   * WebSocket 连接建立后发送 run-task 指令
   */
  private onOpen(text: string): void {
    const runTaskCmd = {
      header: {
        action: 'run-task',
        task_id: this.taskId,
        streaming: 'duplex',
      },
      payload: {
        task_group: 'audio',
        task: 'tts',
        function: 'SpeechSynthesizer',
        model: this.options.model || BAILIAN_AUDIO_CONSTANTS.TTS_MODELS.V3_FLASH,
        parameters: {
          text_type: 'PlainText',
          voice: this.voiceId,
          format: this.options.format || BAILIAN_AUDIO_CONSTANTS.DEFAULT_FORMAT,
          sample_rate: this.options.sampleRate || BAILIAN_AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE,
          volume: this.options.volume ?? 50,
          rate: this.options.rate ?? 1,
          pitch: this.options.pitch ?? 1,
        },
        input: {},
      },
    };

    this.ws!.send(JSON.stringify(runTaskCmd));
    console.log(`[WsTtsClient] 已发送 run-task 指令，taskId: ${this.taskId}`);

    // 等待任务启动后发送文本
    this.waitForTaskStarted().then(() => {
      this.sendText(text);
    }).catch(reject => {
      console.error('[WsTtsClient] 等待任务启动失败:', reject);
    });
  }

  /**
   * 处理 WebSocket 消息
   */
  private onMessage(data: WebSocketRawData): void {
    // 尝试解析为 JSON
    try {
      const text = data.toString('utf8');
      const msgJson = JSON.parse(text);
      const header = msgJson.header || {};
      const event = header.event || '';

      if (event === 'task-started') {
        this.state = 'running';
        console.log(`[WsTtsClient] 任务已启动，taskId: ${this.taskId}`);
        if (this.taskStartedResolve) {
          this.taskStartedResolve();
        }
      } else if (event === 'task-finished') {
        this.state = 'finished';
        console.log(`[WsTtsClient] 任务完成，taskId: ${this.taskId}`);
        this.close();
        if (this.taskFinishedResolve) {
          this.taskFinishedResolve();
        }
      } else if (event === 'task-failed') {
        this.state = 'failed';
        const errorMsg = msgJson.payload?.message || '未知错误';
        console.error(`[WsTtsClient] 任务失败，taskId: ${this.taskId}, 错误: ${errorMsg}`);
        this.close();
        if (this.taskFailedReject) {
          this.taskFailedReject(new Error(errorMsg));
        }
      }
      return;
    } catch {
      // 不是 JSON，是音频二进制数据
    }

    // 二进制音频数据
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    this.audioChunks.push(chunk);
  }

  /**
   * 处理 WebSocket 错误
   */
  private onError(error: Error): void {
    console.error(`[WsTtsClient] WebSocket 错误: ${error.message}`);
    this.state = 'failed';
    this.close();
    if (this.taskFailedReject) {
      this.taskFailedReject(error);
    }
  }

  /**
   * 处理 WebSocket 关闭
   */
  private onClose(code: number, reason: Buffer): void {
    console.log(`[WsTtsClient] WebSocket 已关闭: ${reason.toString()} (${code})`);
    if (this.state === 'running') {
      // 如果还在运行状态就关闭了，可能是异常
      if (this.taskFailedReject) {
        this.taskFailedReject(new Error(`WebSocket 意外关闭: ${reason.toString()}`));
      }
    }
  }

  /**
   * 等待任务启动
   */
  private waitForTaskStarted(timeout: number = BAILIAN_AUDIO_CONSTANTS.WS_CONNECT_TIMEOUT): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('任务启动超时'));
      }, timeout);

      this.taskStartedResolve = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  /**
   * 发送文本进行合成
   */
  private sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WS.OPEN) {
      console.error('[WsTtsClient] WebSocket 未连接，无法发送文本');
      if (this.taskFailedReject) {
        this.taskFailedReject(new Error('WebSocket 未连接'));
      }
      return;
    }

    // 按句子边界切割文本
    const SENTENCE_DELIMITERS = ['.', '?', '!', '。', '？', '！', '\n'];
    const fragments: string[] = [];
    let startIndex = 0;
    let i = 0;

    while (i < text.length) {
      if (SENTENCE_DELIMITERS.includes(text[i])) {
        let endIndex = i + 1;
        while (endIndex < text.length && SENTENCE_DELIMITERS.includes(text[endIndex])) {
          endIndex++;
        }
        fragments.push(text.substring(startIndex, endIndex));
        startIndex = endIndex;
        i = endIndex - 1;
      }
      i++;
    }

    if (startIndex < text.length) {
      fragments.push(text.substring(startIndex));
    }

    // 发送所有文本片段
    for (const fragment of fragments) {
      if (fragment.trim()) {
        this.sendContinueTask(fragment);
      }
    }

    // 发送结束指令
    this.sendFinishTask();
  }

  /**
   * 发送 continue-task 指令
   */
  private sendContinueTask(text: string): boolean {
    if (!this.ws || this.ws.readyState !== WS.OPEN) {
      return false;
    }

    const cmd = {
      header: {
        action: 'continue-task',
        task_id: this.taskId,
        streaming: 'duplex',
      },
      payload: {
        input: {
          text: text,
        },
      },
    };

    this.ws.send(JSON.stringify(cmd));
    return true;
  }

  /**
   * 发送 finish-task 指令
   */
  private sendFinishTask(): void {
    if (!this.ws || this.ws.readyState !== WS.OPEN) {
      return;
    }

    const cmd = {
      header: {
        action: 'finish-task',
        task_id: this.taskId,
        streaming: 'duplex',
      },
      payload: {
        input: {},
      },
    };

    this.ws.send(JSON.stringify(cmd));
    console.log(`[WsTtsClient] 已发送 finish-task 指令，taskId: ${this.taskId}`);
  }

  /**
   * 关闭连接
   */
  private close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // 忽略关闭错误
      }
      this.ws = null;
    }
  }

  /**
   * 取消任务
   */
  public cancel(): void {
    this.state = 'failed';
    this.close();
  }
}

/**
 * 阿里云百炼语音工具类
 */
export class BailianAudioUtil {
  private static instance: BailianAudioUtil | null = null;
  private config: BailianAudioConfig | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): BailianAudioUtil {
    if (!BailianAudioUtil.instance) {
      BailianAudioUtil.instance = new BailianAudioUtil();
    }
    return BailianAudioUtil.instance;
  }

  /**
   * 初始化
   * @param config 配置
   */
  public init(config: BailianAudioConfig): void {
    this.config = config;
    console.log('[BailianAudioUtil] 初始化成功');
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return this.config !== null && !!this.config.apiKey;
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
  }

  /**
   * 获取 API Key
   * 始终从 tokenConfigUtil 动态获取（内部已实现 9 分钟自动刷新）
   * fallback 到本地缓存（仅在 tokenConfigUtil 不可用时）
   */
  private async getApiKey(): Promise<string> {
    try {
      const apiKey = await tokenConfigUtil.getBailianApiKey();
      if (apiKey) {
        return apiKey;
      }
    } catch (error) {
      console.error('[BailianAudioUtil] 从 tokenConfigUtil 获取 API Key 失败:', error);
    }

    // fallback: 使用本地缓存
    if (this.config?.apiKey) {
      return this.config.apiKey;
    }

    throw new Error('API Key 未配置');
  }

  /**
   * 获取基础 URL
   */
  private getBaseUrl(): string {
    return BAILIAN_AUDIO_CONSTANTS.BASE_URL;
  }

  /**
   * 音色克隆（公网URL）
   * 使用公开可访问的音频URL创建音色
   *
   * API 文档：POST /api/v1/services/audio/tts/customization
   *
   * @param audioUrl 公网可访问的音频URL
   * @param options 克隆选项
   */
  public async cloneVoiceByUrl(
    audioUrl: string,
    options: VoiceCloneOptions
  ): Promise<VoiceCloneResult> {
    const apiKey = await this.getApiKey();

    console.log(`[BailianAudioUtil] 开始通过URL克隆音色: ${options.voiceName}`);

    try {
      // 构建请求体 - 严格按照官方 API 格式
      // 官方文档: https://help.aliyun.com/zh/model-studio/developer-reference/cosyvoice-v3-api
      const payload = {
        model: BAILIAN_AUDIO_CONSTANTS.VOICE_CLONE_MODEL,
        input: {
          action: 'create_voice',
          target_model: options.targetModel || BAILIAN_AUDIO_CONSTANTS.TTS_MODELS.V35_PLUS,
          prefix: options.voiceName,
          url: audioUrl,
        },
      };

      console.log('[BailianAudioUtil] 音色克隆请求:', JSON.stringify(payload, null, 2));

      const data = await httpClient.request<VoiceCloneResponse>({
        url: `${this.getBaseUrl()}/services/audio/tts/customization`,
        method: 'POST',
        data: payload,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: BAILIAN_AUDIO_CONSTANTS.REQUEST_TIMEOUT,
      });

      // 检查响应
      if (data.code && data.code !== 200 && data.code !== '200' && data.code !== 'Success') {
        return {
          success: false,
          error: data.message || '克隆失败',
        };
      }

      const voiceId = data.output?.voice_id;
      if (!voiceId) {
        return {
          success: false,
          error: 'API 返回成功但未找到 voice_id',
        };
      }

      console.log(`[BailianAudioUtil] 音色克隆成功，Voice ID: ${voiceId}`);

      return {
        success: true,
        voiceId,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '未知错误';
      console.error('[BailianAudioUtil] 音色克隆出错:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * 音色克隆（本地文件）
   * 上传参考音频，生成专属 voice_id
   *
   * 注意：此方法需要先将文件上传到可公开访问的 URL，然后调用 cloneVoiceByUrl
   * 如果你有 OSS 等云存储，可以先上传文件获取 URL
   *
   * @param audioFilePath 本地参考音频路径（建议 10-60 秒，清晰无噪）
   * @param options 克隆选项
   */
  public async cloneVoice(
    audioFilePath: string,
    options: VoiceCloneOptions
  ): Promise<VoiceCloneResult> {
    // 检查文件是否存在
    if (!fs.existsSync(audioFilePath)) {
      return {
        success: false,
        error: `音频文件不存在: ${audioFilePath}`,
      };
    }

    // 获取文件扩展名
    const ext = path.extname(audioFilePath).toLowerCase();
    if (!['.mp3', '.wav', '.m4a', '.pcm'].includes(ext)) {
      return {
        success: false,
        error: '不支持的音频格式，请使用 mp3、wav、m4a 或 pcm',
      };
    }

    console.log(`[BailianAudioUtil] 开始克隆音色: ${options.voiceName}`);

    // 注意：新的 API 只支持 URL 方式，需要先将文件上传到可访问的 URL
    // 这里返回错误提示用户使用 cloneVoiceByUrl 或先上传文件
    return {
      success: false,
      error: '新版 API 仅支持 URL 方式克隆音色，请先将音频上传到可公开访问的 URL，然后使用 cloneVoiceByUrl 方法',
    };
  }

  /**
   * 语音合成
   * 使用 WebSocket 将文本转换为语音
   *
   * @param text 要合成的文本
   * @param voiceId 音色 ID（克隆的或预设的）
   * @param outputFilePath 输出音频文件路径（可选，不传则返回 Buffer）
   * @param options 合成选项
   */
  public async synthesizeSpeech(
    text: string,
    voiceId: string,
    outputFilePath?: string,
    options: SpeechSynthesisOptions = {}
  ): Promise<SpeechSynthesisResult> {
    const apiKey = await this.getApiKey();

    console.log(`[BailianAudioUtil] 开始合成语音，模型: ${options.model || BAILIAN_AUDIO_CONSTANTS.TTS_MODELS.V3_FLASH}，音色: ${voiceId}`);

    try {
      // 使用 WebSocket 客户端进行语音合成
      const client = new WsTtsClient(apiKey, voiceId, options);
      const audioData = await client.start(text);

      // 保存文件
      if (outputFilePath) {
        // 确保输出目录存在
        const dir = path.dirname(outputFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputFilePath, audioData);
        console.log(`[BailianAudioUtil] 语音合成成功，文件已保存: ${outputFilePath}`);
        return {
          success: true,
          outputPath: outputFilePath,
          audioData,
        };
      }

      return {
        success: true,
        audioData,
      };
    } catch (error: any) {
      const errorMsg = error.message || '未知错误';
      console.error('[BailianAudioUtil] 语音合成出错:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * 文本转语音（使用预设音色）
   * @param text 要合成的文本
   * @param outputFilePath 输出文件路径
   * @param voiceId 预设音色 ID（默认 longanyang）
   * @param options 合成选项
   */
  public async textToSpeech(
    text: string,
    outputFilePath: string,
    voiceId: string = PRESET_VOICES.LONGANYANG,
    options?: SpeechSynthesisOptions
  ): Promise<SpeechSynthesisResult> {
    return this.synthesizeSpeech(text, voiceId, outputFilePath, options);
  }

  /**
   * 文本转语音（返回 Buffer）
   * @param text 要合成的文本
   * @param voiceId 音色 ID
   * @param options 合成选项
   */
  public async textToSpeechBuffer(
    text: string,
    voiceId: string = PRESET_VOICES.LONGANYANG,
    options?: SpeechSynthesisOptions
  ): Promise<SpeechSynthesisResult> {
    return this.synthesizeSpeech(text, voiceId, undefined, options);
  }

  /**
   * 获取预设音色列表
   */
  public getPresetVoices(): typeof PRESET_VOICES {
    return PRESET_VOICES;
  }

  /**
   * 获取支持的音色模型列表
   */
  public getSupportedModels(): { id: VoiceModelId; name: string }[] {
    return [
      { id: BAILIAN_AUDIO_CONSTANTS.TTS_MODELS.V35_PLUS, name: 'CosyVoice V3.5 Plus（高质量）' },
      { id: BAILIAN_AUDIO_CONSTANTS.TTS_MODELS.V35_FLASH, name: 'CosyVoice V3.5 Flash（快速）' },
      { id: BAILIAN_AUDIO_CONSTANTS.TTS_MODELS.V3_PLUS, name: 'CosyVoice V3 Plus（高质量）' },
      { id: BAILIAN_AUDIO_CONSTANTS.TTS_MODELS.V3_FLASH, name: 'CosyVoice V3 Flash（快速）' },
    ];
  }

  // ==================== 语音识别（ASR）异步任务模式 ====================

  /**
   * 提交语音识别任务
   * 使用异步任务模式，支持多个音频文件URL
   *
   * @param fileUrls 音频文件URL列表
   * @param options 识别选项
   */
  public async submitAsrTask(
    fileUrls: string[],
    options: AsrOptions = {}
  ): Promise<AsrTaskSubmitResult> {
    const apiKey = await this.getApiKey();

    if (!fileUrls || fileUrls.length === 0) {
      return {
        success: false,
        error: '音频文件URL列表不能为空',
      };
    }

    console.log(`[BailianAudioUtil] 提交语音识别任务，文件数: ${fileUrls.length}`);

    try {
      // 构建参数
      const parameters: Record<string, any> = {};

      // 语言提示（仅适用于 paraformer-v2 模型）
      if (options.language_hints && options.language_hints.length > 0) {
        parameters.language_hints = options.language_hints;
      }

      // 热词ID
      if (options.vocabulary_id) {
        parameters.vocabulary_id = options.vocabulary_id;
      }

      // 音轨索引
      if (options.channel_id) {
        parameters.channel_id = options.channel_id;
      }

      // 过滤语气词
      if (options.disfluency_removal_enabled !== undefined) {
        parameters.disfluency_removal_enabled = options.disfluency_removal_enabled;
      }

      // 时间戳校准
      if (options.timestamp_alignment_enabled !== undefined) {
        parameters.timestamp_alignment_enabled = options.timestamp_alignment_enabled;
      }

      // 敏感词过滤
      if (options.special_word_filter) {
        parameters.special_word_filter = options.special_word_filter;
      }

      // 说话人分离
      if (options.diarization_enabled) {
        parameters.diarization_enabled = true;
        if (options.speaker_count) {
          parameters.speaker_count = options.speaker_count;
        }
      }

      const payload = {
        model: BAILIAN_AUDIO_CONSTANTS.ASR_MODEL,
        input: {
              file_urls: fileUrls,
            },
        parameters,
      };

      console.log('[BailianAudioUtil] ASR任务请求:', JSON.stringify(payload, null, 2));

      const data = await httpClient.request<AsrTaskSubmitResponse>({
        url: `${this.getBaseUrl()}/services/audio/asr/transcription`,
        method: 'POST',
        data: payload,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable', // 必须设置，否则无法提交任务
        },
        timeout: BAILIAN_AUDIO_CONSTANTS.REQUEST_TIMEOUT,
      });

      const taskId = data.output?.task_id;
      const taskStatus = data.output?.task_status;

      if (!taskId) {
        return {
          success: false,
          error: 'API 返回成功但未找到 task_id',
        };
      }

      console.log(`[BailianAudioUtil] ASR任务提交成功，taskId: ${taskId}, requestId: ${data.request_id || '无'}, status: ${taskStatus}`);

      return {
        success: true,
        taskId,
        taskStatus,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '未知错误';
      console.error('[BailianAudioUtil] 提交ASR任务出错:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * 查询语音识别任务状态
   *
   * @param taskId 任务ID
   */
  public async queryAsrTask(taskId: string): Promise<AsrTaskQueryResult> {
    const apiKey = await this.getApiKey();

    if (!taskId) {
      return {
        success: false,
        taskStatus: 'UNKNOWN',
        error: '任务ID不能为空',
      };
    }

    console.log(`[BailianAudioUtil] 查询ASR任务状态， taskId: ${taskId}`);

    try {
      const data = await httpClient.request<AsrTaskQueryResponse>({
        url: `${this.getBaseUrl()}/tasks/${taskId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: BAILIAN_AUDIO_CONSTANTS.REQUEST_TIMEOUT,
      });

      const output = data.output || {};
      const taskStatus = this.parseAsrTaskStatus(output.task_status);

      console.log(`[BailianAudioUtil] ASR任务状态: ${taskStatus}, requestId: ${data.request_id || '无'}`);

      return {
        success: true,
        taskId: output.task_id,
        taskStatus,
        submitTime: output.submit_time,
        scheduledTime: output.scheduled_time,
        endTime: output.end_time,
        results: output.results?.map(r => ({
          file_url: r.file_url,
          transcription_url: r.transcription_url,
          subtask_status: this.parseAsrTaskStatus(r.subtask_status),
          code: r.code,
          message: r.message,
        })),
        taskMetrics: output.task_metrics,
        usage: data.usage,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '未知错误';
      console.error('[BailianAudioUtil] 查询ASR任务出错:', errorMsg);
      return {
        success: false,
        taskStatus: 'UNKNOWN',
        error: errorMsg,
      };
    }
  }

  /**
   * 获取语音识别结果（从transcription_url下载并解析）
   *
   * @param transcriptionUrl 转录结果URL
   */
  public async getAsrTranscriptionResult(transcriptionUrl: string): Promise<AsrTranscript | null> {
    try {
      console.log(`[BailianAudioUtil] 获取ASR转录结果: ${transcriptionUrl}`);

      // 直接使用 axios 请求，不使用 httpClient 的默认 headers
      // OSS 签名 URL 对 headers 敏感，不能有多余的 headers
      const response = await axios.get(transcriptionUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      const text = Buffer.from(response.data).toString('utf-8');
      const result: AsrTranscript = JSON.parse(text);

      return result;
    } catch (error: any) {
      console.error('[BailianAudioUtil] 获取ASR转录结果出错:', error);
      return null;
    }
  }

  /**
   * 等待语音识别任务完成并获取结果
   * 自动轮询查询任务状态，直到完成或失败
   *
   * @param taskId 任务ID
   * @param pollInterval 轮询间隔（毫秒，默认2000）
   * @param maxAttempts 最大尝试次数（默认60，即2分钟）
   */
  public async waitForAsrTask(
    taskId: string,
    pollInterval: number = 2000,
    maxAttempts: number = 60
  ): Promise<AsrTaskQueryResult> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const result = await this.queryAsrTask(taskId);

      if (!result.success) {
        return result;
      }

      if (result.taskStatus === 'SUCCEEDED') {
        console.log(`[BailianAudioUtil] ASR任务完成， taskId: ${taskId}`);
        return result;
      }

      if (result.taskStatus === 'FAILED') {
        // 输出详细的子任务错误信息
        let failedDetail = '';
        if (result.results) {
          for (const sub of result.results) {
            if (sub.subtask_status === 'FAILED') {
              failedDetail += `, subtask code=${sub.code || 'unknown'}, message=${sub.message || '无'}`;
            }
          }
        }
        console.error(`[BailianAudioUtil] ASR任务失败，taskId: ${taskId}${failedDetail}, error: ${result.error || '无'}`);
        return result;
      }

      // 等待后继续轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }

    return {
      success: false,
      taskStatus: 'UNKNOWN',
      error: '等待任务完成超时',
    };
  }

  /**
   * 完整的语音识别流程
   * 提交任务 -> 等待完成 -> 获取结果 -> 解析
   *
   * @param fileUrls 音频文件URL列表
   * @param options 识别选项
   * @param pollInterval 轮询间隔（毫秒）
   */
  public async recognizeSpeechFromUrls(
    fileUrls: string[],
    options: AsrOptions = {},
    pollInterval: number = 2000
  ): Promise<AsrResult> {
    // 1. 提交任务
    const submitResult = await this.submitAsrTask(fileUrls, options);
    if (!submitResult.success) {
      return {
        success: false,
        sentences: [],
        error: submitResult.error,
      };
    }

    // 2. 等待任务完成
    const queryResult = await this.waitForAsrTask(submitResult.taskId!, pollInterval);
    console.log(`[BailianAudioUtil] ASR最终结果: taskId=${submitResult.taskId}, status=${queryResult.taskStatus}, results数=${queryResult.results?.length || 0}, usage=${JSON.stringify(queryResult.usage || {})}`);
    if (!queryResult.success || queryResult.taskStatus !== 'SUCCEEDED') {
      // 获取详细错误信息
      let errorDetail = queryResult.error || `任务状态: ${queryResult.taskStatus}`;
      if (queryResult.results) {
        for (const subResult of queryResult.results) {
          if (subResult.subtask_status === 'FAILED' && subResult.message) {
            errorDetail = `${errorDetail}, code: ${subResult.code || 'unknown'}, message: ${subResult.message}`;
            console.error(`[BailianAudioUtil] ASR子任务失败: code=${subResult.code}, message=${subResult.message}`);
          }
        }
      }
      return {
        success: false,
        sentences: [],
        error: errorDetail,
      };
    }

    // 3. 获取并解析结果
    const transcripts: AsrTranscript[] = [];
    const allSentences: AsrSentence[] = [];
    let fullText = '';
    let totalContentDuration = 0; // 语音内容总时长（用于计费）

    if (queryResult.results) {
      for (const subResult of queryResult.results) {
        if (subResult.subtask_status === 'SUCCEEDED' && subResult.transcription_url) {
          const transcript = await this.getAsrTranscriptionResult(subResult.transcription_url);
          if (transcript) {
            transcripts.push(transcript);

            // 解析句子 - 按标点符号拆分短句
            for (const channel of transcript.transcripts || []) {
              // 累加语音内容时长（用于计费）
              if (channel.content_duration_in_milliseconds) {
                totalContentDuration += channel.content_duration_in_milliseconds;
              }
              for (const sentence of channel.sentences || []) {
                // 按标点符号拆分短句
                const shortSentences = this.splitSentenceByPunctuation(
                  sentence
                );
                for (const shortSentence of shortSentences) {
                  allSentences.push(shortSentence);
                  fullText += shortSentence.text;
                }
              }
            }
          }
        }
      }
    }

    console.log(`[BailianAudioUtil] 语音识别完成，句子数: ${allSentences.length}，语音时长: ${totalContentDuration}ms`);

    return {
      success: true,
      sentences: allSentences,
      fullText,
      contentDuration: totalContentDuration,
      transcripts,
    };
  }

  /**
   * 根据标点符号拆分句子
   * 将长句按照标点符号拆分成多个短句，并计算每个短句的开始和结束时间
   * 基于 words 数组中每个词的 punctuation 属性判断是否有标点符号
   *
   * @param sentence 原始句子
   */
  private splitSentenceByPunctuation(
    sentence: AsrSentence
  ): AsrSentence[] {
    if (!sentence.words || sentence.words.length === 0) {
      return [sentence];
    }

    const result: AsrSentence[] = [];
    let currentWords: AsrWord[] = [];
    let sentenceId = 1;

    for (let i = 0; i < sentence.words.length; i++) {
      const word = sentence.words[i];
      currentWords.push(word);

      // 检查当前词后面是否有标点符号（punctuation 属性不为空表示有标点）
      const hasPunctuation = word.punctuation && word.punctuation.length > 0;

      // 如果有标点符号或者是最后一个词，创建一个短句
      if (hasPunctuation || i === sentence.words.length - 1) {
        const text = currentWords.map(w => w.text + (w.punctuation || '')).join('');
        const beginTime = currentWords[0].begin_time;
        const endTime = currentWords[currentWords.length - 1].end_time;

        result.push({
          text,
          begin_time: beginTime,
          end_time: endTime,
          speaker_id: sentence.speaker_id,
          sentence_id: sentenceId++,
          words: [...currentWords],
        });

        currentWords = [];
      }
    }

    return result;
  }

  /**
   * 解析ASR任务状态
   */
  private parseAsrTaskStatus(status?: string): AsrTaskStatus {
    if (!status) return 'UNKNOWN';
    const upperStatus = status.toUpperCase();
    if (['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED'].includes(upperStatus)) {
      return upperStatus as AsrTaskStatus;
    }
    return 'UNKNOWN';
  }

  // ==================== 兼容旧接口 ====================

  /**
   * 语音识别（ASR）- 旧版接口，仅支持单个本地文件
   * 注意：新版API仅支持URL方式，如需使用本地文件，请先上传到OSS获取URL
   * @deprecated 请使用 recognizeSpeechFromUrls
   */
  public async recognizeSpeech(
    audioFilePath: string,
    options: AsrOptions = {}
  ): Promise<AsrResult> {
    // 检查文件是否存在
    if (!fs.existsSync(audioFilePath)) {
      return {
        success: false,
        sentences: [],
        error: `音频文件不存在: ${audioFilePath}`,
      };
    }

    // 新版API仅支持URL方式，返回错误提示
    return {
      success: false,
      sentences: [],
      error: '新版ASR API仅支持URL方式，请先将音频文件上传到可公开访问的URL，然后使用 recognizeSpeechFromUrls 方法',
    };
  }
}

/**
 * ASR 任务提交响应
 */
interface AsrTaskSubmitResponse {
  output?: {
    task_status?: string;
    task_id?: string;
  };
  request_id?: string;
  code?: string | number;
  message?: string;
}

/**
 * ASR 任务查询响应
 */
interface AsrTaskQueryResponse {
  request_id?: string;
  output?: {
    task_id?: string;
    task_status?: string;
    submit_time?: string;
    scheduled_time?: string;
    end_time?: string;
    results?: Array<{
      file_url?: string;
      transcription_url?: string;
      subtask_status?: string;
      code?: string;
      message?: string;
    }>;
    task_metrics?: {
      TOTAL: number;
      SUCCEEDED: number;
      FAILED: number;
    };
  };
  usage?: {
    duration: number;
  };
}

// 导出单例实例
export const bailianAudioUtil = BailianAudioUtil.getInstance();
