/**
 * 草稿素材准备步骤
 * 负责准备视频、音频、文本素材数据（对应后端 populate 模块）
 */

import * as path from 'path';
import { PipelineStep, StepResult } from '../base';
import { TextToVideoContext, VideoTimeline } from '../context';
import {AudioInfoRequest, draftApiClient, TextInfoRequest, TimelineItem, VideoInfoRequest} from '../../core';
import { deductPointsForStep } from '../points';
import { ffmpeg } from '../../ffmpeg';
import { DB } from '../../database';

/**
 * ASR 字幕数据结构（包含 child 子句）
 * 用于存储在 text_to_video_task.asr_content 字段中的数据格式
 */
interface AsrSubtitleItem {
  /** 文本内容 */
  text: string;
  /** 开始时间（毫秒） */
  begin_time: number;
  /** 结束时间（毫秒） */
  end_time: number;
  /** 句子ID */
  sentence_id?: number;
  /** 子句数组（由当前句子拆分成的更短的子句） */
  child?: AsrSubtitleItem[];
}

/**
 * 素材准备结果
 * 包含准备好的视频、音频、文本素材信息
 */
export interface PopulateResult {
  /** 视频素材信息列表 */
  videoInfos: VideoInfoRequest[];
  /** 音频素材信息列表 */
  audioInfos: AudioInfoRequest[];
  /** 文本素材信息列表 */
  textInfos: TextInfoRequest[];
}

/**
 * 草稿素材准备步骤
 * 负责准备视频、音频、文本素材数据
 * 对应后端 core/draft/populate 模块的功能
 */
export class DraftPopulateStep extends PipelineStep {
  private jianyingDraftPath: string;
  private videoRootPath: string;
  private db: DB;

  constructor(db: DB, jianyingDraftPath: string, videoRootPath: string = '') {
    super();
    this.db = db;
    this.jianyingDraftPath = jianyingDraftPath;
    this.videoRootPath = videoRootPath;
  }

  get name(): string {
    return '素材准备';
  }

  get stepKey(): string {
    return 'draft_populate';
  }

  async execute(context: TextToVideoContext): Promise<StepResult> {
    console.log(`[DraftPopulateStep] 开始执行`);

    // 检查依赖
    if (!context.videoTimelines || context.videoTimelines.length === 0) {
      return { success: false, error: '视频时间线为空，请先执行视频匹配', pointsUsed: 0 };
    }

    if (!context.ttsLocalPath) {
      return { success: false, error: '语音文件路径为空', pointsUsed: 0 };
    }

    const _len = context.videoTimelines?.length || 0;
    let totalVideoDuration = 0;
    if (_len > 0) {
      totalVideoDuration = context.videoTimelines[_len - 1].end_time;
    }

    try {
      // ==================== 步骤1: 构建视频素材 ====================
      console.log(`[DraftPopulateStep] 开始构建视频素材...`);
      const videoInfos = await this.buildVideoTimelineFromVideoMatchData(context);
      console.log(`[DraftPopulateStep] 视频素材构建完成，数量: ${videoInfos.length}`);

      // ==================== 步骤2: 构建音频素材 ====================
      console.log(`[DraftPopulateStep] 开始构建音频素材...`);
      const audioInfos = await this.buildAudioTimelineFromTTS(context, totalVideoDuration);
      console.log(`[DraftPopulateStep] 音频素材构建完成，数量: ${audioInfos.length}`);

      // ==================== 步骤3: 构建文本素材 ====================
      console.log(`[DraftPopulateStep] 开始构建文本素材...`);
      const textInfos = await this.buildTextTimelineFromAsr(context);
      console.log(`[DraftPopulateStep] 文本素材构建完成，数量: ${textInfos.length}`);

      return {
        success: true,
        data: {
          draft_populate_used_points: 0,
          // 扁平数组（向后兼容）
          _video_infos: videoInfos,
          _audio_infos: audioInfos,
          _text_infos: textInfos,
          // 轨道化数组（新增）
          _video_tracks: [{ track_name: '主视频轨道', mute: true, segments: videoInfos }],
          _audio_tracks: [{ track_name: '配音轨道', mute: false, segments: audioInfos }],
          _text_tracks: [{ track_name: '字幕轨道', segments: textInfos }],
        },
        pointsUsed: 0,
      };
    } catch (error: any) {
      console.error('[DraftPopulateStep] 执行失败:', error);
      return { success: false, error: error.message || '未知错误', pointsUsed: 0 };
    }
  }

  // ==================== 字幕时间线构建方法 ====================

  /**
   * 基于提取的文案组装字幕时间线对象
   * 处理逻辑：
   * 1. 从第二个字幕开始，确保上一个字幕的结束时间点等于当前字幕的开始时间点
   * 2. 如果不等于，把当前字幕的开始时间赋值给上一个字幕的结束时间
   * 3. 如果上一个字幕有 child 属性，还需要确保 child 数组最后一个子句的结束时间也等于当前字幕的开始时间
   * 4. 遍历处理后的数据，构建 durations 数组和 texts 数组
   * 5. 如果字幕有 child 数组，进一步遍历 child 并追加到数组中
   *
   * @param context 执行上下文
   * @returns 文本时间线信息数组
   */
  private async buildTextTimelineFromAsr(context: TextToVideoContext): Promise<TextInfoRequest[]> {
    const textInfos: TextInfoRequest[] = [];

    if (!context.asrContent?.sentences) {
      console.warn('[DraftPopulateStep] 没有ASR结果，跳过文本素材构建');
      return textInfos;
    }

    // 获取 ASR 句子数据并转换为可修改的数组
    const sentences: AsrSubtitleItem[] = JSON.parse(JSON.stringify(context.asrContent.sentences));

    console.log(`[DraftPopulateStep] 开始处理字幕时间线，原始句子数: ${sentences.length}`);

    // ==================== 步骤1: 构建 durations 和 texts 数组 ====================
    const durations: number[] = [];  // 每个字幕的持续时间数组（毫秒）
    const texts: string[] = [];      // 每个字幕的文本数组
    const timelineParams: Array<{ begin_time: number; end_time: number }> = [];

    for (const sentence of sentences) {
      const { text, begin_time, end_time, child } = sentence;

      if (child && child.length > 0) {

        for (const childItem of child) {
          timelineParams.push({
            begin_time: childItem.begin_time * 1000,
            end_time: childItem.end_time * 1000
          });
          texts.push(childItem.text);
        }

      } else {
        timelineParams.push({
          begin_time: begin_time * 1000,
          end_time: end_time * 1000
        });
        texts.push(text);
      }

    }

    console.log(`[DraftPopulateStep] texts: ${JSON.stringify(texts.slice(0, 5))}...`);
    console.log(`[DraftPopulateStep] timelineParams: ${JSON.stringify(timelineParams)}`);

    // ==================== 步骤2: 调用 generateTimelines 接口创建时间线 ====================

    // 构建参数结构 [{"begin_time": 1200000,"end_time":3500000},{"begin_time": 4200000,"end_time":7500000},...]
    const timelineResult = await draftApiClient.generateTimelines(timelineParams);
    if (timelineResult.code !== 0) {
      console.error('[DraftPopulateStep] generateTimelines 失败:', timelineResult.message);
      return textInfos;
    }

    const timelines = timelineResult.target.timelines;
    console.log(`[DraftPopulateStep] generateTimelines 成功，获取到 ${timelines.length} 个时间线片段`);

    // ==================== 步骤4: 调用 createTextInfosByTimelines 创建文本素材 ====================
    console.log(`[DraftPopulateStep] 调用 createTextInfosByTimelines 接口...`);

    const textInfoResult = await draftApiClient.createTextInfosByTimelines(timelines, texts);
    if (textInfoResult.code !== 0) {
      console.error('[DraftPopulateStep] createTextInfosByTimelines 失败:', textInfoResult.message);
      return textInfos;
    }

    // 解析返回的 text_infos JSON 字符串
    try {
      const parsedTextInfos = JSON.parse(textInfoResult.text_infos);
      if (Array.isArray(parsedTextInfos)) {
        // 设置默认样式（使用嵌套结构匹配 TextInfoRequest 类型）
        for (const textInfo of parsedTextInfos) {
          // 文本样式
          if (!textInfo.style) textInfo.style = {};
          textInfo.style.size = textInfo.style.size ?? 12;
          textInfo.style.color = textInfo.style.color ?? [255, 255, 255, 255]; // 白色
          // 位置变换
          if (!textInfo.clip_settings) textInfo.clip_settings = {};
          textInfo.clip_settings.transform_y = textInfo.clip_settings.transform_y ?? -0.8; // 底部位置
        }
        textInfos.push(...parsedTextInfos);
      }
      console.log(`[DraftPopulateStep] createTextInfosByTimelines 成功，解析出 ${textInfos.length} 个文本素材`);
    } catch (parseError) {
      console.error('[DraftPopulateStep] 解析 text_infos JSON 失败:', parseError);
      return textInfos;
    }

    console.log(`[DraftPopulateStep] buildTextTimelineFromAsr 完成，构建了 ${textInfos.length} 个文本素材`);
    return textInfos;
  }

  /**
   * 基于 draft/generate-data 接口返回的数据，完成源视频素材的关联以及视频时间线对象的创建
   * 处理逻辑：
   * 1. 从 videoTimelines 中提取所有 matched_record_id（去重）
   * 2. 使用 getDraftVideosByIds 批量查询数据库获取视频素材信息
   * 3. 整合视频素材信息与时间线数据，构建 VideoInfoRequest 对象
   * 4. 打印详细日志便于调试
   *
   * @param context 执行上下文
   * @returns 视频时间线信息数组
   */
  private async buildVideoTimelineFromVideoMatchData(context: TextToVideoContext): Promise<VideoInfoRequest[]> {
    const videoInfos: VideoInfoRequest[] = [];

    if (!context.videoTimelines || context.videoTimelines.length === 0) {
      console.warn('[DraftPopulateStep] 没有视频时间线数据，跳过视频素材构建');
      return videoInfos;
    }

    console.log(`[DraftPopulateStep] 开始构建视频素材，时间线数量: ${context.videoTimelines.length}`);

    // ==================== 步骤1: 提取所有 matched_record_id 并去重 ====================
    const recordIdSet = new Set<string>();
    const timelinesWithoutRecordId: number[] = [];
    for (const timeline of context.videoTimelines) {
      if (timeline.matched_record_id) {
        recordIdSet.add(timeline.matched_record_id);
      } else {
        timelinesWithoutRecordId.push(timeline.sentence_id);
      }
    }

    if (timelinesWithoutRecordId.length > 0) {
      console.warn(`[DraftPopulateStep] 有 ${timelinesWithoutRecordId.length} 个时间线缺少 matched_record_id: sentence_ids=${timelinesWithoutRecordId.join(', ')}`);
    }

    const uniqueRecordIds = Array.from(recordIdSet);
    console.log(`[DraftPopulateStep] 提取到的唯一视频记录ID: ${uniqueRecordIds.length} 个`);
    console.log(`[DraftPopulateStep] 视频记录ID列表: ${JSON.stringify(uniqueRecordIds)}`);

    // ==================== 步骤2: 批量查询数据库获取视频素材信息 ====================
    // 将字符串 ID 转换为数字 ID
    const numericIds = uniqueRecordIds
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id));

    const videoMap = this.db.getDraftVideosByIds(numericIds);
    console.log(`[DraftPopulateStep] 数据库查询到视频素材: ${videoMap.size} 个`);

    // 打印查询到的视频素材详情
    for (const [id, video] of videoMap) {
      console.log(`[DraftPopulateStep] 视频素材 ID=${id}:`, {
        file_path: video.file_path,
        duration: video.duration,
        use_count: video.use_count,
        keywords: video.keywords,
      });
    }

    // ==================== 步骤3: 整合视频素材信息与时间线数据 ====================
    for (const timeline of context.videoTimelines) {
      const numericId = parseInt(timeline.matched_record_id, 10);
      const videoInfo = videoMap.get(numericId);

      if (!videoInfo) {
        console.warn(`[DraftPopulateStep] 未找到视频记录 ID=${timeline.matched_record_id}，跳过`);
        continue;
      }

      // 获取视频文件路径
      const videoUrl = videoInfo.file_path || await this.getVideoUrl(timeline.matched_record_id, context);

      // 计算源视频时长（数据库中存储的是秒，需要转换为微秒）
      const sourceDuration = videoInfo.duration
        ? Math.round(videoInfo.duration * 1000000)  // 秒转微秒
        : timeline.duration;

      const record_segment = timeline.record_segments[0];
      const start_time = record_segment.start_time;
      const end_time = record_segment.end_time;

      const videoInfoRequest: VideoInfoRequest = {
        material_url: videoUrl,
        target_timerange: {
          start: timeline.begin_time,
          duration: timeline.duration,
        },
        source_timerange: {
          start: start_time,
          duration: end_time - start_time,
        },
      };

      videoInfos.push(videoInfoRequest);

      // 打印详细日志
      console.log(`[DraftPopulateStep] 构建视频素材:`, {
        sentence_id: timeline.sentence_id,
        text: timeline.text,
        matched_record_id: timeline.matched_record_id,
        material_url: videoUrl,
        target_time_start: timeline.begin_time,
        target_time_duration: timeline.duration,
        source_duration: end_time - start_time,
        score: timeline.score,
      });
    }

    console.log(`[DraftPopulateStep] buildVideoTimelineFromVideoMatchData 完成，构建了 ${videoInfos.length} 个视频素材`);
    return videoInfos;
  }

  /**
   * 基于语音合成的音频文件，完成音频时间线对象的创建
   * 处理逻辑：
   * 1. 使用 FFmpeg 获取 TTS 音频文件的实际时长
   * 2. 把音频时长组装为列表，调用 generateTimelines 创建时间线
   * 3. 基于时间线调用 createAudioInfosByTimelines 创建音频素材
   *
   * @param context 执行上下文
   * @param totalVideoDuration 视频的时长（微秒 目的：使音频对齐视频时长）
   * @returns 音频时间线信息数组
   */
  private async buildAudioTimelineFromTTS(context: TextToVideoContext, totalVideoDuration: number = 0): Promise<AudioInfoRequest[]> {
    const audioInfos: AudioInfoRequest[] = [];

    if (!context.ttsLocalPath) {
      console.warn('[DraftPopulateStep] 没有TTS音频文件，跳过音频素材构建');
      return audioInfos;
    }

    try {
      // ==================== 步骤1: 获取TTS音频文件时长 ====================
      // console.log(`[DraftPopulateStep] 获取音频文件时长: ${context.ttsLocalPath}`);
      // const audioInfo = await ffmpeg.getVideoInfo(context.ttsLocalPath);
      // const audioDurationSeconds = audioInfo.duration;
      // const audioDurationMicro = Math.round(audioDurationSeconds * 1000000); // 秒转微秒
      //
      // console.log(`[DraftPopulateStep] 音频时长: ${audioDurationSeconds}秒 (${audioDurationMicro}微秒)`);

      // ==================== 步骤2: 把视频时长组装为列表，调用 generateTimelines 创建时间线 ====================
      const durations = [totalVideoDuration];
      console.log(`[DraftPopulateStep] 调用 generateTimelines 接口，参数: ${JSON.stringify(durations)}`);

      const timelineResult = await draftApiClient.generateTimelines(durations);
      if (timelineResult.code !== 0) {
        console.error('[DraftPopulateStep] generateTimelines 失败:', timelineResult.message);
        return audioInfos;
      }

      const timelines: TimelineItem[] = timelineResult.target.timelines;
      console.log(`[DraftPopulateStep] generateTimelines 成功，获取到 ${timelines.length} 个时间线片段`);

      // ==================== 步骤3: 调用 createAudioInfosByTimelines 创建音频素材 ====================
      console.log(`[DraftPopulateStep] 调用 createAudioInfosByTimelines 接口...`);

      const audioInfoResult = await draftApiClient.createAudioInfosByTimelines(
        timelines,
        [context.ttsLocalPath]
      );
      if (audioInfoResult.code !== 0) {
        console.error('[DraftPopulateStep] createAudioInfosByTimelines 失败:', audioInfoResult.message);
        return audioInfos;
      }

      // 解析返回的 audio_infos JSON 字符串
      try {
        const parsedAudioInfos = JSON.parse(audioInfoResult.audio_infos);
        if (Array.isArray(parsedAudioInfos)) {
          // 设置默认音量
          for (const info of parsedAudioInfos) {
            info.volume = info.volume ?? 1.0;
          }
          audioInfos.push(...parsedAudioInfos);
        }
        console.log(`[DraftPopulateStep] createAudioInfosByTimelines 成功，解析出 ${audioInfos.length} 个音频素材`);
      } catch (parseError) {
        console.error('[DraftPopulateStep] 解析 audio_infos JSON 失败:', parseError);
        return audioInfos;
      }

      console.log(`[DraftPopulateStep] buildAudioTimelineFromTTS 完成，构建了 ${audioInfos.length} 个音频素材`);
      return audioInfos;
    } catch (error: any) {
      console.error('[DraftPopulateStep] buildAudioTimelineFromTTS 执行失败:', error);
      return audioInfos;
    }
  }

  /**
   * 获取视频文件URL
   * @param matchedRecordId 匹配的记录ID
   * @param context 执行上下文
   * @returns 视频文件URL
   */
  private async getVideoUrl(matchedRecordId: string, context: TextToVideoContext): Promise<string> {
    // 目前返回占位符
    const videoRootPath = context.videoRootPath || this.videoRootPath;
    return path.join(videoRootPath, `${matchedRecordId}.mp4`);
  }

  /**
   * 检查是否可以跳过此步骤（断点续传）
   */
  canSkip(context: TextToVideoContext, taskRecord: any): boolean {
    // 如果已有 draft_populate_used_points 且任务状态为成功，可以跳过
    return taskRecord?.draft_populate_used_points && taskRecord?.status === 2;
  }
}
