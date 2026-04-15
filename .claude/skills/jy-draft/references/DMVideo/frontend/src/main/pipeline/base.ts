/**
 * 管道步骤基类
 * 定义所有处理步骤的通用接口和行为
 */

import { TextToVideoContext } from './context';

/**
 * 步骤执行结果
 */
export interface StepResult {
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: Record<string, any>;
  /** 错误信息 */
  error?: string;
  /** 消耗的积分 */
  pointsUsed: number;
}

/**
 * 管道步骤抽象基类
 */
export abstract class PipelineStep {
  /**
   * 步骤名称（用于显示）
   */
  abstract get name(): string;

  /**
   * 步骤键名（用于数据库存储和断点续传判断）
   */
  abstract get stepKey(): string;

  /**
   * 执行步骤
   * @param context 执行上下文
   * @returns 执行结果
   */
  abstract execute(context: TextToVideoContext): Promise<StepResult>;

  /**
   * 断点续传：检查是否可跳过
   * 如果数据库中已有该步骤的结果，则跳过
   * @param context 执行上下文
   * @param taskRecord 任务记录（从数据库查询）
   */
  canSkip(context: TextToVideoContext, taskRecord: any): boolean {
    const stepData = taskRecord[this.stepKey];
    return stepData != null && stepData !== '' && stepData !== undefined;
  }

  /**
   * 步骤执行前的钩子
   */
  async beforeExecute?(context: TextToVideoContext): Promise<void>;

  /**
   * 步骤执行后的钩子
   */
  async afterExecute?(context: TextToVideoContext, result: StepResult): Promise<void>;
}

/**
 * 步骤状态
 */
export type StepStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

/**
 * 步骤进度信息
 */
export interface StepProgress {
  /** 步骤名称 */
  stepName: string;
  /** 步骤键名 */
  stepKey: string;
  /** 状态 */
  status: StepStatus;
  /** 返回数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
  /** 时间戳 */
  timestamp: number;
}