/**
 * 语音合成步骤
 * 将文案转换为语音文件
 */

import * as path from 'path';
import * as fs from 'fs';
import { PipelineStep, StepResult } from '../base';
import { TextToVideoContext } from '../context';
import { bailianAudioUtil } from '../../core';
import { deductPointsForStep, calculateTtsPointsByCharacters } from '../points';

/**
 * 语音合成步骤
 */
export class TtsStep extends PipelineStep {
  private outputDir: string;

  constructor(outputDir: string) {
    super();
    this.outputDir = outputDir;
  }

  get name(): string {
    return '语音合成';
  }

  get stepKey(): string {
    return 'tts_local_path';
  }

  async execute(context: TextToVideoContext): Promise<StepResult> {
    console.log(`[TtsStep] 开始执行，文案长度: ${context.textContent.length}`);

    // 检查依赖
    if (!context.textContent) {
      return { success: false, error: '文案内容为空', pointsUsed: 0 };
    }

    if (!context.voiceId) {
      return { success: false, error: '未配置音色ID', pointsUsed: 0 };
    }

    try {
      // 确保输出目录存在
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      // 生成输出文件路径
      const timestamp = Date.now();
      const fileName = `tts_${context.taskId}_${timestamp}.mp3`;
      const outputPath = path.join(this.outputDir, fileName);

      // 调用语音合成（使用 WebSocket API）
      const result = await bailianAudioUtil.synthesizeSpeech(
        context.textContent,
        context.voiceId,
        outputPath,
        {
          model: context.voiceModelId as any,
          format: 'mp3',
          sampleRate: 22050,
          rate: 1.0,
          volume: 50,
        }
      );

      if (!result.success) {
        return { success: false, error: result.error || '语音合成失败', pointsUsed: 0 };
      }

      // 计算积分（根据文案字符数和模型）
      const pointsUsed = calculateTtsPointsByCharacters(
        context.textContent.length,
        context.voiceModelId
      );

      console.log(`[TtsStep] 语音合成成功，文件: ${outputPath}，积分: ${pointsUsed}`);

      // 扣除积分
      await deductPointsForStep(context, pointsUsed, 'TtsStep');

      return {
        success: true,
        data: {
          tts_local_path: outputPath,
          text_used_points: pointsUsed,
        },
        pointsUsed,
      };
    } catch (error: any) {
      console.error('[TtsStep] 执行失败:', error);
      return { success: false, error: error.message || '未知错误', pointsUsed: 0 };
    }
  }
}