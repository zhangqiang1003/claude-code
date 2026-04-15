/**
 * 音频文案提取步骤（ASR）
 * 从音频文件中提取带时间戳的文本
 */

import * as fs from 'fs';
import { PipelineStep, StepResult } from '../base';
import { ChildSentence, SimplifiedSentence, TextToVideoContext } from '../context';
import { bailianAudioUtil, AsrSentence, AsrWord } from '../../core';
import { ossUtil, dumpJson } from '../../core';
import { calculateAsrPointsByDuration, deductPointsForStep } from '../points';

/** 长句阈值：超过此时长（毫秒）的句子会被拆分为2个子短句 */
const LONG_SENTENCE_THRESHOLD = 2500;

/** 超长句阈值：超过此时长（毫秒）的句子会被拆分为3个子短句 */
const VERY_LONG_SENTENCE_THRESHOLD = 6000;


/**
 * ASR 步骤
 */
export class AsrStep extends PipelineStep {
  get name(): string {
    return '音频文案提取';
  }

  get stepKey(): string {
    return 'asr_content';
  }

  async execute(context: TextToVideoContext): Promise<StepResult> {
    console.log(`[AsrStep] 开始执行`);

    // 检查依赖
    if (!context.ttsLocalPath) {
      return { success: false, error: '语音文件路径为空，请先执行语音合成', pointsUsed: 0 };
    }

    if (!fs.existsSync(context.ttsLocalPath)) {
      return { success: false, error: `语音文件不存在: ${context.ttsLocalPath}`, pointsUsed: 0 };
    }

    try {
      // 诊断信息：打印音频文件大小
      const audioStat = fs.statSync(context.ttsLocalPath);
      console.log(`[AsrStep] 音频文件: ${context.ttsLocalPath}, 大小: ${(audioStat.size / 1024).toFixed(1)}KB`);

      // 先将音频文件上传到 OSS
      console.log(`[AsrStep] 正在上传音频文件到 OSS: ${context.ttsLocalPath}`);

      if (!ossUtil.isInitialized()) {
        return { success: false, error: 'OSS 未初始化，无法上传音频文件', pointsUsed: 0 };
      }

      const uploadResult = await ossUtil.uploadFile(context.ttsLocalPath);

      if (!uploadResult.success) {
        return { success: false, error: `上传音频文件失败: ${uploadResult.error}`, pointsUsed: 0 };
      }

      // 使用内网签名 URL（OSS 和百炼同在北京区域，走内网更快且免费）
      const audioInternalUrl = ossUtil.generateSignedInternalUrl(uploadResult.name);
      console.log(`[AsrStep] 音频文件上传成功，使用内网 URL: ${audioInternalUrl.substring(0, 100)}...`);

      // 使用内网 URL 进行语音识别（私有 bucket 需要签名 URL）
      // TTS 生成的音频一定有人声，若 ASR 返回 HAVE_NO_WORDS 视为服务端偶发问题，自动重试
      const MAX_ATTEMPTS = 2;
      let result = await bailianAudioUtil.recognizeSpeechFromUrls([audioInternalUrl]);

      if (!result.success && result.error && result.error.includes('ASR_RESPONSE_HAVE_NO_WORDS')) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          console.warn(`[AsrStep] ASR 未识别到语音内容（第${attempt}次），重新上传并重试...`);

          // 重新上传获取新的签名 URL（排除 URL 过期/损坏的可能）
          const reUploadResult = await ossUtil.uploadFile(context.ttsLocalPath);
          if (!reUploadResult.success) {
            console.warn(`[AsrStep] 重新上传失败: ${reUploadResult.error}`);
            continue;
          }

          const reInternalUrl = ossUtil.generateSignedInternalUrl(reUploadResult.name);
          result = await bailianAudioUtil.recognizeSpeechFromUrls([reInternalUrl]);
          if (result.success || !result.error?.includes('ASR_RESPONSE_HAVE_NO_WORDS')) {
            break;
          }
        }
      }

      if (!result.success) {
        // 重试后仍然失败
        if (result.error && result.error.includes('ASR_RESPONSE_HAVE_NO_WORDS')) {
          console.warn(`[AsrStep] ASR 多次重试仍未识别到语音内容，将使用空文案继续执行`);
          const simplifiedSentences: SimplifiedSentence[] = [];
          //dumpJson('asr_simplified.json', simplifiedSentences);
          return {
            success: true,
            data: {
              asr_content: simplifiedSentences,
            },
            pointsUsed: 0,
          };
        }
        return { success: false, error: result.error || '语音识别失败', pointsUsed: 0 };
      }

      // 计算积分（使用语音内容时长，用于计费）
      const contentDuration = (result.contentDuration || 0) / 1000; // 转换为秒
      const pointsUsed = calculateAsrPointsByDuration(contentDuration);

      console.log(`[AsrStep] 音频文案提取成功，句子数: ${result.sentences?.length || 0}，语音时长: ${contentDuration} ms，积分: ${pointsUsed}`);

      // 提取简化后的短句数据（移除标点符号，时长超过2.5s的句子拆分为子短句）
      const simplifiedSentences = this.processSentences(result.sentences || [], result.contentDuration || 0);

      // 保存简化后的 ASR 数据到本地 JSON 文件
      // dumpJson('asr_simplified.json', simplifiedSentences);

      // 扣除积分
      await deductPointsForStep(context, pointsUsed, 'AsrStep');

      return {
        success: true,
        data: {
          asr_content: simplifiedSentences,
        },
        pointsUsed,
      };
    } catch (error: any) {
      console.error('[AsrStep] 执行失败:', error);
      return { success: false, error: error.message || '未知错误', pointsUsed: 0 };
    }
  }

  /**
   * 处理句子列表：移除标点符号，拆分长句
   */
  private processSentences(sentences: AsrSentence[], audioDuration: number): SimplifiedSentence[] {

    let video_begin_time = 0;
    const sentences_len = sentences.length;
    const modifySentences = sentences.map((sentence, index) => {
      // 移除标点符号
      const textWithoutPunctuation = this.removePunctuation(sentence.text);
      const duration = sentence.end_time - sentence.begin_time;

      const result: SimplifiedSentence = {
        text: textWithoutPunctuation,
        begin_time: sentence.begin_time,
        end_time: sentence.end_time,
        sentence_id: sentence.sentence_id || index + 1,
        video_begin_time: video_begin_time,
        video_end_time: index + 1 < sentences_len ? sentences[index + 1].begin_time : sentence.end_time
      };

      video_begin_time = index + 1 < sentences_len ? sentences[index + 1].begin_time : audioDuration;

      // 根据时长决定拆分数量
      if (duration > VERY_LONG_SENTENCE_THRESHOLD && sentence.words && sentence.words.length >= 3) {
        // 超过6s，拆分为3个子短句
        result.child = this.splitSentenceIntoChildren(sentence, 3);
      } else if (duration > LONG_SENTENCE_THRESHOLD && sentence.words && sentence.words.length >= 2) {
        // 超过2.5s，拆分为2个子短句
        result.child = this.splitSentenceIntoChildren(sentence, 2);
      }

      return result;
    });

    const _len = modifySentences.length;
    modifySentences[_len - 1].video_end_time = modifySentences[_len - 1].video_end_time + 300;

    return modifySentences;
  }

  /**
   * 移除标点符号
   */
  private removePunctuation(text: string): string {
    // 常见中英文标点符号
    const punctuationRegex = /[，。！？、；：""''（）【】《》\.,!?;:'"\(\)\[\]<>]/g;
    return text.replace(punctuationRegex, '');
  }

  /**
   * 将长句拆分为指定数量的子短句
   * @param sentence 原始句子
   * @param parts 拆分数量（2或3）
   */
  private splitSentenceIntoChildren(sentence: AsrSentence, parts: number): ChildSentence[] {
    if (!sentence.words || sentence.words.length < parts) {
      return [];
    }

    const words = sentence.words;
    const totalDuration = sentence.end_time - sentence.begin_time;
    const children: ChildSentence[] = [];

    // 计算每个部分的理想时长
    const partDuration = totalDuration / parts;

    // 找到分割点
    const splitIndices: number[] = [];
    for (let p = 1; p < parts; p++) {
      const targetTime = sentence.begin_time + partDuration * p;
      let closestIndex = 0;
      let minDiff = Infinity;

      for (let i = 0; i < words.length; i++) {
        const wordMidTime = (words[i].begin_time + words[i].end_time) / 2;
        const diff = Math.abs(wordMidTime - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }

      // 确保分割点不重复且有效
      if (closestIndex > 0 && !splitIndices.includes(closestIndex)) {
        splitIndices.push(closestIndex);
      } else {
        // 找一个合适的备用分割点
        for (let i = 1; i < words.length - 1; i++) {
          if (!splitIndices.includes(i)) {
            splitIndices.push(i);
            break;
          }
        }
      }
    }

    // 排序分割点
    splitIndices.sort((a, b) => a - b);

    // 添加边界
    const boundaries = [-1, ...splitIndices, words.length - 1];

    // 创建子短句
    for (let i = 0; i < boundaries.length - 1; i++) {
      const startIdx = boundaries[i] + 1;
      const endIdx = boundaries[i + 1];

      if (startIdx <= endIdx) {
        const partWords = words.slice(startIdx, endIdx + 1);
        const partText = this.removePunctuation(
          partWords.map((w: AsrWord) => w.text).join('')
        );

        if (partText && partWords.length > 0) {
          children.push({
            text: partText,
            begin_time: partWords[0].begin_time,
            end_time: partWords[partWords.length - 1].end_time,
            sentence_id: i + 1,
          });
        }
      }
    }

    return children;
  }

  /**
   * 断点续传检查
   * 如果已有 ASR 结果，可以跳过
   */
  canSkip(context: TextToVideoContext, taskRecord: any): boolean {
    // 必须有 TTS 文件才能跳过
    if (!context.ttsLocalPath) {
      return false;
    }
    // 检查是否有有效的 ASR 结果（现在是数组格式）
    if (taskRecord.asr_content) {
      try {
        const asrContent = JSON.parse(taskRecord.asr_content);
        return Array.isArray(asrContent) && asrContent.length > 0;
      } catch {
        return false;
      }
    }
    return false;
  }
}
