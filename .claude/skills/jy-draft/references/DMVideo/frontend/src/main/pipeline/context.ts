/**
 * 文生视频上下文数据结构
 * 在整个管道执行过程中传递和共享数据
 */

export interface ChildSentence {
  text: string;
  begin_time: number;
  end_time: number;
  sentence_id: number;
}

/** 简化后的短句格式 */
export interface SimplifiedSentence {
  /** 文本内容 */
  text: string;
  /** 开始时间（毫秒） */
  begin_time: number;
  /** 结束时间（毫秒） */
  end_time: number;
  sentence_id: number;
  child?: ChildSentence[];
  /** 当前文案对应视频片段的开始时间点 （毫秒）*/
  video_begin_time: number;
  /** 当前文案对应视频片段的结束时间点 （毫秒）*/
  video_end_time: number;
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
}

/**
 * ASR 结果
 */
export interface AsrResult {
  /** 是否成功 */
  success: boolean;
  /** 句子列表 */
  sentences: SimplifiedSentence[];
  /** 错误信息 */
  error?: string;
}

/**
 * 记录信息（视频素材）
 */
export interface RecordInfo {
  id: number;
  /** 关键词 */
  keywords: string;
  /** 使用次数 */
  used_count: number;
  /** 视频时长（微秒） */
  video_duration: number;
}

/**
 * 短句信息（带关键词绑定）
 */
export interface ShortSentence {
  /** 句子 ID */
  sentence_id: number;
  /** 文本内容 */
  text: string;
  /** 开始时间（微秒） */
  begin_time: number;
  /** 结束时间（微秒） */
  end_time: number;
  /** 时长（微秒） */
  duration: number;
  /** 关键词 */
  keywords: string[];
  /** 关联的视频记录 ID 列表 */
  record_ids: string[];
  /** 关联的视频记录信息 */
  record_infos: RecordInfo[];
  /**字幕对应视频片段的开始时间 （微妙） */
  video_begin_time: number;
  /**字幕对应视频片段的结束时间 （微妙） */
  video_end_time: number;
  /**字幕对应视频片段的持续时长 （微妙） */
  videoDuration: number;
}

/**
 * 视频片段信息（API 返回的 record_segments）
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
 * 视频时间线
 */
export interface VideoTimeline {
  /** 句子 ID */
  sentence_id: number;
  /** 文本内容 */
  text: string;
  /** 匹配的视频记录 ID（兼容旧字段，取 record_ids[0]） */
  matched_record_id: string;
  /** 视频片段ID列表 */
  record_ids: string[];
  /** 视频片段信息列表 */
  record_segments: RecordSegment[];
  /** 在视频轨道上的开始时间（微秒） */
  begin_time: number;
  /** 在视频轨道上的结束时间（微秒） */
  end_time: number;
  /** 在视频轨道上的时长（微秒） */
  duration: number;
  /** 匹配分数 */
  score: number;
  /** 关键词（逗号分隔） */
  keywords: string;
}

/**
 * 背景音乐配置
 */
export interface BgMusicConfig {
  /** 背景音乐本地地址 */
  bg_audio_url: string;
  /** 在时间线上的起始时间点（毫秒） */
  target_start_time: number;
  /** 音频文件的截取起始点（毫秒） */
  source_start_time: number;
  /** 音频文件的截取结束点（毫秒） */
  source_end_time: number;
  /** 背景音乐音量（0-100） */
  volume: number;
}

/**
 * 文生视频上下文
 */
export class TextToVideoContext {
  // ===== 任务信息 =====
  /** 任务 ID */
  taskId: number = 0;
  /** API Token（用于积分扣除） */
  apiToken: string = '';
  /** 关联的素材库文案 ID */
  draftTextId: number = 0;
  /** 文案内容 */
  textContent: string = '';

  // ===== 配置参数 =====
  /** 音色 ID（系统音色或克隆音色） */
  voiceId: string = '';
  /** 音色模型 ID */
  voiceModelId: string = '';
  /** 源视频是否静音 */
  isMuted: boolean = false;
  /** 背景音乐配置列表 */
  bgMusicConfig: BgMusicConfig[] = [];
  /** 筛选条件-省 */
  provinceAt?: string;
  /** 筛选条件-市 */
  cityAt?: string;
  /** 筛选条件-地点 */
  placeAt?: string;
  /** 视频画布宽度 */
  canvasWidth?: number;
  /** 视频画布高度 */
  canvasHeight?: number;
  /** 剪映草稿名称 */
  draftName?: string;
  /** 视频素材根目录路径 */
  videoRootPath?: string;

  // ===== 中间结果 =====
  /** 语音合成文件本地路径 */
  ttsLocalPath?: string;
  /** ASR 结果 */
  asrContent?: AsrResult;
  /** 可用关键词列表 */
  keywords?: string[];
  /** 短句绑定结果 */
  shortSentences?: ShortSentence[];
  /** 视频时间线 */
  videoTimelines?: VideoTimeline[];

  // ===== 积分消耗 =====
  /** 文案处理消耗积分 */
  textUsedPoints: number = 0;
  /** 关键词绑定消耗积分 */
  keywordsBindUsedPoints: number = 0;
  /** 视频处理消耗积分 */
  videoUsedPoints: number = 0;
  /** 关联素材库视频ID列表（逗号分隔） */
  draftVideoIds?: string;

  constructor(init: Partial<TextToVideoContext>) {
    Object.assign(this, init);
  }

  /**
   * 从数据库记录创建上下文
   */
  static fromRecord(record: any, textContent: string): TextToVideoContext {
    const context = new TextToVideoContext({
      taskId: record.id,
      draftTextId: record.draft_text_id,
      textContent,
      voiceId: record.voice_id || '',
      voiceModelId: record.voice_model_id || '',
      isMuted: record.is_muted === 1,
      provinceAt: record.province_at || undefined,
      cityAt: record.city_at || undefined,
      placeAt: record.place_at || undefined,
      draftName: record.draft_name || undefined,
      canvasWidth: record.canvas_width || undefined,
      canvasHeight: record.canvas_height || undefined,
    });

    // 恢复中间结果（用于断点续传）
    if (record.tts_local_path) {
      context.ttsLocalPath = record.tts_local_path;
    }
    if (record.asr_content) {
      try {
        const parsed = JSON.parse(record.asr_content);
        // 兼容两种格式：数组格式（新版）和对象格式（旧版）
        if (Array.isArray(parsed)) {
          context.asrContent = { success: true, sentences: parsed };
        } else {
          context.asrContent = parsed;
        }
      } catch (e) {
        console.warn('[Context] 解析 asr_content 失败:', e);
      }
    }
    if (record.short_sentences) {
      try {
        context.shortSentences = JSON.parse(record.short_sentences);
      } catch (e) {
        console.warn('[Context] 解析 short_sentences 失败:', e);
      }
    }
    if (record.video_timelines) {
      try {
        context.videoTimelines = JSON.parse(record.video_timelines);
      } catch (e) {
        console.warn('[Context] 解析 video_timelines 失败:', e);
      }
    }
    if (record.bg_music_config) {
      try {
        context.bgMusicConfig = JSON.parse(record.bg_music_config);
      } catch (e) {
        console.warn('[Context] 解析 bg_music_config 失败:', e);
      }
    }

    // 恢复积分消耗
    context.textUsedPoints = record.text_used_points || 0;
    context.keywordsBindUsedPoints = record.keywords_bind_used_points || 0;
    context.videoUsedPoints = record.video_used_points || 0;

    return context;
  }
}
