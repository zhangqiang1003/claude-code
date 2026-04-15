/**
 * Preload 脚本
 * 暴露安全的 API 给渲染进程
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ==================== 数据库 API ====================
  // 材料库-文案
  addMaterialText: (content: string, source?: string) =>
    ipcRenderer.invoke('db:add-material-text', content, source),
  getMaterialTextList: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('db:get-material-text-list', limit, offset),
  updateMaterialText: (id: number, content: string) =>
    ipcRenderer.invoke('db:update-material-text', id, content),
  deleteMaterialText: (ids: number[]) =>
    ipcRenderer.invoke('db:delete-material-text', ids),

  // 材料库-视频
  addMaterialVideo: (video: any) =>
    ipcRenderer.invoke('db:add-material-video', video),
  addMaterialVideoWithCopy: (sourceFilePaths: string[]) =>
    ipcRenderer.invoke('db:add-material-video-with-copy', sourceFilePaths),
  getMaterialVideoList: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('db:get-material-video-list', limit, offset),
  getMaterialVideoCount: () =>
    ipcRenderer.invoke('db:get-material-video-count'),
  getMaterialVideo: (id: number) =>
    ipcRenderer.invoke('db:get-material-video', id),
  deleteMaterialVideo: (ids: number[]) =>
    ipcRenderer.invoke('db:delete-material-video', ids),

  // 材料库-作品地址
  addMaterialUrl: (url: any) =>
    ipcRenderer.invoke('db:add-material-url', url),
  getMaterialUrlList: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('db:get-material-url-list', limit, offset),
  deleteMaterialUrl: (ids: number[]) =>
    ipcRenderer.invoke('db:delete-material-url', ids),

  // 素材库-文案
  addDraftText: (content: string, sourceId?: number) =>
    ipcRenderer.invoke('db:add-draft-text', content, sourceId),
  getDraftTextList: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('db:get-draft-text-list', limit, offset),
  getDraftTextCount: () =>
    ipcRenderer.invoke('db:get-draft-text-count'),
  deleteDraftText: (ids: number[]) =>
    ipcRenderer.invoke('db:delete-draft-text', ids),
  updateDraftText: (id: number, content: string) =>
    ipcRenderer.invoke('db:update-draft-text', id, content),
  updateDraftTextStatus: (id: number, status: number) =>
    ipcRenderer.invoke('db:update-draft-text-status', id, status),

  // 素材库-视频
  addDraftVideo: (video: any) =>
    ipcRenderer.invoke('db:add-draft-video', video),
  addDraftVideoWithCopy: (sourceFilePaths: string[]) =>
    ipcRenderer.invoke('db:add-draft-video-with-copy', sourceFilePaths),
  getDraftVideoList: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('db:get-draft-video-list', limit, offset),
  getDraftVideoCount: () =>
    ipcRenderer.invoke('db:get-draft-video-count'),
  getDraftVideo: (id: number) =>
    ipcRenderer.invoke('db:get-draft-video', id),
  updateDraftVideoAnalysis: (id: number, keywords: string) =>
    ipcRenderer.invoke('db:update-draft-video-analysis', id, keywords),
  updateDraftVideoAnalysisStatus: (id: number, status: number) =>
    ipcRenderer.invoke('db:update-draft-video-analysis-status', id, status),
  updateDraftVideoLocation: (id: number, provinceIds: string | null, cityIds: string | null, placeNames: string | null) =>
    ipcRenderer.invoke('db:update-draft-video-location', id, provinceIds, cityIds, placeNames),
  updateDraftVideoFileName: (id: number, fileName: string) =>
    ipcRenderer.invoke('db:update-draft-video-file-name', id, fileName),
  incrementDraftVideoUseCount: (id: number) =>
    ipcRenderer.invoke('db:increment-draft-video-use-count', id),
  deleteDraftVideo: (ids: number[]) =>
    ipcRenderer.invoke('db:delete-draft-video', ids),

  // 素材库-视频关键词关联
  addVideoKeywords: (videoId: number, keywords: string[]) =>
    ipcRenderer.invoke('db:add-video-keywords', videoId, keywords),
  getVideoKeywords: (videoId: number) =>
    ipcRenderer.invoke('db:get-video-keywords', videoId),
  deleteVideoKeywords: (videoId: number) =>
    ipcRenderer.invoke('db:delete-video-keywords', videoId),
  searchVideosByKeyword: (keyword: string) =>
    ipcRenderer.invoke('db:search-videos-by-keyword', keyword),
  getAllKeywordsWithCount: () =>
    ipcRenderer.invoke('db:get-all-keywords-with-count'),

  // 作品库
  addWork: (work: any) =>
    ipcRenderer.invoke('db:add-work', work),
  getWorkList: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('db:get-work-list', limit, offset),
  updateWorkRemark: (id: number, remark: string) =>
    ipcRenderer.invoke('db:update-work-remark', id, remark),
  updateWorkStats: (id: number, stats: any) =>
    ipcRenderer.invoke('db:update-work-stats', id, stats),
  deleteWork: (ids: number[]) =>
    ipcRenderer.invoke('db:delete-work', ids),

  // 配置
  getConfig: (key: string) =>
    ipcRenderer.invoke('db:get-config', key),
  setConfig: (key: string, value: string) =>
    ipcRenderer.invoke('db:set-config', key, value),
  getAllConfigs: () =>
    ipcRenderer.invoke('db:get-all-configs'),
  setVideoRootPath: (path: string) =>
    ipcRenderer.invoke('db:set-video-root-path', path),

  // ==================== 音色克隆记录 ====================
  addVoiceClone: (voice: any) =>
    ipcRenderer.invoke('db:add-voice-clone', voice),
  getVoiceCloneList: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('db:get-voice-clone-list', limit, offset),
  getVoiceClone: (id: number) =>
    ipcRenderer.invoke('db:get-voice-clone', id),
  getActiveVoiceClones: () =>
    ipcRenderer.invoke('db:get-active-voice-clones'),
  updateVoiceCloneStatus: (id: number, status: string) =>
    ipcRenderer.invoke('db:update-voice-clone-status', id, status),
  updateVoiceCloneUsedAt: (id: number) =>
    ipcRenderer.invoke('db:update-voice-clone-used-at', id),
  updateVoiceCloneTag: (id: number, voiceTag: string) =>
    ipcRenderer.invoke('db:update-voice-clone-tag', id, voiceTag),
  deleteVoiceClone: (ids: number[]) =>
    ipcRenderer.invoke('db:delete-voice-clone', ids),
  getVoiceCloneCount: () =>
    ipcRenderer.invoke('db:get-voice-clone-count'),
  getFreeVoiceCloneCount: () =>
    ipcRenderer.invoke('db:get-free-voice-clone-count'),
  expireUnusedVoices: (freeDays?: number, paidDays?: number) =>
    ipcRenderer.invoke('db:expire-unused-voices', freeDays, paidDays),

  // ==================== 初始化配置 ====================
  getInitConfigStatus: (initParam: string) =>
    ipcRenderer.invoke('db:get-init-config-status', initParam),
  updateInitConfigStatus: (initParam: string, status: number) =>
    ipcRenderer.invoke('db:update-init-config-status', initParam, status),
  isInitConfigCompleted: (initParam: string) =>
    ipcRenderer.invoke('db:is-init-config-completed', initParam),

  // ==================== FFmpeg API ====================
  getVideoInfo: (filePath: string) =>
    ipcRenderer.invoke('ffmpeg:get-video-info', filePath),
  getAudioInfo: (filePath: string) =>
    ipcRenderer.invoke('ffmpeg:get-audio-info', filePath),
  extractAudio: (videoPath: string, outputPath?: string, format?: string) =>
    ipcRenderer.invoke('ffmpeg:extract-audio', videoPath, outputPath, format),
  muteVideo: (videoPath: string, outputPath?: string) =>
    ipcRenderer.invoke('ffmpeg:mute-video', videoPath, outputPath),
  cutVideo: (videoPath: string, startTime: number, duration: number, outputPath?: string) =>
    ipcRenderer.invoke('ffmpeg:cut-video', videoPath, startTime, duration, outputPath),
  splitByDuration: (videoPath: string, segmentDuration: number, outputDir?: string) =>
    ipcRenderer.invoke('ffmpeg:split-by-duration', videoPath, segmentDuration, outputDir),
  splitByScene: (videoPath: string, threshold?: number, outputDir?: string) =>
    ipcRenderer.invoke('ffmpeg:split-by-scene', videoPath, threshold, outputDir),
  generateThumbnail: (videoPath: string, timePoint?: number, outputPath?: string) =>
    ipcRenderer.invoke('ffmpeg:generate-thumbnail', videoPath, timePoint, outputPath),
  transcodeVideo: (videoPath: string, outputPath: string, codec?: string, crf?: number) =>
    ipcRenderer.invoke('ffmpeg:transcode', videoPath, outputPath, codec, crf),
  mergeVideos: (videoPaths: string[], outputPath: string) =>
    ipcRenderer.invoke('ffmpeg:merge-videos', videoPaths, outputPath),
  extractFrames: (videoPath: string, options?: any) =>
    ipcRenderer.invoke('ffmpeg:extract-frames', videoPath, options),
  extractKeyframes: (videoPath: string, options?: any) =>
    ipcRenderer.invoke('ffmpeg:extract-keyframes', videoPath, options),

  // ==================== 对话框 API ====================
  openDirectory: () =>
    ipcRenderer.invoke('dialog:open-directory'),
  openFile: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:open-file', filters),
  openVideo: (multiSelections?: boolean) =>
    ipcRenderer.invoke('dialog:open-video', multiSelections),
  saveFile: (defaultName?: string, filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:save-file', defaultName, filters),
  showMessage: (type: 'none' | 'info' | 'error' | 'question' | 'warning', title: string, message: string, buttons?: string[]) =>
    ipcRenderer.invoke('dialog:message', type, title, message, buttons),
  showItemInFolder: (filePath: string) =>
    ipcRenderer.invoke('dialog:show-item-in-folder', filePath),

  // ==================== 其他 API ====================
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),

  // 读取本地视频文件为 Buffer
  readVideoFile: (filePath: string) =>
    ipcRenderer.invoke('read-video-file', filePath),

  log: (level: 'INFO' | 'WARN' | 'ERROR', ...args: any[]) =>
    ipcRenderer.invoke('renderer-log', level, ...args),

  // 获取系统版本信息
  getVersions: () =>
    ipcRenderer.invoke('get-versions'),

  // ==================== Token API ====================
  getTokenBaseUrl: () =>
    ipcRenderer.invoke('token:get-base-url'),
  setTokenBaseUrl: (url: string) =>
    ipcRenderer.invoke('token:set-base-url', url),
  getTokenInfo: (apiToken: string, taskId?: string) =>
    ipcRenderer.invoke('token:get-token-info', apiToken, taskId),
  generateToken: (expireTime: string, totalPoints: number) =>
    ipcRenderer.invoke('token:generate-token', expireTime, totalPoints),
  unusedToken: (apiToken: string) =>
    ipcRenderer.invoke('token:unused-token', apiToken),
  recordTokenLog: (apiToken: string, usedPoints: number, taskType?: number, taskId?: string, taskStatus?: number) =>
    ipcRenderer.invoke('token:record-log', apiToken, usedPoints, taskType, taskId, taskStatus),
  checkTokenValid: (apiToken: string) =>
    ipcRenderer.invoke('token:check-valid', apiToken),
  getRemainingPoints: (apiToken: string) =>
    ipcRenderer.invoke('token:get-remaining-points', apiToken),
  hasEnoughPoints: (apiToken: string, requiredPoints: number) =>
    ipcRenderer.invoke('token:has-enough-points', apiToken, requiredPoints),
  deductPoints: (apiToken: string, usedPoints: number) =>
    ipcRenderer.invoke('token:deduct-points', apiToken, usedPoints),
  getTokenDisplayInfo: (apiToken: string) =>
    ipcRenderer.invoke('token:get-display-info', apiToken),

  // ==================== OSS API ====================
  ossInit: (config: any) =>
    ipcRenderer.invoke('oss:init', config),
  ossInitFromDb: () =>
    ipcRenderer.invoke('oss:init-from-db'),
  ossUploadFile: (filePath: string, objectName?: string) =>
    ipcRenderer.invoke('oss:upload-file', filePath, objectName),
  ossUploadFiles: (filePaths: string[]) =>
    ipcRenderer.invoke('oss:upload-files', filePaths),
  ossDeleteFile: (objectName: string) =>
    ipcRenderer.invoke('oss:delete-file', objectName),
  ossExists: (objectName: string) =>
    ipcRenderer.invoke('oss:exists', objectName),
  ossIsInitialized: () =>
    ipcRenderer.invoke('oss:is-initialized'),
  ossGetInternalUrl: (objectName: string) =>
    ipcRenderer.invoke('oss:get-internal-url', objectName),
  ossGetPublicUrl: (objectName: string) =>
    ipcRenderer.invoke('oss:get-public-url', objectName),

  // ==================== TokenConfig API ====================
  tokenConfigGetInfo: (forceRefresh?: boolean) =>
    ipcRenderer.invoke('token-config:get-info', forceRefresh),
  tokenConfigGetOSSCredentials: (forceRefresh?: boolean) =>
    ipcRenderer.invoke('token-config:get-oss-credentials', forceRefresh),
  tokenConfigGetBailianApiKey: (forceRefresh?: boolean) =>
    ipcRenderer.invoke('token-config:get-bailian-api-key', forceRefresh),
  tokenConfigSetBaseUrl: (url: string) =>
    ipcRenderer.invoke('token-config:set-base-url', url),
  tokenConfigGetBaseUrl: () =>
    ipcRenderer.invoke('token-config:get-base-url'),
  tokenConfigClearCache: () =>
    ipcRenderer.invoke('token-config:clear-cache'),
  tokenConfigIsCacheValid: () =>
    ipcRenderer.invoke('token-config:is-cache-valid'),
  tokenConfigInitOSSWithSTS: (forceRefresh?: boolean) =>
    ipcRenderer.invoke('token-config:init-oss-with-sts', forceRefresh),

  // ==================== 百炼大模型 API ====================
  bailianInit: (config: any) =>
    ipcRenderer.invoke('bailian:init', config),
  bailianIsInitialized: () =>
    ipcRenderer.invoke('bailian:is-initialized'),
  bailianSetApiKey: (apiKey: string) =>
    ipcRenderer.invoke('bailian:set-api-key', apiKey),
  bailianChat: (prompt: string, systemPrompt?: string, options?: any) =>
    ipcRenderer.invoke('bailian:chat', prompt, systemPrompt, options),
  bailianChatCompletion: (messages: any[], options?: any) =>
    ipcRenderer.invoke('bailian:chat-completion', messages, options),
  bailianAnalyzeImage: (imageUrl: string, question: string, options?: any) =>
    ipcRenderer.invoke('bailian:analyze-image', imageUrl, question, options),
  bailianAnalyzeImages: (imageUrls: string[], question: string, options?: any) =>
    ipcRenderer.invoke('bailian:analyze-images', imageUrls, question, options),
  bailianAnalyzeVideoFrames: (frameUrls: string[], options?: any) =>
    ipcRenderer.invoke('bailian:analyze-video-frames', frameUrls, options),
  bailianSummarizeVideo: (frameUrls: string[], options?: any) =>
    ipcRenderer.invoke('bailian:summarize-video', frameUrls, options),
  bailianExtractVideoKeywords: (frameUrls: string[], options?: any) =>
    ipcRenderer.invoke('bailian:extract-video-keywords', frameUrls, options),
  bailianDescribeVideo: (frameUrls: string[], options?: any) =>
    ipcRenderer.invoke('bailian:describe-video', frameUrls, options),
  bailianCustomVideoAnalysis: (frameUrls: string[], customPrompt: string, options?: any) =>
    ipcRenderer.invoke('bailian:custom-video-analysis', frameUrls, customPrompt, options),
  bailianMatchKeywords: (text: string, availableKeywords?: string[], options?: any) =>
    ipcRenderer.invoke('bailian:match-keywords', text, availableKeywords, options),

  // ==================== 百炼语音 API ====================
  bailianAudioInit: (config: any) =>
    ipcRenderer.invoke('bailian-audio:init', config),
  bailianAudioIsInitialized: () =>
    ipcRenderer.invoke('bailian-audio:is-initialized'),
  bailianAudioSetApiKey: (apiKey: string) =>
    ipcRenderer.invoke('bailian-audio:set-api-key', apiKey),
  bailianAudioCloneVoice: (audioFilePath: string, options: any) =>
    ipcRenderer.invoke('bailian-audio:clone-voice', audioFilePath, options),
  bailianAudioSynthesizeSpeech: (text: string, voiceId: string, outputFilePath?: string, options?: any) =>
    ipcRenderer.invoke('bailian-audio:synthesize-speech', text, voiceId, outputFilePath, options),
  bailianAudioTextToSpeech: (text: string, outputFilePath: string, voiceId?: string, options?: any) =>
    ipcRenderer.invoke('bailian-audio:text-to-speech', text, outputFilePath, voiceId, options),
  bailianAudioTextToSpeechBuffer: (text: string, voiceId?: string, options?: any) =>
    ipcRenderer.invoke('bailian-audio:text-to-speech-buffer', text, voiceId, options),
  bailianAudioGetPresetVoices: () =>
    ipcRenderer.invoke('bailian-audio:get-preset-voices'),
  bailianAudioGetSupportedModels: () =>
    ipcRenderer.invoke('bailian-audio:get-supported-models'),
  bailianAudioCloneVoiceByUrl: (audioUrl: string, options: any) =>
    ipcRenderer.invoke('bailian-audio:clone-voice-by-url', audioUrl, options),

  // ==================== 视频素材匹配 API ====================
  videoMatchSetBaseUrl: (url: string) =>
    ipcRenderer.invoke('video-match:set-base-url', url),
  videoMatchGetBaseUrl: () =>
    ipcRenderer.invoke('video-match:get-base-url'),
  videoMatchGenerateContentHash: (dateStr?: string) =>
    ipcRenderer.invoke('video-match:generate-content-hash', dateStr),
  videoMatchMatchVideos: (request: any, options: any) =>
    ipcRenderer.invoke('video-match:match-videos', request, options),
  videoMatchBuildShortSentence: (text: string, sentenceId: number, duration: number, recordIds: string[], recordInfos: any[], keywords: string) =>
    ipcRenderer.invoke('video-match:build-short-sentence', text, sentenceId, duration, recordIds, recordInfos, keywords),
  videoMatchBuildShortSentences: (sentences: any[]) =>
    ipcRenderer.invoke('video-match:build-short-sentences', sentences),

  // ==================== 视频分析 API ====================
  videoAnalysisAnalyze: (videoPath: string, options?: any) =>
    ipcRenderer.invoke('video-analysis:analyze', videoPath, options),
  videoAnalysisExtractKeywords: (videoPath: string, options?: any) =>
    ipcRenderer.invoke('video-analysis:extract-keywords', videoPath, options),
  videoAnalysisSummarize: (videoPath: string, options?: any) =>
    ipcRenderer.invoke('video-analysis:summarize', videoPath, options),
  videoAnalysisDescribe: (videoPath: string, options?: any) =>
    ipcRenderer.invoke('video-analysis:describe', videoPath, options),
  videoAnalysisCustomAnalyze: (videoPath: string, customPrompt: string, options?: any) =>
    ipcRenderer.invoke('video-analysis:custom-analyze', videoPath, customPrompt, options),
  videoAnalysisBatchExtractKeywords: (videoPaths: string[], options?: any) =>
    ipcRenderer.invoke('video-analysis:batch-extract-keywords', videoPaths, options),
  videoAnalysisBatchExtractKeywordsConcurrent: (videoPaths: string[], videoIdMap: Record<string, number>, options?: any) =>
    ipcRenderer.invoke('video-analysis:batch-extract-keywords-concurrent', videoPaths, videoIdMap, options),
  onVideoAnalysisBatchProgress: (callback: (progress: any) => void) => {
    const listener = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('video-analysis:batch-progress', listener);
    // 返回取消订阅函数
    return () => ipcRenderer.removeListener('video-analysis:batch-progress', listener);
  },
  videoAnalysisGetDefaultConfig: () =>
    ipcRenderer.invoke('video-analysis:get-default-config'),
  videoAnalysisUpdateDefaultConfig: (config: any) =>
    ipcRenderer.invoke('video-analysis:update-default-config', config),

  // ==================== 异步批量视频分析 API ====================
  videoAnalysisBatchSubmit: (videos: Array<{ id: string; filePath: string }>, options?: any) =>
    ipcRenderer.invoke('video-analysis:batch-submit', videos, options),
  videoAnalysisBatchCheck: (batchId: string) =>
    ipcRenderer.invoke('video-analysis:batch-check', batchId),
  videoAnalysisBatchCancel: (batchId: string) =>
    ipcRenderer.invoke('video-analysis:batch-cancel', batchId),

  // ==================== 剪映草稿 API ====================
  // 基础配置
  draftApiSetBaseUrl: (url: string) =>
    ipcRenderer.invoke('draft-api:set-base-url', url),
  draftApiGetBaseUrl: () =>
    ipcRenderer.invoke('draft-api:get-base-url'),

  // 草稿管理
  draftApiCreateDraft: (width: number, height: number) =>
    ipcRenderer.invoke('draft-api:create-draft', width, height),
  draftApiDeleteDraft: (draftId: string) =>
    ipcRenderer.invoke('draft-api:delete-draft', draftId),
  draftApiGetDraftTemplate: (draftId: string) =>
    ipcRenderer.invoke('draft-api:get-draft-template', draftId),

  // 添加素材
  draftApiAddVideos: (draftId: string, videoInfos: string) =>
    ipcRenderer.invoke('draft-api:add-videos', draftId, videoInfos),
  draftApiAddAudios: (draftId: string, audioInfos: string) =>
    ipcRenderer.invoke('draft-api:add-audios', draftId, audioInfos),
  draftApiAddTexts: (draftId: string, textInfos: string) =>
    ipcRenderer.invoke('draft-api:add-texts', draftId, textInfos),

  // 时间线
  draftApiGenerateTimelines: (timelineSegment: number[]) =>
    ipcRenderer.invoke('draft-api:generate-timelines', timelineSegment),
  draftApiGenerateTimelinesByAudio: (audioUrls: string[]) =>
    ipcRenderer.invoke('draft-api:generate-timelines-by-audio', audioUrls),

  // 视频处理
  draftApiCreateVideoInfo: (request: any) =>
    ipcRenderer.invoke('draft-api:create-video-info', request),
  draftApiCreateVideoInfosByTimelines: (timelines: any[], videoUrls: string[]) =>
    ipcRenderer.invoke('draft-api:create-video-infos-by-timelines', timelines, videoUrls),
  draftApiConcatVideoInfos: (videoInfos1: string, videoInfos2: string) =>
    ipcRenderer.invoke('draft-api:concat-video-infos', videoInfos1, videoInfos2),
  draftApiSwapVideoSegment: (videoInfos: string, swapPosition: any[], targetTimerangeStart?: number) =>
    ipcRenderer.invoke('draft-api:swap-video-segment', videoInfos, swapPosition, targetTimerangeStart),
  draftApiModifyVideoInfos: (videoInfos: string, segmentIndex: number[], modifications: any) =>
    ipcRenderer.invoke('draft-api:modify-video-infos', videoInfos, segmentIndex, modifications),

  // 音频处理
  draftApiCreateAudioInfo: (request: any) =>
    ipcRenderer.invoke('draft-api:create-audio-info', request),
  draftApiCreateAudioInfosByTimelines: (timelines: any[], audioUrls: string[]) =>
    ipcRenderer.invoke('draft-api:create-audio-infos-by-timelines', timelines, audioUrls),
  draftApiConcatAudioInfos: (audioInfos1: string, audioInfos2: string) =>
    ipcRenderer.invoke('draft-api:concat-audio-infos', audioInfos1, audioInfos2),
  draftApiSwapAudioSegment: (audioInfos: string, swapPosition: any[], targetTimerangeStart?: number) =>
    ipcRenderer.invoke('draft-api:swap-audio-segment', audioInfos, swapPosition, targetTimerangeStart),
  draftApiModifyAudioInfos: (audioInfos: string, segmentIndex: number[], modifications: any) =>
    ipcRenderer.invoke('draft-api:modify-audio-infos', audioInfos, segmentIndex, modifications),

  // 文本处理
  draftApiCreateTextInfo: (request: any) =>
    ipcRenderer.invoke('draft-api:create-text-info', request),
  draftApiCreateTextInfosByTimelines: (timelines: any[], texts: string[]) =>
    ipcRenderer.invoke('draft-api:create-text-infos-by-timelines', timelines, texts),
  draftApiConcatTextInfos: (textInfos1: string, textInfos2: string) =>
    ipcRenderer.invoke('draft-api:concat-text-infos', textInfos1, textInfos2),
  draftApiSwapTextSegment: (textInfos: string, swapPosition: any[], targetTimerangeStart?: number) =>
    ipcRenderer.invoke('draft-api:swap-text-segment', textInfos, swapPosition, targetTimerangeStart),
  draftApiModifyTextInfos: (textInfos: string, segmentIndex: number[], modifications: any) =>
    ipcRenderer.invoke('draft-api:modify-text-infos', textInfos, segmentIndex, modifications),

  // 辅助方法
  draftApiParseJson: (jsonStr: string) =>
    ipcRenderer.invoke('draft-api:parse-json', jsonStr),
  draftApiToJson: (obj: any) =>
    ipcRenderer.invoke('draft-api:to-json', obj),
  draftApiSecondsToMicroseconds: (seconds: number) =>
    ipcRenderer.invoke('draft-api:seconds-to-microseconds', seconds),
  draftApiMicrosecondsToSeconds: (microseconds: number) =>
    ipcRenderer.invoke('draft-api:microseconds-to-seconds', microseconds),
  draftApiMillisecondsToMicroseconds: (milliseconds: number) =>
    ipcRenderer.invoke('draft-api:milliseconds-to-microseconds', milliseconds),
  draftApiMicrosecondsToMilliseconds: (microseconds: number) =>
    ipcRenderer.invoke('draft-api:microseconds-to-milliseconds', microseconds),

  // ==================== 文生视频 API ====================
  // 创建文生视频任务
  textToVideoCreateTask: (params: {
    draft_text_id: number;
    voice_id: string;
    voice_model_id: string;
    is_muted?: boolean;
    bg_music_config?: string;
    province_at?: string;
    city_at?: string;
    place_at?: string;
    draft_name?: string;
  }) => ipcRenderer.invoke('text-to-video:create-task', params),

  // 获取任务详情
  textToVideoGetTask: (taskId: number) =>
    ipcRenderer.invoke('text-to-video:get-task', taskId),

  // 获取任务列表
  textToVideoGetTaskList: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('text-to-video:get-task-list', limit, offset),

  // 获取可恢复的任务
  textToVideoGetResumableTask: (draftTextId: number) =>
    ipcRenderer.invoke('text-to-video:get-resumable-task', draftTextId),

  // 启动任务执行
  textToVideoStart: (taskId: number) =>
    ipcRenderer.invoke('text-to-video:start', taskId),

  // 取消任务
  textToVideoCancel: (taskId: number) =>
    ipcRenderer.invoke('text-to-video:cancel', taskId),

  // 删除任务
  textToVideoDelete: (ids: number[]) =>
    ipcRenderer.invoke('text-to-video:delete', ids),

  // 监听进度更新
  onTextToVideoProgress: (callback: (progress: any) => void) => {
    const listener = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('text-to-video-progress', listener);
    // 返回取消订阅函数
    return () => ipcRenderer.removeListener('text-to-video-progress', listener);
  },

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
  }) => ipcRenderer.invoke('draft-review:submit', taskId, result),

  // 获取审核数据（断点续传用）
  draftReviewGetData: (taskId: number) =>
    ipcRenderer.invoke('draft-review:get-data', taskId),

  // 监听审核请求
  onDraftReviewRequest: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('draft-review:request', listener);
    // 返回取消订阅函数
    return () => ipcRenderer.removeListener('draft-review:request', listener);
  },

  // 语音识别（ASR）
  bailianAudioRecognizeSpeech: (audioFilePath: string, options?: any) =>
    ipcRenderer.invoke('bailian-audio:recognize-speech', audioFilePath, options),

  // 获取省市区数据
  getPlaceData: () =>
    ipcRenderer.invoke('place:get-data'),

  // 获取素材库视频中已使用的地点信息
  getDraftVideoUsedLocations: () =>
    ipcRenderer.invoke('place:get-used-locations'),

  // ==================== 飞书多维表格同步 API ====================
  // 同步视频素材
  feishuSyncVideos: (options?: { overwrite?: boolean }) =>
    ipcRenderer.invoke('feishu:sync-videos', options),

  // 同步文案
  feishuSyncTexts: (options?: { overwrite?: boolean; textFieldName?: string }) =>
    ipcRenderer.invoke('feishu:sync-texts', options),

  // 获取视频表格字段
  feishuGetVideoFields: () =>
    ipcRenderer.invoke('feishu:get-video-fields'),

  // 获取文案表格字段
  feishuGetTextFields: () =>
    ipcRenderer.invoke('feishu:get-text-fields'),

  // 更新飞书配置
  feishuUpdateConfig: (config: {
    appId?: string;
    appSecret?: string;
    videoTable?: { appToken: string; tableId: string };
    textTable?: { appToken: string; tableId: string };
  }) => ipcRenderer.invoke('feishu:update-config', config),

  // 获取飞书配置
  feishuGetConfig: () =>
    ipcRenderer.invoke('feishu:get-config'),

  // 监听同步进度
  onFeishuSyncProgress: (callback: (progress: any) => void) => {
    const listener = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('feishu:sync-progress', listener);
    // 返回取消订阅函数
    return () => ipcRenderer.removeListener('feishu:sync-progress', listener);
  },

  // ==================== 微信扫码登录 API ====================
  // 获取微信扫码登录二维码
  wechatAuthGetQrcode: () =>
    ipcRenderer.invoke('wechat-auth:get-qrcode'),

  // 查询微信扫码登录状态
  wechatAuthCheckStatus: (state: string) =>
    ipcRenderer.invoke('wechat-auth:check-status', state),

  // 设置微信 API 基础 URL
  wechatAuthSetBaseUrl: (baseUrl: string) =>
    ipcRenderer.invoke('wechat-auth:set-base-url', baseUrl),

  // 获取微信 API 基础 URL
  wechatAuthGetBaseUrl: () =>
    ipcRenderer.invoke('wechat-auth:get-base-url'),

  // ==================== QQ 扫码登录 API ====================
  // 获取QQ扫码登录二维码
  qqAuthGetQrcode: () =>
    ipcRenderer.invoke('qq-auth:get-qrcode'),

  // 查询QQ扫码登录状态
  qqAuthCheckStatus: (state: string) =>
    ipcRenderer.invoke('qq-auth:check-status', state),

  // 设置QQ API 基础 URL
  qqAuthSetBaseUrl: (baseUrl: string) =>
    ipcRenderer.invoke('qq-auth:set-base-url', baseUrl),

  // 获取QQ API 基础 URL
  qqAuthGetBaseUrl: () =>
    ipcRenderer.invoke('qq-auth:get-base-url'),

  // ==================== HTTP 请求 API ====================
  // 通用 HTTP 请求（支持外部 API）
  httpGet: <T = any>(url: string, params?: any, headers?: Record<string, string>) =>
    ipcRenderer.invoke('http:get', url, params, headers),
  httpPost: <T = any>(url: string, data?: any, headers?: Record<string, string>) =>
    ipcRenderer.invoke('http:post', url, data, headers),
  httpPut: <T = any>(url: string, data?: any, headers?: Record<string, string>) =>
    ipcRenderer.invoke('http:put', url, data, headers),
  httpDelete: <T = any>(url: string, data?: any, headers?: Record<string, string>) =>
    ipcRenderer.invoke('http:delete', url, data, headers),
  httpSetBaseUrl: (baseUrl: string) =>
    ipcRenderer.invoke('http:set-base-url', baseUrl),
  httpGetBaseUrl: () =>
    ipcRenderer.invoke('http:get-base-url'),
  httpUploadFile: <T = any>(url: string, fileData: { base64: string; fileName: string; mimeType: string }, formData?: Record<string, any>, headers?: Record<string, string>) =>
    ipcRenderer.invoke('http:upload-file', url, fileData, formData, headers),

  // ==================== 智能分割 API ====================
  smartSplitCheckPoints: (requiredPoints: number) =>
    ipcRenderer.invoke('smart-split:check-points', requiredPoints),
  smartSplitEstimatePoints: (videoDurationSeconds: number) =>
    ipcRenderer.invoke('smart-split:estimate-points', videoDurationSeconds),
  smartSplitPreDeductPoints: (points: number, videoId: number) =>
    ipcRenderer.invoke('smart-split:pre-deduct-points', points, videoId),
  smartSplitGetAnalysisResults: (videoId: number) =>
    ipcRenderer.invoke('smart-split:get-analysis-results', videoId),
  smartSplitDeleteAnalysisResults: (videoId: number) =>
    ipcRenderer.invoke('smart-split:delete-analysis-results', videoId),
  smartSplitMarkMigrated: (resultId: number) =>
    ipcRenderer.invoke('smart-split:mark-migrated', resultId),
  smartSplitAnalyze: (videoPath: string, options?: any) =>
    ipcRenderer.invoke('smart-split:analyze', videoPath, options),
  smartSplitExecute: (videoPath: string, segments: Array<{ id?: number; startTime: number; endTime: number }>, options?: { videoId?: number }) =>
    ipcRenderer.invoke('smart-split:execute', videoPath, segments, options),
  smartSplitClassify: (params: any) =>
    ipcRenderer.invoke('smart-split:classify', params),

  // 智能分割：异步 Batch 分析
  smartSplitAnalyzeAsync: (videoPath: string, options?: any) =>
    ipcRenderer.invoke('smart-split:analyze-async', videoPath, options),
  smartSplitCheckBatchResult: (batchId: string, videoId?: number, preDeductedPoints?: number) =>
    ipcRenderer.invoke('smart-split:check-batch-result', batchId, videoId, preDeductedPoints),

  // ==================== 客户端信息 API ====================
  clientInfoGetQrcode: () =>
    ipcRenderer.invoke('client-info:get-qrcode'),
  clientInfoDownloadQrcodeBase64: (imageUrl: string) =>
    ipcRenderer.invoke('client-info:download-qrcode-base64', imageUrl),
  onQrcodeBase64Ready: (callback: (data: { imageUrl: string; base64: string }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('client-info:qrcode-base64-ready', listener);
    return () => ipcRenderer.removeListener('client-info:qrcode-base64-ready', listener);
  },
});
