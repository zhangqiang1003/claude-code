/**
 * 草稿素材审核步骤
 * 负责在素材准备完成后暂停执行，等待用户审核并修改素材数据
 */

import { BrowserWindow } from 'electron';
import { PipelineStep, StepResult } from '../base';
import { TextToVideoContext } from '../context';
import { DB } from '../../database';
import {
  AudioInfoRequest,
  AudioTrack,
  TextInfoRequest,
  TextTrack,
  VideoInfoRequest,
  VideoTrack,
} from '../../typings/draftApi';

/**
 * 用户编辑结果
 */
export interface UserEditResult {
  action: 'confirm' | 'skip' | 'cancel';
  editedMaterials?: EditedMaterials;
}

/**
 * 编辑后的素材（轨道化）
 */
export interface EditedMaterials {
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
  bgMusicConfig: BgMusicConfigItem[];
}

/**
 * 背景音乐配置项
 */
export interface BgMusicConfigItem {
  bg_audio_url: string;
  volume: number;
  target_start_time: number;
  source_start_time: number;
  source_end_time: number;
}

/**
 * 审核请求数据（轨道化）
 */
export interface DraftReviewRequest {
  taskId: number;
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
  bgMusicConfig?: BgMusicConfigItem[];
}

// 全局 Map 存储 pending 步骤实例
const pendingReviewSteps = new Map<number, DraftReviewStep>();

/**
 * 草稿素材审核步骤
 * 在 DraftPopulateStep 完成后暂停执行
 * 等待用户审核编辑素材
 */
export class DraftReviewStep extends PipelineStep {
  private window: BrowserWindow;
  private db: DB;
  private pendingResolves: Map<number, (value: UserEditResult) => void> = new Map();

  constructor(window: BrowserWindow, db: DB) {
    super();
    this.window = window;
    this.db = db;
  }

  get name(): string {
    return '素材审核';
  }

  get stepKey(): string {
    return 'draft_review';
  }

  async execute(context: TextToVideoContext): Promise<StepResult> {
    console.log(`[DraftReviewStep] 开始执行`);

    // ==================== 读取素材数据（轨道化优先，扁平兜底） ====================

    let videoTracks: VideoTrack[] = (context as any)._video_tracks || [];
    let audioTracks: AudioTrack[] = (context as any)._audio_tracks || [];
    let textTracks: TextTrack[] = (context as any)._text_tracks || [];
    let bgMusicConfig = context.bgMusicConfig || [];

    // 扁平兜底：如果轨道数据为空但扁平数据存在，包装为单轨道
    if (videoTracks.length === 0) {
      const flatVideos: VideoInfoRequest[] = (context as any)._video_infos || [];
      if (flatVideos.length > 0) {
        videoTracks = [{ track_name: '主视频轨道', mute: true, segments: flatVideos }];
      }
    }
    if (audioTracks.length === 0) {
      const flatAudios: AudioInfoRequest[] = (context as any)._audio_infos || [];
      if (flatAudios.length > 0) {
        audioTracks = [{ track_name: '配音轨道', mute: false, segments: flatAudios }];
      }
    }
    if (textTracks.length === 0) {
      const flatTexts: TextInfoRequest[] = (context as any)._text_infos || [];
      if (flatTexts.length > 0) {
        textTracks = [{ track_name: '字幕轨道', segments: flatTexts }];
      }
    }

    // ==================== 断点续传支持 ====================

    const taskRecord = this.db.getTextToVideoTask(context.taskId);
    if (taskRecord?.draft_review_status === 1) {
      // 尝试从数据库加载已保存的编辑数据（轨道化格式）
      if (taskRecord.edited_video_tracks) {
        try {
          videoTracks = this.parseTracks(taskRecord.edited_video_tracks, '主视频轨道', true);
          console.log(`[DraftReviewStep] 断点续传: 加载已编辑的视频轨道 ${videoTracks.length} 条`);
        } catch (e) { /* ignore */ }
      } else if (taskRecord.edited_video_infos) {
        // 兼容旧的扁平格式
        try {
          const flat = JSON.parse(taskRecord.edited_video_infos);
          videoTracks = [{ track_name: '主视频轨道', mute: true, segments: Array.isArray(flat) ? flat : [] }];
        } catch (e) { /* ignore */ }
      }
      if (taskRecord.edited_audio_tracks) {
        try {
          audioTracks = this.parseTracks(taskRecord.edited_audio_tracks, '配音轨道', false);
          console.log(`[DraftReviewStep] 断点续传: 加载已编辑的音频轨道 ${audioTracks.length} 条`);
        } catch (e) { /* ignore */ }
      } else if (taskRecord.edited_audio_infos) {
        try {
          const flat = JSON.parse(taskRecord.edited_audio_infos);
          audioTracks = [{ track_name: '配音轨道', mute: false, segments: Array.isArray(flat) ? flat : [] }];
        } catch (e) { /* ignore */ }
      }
      if (taskRecord.edited_text_tracks) {
        try {
          textTracks = this.parseTracks(taskRecord.edited_text_tracks, '字幕轨道');
          console.log(`[DraftReviewStep] 断点续传: 加载已编辑的字幕轨道 ${textTracks.length} 条`);
        } catch (e) { /* ignore */ }
      } else if (taskRecord.edited_text_infos) {
        try {
          const flat = JSON.parse(taskRecord.edited_text_infos);
          textTracks = [{ track_name: '字幕轨道', segments: Array.isArray(flat) ? flat : [] }];
        } catch (e) { /* ignore */ }
      }
      if (taskRecord.edited_bg_music_config) {
        try {
          bgMusicConfig = JSON.parse(taskRecord.edited_bg_music_config);
          console.log(`[DraftReviewStep] 断点续传: 加载已编辑的背景音乐数据 ${bgMusicConfig.length} 条`);
        } catch (e) { /* ignore */ }
      }
    }

    const totalVideoSegments = videoTracks.reduce((sum, t) => sum + t.segments.length, 0);
    const totalAudioSegments = audioTracks.reduce((sum, t) => sum + t.segments.length, 0);
    const totalTextSegments = textTracks.reduce((sum, t) => sum + t.segments.length, 0);
    console.log(`[DraftReviewStep] 素材数据: videoTracks=${videoTracks.length}(${totalVideoSegments} segments), audioTracks=${audioTracks.length}(${totalAudioSegments} segments), textTracks=${textTracks.length}(${totalTextSegments} segments), bgm=${bgMusicConfig.length}`);

    // 更新数据库审核状态为 1（审核中）
    this.db.updateTextToVideoTaskReviewStatus(context.taskId, 1);

    // 保存当前步骤实例到全局 Map
    pendingReviewSteps.set(context.taskId, this);

    // 发送审核请求到渲染进程
    const reviewRequest: DraftReviewRequest = {
      taskId: context.taskId,
      videoTracks,
      audioTracks,
      textTracks,
      bgMusicConfig,
    };
    console.log(`[DraftReviewStep] 发送审核请求到渲染进程, taskId=${context.taskId}`);
    this.window.webContents.send('draft-review:request', reviewRequest);

    // 等待用户响应
    const result = await this.waitForUserResponse(context.taskId);

    // 从全局 Map 中移除
    pendingReviewSteps.delete(context.taskId);

    // 处理用户响应
    if (result.action === 'cancel') {
      console.log(`[DraftReviewStep] 用户取消任务`);
      return { success: false, error: '用户取消', pointsUsed: 0 };
    }

    if (result.action === 'skip') {
      console.log(`[DraftReviewStep] 用户跳过编辑，使用原始数据`);
      // 仍然将原始轨道数据写入 context，供后续步骤使用
      (context as any)._video_tracks = videoTracks;
      (context as any)._audio_tracks = audioTracks;
      (context as any)._text_tracks = textTracks;
      return { success: true, data: { draft_review_status: 'skipped' }, pointsUsed: 0 };
    }

    // 用户确认编辑
    if (result.editedMaterials) {
      (context as any)._edited_video_tracks = result.editedMaterials.videoTracks;
      (context as any)._edited_audio_tracks = result.editedMaterials.audioTracks;
      (context as any)._edited_text_tracks = result.editedMaterials.textTracks;
      (context as any)._edited_bg_music_config = result.editedMaterials.bgMusicConfig;

      console.log(`[DraftReviewStep] 用户确认编辑，已更新 context 中的轨道素材数据`);
    }

    return { success: true, data: { draft_review_status: 'confirmed' }, pointsUsed: 0 };
  }

  /**
   * 解析轨道 JSON 字符串
   * 兼容旧格式：如果 JSON 解析为扁平数组，则包装为单轨道
   */
  private parseTracks(jsonStr: string, defaultTrackName: string, defaultMute?: boolean): any[] {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      // 检查是否是轨道格式（元素有 segments 字段）
      if (parsed.length > 0 && parsed[0].segments !== undefined) {
        return parsed;
      }
      // 旧的扁平格式，包装为单轨道
      return [{ track_name: defaultTrackName, mute: defaultMute, segments: parsed }];
    }
    return [];
  }

  /**
   * 等待用户响应
   */
  private waitForUserResponse(taskId: number): Promise<UserEditResult> {
    return new Promise((resolve) => {
      this.pendingResolves.set(taskId, resolve);
    });
  }

  /**
   * 处理用户响应（由 IPC 调用）
   */
  handleUserResponse(taskId: number, result: UserEditResult): void {
    const resolve = this.pendingResolves.get(taskId);
    if (resolve) {
      resolve(result);
      this.pendingResolves.delete(taskId);
      console.log(`[DraftReviewStep] 已处理用户响应, taskId=${taskId}`);
    } else {
      console.warn(`[DraftReviewStep] 未找到等待中的 Promise, taskId=${taskId}`);
    }
  }

  /**
   * 检查是否可以跳过此步骤（断点续传）
   */
  canSkip(_context: TextToVideoContext, taskRecord: any): boolean {
    return taskRecord?.draft_review_status === 2 ||
           taskRecord?.draft_review_status === 3;
  }
}

// 导出获取 pending 步骤的方法
export function getPendingReviewStep(taskId: number): DraftReviewStep | undefined {
  return pendingReviewSteps.get(taskId);
}
