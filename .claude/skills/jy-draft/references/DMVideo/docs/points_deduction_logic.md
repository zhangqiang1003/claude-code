# 积分消耗逻辑点梳理

> 更新时间：2026-04-07

本文档梳理了 `frontend` 模块中所有涉及积分消耗的业务逻辑点，包括已实现和待实现的积分扣除功能。

---

## 一、积分消耗架构

### 1.1 核心文件

| 文件路径 | 说明 |
|---------|------|
| `src/main/core/tokenApi.ts` | Token API 工具类，封装积分扣除接口 |
| `src/main/pipeline/points.ts` | 积分计算和扣除工具函数 |
| `src/main/pipeline/context.ts` | Pipeline 上下文，包含 `apiToken` 字段 |

### 1.2 积分扣除流程

```
1. 计算积分消耗值 (pointsUsed)
2. 调用 deductPointsForStep(context, pointsUsed, stepName)
3. 内部调用 tokenApiUtil.deductPointsAuto() 扣除积分
4. 记录日志，失败不中断流程
```

### 1.3 积分转换规则

| 消耗类型 | 转换规则 | 最低积分 |
|---------|---------|---------|
| TTS (语音合成) | 每 100 token = 1 积分 | 1 |
| ASR (语音识别) | 每 30 秒时长 = 1 积分 | 1 |
| VLM (视觉语言模型) | 每 500 token = 1 积分 | 1 |
| LLM (大语言模型) | 每 1000 token = 1 积分 | 1 |
| 视频匹配 | 每个句子 = 0.5 积分 | 1 |
| 草稿生成 | 基础 5 分 + 视频(+2) + 文本(+1) + 音频(+1) | 5 |

---

## 二、已实现积分扣除的模块

### 2.1 Pipeline Steps（管道步骤）

以下步骤在 `src/main/pipeline/steps/` 目录下，已正确实现积分扣除：

| 文件 | 步骤名称 | 积分计算规则 | 状态 |
|------|---------|-------------|------|
| `tts_step.ts` | 语音合成 (TTS) | 根据文案长度估算，每 10 秒约 1 积分 | ✅ 已实现 |
| `asr_step.ts` | 音频文案提取 (ASR) | 根据语音时长，每 30 秒 = 1 积分 | ✅ 已实现 |
| `keyword_bind_step.ts` | 关键词绑定 | LLM token 消耗转换，每 1000 token = 1 积分 | ✅ 已实现 |
| `video_match_step.ts` | 视频匹配 | 每个句子 = 0.5 积分，最低 1 积分 | ✅ 已实现 |
| `draft_populate_step.ts` | 素材准备 | 基础 5 分 + 附加项 | ✅ 已实现 |

### 2.2 实现代码示例

```typescript
// 在步骤执行成功后扣除积分
import { deductPointsForStep, convertTokensToPoints } from '../points';

// 计算积分
const pointsUsed = convertTokensToPoints(
  result.usage?.promptTokens || 0,
  result.usage?.completionTokens || 0,
  'llm'  // 或 'vlm', 'tts', 'asr'
);

// 扣除积分（失败不中断流程）
await deductPointsForStep(context, pointsUsed, 'StepName');
```

---

## 三、未实现积分扣除的模块

以下功能**消耗 VLM/LLM token** 但**只打印日志，没有调用积分扣除接口**。

### 3.1 视频分析功能

**文件位置**: `src/main/core/videoAnalysis.ts`

**IPC Handler 位置**: `src/main/ipc_handle/index.ts` → `registerVideoAnalysisHandlers()`

| IPC Handler | 调用方法 | 功能说明 | 返回 usage | 状态 |
|-------------|---------|---------|-----------|------|
| `video-analysis:analyze` | `analyzeVideo()` | 通用视频分析 | ✅ | ❌ 未扣除 |
| `video-analysis:extract-keywords` | `extractVideoKeywords()` | 提取视频关键词 | ✅ | ❌ 未扣除 |
| `video-analysis:summarize` | `summarizeVideo()` | 生成视频摘要 | ✅ | ❌ 未扣除 |
| `video-analysis:describe` | `describeVideo()` | 生成视频描述 | ✅ | ❌ 未扣除 |
| `video-analysis:custom-analyze` | `customAnalyzeVideo()` | 自定义视频分析 | ✅ | ❌ 未扣除 |
| `video-analysis:batch-extract-keywords` | `batchExtractKeywords()` | 批量提取关键词（串行） | ✅ | ❌ 未扣除 |
| `video-analysis:batch-extract-keywords-concurrent` | `batchExtractKeywordsConcurrent()` | 批量提取关键词（并发） | ✅ | ❌ 未扣除 |
| `video-analysis:batch-submit` | `batchExtractKeywordsAsync()` | 异步批量提交 | ❓ | ❌ 未扣除 |
| `video-analysis:batch-check` | `checkBatchResult()` | 异步批量查询结果 | ❓ | ❌ 未扣除 |

**当前代码问题**（仅打印日志）：

```typescript
// ipc_handle/index.ts 第 1264-1274 行
ipcMain.handle('video-analysis:analyze', async (_, videoPath: string, options?: any) => {
  try {
    const result = await videoAnalysisUtil.analyzeVideo(videoPath, options);
    if (result.success && result.usage) {
      console.log(`[VideoAnalysis] 视频: ${videoPath}`);
      console.log(`[VideoAnalysis] Token 输入: ${result.usage.promptTokens}, Token 输出: ${result.usage.completionTokens}, 总计: ${result.usage.totalTokens}`);
      // ❌ 缺少积分扣除调用
    }
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

### 3.2 智能分割功能

**文件位置**: `src/main/core/videoAnalysis.ts`

**IPC Handler 位置**: `src/main/ipc_handle/index.ts` → `registerSmartSplitHandlers()`

| IPC Handler | 调用方法 | 功能说明 | 返回 usage | 状态 |
|-------------|---------|---------|-----------|------|
| `smart-split:analyze` | `analyzeVideoSegments()` | 智能分割分析 | ✅ | ❌ 未扣除 |
| `smart-split:analyze-async` | `analyzeVideoSegmentsAsync()` | 异步智能分割 | ❓ | ❌ 未扣除 |
| `smart-split:check-batch-result` | `checkVideoSegmentsBatchResult()` | 异步结果查询 | ❓ | ❌ 未扣除 |

**当前代码问题**（第 2426-2464 行）：

```typescript
ipcMain.handle('smart-split:analyze', async (_, videoPath: string, options?: any) => {
  try {
    const result = await videoAnalysisUtil.analyzeVideoSegments(videoPath, analyzeOptions);
    // ... 保存数据库等操作
    // ❌ 缺少积分扣除调用（result.usage 有 token 使用量）
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

---

## 四、修复建议

### 4.1 IPC Handler 层添加积分扣除

由于视频分析和智能分割功能不在 Pipeline 流程中，无法使用 `deductPointsForStep()`（需要 context）。需要在 IPC Handler 层直接调用 `tokenApiUtil`：

```typescript
import { tokenApiUtil, TaskType, TaskStatus } from '../core';
import { convertTokensToPoints } from '../pipeline/points';

ipcMain.handle('video-analysis:extract-keywords', async (_, videoPath: string, options?: any) => {
  try {
    const result = await videoAnalysisUtil.extractVideoKeywords(videoPath, options);

    // 扣除积分
    if (result.success && result.usage) {
      const apiToken = this.db.getConfig('api_token');
      if (apiToken) {
        const pointsUsed = convertTokensToPoints(
          result.usage.promptTokens,
          result.usage.completionTokens,
          'vlm'  // 视频分析使用 VLM
        );

        await tokenApiUtil.deductPointsAuto(
          apiToken,
          pointsUsed,
          TaskType.GENERAL,
          undefined,
          TaskStatus.SUCCESS
        );
        console.log(`[VideoAnalysis] 积分扣除: ${pointsUsed}`);
      }
    }

    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

### 4.2 批量分析积分累计

对于批量分析功能，需要累计所有视频的 token 消耗后一次性扣除：

```typescript
// 批量处理完成后累计扣除
let totalPromptTokens = 0;
let totalCompletionTokens = 0;

for (const [path, result] of results) {
  if (result.success && result.usage) {
    totalPromptTokens += result.usage.promptTokens;
    totalCompletionTokens += result.usage.completionTokens;
  }
}

const totalPointsUsed = convertTokensToPoints(
  totalPromptTokens,
  totalCompletionTokens,
  'vlm'
);

await tokenApiUtil.deductPointsAuto(apiToken, totalPointsUsed, ...);
```

---

## 五、文件路径汇总

### 已实现积分扣除

```
src/main/pipeline/points.ts              # 积分计算和扣除工具
src/main/core/tokenApi.ts                # Token API 封装
src/main/pipeline/steps/tts_step.ts      # TTS 步骤
src/main/pipeline/steps/asr_step.ts      # ASR 步骤
src/main/pipeline/steps/keyword_bind_step.ts  # 关键词绑定步骤
src/main/pipeline/steps/video_match_step.ts   # 视频匹配步骤
src/main/pipeline/steps/draft_populate_step.ts # 素材准备步骤
```

### 待添加积分扣除

```
src/main/core/videoAnalysis.ts           # 视频分析工具类
src/main/ipc_handle/index.ts             # IPC 处理器（需修改以下 handlers）
  ├── registerVideoAnalysisHandlers()    # 视频分析 handlers
  │     ├── video-analysis:analyze
  │     ├── video-analysis:extract-keywords
  │     ├── video-analysis:summarize
  │     ├── video-analysis:describe
  │     ├── video-analysis:custom-analyze
  │     ├── video-analysis:batch-extract-keywords
  │     ├── video-analysis:batch-extract-keywords-concurrent
  │     ├── video-analysis:batch-submit
  │     └── video-analysis:batch-check
  └── registerSmartSplitHandlers()       # 智能分割 handlers
        ├── smart-split:analyze
        ├── smart-split:analyze-async
        └── smart-split:check-batch-result
```

---

## 六、注意事项

1. **执行后扣除**：积分在功能成功执行后扣除，失败不扣费
2. **不中断流程**：积分扣除失败只记录日志，不抛出异常
3. **空值处理**：`apiToken` 为空或 `pointsUsed` 为 0 时跳过扣除
4. **断点续传**：Pipeline 步骤通过 `canSkip()` 跳过已完成的步骤，不会重复扣费
5. **异步任务**：异步 Batch 任务在查询结果时扣除积分（任务完成时）
