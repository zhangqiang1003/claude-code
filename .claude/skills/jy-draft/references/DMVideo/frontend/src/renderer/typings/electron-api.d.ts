/**
 * Electron API 类型定义
 * DMVideo 视频处理生成工具
 */

import type { OpenDialogReturnValue, SaveDialogReturnValue } from 'electron';

// 视频信息
interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
  size: number;
}

// 分割结果
interface SplitResult {
  success: boolean;
  segments: string[];
  error?: string;
}

// 版本信息
interface VersionsInfo {
  electron: string;
  node: string;
  chrome: string;
  v8: string;
  platform: string;
  arch: string;
}

interface ElectronApi {
  // ==================== 数据库 API ====================
  // 材料库-文案
  addMaterialText: (content: string, source?: string) => Promise<{ id: number }>;
  getMaterialTextList: (limit?: number, offset?: number) => Promise<any[]>;
  updateMaterialText: (id: number, content: string) => Promise<{ changes: number }>;
  deleteMaterialText: (ids: number[]) => Promise<{ changes: number }>;

  // 材料库-视频
  addMaterialVideo: (video: any) => Promise<{ id: number }>;
  addMaterialVideoWithCopy: (sourceFilePaths: string[]) => Promise<{
    success: boolean;
    results: { success: boolean; file_name?: string; error?: string }[];
    error?: string;
  }>;
  getMaterialVideoList: (limit?: number, offset?: number) => Promise<any[]>;
  getMaterialVideo: (id: number) => Promise<any>;
  deleteMaterialVideo: (ids: number[]) => Promise<{ changes: number }>;

  // 材料库-作品地址
  addMaterialUrl: (url: any) => Promise<{ id: number }>;
  getMaterialUrlList: (limit?: number, offset?: number) => Promise<any[]>;
  deleteMaterialUrl: (ids: number[]) => Promise<{ changes: number }>;

  // 素材库-文案
  addDraftText: (content: string, sourceId?: number) => Promise<{ id: number }>;
  getDraftTextList: (limit?: number, offset?: number) => Promise<any[]>;
  deleteDraftText: (ids: number[]) => Promise<{ changes: number }>;
  updateDraftText: (id: number, content: string) => Promise<{ changes: number }>;
  updateDraftTextStatus: (id: number, status: number) => Promise<{ changes: number }>;

  // 素材库-视频
  addDraftVideo: (video: any) => Promise<{ id: number }>;
  addDraftVideoWithCopy: (sourceFilePaths: string[]) => Promise<{
    success: boolean;
    results: { success: boolean; id?: number; file_name?: string; error?: string }[];
    filtered?: { file_name: string; duration: number }[];
    error?: string;
  }>;
  getDraftVideoList: (limit?: number, offset?: number) => Promise<any[]>;
  getDraftVideo: (id: number) => Promise<any>;
  updateDraftVideoAnalysis: (id: number, keywords: string) => Promise<{ changes: number }>;
  updateDraftVideoAnalysisStatus: (id: number, status: number) => Promise<{ changes: number }>;
  updateDraftVideoFileName: (id: number, fileName: string) => Promise<{ changes: number }>;
  incrementDraftVideoUseCount: (id: number) => Promise<{ changes: number }>;
  deleteDraftVideo: (ids: number[]) => Promise<{ changes: number }>;

  // 素材库-视频关键词关联
  addVideoKeywords: (videoId: number, keywords: string[]) => Promise<{ count: number }>;
  getVideoKeywords: (videoId: number) => Promise<string[]>;
  deleteVideoKeywords: (videoId: number) => Promise<{ changes: number }>;
  searchVideosByKeyword: (keyword: string) => Promise<number[]>;
  getAllKeywordsWithCount: () => Promise<{ keyword: string; count: number }[]>;

  // 作品库
  addWork: (work: any) => Promise<{ id: number }>;
  getWorkList: (limit?: number, offset?: number) => Promise<any[]>;
  updateWorkRemark: (id: number, remark: string) => Promise<{ changes: number }>;
  updateWorkStats: (id: number, stats: any) => Promise<{ changes: number }>;
  deleteWork: (ids: number[]) => Promise<{ changes: number }>;

  // 配置
  getConfig: (key: string) => Promise<{ value: string | null }>;
  setConfig: (key: string, value: string) => Promise<{ success: boolean }>;
  getAllConfigs: () => Promise<Record<string, string>>;
  setVideoRootPath: (path: string) => Promise<{
    success: boolean;
    data?: {
      videoRootPath: string;
      materialVideoPath: string;
      draftVideoPath: string;
    };
    error?: string;
  }>;

  // 音色克隆记录
  addVoiceClone: (voice: {
    voice_id: string;
    voice_tag: string;
    voice_model_id: string;
    audio_file_path?: string;
    clone_type?: string;
  }) => Promise<{ id: number }>;
  getVoiceCloneList: (limit?: number, offset?: number) => Promise<any[]>;
  getVoiceClone: (id: number) => Promise<any>;
  getActiveVoiceClones: () => Promise<any[]>;
  updateVoiceCloneStatus: (id: number, status: 'active' | 'expired') => Promise<{ changes: number }>;
  updateVoiceCloneUsedAt: (id: number) => Promise<{ changes: number }>;
  updateVoiceCloneTag: (id: number, voiceTag: string) => Promise<{ changes: number }>;
  deleteVoiceClone: (ids: number[]) => Promise<{ changes: number }>;
  getVoiceCloneCount: () => Promise<{ count: number }>;
  getFreeVoiceCloneCount: () => Promise<{ count: number }>;
  expireUnusedVoices: (freeDays?: number, paidDays?: number) => Promise<{ changes: number }>;

  // ==================== FFmpeg API ====================
  getVideoInfo: (filePath: string) => Promise<{ success: boolean; data?: VideoInfo; error?: string }>;
  extractAudio: (videoPath: string, outputPath?: string, format?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  muteVideo: (videoPath: string, outputPath?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  cutVideo: (videoPath: string, startTime: number, duration: number, outputPath?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  splitByDuration: (videoPath: string, segmentDuration: number, outputDir?: string) => Promise<{ success: boolean; data?: SplitResult; error?: string }>;
  splitByScene: (videoPath: string, threshold?: number, outputDir?: string) => Promise<{ success: boolean; data?: SplitResult; error?: string }>;
  generateThumbnail: (videoPath: string, timePoint?: number, outputPath?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  transcodeVideo: (videoPath: string, outputPath: string, codec?: string, crf?: number) => Promise<{ success: boolean; data?: string; error?: string }>;
  mergeVideos: (videoPaths: string[], outputPath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  extractFrames: (videoPath: string, options?: any) => Promise<{ success: boolean; data?: string[]; error?: string }>;
  extractKeyframes: (videoPath: string, options?: any) => Promise<{ success: boolean; data?: string[]; error?: string }>;

  // ==================== 视频分析 API ====================
  videoAnalysisAnalyze: (videoPath: string, options?: any) => Promise<{
    success: boolean;
    result?: string;
    keywords?: string[];
    videoUrl?: string;
    error?: string;
  }>;
  videoAnalysisExtractKeywords: (videoPath: string, options?: any) => Promise<{
    success: boolean;
    result?: string;
    keywords?: string[];
    videoUrl?: string;
    error?: string;
  }>;
  videoAnalysisSummarize: (videoPath: string, options?: any) => Promise<{
    success: boolean;
    result?: string;
    keywords?: string[];
    videoUrl?: string;
    error?: string;
  }>;
  videoAnalysisDescribe: (videoPath: string, options?: any) => Promise<{
    success: boolean;
    result?: string;
    keywords?: string[];
    videoUrl?: string;
    error?: string;
  }>;
  videoAnalysisCustomAnalyze: (videoPath: string, customPrompt: string, options?: any) => Promise<{
    success: boolean;
    result?: string;
    keywords?: string[];
    videoUrl?: string;
    error?: string;
  }>;
  videoAnalysisBatchExtractKeywords: (videoPaths: string[], options?: any) => Promise<{
    success: boolean;
    data?: Record<string, {
      success: boolean;
      result?: string;
      keywords?: string[];
      videoUrl?: string;
      error?: string;
    }>;
    error?: string;
  }>;
  videoAnalysisBatchExtractKeywordsConcurrent: (videoPaths: string[], videoIdMap: Record<string, number>, options?: any) => Promise<{
    success: boolean;
    data?: Record<string, {
      success: boolean;
      result?: string;
      keywords?: string[];
      videoUrl?: string;
      error?: string;
    }>;
    error?: string;
  }>;
  onVideoAnalysisBatchProgress: (callback: (progress: {
    completed: number;
    total: number;
    currentVideo?: string;
    successCount: number;
    failCount: number;
    currentResult?: {
      success: boolean;
      result?: string;
      keywords?: string[];
      videoUrl?: string;
      error?: string;
    };
    isDone: boolean;
  }) => void) => () => void;
  videoAnalysisGetDefaultConfig: () => Promise<{ config: any }>;
  videoAnalysisUpdateDefaultConfig: (config: any) => Promise<{ success: boolean }>;

  // 异步批量视频分析 API
  videoAnalysisBatchSubmit: (videos: Array<{ id: string; filePath: string }>, options?: any) => Promise<{
    success: boolean;
    batchId?: string;
    error?: string;
  }>;
  videoAnalysisBatchCheck: (batchId: string) => Promise<{
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
  }>;
  videoAnalysisBatchCancel: (batchId: string) => Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }>;

  // ==================== 对话框 API ====================
  openDirectory: () => Promise<OpenDialogReturnValue>;
  openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<OpenDialogReturnValue>;
  openVideo: (multiSelections?: boolean) => Promise<OpenDialogReturnValue>;
  saveFile: (defaultName?: string, filters?: { name: string; extensions: string[] }[]) => Promise<SaveDialogReturnValue>;
  showMessage: (type: 'none' | 'info' | 'error' | 'question' | 'warning', title: string, message: string, buttons?: string[]) => Promise<{ response: number; checkboxChecked: boolean }>;
  showItemInFolder: (filePath: string) => Promise<{ success: boolean }>;

  // ==================== 其他 API ====================
  openExternal: (url: string) => Promise<void>;
  readVideoFile: (filePath: string) => Promise<{ success: boolean; buffer?: ArrayBuffer; mimeType?: string; error?: string }>;
  log: (level: 'INFO' | 'WARN' | 'ERROR', ...args: any[]) => Promise<void>;
  getVersions: () => Promise<VersionsInfo>;

  // ==================== 百炼语音 API ====================
  bailianAudioInit: (config: any) => Promise<{ success: boolean; error?: string }>;
  bailianAudioIsInitialized: () => Promise<{ initialized: boolean }>;
  bailianAudioSetApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  bailianAudioCloneVoice: (audioFilePath: string, options: any) => Promise<{
    success: boolean;
    voiceId?: string;
    error?: string;
  }>;
  bailianAudioCloneVoiceByUrl: (audioUrl: string, options: any) => Promise<{
    success: boolean;
    voiceId?: string;
    error?: string;
  }>;
  bailianAudioSynthesizeSpeech: (text: string, voiceId: string, outputFilePath?: string, options?: any) => Promise<{
    success: boolean;
    outputPath?: string;
    audioData?: string; // base64
    audioUrl?: string;
    error?: string;
  }>;
  bailianAudioTextToSpeech: (text: string, outputFilePath: string, voiceId?: string, options?: any) => Promise<{
    success: boolean;
    outputPath?: string;
    audioUrl?: string;
    error?: string;
  }>;
  bailianAudioTextToSpeechBuffer: (text: string, voiceId?: string, options?: any) => Promise<{
    success: boolean;
    audioData?: string; // base64
    error?: string;
  }>;
  bailianAudioGetPresetVoices: () => Promise<{ voices: Record<string, string> }>;
  bailianAudioGetSupportedModels: () => Promise<{ models: { id: string; name: string }[] }>;

  // ==================== 飞书多维表格同步 API ====================
  feishuSyncVideos: (options?: { overwrite?: boolean }) => Promise<{
    success: boolean;
    successCount: number;
    skipCount: number;
    failCount: number;
    errors: string[];
    error?: string;
  }>;
  feishuSyncTexts: (options?: { overwrite?: boolean; textFieldName?: string }) => Promise<{
    success: boolean;
    successCount: number;
    skipCount: number;
    failCount: number;
    errors: string[];
    error?: string;
  }>;
  feishuGetVideoFields: () => Promise<{ success: boolean; fields?: any[]; error?: string }>;
  feishuGetTextFields: () => Promise<{ success: boolean; fields?: any[]; error?: string }>;
  feishuUpdateConfig: (config: {
    appId?: string;
    appSecret?: string;
    videoTable?: { appToken: string; tableId: string };
    textTable?: { appToken: string; tableId: string };
  }) => Promise<{ success: boolean; error?: string }>;
  feishuGetConfig: () => Promise<{
    success: boolean;
    config?: {
      appId: string;
      appSecret: string;
      videoTable: { appToken: string; tableId: string };
      textTable: { appToken: string; tableId: string };
    };
    error?: string;
  }>;
  onFeishuSyncProgress: (callback: (progress: {
    total: number;
    completed: number;
    current: string;
    status: 'reading' | 'downloading' | 'processing' | 'saving' | 'done';
    isDone: boolean;
    syncType?: 'video' | 'text';
  }) => void) => () => void;

  // ==================== 草稿审核 API ====================
  // 提交编辑结果
  draftReviewSubmit: (taskId: number, result: {
    action: 'confirm' | 'skip' | 'cancel';
    editedMaterials?: {
      videoTracks?: any[];
      audioTracks?: any[];
      textTracks?: any[];
      bgMusicConfig?: any[];
    };
  }) => Promise<{ success: boolean; error?: string }>;

  // 获取审核数据（断点续传用）
  draftReviewGetData: (taskId: number) => Promise<{
    success: boolean;
    data?: {
      videoTracks: any[] | null;
      audioTracks: any[] | null;
      textTracks: any[] | null;
      bgMusicConfig: any[] | null;
      reviewStatus: number;
    };
    error?: string;
  }>;

  // 监听审核请求
  onDraftReviewRequest: (callback: (data: {
    taskId: number;
    videoTracks: any[];
    audioTracks: any[];
    textTracks: any[];
    bgMusicConfig?: any[];
  }) => void) => () => void;

  // ==================== 微信扫码登录 API ====================
  wechatAuthGetQrcode: () => Promise<ApiResponse<WechatQrcodeLoginResp>>;
  wechatAuthCheckStatus: (state: string) => Promise<ApiResponse<WechatQrcodeLoginStatusResp>>;
  wechatAuthSetBaseUrl: (baseUrl: string) => Promise<{ success: boolean; error?: string }>;
  wechatAuthGetBaseUrl: () => Promise<{ baseUrl: string }>;

  // ==================== QQ 扫码登录 API ====================
  qqAuthGetQrcode: () => Promise<ApiResponse<QqQrcodeLoginResp>>;
  qqAuthCheckStatus: (state: string) => Promise<ApiResponse<QqQrcodeLoginStatusResp>>;
  qqAuthSetBaseUrl: (baseUrl: string) => Promise<{ success: boolean; error?: string }>;
  qqAuthGetBaseUrl: () => Promise<{ baseUrl: string }>;

  // ==================== HTTP 请求 API ====================
  httpGet: <T = any>(url: string, params?: any, headers?: Record<string, string>) => Promise<ApiResponse<T>>;
  httpPost: <T = any>(url: string, data?: any, headers?: Record<string, string>) => Promise<ApiResponse<T>>;
  httpPut: <T = any>(url: string, data?: any, headers?: Record<string, string>) => Promise<ApiResponse<T>>;
  httpDelete: <T = any>(url: string, data?: any, headers?: Record<string, string>) => Promise<ApiResponse<T>>;
  httpSetBaseUrl: (baseUrl: string) => Promise<{ success: boolean; error?: string }>;
  httpGetBaseUrl: () => Promise<{ baseUrl: string }>;
  httpUploadFile: <T = any>(
    url: string,
    fileData: { base64: string; fileName: string; mimeType: string },
    formData?: Record<string, any>,
    headers?: Record<string, string>
  ) => Promise<ApiResponse<T>>;

  // ==================== 智能分割 API ====================
  smartSplitCheckPoints: (requiredPoints: number) => Promise<{
    sufficient: boolean;
    remaining: number;
    error?: string;
  }>;
  smartSplitEstimatePoints: (videoDurationSeconds: number) => Promise<{
    success: boolean;
    estimatedPoints?: number;
    error?: string;
  }>;
  smartSplitPreDeductPoints: (points: number, videoId: number) => Promise<{
    success: boolean;
    remainingPoints?: number;
    error?: string;
  }>;
  smartSplitGetAnalysisResults: (videoId: number) => Promise<{
    success: boolean;
    results: Array<{
      id: number;
      material_video_id: number;
      segment_start_time: number;
      segment_end_time: number;
      segment_duration: number;
      segment_file_path: string | null;
      description: string;
      keywords?: string;
      is_migrated?: number;
      created_at: string;
      updated_at: string;
    }>;
    error?: string;
  }>;
  smartSplitDeleteAnalysisResults: (videoId: number) => Promise<{
    success: boolean;
    error?: string;
  }>;
  smartSplitMarkMigrated: (resultId: number) => Promise<{
    success: boolean;
    error?: string;
  }>;
  smartSplitAnalyze: (videoPath: string, options?: { videoId?: number; customPrompt?: string }) => Promise<{
    success: boolean;
    segments?: Array<{ startTime: number; endTime: number; description: string }>;
    videoUrl?: string;
    ossObjectName?: string;
    rawResult?: string;
    error?: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }>;
  smartSplitExecute: (videoPath: string, segments: Array<{ id?: number; startTime: number; endTime: number }>, options?: { videoId?: number }) => Promise<{
    success: boolean;
    outputFiles: string[];
    error?: string;
  }>;
  smartSplitClassify: (params: {
    sourceVideoId: number;
    outputFiles: string[];
    segments: Array<{ startTime: number; endTime: number; description: string }>;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;

  // 智能分割：异步 Batch 分析
  smartSplitAnalyzeAsync: (videoPath: string, options?: any) => Promise<{
    success: boolean;
    batchId?: string;
    ossObjectName?: string;
    error?: string;
  }>;
  smartSplitCheckBatchResult: (batchId: string, videoId?: number, preDeductedPoints?: number) => Promise<{
    status: string;
    requestCounts?: { total: number; completed: number; failed: number };
    segments?: Array<{ startTime: number; endTime: number; description: string; keywords?: string }>;
    rawResult?: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    settlement?: {
      actualPoints: number;
      preDeductedPoints: number;
      difference: number;
      settlementType: 'refund' | 'charge' | 'exact';
    };
    error?: string;
  }>;

  // ==================== 客户端信息 API ====================
  clientInfoGetQrcode: () => Promise<{
    success: boolean;
    qrcodeUrl?: string;
    error?: string;
  }>;
  clientInfoDownloadQrcodeBase64: (imageUrl: string) => Promise<void>;
  onQrcodeBase64Ready: (callback: (data: { imageUrl: string; base64: string }) => void) => () => void;
}

// 微信扫码登录响应类型
export interface WechatQrcodeLoginResp {
  state: string;        // 二维码状态标识
  qrcodeUrl: string;    // 二维码图片URL（微信授权链接）
  expireTime: number;   // 过期时间戳
}

export interface WechatQrcodeLoginStatusResp {
  status: number;       // 0-等待扫码 1-已扫码 2-已确认 3-已取消 4-已过期
  loginResult?: {       // 登录结果（仅status=2时存在）
    accessToken: string;
    refreshToken: string;
    expiresTime: number;
    userId: number;
    nickname: string;
    avatar: string;
  };
}

// QQ 扫码登录响应类型
export interface QqQrcodeLoginResp {
  state: string;        // 二维码状态标识
  qrcodeUrl: string;    // 二维码图片URL（QQ授权链接）
  expireTime: number;   // 过期时间戳
}

export interface QqQrcodeLoginStatusResp {
  status: number;       // 0-等待扫码 1-已扫码 2-已确认 3-已取消 4-已过期
  loginResult?: {       // 登录结果（仅status=2时存在）
    accessToken: string;
    refreshToken: string;
    expiresTime: number;
    userId: number;
    nickname: string;
    avatar: string;
  };
}

// 通用 API 响应类型
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}

export { };