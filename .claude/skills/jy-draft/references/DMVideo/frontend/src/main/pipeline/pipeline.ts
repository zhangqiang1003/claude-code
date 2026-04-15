/**
 * 文生视频管道编排器
 * 管理步骤的执行顺序、进度推送和断点续传
 */

import { BrowserWindow, app } from 'electron';
import { PipelineStep, StepProgress, StepResult } from './base';
import { TextToVideoContext } from './context';
import { DB } from '../database';

// 判断是否是生产环境(打包后)
const isProduction = app.isPackaged;

/**
 * 管道配置
 */
export interface PipelineConfig {
  /** 是否启用断点续传 */
  enableResume: boolean;
  /** 步骤间延迟（毫秒） */
  stepDelay: number;
}

/**
 * 文生视频管道
 */
export class TextToVideoPipeline {
  private steps: PipelineStep[] = [];
  private db: DB;
  private window: BrowserWindow;
  private config: PipelineConfig;
  private isCancelled: boolean = false;

  constructor(db: DB, window: BrowserWindow, config?: Partial<PipelineConfig>) {
    this.db = db;
    this.window = window;
    this.config = {
      enableResume: true,
      stepDelay: 100,
      ...config,
    };
  }

  /**
   * 添加步骤
   */
  addStep(step: PipelineStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * 取消执行
   */
  cancel(): void {
    this.isCancelled = true;
  }

  /**
   * 执行管道
   * @param context 执行上下文
   */
  async run(context: TextToVideoContext): Promise<void> {
    this.isCancelled = false;

    // 更新任务状态为处理中
    this.db.updateTextToVideoTaskStatus(context.taskId, 1);

    // 获取任务记录（用于断点续传判断）
    const taskRecord = this.db.getTextToVideoTask(context.taskId);

    for (const step of this.steps) {
      // 检查是否已取消
      if (this.isCancelled) {
        this.db.updateTextToVideoTaskStatus(context.taskId, 3, '用户取消');
        this.sendProgress(step.name, step.stepKey, 'failed', { error: '用户取消' });
        throw new Error('用户取消');
      }

      // 更新当前步骤
      this.db.updateTextToVideoTaskCurrentStep(context.taskId, step.name);
      this.sendProgress(step.name, step.stepKey, 'processing');

      // 断点续传检查
      if (this.config.enableResume && step.canSkip(context, taskRecord)) {
        console.log(`[Pipeline] 步骤 ${step.name} 已完成，跳过`);
        this.sendProgress(step.name, step.stepKey, 'skipped');
        continue;
      }

      try {
        // 执行前钩子
        if (step.beforeExecute) {
          await step.beforeExecute(context);
        }

        // 执行步骤
        const result = await step.execute(context);

        if (!result.success) {
          throw new Error(result.error || '步骤执行失败');
        }

        // 保存步骤结果到数据库
        if (result.data) {
          for (const [key, value] of Object.entries(result.data)) {
            this.db.updateTextToVideoTaskStepData(context.taskId, key, value);
          }
        }

        // 更新上下文
        this.updateContext(context, result.data);

        // 发送进度
        this.sendProgress(step.name, step.stepKey, 'completed', result.data);

        // 执行后钩子
        if (step.afterExecute) {
          await step.afterExecute(context, result);
        }

        // 步骤间延迟
        if (this.config.stepDelay > 0) {
          await this.delay(this.config.stepDelay);
        }
      } catch (error: any) {
        // 生产环境只输出错误消息，开发环境输出完整堆栈
        const errorDetails = isProduction
          ? error.message
          : (error.stack || error.message || String(error));
        console.error(`[Pipeline] 步骤 ${step.name} 失败: ${errorDetails}`);
        this.db.updateTextToVideoTaskStatus(context.taskId, 3, error.message);
        this.sendProgress(step.name, step.stepKey, 'failed', { error: error.message });
        throw error;
      }
    }

    // 更新任务状态为成功
    this.db.updateTextToVideoTaskStatus(context.taskId, 2);
    console.log(`[Pipeline] 任务 ${context.taskId} 执行完成`);
  }

  /**
   * 更新上下文数据
   */
  private updateContext(context: TextToVideoContext, data?: Record<string, any>): void {
    if (!data) return;

    if (data.tts_local_path) {
      context.ttsLocalPath = data.tts_local_path;
    }
    if (data.asr_content) {
      // asr_content 存储为数组格式，包装为对象格式供后续步骤使用
      if (Array.isArray(data.asr_content)) {
        context.asrContent = { success: true, sentences: data.asr_content };
      } else {
        context.asrContent = data.asr_content;
      }
    }
    if (data.keywords) {
      context.keywords = data.keywords;
    }
    if (data.short_sentences) {
      context.shortSentences = data.short_sentences;
    }
    if (data.video_timelines) {
      context.videoTimelines = data.video_timelines;
    }
    // 传递视频关键词映射（以下划线开头的字段为临时数据，不保存到数据库但需要传递给下一步骤）
    if (data._videoKeywordMap) {
      (context as any)._videoKeywordMap = data._videoKeywordMap;
    }
    if (data._videoInfoMap) {
      (context as any)._videoInfoMap = data._videoInfoMap;
    }
    // 传递 DraftPopulateStep 准备的素材数据
    if (data._video_infos) {
      (context as any)._video_infos = data._video_infos;
    }
    if (data._audio_infos) {
      (context as any)._audio_infos = data._audio_infos;
    }
    if (data._text_infos) {
      (context as any)._text_infos = data._text_infos;
    }
    // 轨道化素材数据（优先使用）
    if (data._video_tracks) {
      (context as any)._video_tracks = data._video_tracks;
    }
    if (data._audio_tracks) {
      (context as any)._audio_tracks = data._audio_tracks;
    }
    if (data._text_tracks) {
      (context as any)._text_tracks = data._text_tracks;
    }
  }

  /**
   * 发送进度通知
   */
  private sendProgress(
    stepName: string,
    stepKey: string,
    status: 'processing' | 'completed' | 'failed' | 'skipped',
    data?: any
  ): void {
    const progress: StepProgress = {
      stepName,
      stepKey,
      status,
      data,
      timestamp: Date.now(),
    };

    this.window.webContents.send('text-to-video-progress', progress);
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建默认的文生视频管道
 */
export function createDefaultPipeline(db: DB, window: BrowserWindow): TextToVideoPipeline {
  // 动态导入步骤，避免循环依赖
  const pipeline = new TextToVideoPipeline(db, window);

  // 步骤将在 steps/index.ts 中导入并添加
  return pipeline;
}