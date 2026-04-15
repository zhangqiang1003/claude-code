/**
 * 关键词绑定步骤
 * 使用大模型将文案句子与关键词匹配
 */

import { PipelineStep, StepResult } from "../base";
import {
  TextToVideoContext,
  ShortSentence,
  RecordInfo,
  AsrSentence,
  SimplifiedSentence,
} from "../context";
import { bailianUtil, dumpJson } from "../../core";
import { calculatePointsEnhanced, deductPointsForStep } from "../points";

/**
 * 关键词绑定步骤
 */
export class KeywordBindStep extends PipelineStep {
  /** 存储传入的关键词列表，用于后续验证 */
  private inputKeywordsSet: Set<string> = new Set();
  get name(): string {
    return "关键词绑定";
  }

  get stepKey(): string {
    return "short_sentences";
  }

  async execute(context: TextToVideoContext): Promise<StepResult> {
    console.log(`[KeywordBindStep] 开始执行`);

    // 检查依赖
    if (
      !context.asrContent ||
      !context.asrContent.sentences ||
      context.asrContent.sentences.length === 0
    ) {
      return {
        success: false,
        error: "ASR 结果为空，请先执行音频文案提取",
        pointsUsed: 0,
      };
    }

    if (!context.keywords || context.keywords.length === 0) {
      return {
        success: false,
        error: "关键词列表为空，请先执行关键词查询",
        pointsUsed: 0,
      };
    }

    try {

      // 获取上一步的视频信息（从上一步传递）
      const videoInfoMap = (context as any)._videoInfoMap || new Map<number, any>();
      console.log(
        `[KeywordBindStep] videoInfoMap 数量: ${videoInfoMap.size}`,
      );
      console.log(
        `[KeywordBindStep] videoInfoMap 内容: ${JSON.stringify(Array.from(videoInfoMap.entries()).slice(0, 3))}`,
      );

      // const videoMap = new Map<
      //   number,
      //   { keywords: string[]; duration: number; useCount: number }
      // >();
      // for (const item of videoInfoMap) {
      //   videoMap.set(item.videoId, {
      //     keywords: item.keywords,
      //     duration: item.duration,
      //     useCount: item.useCount,
      //   });
      // }

      const videoMap: Map<number, {
        videoId: number;
        keywords: string[];
        duration: number;
        useCount: number;
        filePath: string;
        fileName: string;
        width: number;
        height: number;
        size: number;
        format: string;
        provinceIds: string;
        cityIds: string;
        placeNames: string;
      }> = videoInfoMap; // 直接使用 videoInfoMap，假设它已经包含了 keywords、duration 和 useCount 信息

      console.log(`[KeywordBindStep] videoMap 大小: ${videoMap.size}`);
      // 打印 videoMap 的关键词信息
      for (const [videoId, info] of Array.from(videoMap.entries()).slice(
        0,
        3,
      )) {
        console.log(
          `[KeywordBindStep] videoMap[${videoId}]: keywords=${JSON.stringify(info.keywords)} useCount=${info.useCount} fileName=${info.fileName} duration=${info.duration}`,
        );
      }

      // 构建大模型提示词
      const rewrite = context.textContent; // 文案全文
      const sentences = context.asrContent.sentences;
      const keywordsList = context.keywords; // 限制关键词数量

      //dumpJson("asr_conent.json", sentences)

      // ==================== 详细日志：记录传入的关键词（入参） ====================
      console.log(`[KeywordBindStep] ========== 入参关键词列表 ==========`);
      console.log(`[KeywordBindStep] 入参关键词数量: ${keywordsList.length}`);

      // 保存入参关键词到成员变量，用于后续验证
      this.inputKeywordsSet = new Set(
        keywordsList.map((k) => k.toLowerCase().trim()),
      );

      const promptSentences: AsrSentence[] = [];

      sentences.forEach(item => {
        const {text, video_begin_time, video_end_time} = item;
        const _: AsrSentence = {
          text,
          begin_time: video_begin_time,
          end_time: video_end_time
        }

        promptSentences.push(_);
      })

      const prompt = this.buildPrompt(rewrite, promptSentences, keywordsList);

      // ==================== 详细日志：记录发送给大模型的完整 Prompt ====================
      console.log(
        `[KeywordBindStep] ========== 发送给大模型的 Prompt ==========`,
      );
      console.log(`[KeywordBindStep] System Prompt: ${this.getSystemPrompt()}`);
      console.log(`[KeywordBindStep] User Prompt 长度: ${prompt.length} 字符`);
      console.log(`[KeywordBindStep] User Prompt 完整内容:\n${prompt}`);
      console.log(`[KeywordBindStep] ========================================`);

      // 调用大模型
      console.log(`[KeywordBindStep] 开始调用大模型...`);
      console.log(
        `[KeywordBindStep] 调用参数: temperature=0.1, maxTokens=4096, model=qwen3.5-plus`,
      );
      const result = await bailianUtil.chat(prompt, this.getSystemPrompt(), {
        temperature: 0.1, // 降低温度，让输出更确定性
        maxTokens: 4096,
        model: "qwen3.5-plus", // 使用更适合文本任务的模型
      });
      console.log(
        `[KeywordBindStep] 大模型调用完成，success=${result.success}`,
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "大模型调用失败",
          pointsUsed: 0,
        };
      }

      // 打印大模型返回的原始内容
      console.log(
        `[KeywordBindStep] 大模型返回内容长度: ${result.content?.length || 0}`,
      );
      console.log(
        `[KeywordBindStep] 大模型返回内容: ${result.content}`,
      );

      // 解析结果
      const shortSentences = this.parseResult(
        result.content || "",
        sentences,
        videoMap,
        keywordsList,
      );

      if (shortSentences.length === 0) {
        return { success: false, error: "关键词绑定结果为空", pointsUsed: 0 };
      }

      // 计算积分（使用增强版阶梯定价）
      const pointsUsed = await calculatePointsEnhanced(
        result.usage?.promptTokens || 0,
        result.usage?.completionTokens || 0,
        "llm"
      );

      console.log(
        `[KeywordBindStep] 关键词绑定成功，句子数: ${shortSentences.length}，积分: ${pointsUsed}`,
      );

      // 扣除积分
      await deductPointsForStep(context, pointsUsed, 'KeywordBindStep');

      return {
        success: true,
        data: {
          short_sentences: shortSentences,
          keywords_bind_used_points: pointsUsed,
        },
        pointsUsed,
      };
    } catch (error: any) {
      console.error("[KeywordBindStep] 执行失败:", error);
      return {
        success: false,
        error: error.message || "未知错误",
        pointsUsed: 0,
      };
    }
  }

  /**
   * 构建提示词
   */
  private buildPrompt(
    rewrite: string,
    sentences: AsrSentence[],
    keywords: string[],
  ): string {
    const sentencesText = sentences
      .map((s, index) => `短句${index + 1}: ${s.text}`)
      .join("\n");

    const keywordsText = JSON.stringify(keywords);

    return `## 任务
为每句字幕从【关键词列表】中选择3-5个最匹配的关键词。

## 文案全文
${rewrite}

## 字幕信息
${sentencesText}

## 关键词列表（必须从中选择，共${keywords.length}个）
${keywordsText}

## 输出格式
[{"text":"<短句内容>","keywords":"<关键词1>,<关键词2>,<关键词3>,<关键词4>,<关键词5>","sentence_id":<短句序号>},...]

## 严格限制
1. 【绝对禁止】创造、修改、组合、扩展任何关键词
2. 【必须】关键词必须从【关键词列表】中**原样选择**，一个字都不能改
3. 【必须】仅返回JSON数组，不要任何解释说明

## 正确示例
假设关键词列表是：["旅行", "美食", "酒店", "度假"]
- 正确：{"keywords": "旅行,美食,酒店"}  （完全来自列表）
- 错误：{"keywords": "旅行住宿,美食探店,度假村"}  （自行扩展了关键词）

## 现在请为每句字幕选择关键词：`;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `你是文案分析专家，擅长从用户指定的关键词列表中为每句话选择最匹配的关键词。

核心原则：
- 你必须且只能从用户提供的【关键词列表】中选择关键词
- 绝对禁止自行创造、修改、组合或扩展任何关键词
- 选中的关键词必须与列表中的关键词完全一致（字完全相同）
- 如果找不到合适的关键词，可以少选，但不能自创

错误示范（禁止）：
- 关键词列表有"旅行"，你返回"旅行住宿" 
- 关键词列表有"美食"，你返回"美食探店" 
- 关键词列表有"酒店"，你返回"度假酒店" 

正确做法：
- 关键词列表有"旅行"，你必须返回"旅行" 
- 关键词列表有"美食"，你必须返回"美食" `;
  }

  /**
   * 解析大模型返回结果
   */
  private parseResult(
    content: string,
    sentences: SimplifiedSentence[],
    videoMap: Map<
      number,
      {
        videoId: number;
        keywords: string[];
        duration: number;
        useCount: number;
        filePath: string;
        fileName: string;
        width: number;
        height: number;
        size: number;
        format: string;
        provinceIds: string;
        cityIds: string;
        placeNames: string;
      }
    >,
    keywords: string[],
  ): ShortSentence[] {
    try {
      console.log(
        `[KeywordBindStep] 开始解析结果，内容长度: ${content.length}`,
      );

      // 尝试提取 JSON 数组（使用贪婪匹配获取完整数组）
      let jsonStr = "";

      // 首先尝试找到第一个 [ 和最后一个 ]
      const firstBracket = content.indexOf("[");
      const lastBracket = content.lastIndexOf("]");

      if (
        firstBracket !== -1 &&
        lastBracket !== -1 &&
        lastBracket > firstBracket
      ) {
        jsonStr = content.substring(firstBracket, lastBracket + 1);
        console.log(
          `[KeywordBindStep] 提取到的JSON片段（前200字符）: ${jsonStr.substring(0, 200)}`,
        );
      } else {
        console.warn("[KeywordBindStep] 未找到JSON数组标记 [ ]");
        console.log(`[KeywordBindStep] 原始内容: ${content}`);
        return [];
      }

      // 尝试修复常见的 JSON 格式问题
      jsonStr = this.fixJsonString(jsonStr);

      let parsed: any[];
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError: any) {
        console.error("[KeywordBindStep] JSON解析失败:", parseError.message);

        // 尝试更激进的修复
        jsonStr = this.aggressiveFixJson(jsonStr);
        try {
          parsed = JSON.parse(jsonStr);
        } catch (secondError: any) {
          console.error(
            "[KeywordBindStep] 二次修复后仍然失败:",
            secondError.message,
          );
          return [];
        }
      }

      if (!Array.isArray(parsed)) {
        console.warn("[KeywordBindStep] 解析结果不是数组");
        return [];
      }

      console.log(`[KeywordBindStep] 成功解析到 ${parsed.length} 个结果项`);

      const result: ShortSentence[] = [];
      for (const item of parsed) {
        let sentenceId = item.sentence_id;
        let sentence: SimplifiedSentence | undefined;

        // 如果有 sentence_id，直接使用
        if (sentenceId !== undefined && sentenceId !== null) {
          sentence = sentences[sentenceId - 1];
        }

        // 如果没有找到句子，尝试通过 text 匹配
        if (!sentence && item.text) {
          const matchedIndex = sentences.findIndex(
            (s) => s.text.includes(item.text) || item.text.includes(s.text),
          );
          if (matchedIndex !== -1) {
            sentence = sentences[matchedIndex];
            sentenceId = matchedIndex + 1;
            console.log(
              `[KeywordBindStep] 通过文本匹配找到句子: "${item.text}" -> sentence_id: ${sentenceId}`,
            );
          }
        }

        if (!sentence) {
          console.warn(
            `[KeywordBindStep] 跳过无法匹配的项: text=${item.text}, sentence_id=${sentenceId}`,
          );
          continue;
        }

        // 找到关键词对应的视频记录
        const matchedKeywordStr0 = item.keywords || "";
        const matchedKeywordStr = matchedKeywordStr0.replace(/，/g, ","); // 替换中文逗号
        const matchedKeywords = matchedKeywordStr
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k);
        const recordIds: string[] = [];
        const recordInfos: RecordInfo[] = [];

        console.log(
          `[KeywordBindStep] sentence_id=${sentenceId}, LLM返回的关键词: ${JSON.stringify(matchedKeywords)}`,
        );

        // ==================== 验证：检查大模型返回的关键词是否在入参中 ====================
        const invalidKeywords: string[] = [];
        for (const keyword of matchedKeywords) {
          const keywordLower = keyword.toLowerCase();
          // 检查关键词是否在入参关键词列表中（忽略大小写）
          let foundInInput = false;

          if (this.inputKeywordsSet.has(keywordLower)) {
            foundInInput = true;
          }

          if (!foundInInput) {
            invalidKeywords.push(keyword);
            console.warn(
              `[KeywordBindStep] ⚠️ 关键词 "${keyword}" 不在入参关键词列表中！大模型可能自行创造了关键词`,
            );
          }
        }
        if (invalidKeywords.length > 0) {
          console.warn(
            `[KeywordBindStep] ⚠️⚠️⚠️ sentence_id=${sentenceId} 有 ${invalidKeywords.length} 个关键词不在入参中: ${JSON.stringify(invalidKeywords)}`,
          );
        }
        // ==================== 验证结束 ====================

        for (const keyword of matchedKeywords) {
          let foundMatch = false;

          if (keywords.includes(keyword)) {
            foundMatch = true;

            // 根据关键词反向关联源视频素材信息

            // 根据关键词反向关联源视频素材ID
            for (const [id, video] of videoMap.entries()) {
              const videoKeywords = video.keywords;

              if (videoKeywords.includes(keyword)) {
                if (!recordIds.includes(String(id))) {
                  recordIds.push(String(id));
                  recordInfos.push({
                    id,
                    keywords: keyword,
                    used_count: video.useCount,
                    video_duration: video.duration * 1000000, // 转换为微秒
                  });
                  console.log(
                    `[KeywordBindStep] 匹配成功: keyword="${keyword}" -> videoId=${id}`,
                  );
                }
              }
            }
          }

          if (!foundMatch) {
            console.warn(
              `[KeywordBindStep] 关键词 "${keyword}" 未匹配到任何视频`,
            );
          }
        }

        console.log(
          `[KeywordBindStep] sentence_id=${sentenceId}, 匹配到的 record_ids: ${JSON.stringify(recordIds)}`,
        );

        result.push({
          sentence_id: sentenceId,
          text: sentence.text,
          begin_time: sentence.begin_time * 1000, // 毫秒转微秒
          end_time: sentence.end_time * 1000,
          duration: (sentence.end_time - sentence.begin_time) * 1000,
          video_begin_time: sentence.video_begin_time * 1000,
          video_end_time: sentence.video_end_time * 1000,
          videoDuration: (sentence.video_end_time - sentence.video_begin_time) * 1000,
          keywords: matchedKeywords,
          record_ids: recordIds,
          record_infos: recordInfos,
        });
      }

      console.log(`[KeywordBindStep] 最终生成 ${result.length} 个短句`);
      return result;
    } catch (error: any) {
      console.error("[KeywordBindStep] 解析结果失败:", error);
      console.log(
        `[KeywordBindStep] 原始内容（前500字符）: ${content.substring(0, 500)}`,
      );
      return [];
    }
  }

  /**
   * 修复常见的 JSON 格式问题
   */
  private fixJsonString(jsonStr: string): string {
    // 移除可能存在的 markdown 代码块标记
    let fixed = jsonStr.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

    // 移除控制字符
    fixed = fixed.replace(/[\x00-\x1F\x7F]/g, (char) => {
      if (char === "\n" || char === "\r" || char === "\t") return char;
      return "";
    });

    // 修复末尾多余的逗号（数组中的）
    fixed = fixed.replace(/,\s*\]/g, "]");
    fixed = fixed.replace(/,\s*\}/g, "}");

    return fixed;
  }

  /**
   * 更激进的 JSON 修复
   */
  private aggressiveFixJson(jsonStr: string): string {
    let fixed = jsonStr;

    // 尝试修复未转义的引号（简单处理）
    // 这个比较危险，可能导致其他问题，所以只在二次尝试时使用

    // 修复中文引号
    fixed = fixed.replace(/[""]/g, '"');
    fixed = fixed.replace(/['']/g, "'");

    // 修复可能缺失的引号（属性名）
    fixed = fixed.replace(/\{\s*([^":]+)\s*:/g, '{ "$1":');
    fixed = fixed.replace(/,\s*([^":]+)\s*:/g, ', "$1":');

    console.log(
      `[KeywordBindStep] 激进修复后的JSON（前300字符）: ${fixed.substring(0, 300)}`,
    );
    return fixed;
  }
}
