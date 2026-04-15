/**
 * 积分转换工具
 * 将 Token 消耗转换为积分
 * 支持阿里云阶梯定价模型
 */

import { tokenConfigUtil, ModelPriceTier } from '../core';

/**
 * 模型类型
 */
export type ModelType = 'default' | 'tts' | 'asr' | 'vlm' | 'llm';

/**
 * 视频分析任务类型
 */
export type VideoAnalysisType = 'scene_segmentation' | 'keyword_extraction';

/**
 * 积分转换配置
 */
const POINTS_CONFIG: Record<ModelType, { rate: number; basePoints: number }> = {
  default: { rate: 1000, basePoints: 0 },
  tts: { rate: 100, basePoints: 1 },      // 语音合成：每100 token = 1积分，最低1积分
  asr: { rate: 100, basePoints: 1 },      // 语音识别：每100 token = 1积分，最低1积分
  vlm: { rate: 500, basePoints: 1 },      // 视觉语言模型：每500 token = 1积分
  llm: { rate: 1000, basePoints: 1 },     // 大语言模型：每1000 token = 1积分
};

/**
 * 语音合成的模型列表及对应的价格
 */
const COSY_VOICE_LIST = [
    {
        "model_name": "cosyvoice-v3.5-plus",  // 模型名称
        "price": 150,  // 模型价格：每万字符的输入单价（单位：分）
        "desc": "cosyvoice-v3.5-plus"  // 模型名称描述
    },
    {
        "model_name": "cosyvoice-v3.5-flash",
        "price": 80,
        "desc": "cosyvoice-v3.5-flash"
    },
    {
        "model_name": "cosyvoice-v3-plus",
        "price": 200,
        "desc": "cosyvoice-v3-plus"
    },
    {
        "model_name": "cosyvoice-v3-flash",
        "price": 100,
        "desc": "cosyvoice-v3-flash"
    },
    {
        "model_name": "cosyvoice-v2",
        "price": 200,
        "desc": "cosyvoice-v2"
    },
    {
        "model_name": "cosyvoice-v1",
        "price": 200,
        "desc": "cosyvoice-v1"
    }
]

/**
 * 默认 TTS 模型价格（当模型未匹配时使用）
 */
const DEFAULT_TTS_PRICE = 150; // 每万字符 150 分

/**
 * 视频分析 Token 消耗配置
 */
const VIDEO_ANALYSIS_CONFIG = {
  /** 视频 token 转换率：每秒视频对应的 token 数 */
  VIDEO_TOKENS_PER_SECOND: 610,
  /** 固定文本提示词 token 数 */
  FIXED_TEXT_TOKENS: 220,

  /** 场景分割配置 */
  SCENE_SEGMENTATION: {
    /** 基础输出 token（用于短视频） */
    BASE_COMPLETION_TOKENS: 800,
    /** 每秒视频额外增加的输出 token */
    COMPLETION_TOKENS_PER_SECOND: 130,
    /** 最大输出 token 限制 */
    MAX_COMPLETION_TOKENS: 8000,
  },

  /** 关键词提取配置 */
  KEYWORD_EXTRACTION: {
    /** 固定预估输出 token（短视频，推理复杂） */
    ESTIMATED_COMPLETION_TOKENS: 3500,
  },
} as const;

/**
 * 将 Token 消耗转换为积分（自动应用 20% 上浮）
 * @param promptTokens 输入 token 数
 * @param completionTokens 输出 token 数
 * @param modelType 模型类型
 * @returns 积分数（含 20% 上浮）
 */
export function convertTokensToPoints(
  promptTokens: number,
  completionTokens: number,
  modelType: ModelType = 'default'
): number {
  const config = POINTS_CONFIG[modelType] || POINTS_CONFIG.default;
  const total = promptTokens + completionTokens;

  if (total === 0) {
    return 0;
  }

  const basePoints = Math.ceil(total / config.rate);
  const points = Math.max(basePoints, config.basePoints);
  return applyPointsMarkup(points);
}

/**
 * 根据模型名称获取 TTS 价格（每万字符的单价，单位：分）
 * @param modelName 模型名称
 * @returns 价格（分/万字符）
 */
export function getTtsPriceByModel(modelName: string): number {
  const model = COSY_VOICE_LIST.find(m => m.model_name === modelName);
  return model?.price || DEFAULT_TTS_PRICE;
}

/**
 * 根据字符数和模型计算 TTS 积分（自动应用 20% 上浮）
 * @param characterCount 输入文本的字符数
 * @param modelName 模型名称（默认使用 cosyvoice-v3.5-plus）
 * @returns 积分数（含 20% 上浮，最小单位 0.5）
 */
export function calculateTtsPointsByCharacters(
  characterCount: number,
  modelName: string = 'cosyvoice-v3.5-plus'
): number {
  if (characterCount <= 0) {
    return 0;
  }

  // 获取模型价格（每万字符的分）
  const pricePerTenThousand = getTtsPriceByModel(modelName);

  // 计算实际费用（分）：字符数 / 10000 * 每万字符价格
  const costInCents = (characterCount / 10000) * pricePerTenThousand;

  // 分转积分：1 分 = 1 积分，应用 20% 上浮
  const points = applyPointsMarkup(costInCents);

  // 最低 0.5 积分
  return Math.max(0.5, points);
}

/**
 * 根据音频时长计算积分（用于语音合成，自动应用 20% 上浮）
 * @deprecated 请使用 calculateTtsPointsByCharacters 基于字符数计算
 * @param durationSeconds 音频时长（秒）
 * @returns 积分数（含 20% 上浮）
 */
export function calculateTtsPointsByDuration(durationSeconds: number): number {
  // 语音合成按时长计费：每10秒 = 1积分，应用 20% 上浮
  const basePoints = Math.ceil(durationSeconds / 10);
  return applyPointsMarkup(basePoints);
}

/**
 * 根据音频时长计算积分（用于语音识别，不需要上浮处理）
 * @param durationSeconds 音频时长（秒）
 * @returns 积分数
 */
export function calculateAsrPointsByDuration(durationSeconds: number): number {
  // 语音识别按时长计费：每30秒 = 1积分，应用 20% 上浮
  const basePoints = Math.ceil(durationSeconds / 30);
  return basePoints;
}

/**
 * 在指定范围内生成随机整数（包含边界）
 * @param min 最小值
 * @param max 最大值
 * @returns 随机整数
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 计算视频匹配积分（自动应用 20% 上浮）
 * @param videoDuration 视频持续时长（微秒）
 * @returns 积分数（含 20% 上浮）
 */
export function calculateVideoMatchPoints(videoDuration: number): number {
  // 微秒转秒
  const durationSeconds = Math.ceil(videoDuration / 1000000);

  if (durationSeconds <= 0) {
    return 0;
  }

  // 根据视频时长范围返回基础积分
  let basePoints: number;

  // 5s及以内消耗2积分
  if (durationSeconds <= 5) {
    basePoints = 2;
  }
  // 10s及以内消耗3或4积分
  else if (durationSeconds <= 10) {
    basePoints = randomInt(3, 4);
  }
  // 20s及以内消耗5或6积分
  else if (durationSeconds <= 20) {
    basePoints = randomInt(5, 6);
  }
  // 30s及以内消耗7或8积分
  else if (durationSeconds <= 30) {
    basePoints = randomInt(7, 8);
  }
  // 40s及以内消耗9或10积分
  else if (durationSeconds <= 40) {
    basePoints = randomInt(9, 10);
  }
  // 50s及以内消耗11或12积分
  else if (durationSeconds <= 50) {
    basePoints = randomInt(11, 12);
  }
  // 60s及以内消耗13或14积分
  else if (durationSeconds <= 60) {
    basePoints = randomInt(13, 14);
  }
  // 70s及以内消耗15或16积分
  else if (durationSeconds <= 70) {
    basePoints = randomInt(15, 16);
  }
  // 90s及以内消耗18或19或20积分
  else if (durationSeconds <= 90) {
    basePoints = randomInt(18, 20);
  }
  // 120s及以内消耗23或24或25或26积分
  else if (durationSeconds <= 120) {
    basePoints = randomInt(23, 26);
  }
  // 150s及以内消耗29或30或31或32积分
  else if (durationSeconds <= 150) {
    basePoints = randomInt(29, 32);
  }
  // 150s以上消耗35或36或37或38或39或40积分
  else {
    basePoints = randomInt(35, 40);
  }

  // 应用 20% 上浮
  return applyPointsMarkup(basePoints);
}

// ===== 积分扣除接口 =====

import { tokenApiUtil, TaskType, TaskStatus } from '../core';
import { TextToVideoContext } from './context';

/**
 * 扣除积分的通用方法
 * @param context 执行上下文
 * @param pointsUsed 消耗的积分
 * @param stepName 步骤名称（用于日志）
 */
export async function deductPointsForStep(
  context: TextToVideoContext,
  pointsUsed: number,
  stepName: string
): Promise<void> {
  if (!context.apiToken || pointsUsed <= 0) {
    return;
  }

  try {
    const deductResult = await tokenApiUtil.deductPointsAuto(
      context.apiToken,
      pointsUsed,
      TaskType.GENERAL,
      String(context.taskId),
      TaskStatus.SUCCESS
    );

    if (!deductResult.success) {
      console.warn(`[${stepName}] 积分扣除失败: ${deductResult.error}`);
    } else {
      console.log(`[${stepName}] 积分扣除成功，剩余: ${deductResult.remainingPoints}`);
    }
  } catch (deductError: any) {
    console.error(`[${stepName}] 积分扣除异常: ${deductError.message}`);
  }
}

// ===== 阿里云阶梯定价计算 =====

/**
 * 根据价格档位计算实际费用（单位：分）
 * 符合阿里云阶梯定价模型
 * @param promptTokens 输入 token 数
 * @param completionTokens 输出 token 数
 * @param priceTiers 价格档位列表
 * @returns 费用（分）
 */
export function calculateCostByPriceTiers(
  promptTokens: number,
  completionTokens: number,
  priceTiers: ModelPriceTier[]
): number {
  if (!priceTiers || priceTiers.length === 0) {
    return 0;
  }

  // 根据输入 token 数匹配档位
  const matchedTier = priceTiers.find(
    tier => promptTokens >= tier.input_min_tokens && promptTokens <= tier.input_max_tokens
  ) || priceTiers[priceTiers.length - 1]; // 未匹配时使用最后一个档位

  // 分别计算输入和输出费用（输出价格通常是输入的6倍）
  const inputCost = (promptTokens / 1000000) * matchedTier.input_price_per_million;  // 分
  const outputCost = (completionTokens / 1000000) * matchedTier.output_price_per_million;  // 分

  return inputCost + outputCost;
}

/**
 * 积分上浮比例（在实际消耗基础上增加 20%）
 */
const POINTS_MARKUP_RATE = 1.2;

/**
 * 将数值向上取整到指定精度
 * @param value 原始值
 * @param precision 精度（0.5 表示最小单位为 0.5）
 * @returns 取整后的值
 */
function ceilToPrecision(value: number, precision: number): number {
  return Math.ceil(value / precision) * precision;
}

/**
 * 应用积分上浮（20%）
 * @param points 原始积分数
 * @returns 上浮后的积分数（最小单位 0.5）
 */
function applyPointsMarkup(points: number): number {
  if (points <= 0) return 0;
  return ceilToPrecision(points * POINTS_MARKUP_RATE, 0.5);
}

/**
 * 将费用（元）转换为积分
 * @param cost 费用（分）
 * @param exchangeRate 汇率（默认 100，即 1 元 = 100 积分）
 * @param applyMarkup 是否应用上浮（默认 true）
 * @returns 积分数（最小单位 0.5）
 */
export function convertCostToPoints(cost: number, exchangeRate: number = 100, applyMarkup: boolean = true): number {
  if (cost <= 0) return 0;
  const basePoints = (cost / 100) * exchangeRate;
  const finalPoints = applyMarkup ? basePoints * POINTS_MARKUP_RATE : basePoints;
  return ceilToPrecision(finalPoints, 0.5);
}

/**
 * 增强版积分计算（优先使用阶梯定价，fallback 到固定转换率）
 * @param promptTokens 输入 token 数
 * @param completionTokens 输出 token 数
 * @param modelType 模型类型（fallback 用）
 * @returns 积分数
 */
export async function calculatePointsEnhanced(
  promptTokens: number,
  completionTokens: number,
  modelType: ModelType = 'default'
): Promise<number> {
  try {
    // 尝试从服务端获取价格档位
    const priceTiers = await tokenConfigUtil.getModelPriceTiers();

    if (priceTiers && priceTiers.length > 0) {
      // 使用阶梯定价计算
      const cost = calculateCostByPriceTiers(promptTokens, completionTokens, priceTiers);
      const points = convertCostToPoints(cost);
      console.log(`[Points] 阶梯定价: input=${promptTokens}, output=${completionTokens} → ${cost.toFixed(4)}分 → ${points}积分（含20%上浮）`);
      return Math.max(0.5, points); // 最低 0.5 积分
    }
  } catch (error: any) {
    console.warn(`[Points] 获取价格档位失败，使用固定转换率: ${error.message}`);
  }

  // Fallback 到固定转换率（convertTokensToPoints 已包含 20% 上浮）
  const fallbackPoints = convertTokensToPoints(promptTokens, completionTokens, modelType);
  console.log(`[Points] 固定转换率: input=${promptTokens}, output=${completionTokens} → ${fallbackPoints}积分（含20%上浮）`);
  return fallbackPoints;
}

// ===== 视频分析积分计算 =====

/**
 * 根据视频时长和任务类型预估 token 消耗
 * @param videoDurationSeconds 视频时长（秒）
 * @param analysisType 分析类型
 * @returns 预估的 prompt 和 completion token 数
 */
export function estimateVideoAnalysisTokens(
  videoDurationSeconds: number,
  analysisType: VideoAnalysisType
): { promptTokens: number; completionTokens: number } {
  // 视频 token（两种类型相同）
  const videoTokens = Math.ceil(videoDurationSeconds * VIDEO_ANALYSIS_CONFIG.VIDEO_TOKENS_PER_SECOND);
  const promptTokens = videoTokens + VIDEO_ANALYSIS_CONFIG.FIXED_TEXT_TOKENS;

  let completionTokens: number;

  if (analysisType === 'scene_segmentation') {
    // 场景分割：输出随视频时长增长
    const { BASE_COMPLETION_TOKENS, COMPLETION_TOKENS_PER_SECOND, MAX_COMPLETION_TOKENS } =
      VIDEO_ANALYSIS_CONFIG.SCENE_SEGMENTATION;
    completionTokens = Math.min(
      BASE_COMPLETION_TOKENS + Math.ceil(videoDurationSeconds * COMPLETION_TOKENS_PER_SECOND),
      MAX_COMPLETION_TOKENS
    );
  } else {
    // 关键词提取：固定较高值（推理复杂）
    completionTokens = VIDEO_ANALYSIS_CONFIG.KEYWORD_EXTRACTION.ESTIMATED_COMPLETION_TOKENS;
  }

  return { promptTokens, completionTokens };
}

/**
 * 计算视频分析预扣除积分
 * @param videoDurationSeconds 视频时长（秒）
 * @param analysisType 分析类型：'scene_segmentation' | 'keyword_extraction'
 * @returns 预估积分数
 */
export async function calculateVideoAnalysisPoints(
  videoDurationSeconds: number,
  analysisType: VideoAnalysisType
): Promise<number> {
  if (videoDurationSeconds <= 0) {
    return 0;
  }

  const { promptTokens, completionTokens } = estimateVideoAnalysisTokens(
    videoDurationSeconds,
    analysisType
  );

  // 使用已有的阶梯定价计算（含 20% 上浮）
  const points = await calculatePointsEnhanced(
    promptTokens,
    completionTokens,
    'vlm'
  );

  console.log(
    `[VideoAnalysis] ${analysisType}: 时长=${videoDurationSeconds}s, ` +
    `prompt=${promptTokens}, completion=${completionTokens} → ${points}积分`
  );

  return points;
}

/**
 * 根据实际 token 使用量计算积分（用于结算）
 * @param promptTokens 实际输入 token 数
 * @param completionTokens 实际输出 token 数
 * @returns 积分数（含 20% 上浮）
 */
export async function calculatePointsFromActualUsage(
  promptTokens: number,
  completionTokens: number
): Promise<number> {
  if (promptTokens <= 0 && completionTokens <= 0) {
    return 0;
  }

  // 使用已有的阶梯定价计算（含 20% 上浮）
  const points = await calculatePointsEnhanced(
    promptTokens,
    completionTokens,
    'vlm'
  );

  console.log(
    `[VideoAnalysis] 实际消耗: prompt=${promptTokens}, completion=${completionTokens} → ${points}积分`
  );

  return points;
}

/**
 * 积分结算结果
 */
export interface PointsSettlementResult {
  /** 实际消耗的积分 */
  actualPoints: number;
  /** 预扣除的积分 */
  preDeductedPoints: number;
  /** 需要补扣的积分（正数表示需要补扣，负数表示需要退还） */
  difference: number;
  /** 结算类型 */
  settlementType: 'refund' | 'charge' | 'exact';
}

/**
 * 计算积分结算（多退少补）
 * @param preDeductedPoints 预扣除的积分
 * @param actualPromptTokens 实际输入 token 数
 * @param actualCompletionTokens 实际输出 token 数
 * @returns 结算结果
 */
export async function calculatePointsSettlement(
  preDeductedPoints: number,
  actualPromptTokens: number,
  actualCompletionTokens: number
): Promise<PointsSettlementResult> {
  // 计算实际消耗的积分
  const actualPoints = await calculatePointsFromActualUsage(
    actualPromptTokens,
    actualCompletionTokens
  );

  // 计算差额（实际 - 预扣）
  const difference = actualPoints - preDeductedPoints;

  // 判断结算类型
  let settlementType: 'refund' | 'charge' | 'exact';
  if (Math.abs(difference) < 0.01) {
    // 差额小于 0.01 视为精确匹配
    settlementType = 'exact';
  } else if (difference < 0) {
    // 实际消耗 < 预扣，需要退还
    settlementType = 'refund';
  } else {
    // 实际消耗 > 预扣，需要补扣
    settlementType = 'charge';
  }

  console.log(
    `[VideoAnalysis] 结算: 预扣=${preDeductedPoints}, 实际=${actualPoints}, ` +
    `差额=${difference.toFixed(2)}, 类型=${settlementType}`
  );

  return {
    actualPoints,
    preDeductedPoints,
    difference,
    settlementType,
  };
}
