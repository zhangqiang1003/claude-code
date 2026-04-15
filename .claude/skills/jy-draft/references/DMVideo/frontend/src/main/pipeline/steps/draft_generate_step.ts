/**
 * 草稿生成步骤
 * 负责创建草稿、添加素材、生成剪映草稿文件（对应后端 generate 模块）
 */

import { PipelineStep, StepResult } from '../base';
import { TextToVideoContext } from '../context';
import {
  AddAudiosRequest,
  AddTextsRequest,
  AddVideosRequest,
  AudioInfoRequest,
  AudioTrack,
  draftApiClient,
  TextTrack,
  VideoInfoRequest,
  VideoTrack,
} from '../../core';
import { DB } from '../../database';

/**
 * 草稿生成步骤
 * 负责创建草稿、添加素材、生成剪映草稿文件
 * 对应后端 core/draft/generate 模块的功能
 *
 * 注意：此步骤依赖 DraftPopulateStep 准备的素材数据
 */
export class DraftGenerateStep extends PipelineStep {
  private jianyingDraftPath: string;
  private db: DB;

  constructor(db: DB, jianyingDraftPath: string) {
    super();
    this.db = db;
    this.jianyingDraftPath = jianyingDraftPath;
  }

  get name(): string {
    return '草稿生成';
  }

  get stepKey(): string {
    return 'draft_generate';
  }

  async execute(context: TextToVideoContext): Promise<StepResult> {
    console.log(`[DraftGenerateStep] 开始执行`);

    // ==================== 读取素材数据（轨道化优先，扁平兜底） ====================
    // 优先使用编辑后的轨道数据 > 原始轨道数据 > 编辑后的扁平数据 > 原始扁平数据
    const videoTracks: VideoTrack[] = (context as any)._edited_video_tracks
      || (context as any)._video_tracks
      || this.wrapFlatIntoTrack<VideoInfoRequest>((context as any)._edited_video_infos || (context as any)._video_infos, '主视频轨道', true);

    const audioTracks: AudioTrack[] = (context as any)._edited_audio_tracks
      || (context as any)._audio_tracks
      || this.wrapFlatIntoTrack<AudioInfoRequest>((context as any)._edited_audio_infos || (context as any)._audio_infos, '配音轨道', false);

    const textTracks: TextTrack[] = (context as any)._edited_text_tracks
      || (context as any)._text_tracks
      || this.wrapFlatIntoTrack<any>((context as any)._edited_text_infos || (context as any)._text_infos, '字幕轨道');

    const editedBgMusicConfig = (context as any)._edited_bg_music_config;

    // 检查是否至少有一种素材
    const totalVideoSegments = videoTracks.reduce((sum, t) => sum + t.segments.length, 0);
    const totalAudioSegments = audioTracks.reduce((sum, t) => sum + t.segments.length, 0);
    const totalTextSegments = textTracks.reduce((sum, t) => sum + t.segments.length, 0);

    if (totalVideoSegments === 0 && totalAudioSegments === 0 && totalTextSegments === 0) {
      return { success: false, error: '素材数据为空，请先执行素材准备步骤', pointsUsed: 0 };
    }

    // 检查剪映草稿路径
    if (!this.jianyingDraftPath) {
      return { success: false, error: '剪映草稿路径未配置，请在设置中配置剪映草稿路径', pointsUsed: 0 };
    }

    try {
      // 获取画布尺寸（从上下文或使用默认值）
      const canvasWidth = context.canvasWidth || 1080;
      const canvasHeight = context.canvasHeight || 1920;
      console.log(`[DraftGenerateStep] 画布尺寸: ${canvasWidth}x${canvasHeight}`);

      // ==================== 步骤1: 创建草稿 ====================
      const createResult = await draftApiClient.createDraft(canvasWidth, canvasHeight);
      if (createResult.code !== 0 || !createResult.draft_id) {
        return { success: false, error: createResult.message || '创建草稿失败', pointsUsed: 0 };
      }

      const draftId = createResult.draft_id;
      console.log(`[DraftGenerateStep] 草稿ID: ${draftId}`);

      // ==================== 步骤2: 添加视频素材（多轨道循环） ====================
      for (const track of videoTracks) {
        if (track.segments && track.segments.length > 0) {
          console.info(`[DraftGenerateStep] 添加视频轨道: ${track.track_name || '未命名'}, 片段数: ${track.segments.length}`);

          const videoRequest: AddVideosRequest = {
            draft_id: draftId,
            video_infos: JSON.stringify(track.segments),
            mute: track.mute,
            track_name: track.track_name,
          };

          const videoResult = await draftApiClient.addVideos(videoRequest);
          if (videoResult.code !== 0) {
            console.warn(`[DraftGenerateStep] 添加视频轨道失败 (${track.track_name}):`, videoResult.message);
          } else {
            console.log(`[DraftGenerateStep] 添加视频轨道成功: ${track.track_name}, 片段数: ${track.segments.length}`);
          }
        }
      }

      // ==================== 步骤3: 添加音频素材（多轨道循环） ====================
      for (const track of audioTracks) {
        if (track.segments && track.segments.length > 0) {
          console.info(`[DraftGenerateStep] 添加音频轨道: ${track.track_name || '未命名'}, 片段数: ${track.segments.length}`);

          const audioRequest: AddAudiosRequest = {
            draft_id: draftId,
            audio_infos: JSON.stringify(track.segments),
            mute: track.mute,
            track_name: track.track_name,
          };

          const audioResult = await draftApiClient.addAudios(audioRequest);
          if (audioResult.code !== 0) {
            console.warn(`[DraftGenerateStep] 添加音频轨道失败 (${track.track_name}):`, audioResult.message);
          } else {
            console.log(`[DraftGenerateStep] 添加音频轨道成功: ${track.track_name}, 片段数: ${track.segments.length}`);
          }
        }
      }

      // ==================== 步骤4: 添加文本素材（多轨道循环） ====================
      for (const track of textTracks) {
        if (track.segments && track.segments.length > 0) {
          console.info(`[DraftGenerateStep] 添加文本轨道: ${track.track_name || '未命名'}, 片段数: ${track.segments.length}`);

          const textRequest: AddTextsRequest = {
            draft_id: draftId,
            text_infos: JSON.stringify(track.segments),
            track_name: track.track_name,
          };

          const textResult = await draftApiClient.addTexts(textRequest);
          if (textResult.code !== 0) {
            console.warn(`[DraftGenerateStep] 添加文本轨道失败 (${track.track_name}):`, textResult.message);
          } else {
            console.log(`[DraftGenerateStep] 添加文本轨道成功: ${track.track_name}, 片段数: ${track.segments.length}`);
          }
        }
      }

      // ==================== TODO 步骤5: 添加背景音乐 ====================
      // 优先使用编辑后的背景音乐配置
      const bgMusicToUse = editedBgMusicConfig || context.bgMusicConfig;
      if (bgMusicToUse && bgMusicToUse.length > 0) {
        await this.addBgMusic(draftId, bgMusicToUse);
      }

      // ==================== 步骤6: 生成剪映草稿文件夹 ====================
      console.log(`[DraftGenerateStep] 准备生成剪映草稿，输出目录: ${this.jianyingDraftPath}`);

      const generateResult = await draftApiClient.generateJianyingDraft({
        draft_id: draftId,
        output_folder: this.jianyingDraftPath,
        draft_name: context.draftName,
        fps: 30,
      });

      if (generateResult.code !== 0) {
        return { success: false, error: generateResult.message || '生成剪映草稿失败', pointsUsed: 0 };
      }

      console.log(`[DraftGenerateStep] 剪映草稿生成成功: ${generateResult.draft_folder_path}`);

      // ==================== 步骤7: 更新视频素材使用次数 ====================
      await this.updateVideoUseCount(context);

      // 提取所有视频轨道中的视频 URL 列表
      const allVideoUrls = videoTracks.flatMap(t => t.segments.map(s => s.material_url));
      const draftVideoIds = allVideoUrls.join(',');

      console.log(`[DraftGenerateStep] 草稿生成完成，草稿ID: ${draftId}`);

      return {
        success: true,
        data: {
          draft_id: draftId,
          jianying_draft_path: this.jianyingDraftPath,
          draft_video_ids: draftVideoIds,
        },
        pointsUsed: 0, // 积分已在 DraftPopulateStep 中计算
      };
    } catch (error: any) {
      console.error('[DraftGenerateStep] 执行失败:', error);
      return { success: false, error: error.message || '未知错误', pointsUsed: 0 };
    }
  }

  /**
   * 添加背景音乐
   * @param draftId 草稿ID
   * @param bgMusicConfig 背景音乐配置
   */
  private async addBgMusic(draftId: string, bgMusicConfig: any[]): Promise<void> {
    if (!bgMusicConfig || bgMusicConfig.length === 0) {
      return;
    }

    const audioInfos: AudioInfoRequest[] = [];

    for (const config of bgMusicConfig) {
      audioInfos.push({
        material_url: config.bg_audio_url,
        target_timerange: {
          start: config.target_start_time * 1000, // 毫秒转微秒
          duration: (config.source_end_time - config.source_start_time) * 1000,
        },
        source_timerange: {
          start: config.source_start_time * 1000,
          duration: (config.source_end_time - config.source_start_time) * 1000,
        },
        volume: config.volume,
      });
    }

    if (audioInfos.length > 0) {
      const result = await draftApiClient.addAudios({ draft_id: draftId, audio_infos: JSON.stringify(audioInfos) });
      if (result.code !== 0) {
        console.warn('[DraftGenerateStep] 添加背景音乐失败:', result.message);
      } else {
        console.log(`[DraftGenerateStep] 添加背景音乐成功，数量: ${audioInfos.length}`);
      }
    }
  }

  /**
   * 更新视频素材使用次数
   * 在草稿生成成功后，更新所有使用的视频素材的 use_count
   * @param context 执行上下文
   */
  private async updateVideoUseCount(context: TextToVideoContext): Promise<void> {
    if (!context.videoTimelines || context.videoTimelines.length === 0) {
      return;
    }

    // 提取所有唯一的视频记录 ID
    const videoIds = new Set<number>();
    for (const timeline of context.videoTimelines) {
      if (timeline.matched_record_id) {
        const id = parseInt(timeline.matched_record_id, 10);
        if (!isNaN(id)) {
          videoIds.add(id);
        }
      }
    }

    if (videoIds.size === 0) {
      console.log('[DraftGenerateStep] 没有需要更新使用次数的视频素材');
      return;
    }

    // 更新每个视频的使用次数
    let updateCount = 0;
    for (const videoId of videoIds) {
      try {
        const changes = this.db.incrementDraftVideoUseCount(videoId);
        if (changes > 0) {
          updateCount++;
        }
      } catch (error) {
        console.warn(`[DraftGenerateStep] 更新视频 ID=${videoId} 使用次数失败:`, error);
      }
    }

    console.log(`[DraftGenerateStep] 更新视频素材使用次数完成，成功更新 ${updateCount} 个`);
  }

  /**
   * 将扁平素材数组包装为单轨道（兜底兼容）
   */
  private wrapFlatIntoTrack<T>(flatArray: T[] | undefined, trackName: string, mute?: boolean): Array<{ track_name: string; mute?: boolean; segments: T[] }> {
    if (!flatArray || !Array.isArray(flatArray) || flatArray.length === 0) return [];
    // 兼容旧数据：如果已经是轨道格式则直接返回
    if (flatArray.length > 0 && (flatArray[0] as any).segments !== undefined) {
      return flatArray as any;
    }
    return [{ track_name: trackName, mute, segments: flatArray }];
  }

  /**
   * 检查是否可以跳过此步骤（断点续传）
   */
  canSkip(_context: TextToVideoContext, taskRecord: any): boolean {
    // 如果已有 draft_id 且任务状态为成功，可以跳过
    return taskRecord?.draft_id && taskRecord?.status === 2;
  }
}
