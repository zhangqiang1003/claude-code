/**
 * 剪映草稿 API 客户端
 * 封装后端剪映草稿相关的 HTTP 接口调用
 *
 * 对应后端 backend/core/api/router.py 中的路由定义
 */


import {
  AddAudiosRequest, AddTextsRequest,
  AddVideosRequest,
  ApiResponse,
  AudioInfoRequest,
  AudioInfoResponse,
  CreateDraftResponse,
  GenerateJianyingDraftRequest,
  GenerateJianyingDraftResponse,
  ModifyAudioInfosRequest,
  ModifyTextInfosRequest,
  ModifyVideoInfosRequest,
  SwapPositionItem,
  TextInfoRequest,
  TextInfoResponse,
  TimelineItem,
  TimelineResponse,
  VideoInfoRequest,
  VideoInfoResponse
} from '../typings/draftApi';
import { httpClient } from './httpClient';

// ==================== API 客户端类 ====================

/**
 * 剪映草稿 API 客户端
 *
 * 提供完整的剪映草稿操作接口，路由对齐后端 router.py：
 * - 草稿管理：创建、删除、获取模板
 * - 素材添加：视频、音频、文本
 * - 时间线操作：生成、按音频生成
 * - 视频/音频/文本片段：创建、拼接、交换、修改
 * - 剪映草稿生成：生成可直接在剪映客户端打开的草稿文件夹
 */
class DraftApiClient {
  private baseUrl: string;
  private apiPrefix: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || 'http://127.0.0.1:26312';
    this.apiPrefix = '/api/draft';
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private getApiUrl(path: string): string {
    return `${this.baseUrl}${this.apiPrefix}${path}`;
  }

  // ==================== 草稿管理接口 ====================

  /** 创建草稿，初始化基础信息及空的视/音/文/贴纸轨道 */
  async createDraft(width: number, height: number): Promise<CreateDraftResponse> {
    return httpClient.request<CreateDraftResponse>({
      url: this.getApiUrl('/create'),
      method: 'POST',
      data: { width, height },
    });
  }

  /** 删除草稿所有数据，此操作不可恢复 */
  async deleteDraft(draftId: string): Promise<ApiResponse> {
    return httpClient.request<ApiResponse>({
      url: this.getApiUrl('/delete'),
      method: 'POST',
      data: { draft_id: draftId },
    });
  }

  /** 获取草稿模板数据 */
  async getDraftTemplate(draftId: string): Promise<any> {
    return httpClient.request({
      url: this.getApiUrl(`/template/${draftId}`),
      method: 'GET',
    });
  }

  // ==================== 素材添加接口 ====================

  /** 添加视频/图片素材到草稿视频轨道 */
  async addVideos(request: AddVideosRequest): Promise<ApiResponse> {
    return httpClient.request<ApiResponse>({
      url: this.getApiUrl('/add_videos'),
      method: 'POST',
      data: request,
    });
  }

  /** 添加音频素材到草稿音频轨道 */
  async addAudios(request: AddAudiosRequest): Promise<ApiResponse> {
    return httpClient.request<ApiResponse>({
      url: this.getApiUrl('/add_audios'),
      method: 'POST',
      data: request,
    });
  }

  /** 添加文本素材到草稿文本轨道 */
  async addTexts(request: AddTextsRequest): Promise<ApiResponse> {
    return httpClient.request<ApiResponse>({
      url: this.getApiUrl('/add_texts'),
      method: 'POST',
      data: request,
    });
  }

  // ==================== 时间线接口 ====================

  /** 根据时长分段生成时间线（模式1: 时长数组；模式2: begin_time/end_time 数组） */
  async generateTimelines(timelineSegment: number[] | Array<{ begin_time: number; end_time: number }>): Promise<TimelineResponse> {
    return httpClient.request<TimelineResponse>({
      url: this.getApiUrl('/timelines/generate'),
      method: 'POST',
      data: { timeline_segment: timelineSegment },
    });
  }

  /** 根据音频 URL 列表自动分析时长并生成时间线 */
  async generateTimelinesByAudio(audioUrls: string[]): Promise<TimelineResponse> {
    return httpClient.request<TimelineResponse>({
      url: this.getApiUrl('/timelines/generate_by_audio'),
      method: 'POST',
      data: { audio_urls: audioUrls },
    });
  }

  // ==================== 视频/图片片段接口 ====================

  /** 创建视频/图片素材信息 */
  async createVideoInfo(request: VideoInfoRequest): Promise<VideoInfoResponse> {
    return httpClient.request<VideoInfoResponse>({
      url: this.getApiUrl('/video/info'),
      method: 'POST',
      data: request,
    });
  }

  /** 根据时间线数组和视频 URL 列表批量创建视频素材信息 */
  async createVideoInfosByTimelines(
    timelines: TimelineItem[],
    videoUrls: string[],
  ): Promise<VideoInfoResponse> {
    return httpClient.request<VideoInfoResponse>({
      url: this.getApiUrl('/video/by_timelines'),
      method: 'POST',
      data: { timelines, video_urls: videoUrls },
    });
  }

  /** 拼接两个视频信息数组 */
  async concatVideoInfos(videoInfos1: string, videoInfos2: string): Promise<VideoInfoResponse> {
    return httpClient.request<VideoInfoResponse>({
      url: this.getApiUrl('/video/concat'),
      method: 'POST',
      data: { video_infos1: videoInfos1, video_infos2: videoInfos2 },
    });
  }

  /** 交换视频素材片段位置 */
  async swapVideoSegment(
    videoInfos: string,
    swapPosition: SwapPositionItem[],
    targetTimerangeStart?: number,
  ): Promise<VideoInfoResponse> {
    return httpClient.request<VideoInfoResponse>({
      url: this.getApiUrl('/video/swap'),
      method: 'POST',
      data: {
        video_infos: videoInfos,
        swap_position: swapPosition,
        target_timerange_start: targetTimerangeStart ?? 0,
      },
    });
  }

  /** 修改视频素材信息 */
  async modifyVideoInfos(
    videoInfos: string,
    segmentIndex: number[],
    modifications: Omit<ModifyVideoInfosRequest, 'video_infos' | 'segment_index'>,
  ): Promise<VideoInfoResponse> {
    return httpClient.request<VideoInfoResponse>({
      url: this.getApiUrl('/video/modify'),
      method: 'POST',
      data: {
        video_infos: videoInfos,
        segment_index: segmentIndex,
        ...modifications,
      },
    });
  }

  // ==================== 音频片段接口 ====================

  /** 创建音频素材信息 */
  async createAudioInfo(request: AudioInfoRequest): Promise<AudioInfoResponse> {
    return httpClient.request<AudioInfoResponse>({
      url: this.getApiUrl('/audio/info'),
      method: 'POST',
      data: request,
    });
  }

  /** 根据时间线数组和音频 URL 列表批量创建音频素材信息 */
  async createAudioInfosByTimelines(
    timelines: TimelineItem[],
    audioUrls: string[],
  ): Promise<AudioInfoResponse> {
    return httpClient.request<AudioInfoResponse>({
      url: this.getApiUrl('/audio/by_timelines'),
      method: 'POST',
      data: { timelines, audio_urls: audioUrls },
    });
  }

  /** 拼接两个音频信息数组 */
  async concatAudioInfos(audioInfos1: string, audioInfos2: string): Promise<AudioInfoResponse> {
    return httpClient.request<AudioInfoResponse>({
      url: this.getApiUrl('/audio/concat'),
      method: 'POST',
      data: { audio_infos1: audioInfos1, audio_infos2: audioInfos2 },
    });
  }

  /** 交换音频素材片段位置 */
  async swapAudioSegment(
    audioInfos: string,
    swapPosition: SwapPositionItem[],
    targetTimerangeStart?: number,
  ): Promise<AudioInfoResponse> {
    return httpClient.request<AudioInfoResponse>({
      url: this.getApiUrl('/audio/swap'),
      method: 'POST',
      data: {
        audio_infos: audioInfos,
        swap_position: swapPosition,
        target_timerange_start: targetTimerangeStart ?? 0,
      },
    });
  }

  /** 修改音频素材信息 */
  async modifyAudioInfos(
    audioInfos: string,
    segmentIndex: number[],
    modifications: Omit<ModifyAudioInfosRequest, 'audio_infos' | 'segment_index'>,
  ): Promise<AudioInfoResponse> {
    return httpClient.request<AudioInfoResponse>({
      url: this.getApiUrl('/audio/modify'),
      method: 'POST',
      data: {
        audio_infos: audioInfos,
        segment_index: segmentIndex,
        ...modifications,
      },
    });
  }

  // ==================== 文本片段接口 ====================

  /** 创建文本素材信息 */
  async createTextInfo(request: TextInfoRequest): Promise<TextInfoResponse> {
    return httpClient.request<TextInfoResponse>({
      url: this.getApiUrl('/text/info'),
      method: 'POST',
      data: request,
    });
  }

  /** 根据时间线数组和文本列表批量创建文本素材信息 */
  async createTextInfosByTimelines(
    timelines: TimelineItem[],
    texts: string[],
  ): Promise<TextInfoResponse> {
    return httpClient.request<TextInfoResponse>({
      url: this.getApiUrl('/text/by_timelines'),
      method: 'POST',
      data: { timelines, texts },
    });
  }

  /** 拼接两个文本信息数组 */
  async concatTextInfos(textInfos1: string, textInfos2: string): Promise<TextInfoResponse> {
    return httpClient.request<TextInfoResponse>({
      url: this.getApiUrl('/text/concat'),
      method: 'POST',
      data: { text_infos1: textInfos1, text_infos2: textInfos2 },
    });
  }

  /** 交换文本素材片段位置 */
  async swapTextSegment(
    textInfos: string,
    swapPosition: SwapPositionItem[],
    targetTimerangeStart?: number,
  ): Promise<TextInfoResponse> {
    return httpClient.request<TextInfoResponse>({
      url: this.getApiUrl('/text/swap'),
      method: 'POST',
      data: {
        text_infos: textInfos,
        swap_position: swapPosition,
        target_timerange_start: targetTimerangeStart ?? 0,
      },
    });
  }

  /** 修改文本素材信息 */
  async modifyTextInfos(
    textInfos: string,
    segmentIndex: number[],
    modifications: Omit<ModifyTextInfosRequest, 'text_infos' | 'segment_index'>,
  ): Promise<TextInfoResponse> {
    return httpClient.request<TextInfoResponse>({
      url: this.getApiUrl('/text/modify'),
      method: 'POST',
      data: {
        text_infos: textInfos,
        segment_index: segmentIndex,
        ...modifications,
      },
    });
  }

  // ==================== 剪映草稿生成接口 ====================

  /** 生成完整剪映草稿文件夹，可在剪映客户端中直接打开 */
  async generateJianyingDraft(
    request: GenerateJianyingDraftRequest,
  ): Promise<GenerateJianyingDraftResponse> {
    return httpClient.request<GenerateJianyingDraftResponse>({
      url: this.getApiUrl('/jianying/generate'),
      method: 'POST',
      data: request,
    });
  }

  // ==================== 辅助方法 ====================

  /** 安全地解析 JSON 字符串，解析失败返回 null */
  parseJson<T>(jsonStr: string): T | null {
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      return null;
    }
  }

  /** 将对象转换为 JSON 字符串 */
  toJson(obj: any): string {
    return JSON.stringify(obj);
  }

  /** 秒 -> 微秒 */
  secondsToMicroseconds(seconds: number): number {
    return Math.round(seconds * 1000000);
  }

  /** 微秒 -> 秒 */
  microsecondsToSeconds(microseconds: number): number {
    return microseconds / 1000000;
  }

  /** 毫秒 -> 微秒 */
  millisecondsToMicroseconds(milliseconds: number): number {
    return Math.round(milliseconds * 1000);
  }

  /** 微秒 -> 毫秒 */
  microsecondsToMilliseconds(microseconds: number): number {
    return microseconds / 1000;
  }
}

// 创建默认实例
const draftApiClient = new DraftApiClient();

export { DraftApiClient, draftApiClient };
