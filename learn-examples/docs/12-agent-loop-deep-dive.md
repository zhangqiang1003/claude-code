# Agent Loop 深度解析

## Q1: Agent Loop 的核心终止条件是什么？

### 短答

Loop 在 `stop_reason === 'end_turn'` 时退出。

### 详解

LLM API 每次响应都会返回一个 `stop_reason` 字段：

```json
{
  "content": [...],
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 100, "output_tokens": 50 }
}
```

三种可能的值：

| stop_reason  | 含义                       | Loop 行为                        |
| ------------ | -------------------------- | -------------------------------- |
| `end_turn`   | 模型认为回答完整，无需继续 | **退出循环**，返回结果给用户     |
| `tool_use`   | 模型需要调用工具           | **继续循环**，执行工具后注入结果 |
| `max_tokens` | 被 token 上限截断          | 通常视为异常，退出或报错         |

### 代码结构

```typescript
while (true) {
	const response = await callLLM(messages);

	messages.push({ role: "assistant", content: response.content });

	if (response.stop_reason === "end_turn") {
		break; // 终止条件
	}

	if (response.stop_reason === "tool_use") {
		const toolResults = await executeTools(response.content);
		messages.push({ role: "user", content: toolResults });
		// 继续下一轮
	}
}
```

### stop_reason 从哪里来？

`stop_reason` 是 **LLM API 协议层面的字段**，不是 prompt 引导出来的：

- 模型在训练时就内化了"何时结束生成"的判断
- 你在 system prompt 里定义工具，会影响模型是否倾向于调用工具
- 但 `end_turn` 本身不需要 prompt 里显式说明，是模型自主决策的结果

### needsFollowUp 是什么？

部分实现用 `needsFollowUp` 变量代替直接判断 `stop_reason`：

```typescript
const needsFollowUp = response.stop_reason === 'tool_use';
while (needsFollowUp) { ... }
```

本质相同，只是语义化封装。

---

## Q2: LLM 返回 tool_use 时，怎么知道调用哪个工具？

### 短答

LLM 在 `content` 数组里明确告诉你：工具名（`name`）+ 参数（`input`）。

### API 响应结构

```json
{
	"stop_reason": "tool_use",
	"content": [
		{
			"type": "tool_use",
			"id": "toolu_01abc",
			"name": "getTime",
			"input": { "timezone": "Asia/Shanghai" }
		}
	]
}
```

### Loop 中的处理

```typescript
for (const block of response.content) {
	if (block.type === "tool_use") {
		const tool = toolRegistry[block.name]; // 按名字查找注册的工具
		const result = await tool.execute(block.input);
		toolResults.push({
			type: "tool_result",
			tool_use_id: block.id, // 必须对应请求中的 id
			content: String(result),
		});
	}
}
```

### LLM 怎么知道有哪些工具？

API 请求时通过 `tools` 字段声明工具列表（名字 + 描述 + 参数 schema），LLM 根据这个列表决定调用哪个：

```typescript
await anthropic.messages.create({
	model: "claude-sonnet-4-6",
	tools: [
		{
			name: "getTime",
			description: "获取当前时间",
			input_schema: {
				type: "object",
				properties: {
					timezone: { type: "string", description: "时区" },
				},
			},
		},
	],
	messages,
});
```

---

## Q3: 一轮 tool_use 交互后，messages 数组新增几条？

### 短答

新增 **2 条**：assistant 的 tool_use + user 的 tool_result。

### messages 演化过程

```
初始:
  [{ role: 'user', content: '现在几点？' }]

第1轮 LLM 返回 tool_use 后，push assistant 消息:
  [
    { role: 'user',      content: '现在几点？' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_01', name: 'getTime', input: {} }] }
  ]

执行工具后，push tool_result（以 user role 注入）:
  [
    { role: 'user',      content: '现在几点？' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_01', name: 'getTime', input: {} }] },
    { role: 'user',      content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: '14:30' }] }
  ]

第2轮 LLM 返回 end_turn，push 最终回复:
  [
    ...前3条,
    { role: 'assistant', content: [{ type: 'text', text: '现在是下午2点30分。' }] }
  ]
```

### 关键点

- `tool_result` 用 **`role: 'user'`** 注入，不是 `role: 'tool'`
- `tool_use_id` 必须与请求中的 `id` 对应，LLM 靠这个匹配结果
- 一次响应可能包含**多个** tool_use block（并行调用），需全部执行后一起注入

---

## Q4: LLM 同时返回多个 tool_use 时如何处理？

### 短答

**并行执行，一次性注入所有 tool_result**，不能分批注入。

### 为什么不能分批注入？

Anthropic API 硬性规则：**一条 assistant 消息里有几个 tool_use block，下一条 user 消息里就必须有对应数量的 tool_result**，否则 API 报错。

```typescript
// ❌ 错误：只注入一个 tool_result
messages.push({ role: "assistant", content: [toolUse1, toolUse2] });
messages.push({ role: "user", content: [toolResult1] }); // 缺 toolResult2
await callLLM(messages); // API 报错

// ✅ 正确：并行执行，一次性注入全部结果
const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
const results = await Promise.all(
	toolUseBlocks.map(async (block) => ({
		type: "tool_result",
		tool_use_id: block.id,
		content: String(await toolRegistry[block.name].execute(block.input)),
	})),
);
messages.push({ role: "user", content: results }); // 一次性注入
```

### 为什么可以并行执行？

LLM 同时发出多个工具调用，说明它判断这些调用之间没有依赖关系，用 `Promise.all` 并行跑效率更高。

---

## Q5: 如何防止 Agent Loop 无限循环？

### 短答

双重保险：**maxTurns（迭代上限）+ token budget（消耗上限）**。

### Claude Code 源码实现

Claude Code 的 `query.ts` 用 `turnCount` 追踪迭代次数，每次有工具结果准备递归时递增，超过 `maxTurns` 就退出：

```typescript
// query.ts — 初始化
state = { turnCount: 1, ... }

// 每轮工具执行完毕，准备下一轮时：
const nextTurnCount = turnCount + 1

if (maxTurns && nextTurnCount > maxTurns) {
  yield createAttachmentMessage({
    type: 'max_turns_reached',
    maxTurns,
    turnCount: nextTurnCount,
  })
  return { reason: 'max_turns', turnCount: nextTurnCount }
}

// 继续递归，传入递增后的 turnCount
return query({ ...state, turnCount: nextTurnCount })
```

### 两种防护机制对比

| 机制         | 触发条件            | 适合场景                           |
| ------------ | ------------------- | ---------------------------------- |
| `maxTurns`   | 工具调用轮次超限    | 防止逻辑死循环（LLM 反复调用工具） |
| token budget | 输入 token 超过阈值 | 防止上下文膨胀导致的隐性循环       |

### 自己实现时的最简写法

```typescript
const MAX_TURNS = 20;
let turnCount = 0;

while (true) {
  const response = await callLLM(messages);
  messages.push({ role: 'assistant', content: response.content });

  if (response.stop_reason === 'end_turn') break;

  if (response.stop_reason === 'tool_use') {
    turnCount++;
    if (turnCount >= MAX_TURNS) {
      throw new Error(`超过最大迭代次数 ${MAX_TURNS}`);
    }
    const results = await executeTools(response.content);
    messages.push({ role: 'user', content: results });
  }
}
```
---

## Q6: 流式模式下，何时才能知道 stop_reason？

### 短答

必须等到 **`message_delta` 事件**，它在所有 content block 结束之后才出现。

### 流式事件序列

```

message_start ← 流开始（stop_reason: null）
content_block_start ← 一个 block 开始
content_block_delta ← block 增量内容（多个）
content_block_stop ← 一个 block 结束，此时 stop_reason 仍为 null
message_delta ← ★ stop_reason 在这里（end_turn / tool_use）
message_stop ← 流完全结束

````

### Claude Code 源码注释（claude.ts）

```typescript
// message_delta arrives after content_block_stop with the real values.
// Messages are created at content_block_stop from partialMessage,
// which was set at message_start before any tokens were generated
// (output_tokens: 0, stop_reason: null).
case 'message_delta': {
  usage = updateUsage(usage, part.usage)
  // Write final usage and stop_reason back to the last yielded message.
}
````

### 实践含义

流式 Loop 的正确姿势：

```typescript
let stopReason: string | null = null;
const contentBlocks: ContentBlock[] = [];

for await (const event of stream) {
	if (event.type === "content_block_delta") {
		// 实时输出文字给用户
		process.stdout.write(event.delta.text ?? "");
		// 同时累积 block 内容
	}
	if (event.type === "message_delta") {
		stopReason = event.delta.stop_reason; // 这里才能拿到
	}
}

// 流结束后，根据 stopReason 决定是否继续 Loop
if (stopReason === "tool_use") {
	/* 执行工具，继续循环 */
}
if (stopReason === "end_turn") {
	/* 退出循环 */
}
```

---

## Q7: 流式模式下，tool_use block 的 input 参数是怎么传输的？

### 上游知识：content block 是什么

非流式响应的 `content` 是一个数组，每个元素叫 **content block**：

```json
{
	"content": [
		{ "type": "text", "text": "好的，我来查一下" },
		{
			"type": "tool_use",
			"name": "getTime",
			"input": { "timezone": "Asia/Shanghai" }
		}
	]
}
```

流式模式下，这个数组**一个 block 一个 block 地流过来**，每个 block 内部再逐片传输：

```
content_block_start(index=0)   ← block 0 开始
content_block_delta(index=0) × N  ← block 0 的内容片段
content_block_stop(index=0)    ← block 0 结束

content_block_start(index=1)   ← block 1 开始
...
```

### tool_use input 的传输方式

`content_block_start` 里 tool_use 的 `input` 是空对象 `{}`，真正的参数通过后续多个 `input_json_delta` 事件逐片传输：

```
content_block_start  → { type: 'tool_use', id: 'toolu_01', name: 'getTime', input: {} }
content_block_delta  → { type: 'input_json_delta', partial_json: '{"timezon' }
content_block_delta  → { type: 'input_json_delta', partial_json: 'e": "Asia/' }
content_block_delta  → { type: 'input_json_delta', partial_json: 'Shanghai"}' }
content_block_stop   → 信号：block 结束，此时执行 JSON.parse() 得到完整 input
```

### 关键点

- `content_block_stop` **本身不携带内容**，只是"可以 parse 了"的信号
- 你需要自己维护一个 buffer 做字符串拼接
- 必须等 `content_block_stop` 后才能执行工具（参数此时才完整）

### 处理代码

````typescript
const inputBuffers: Record<number, string> = {};
const toolUseBlocks: Record<number, { id: string; name: string }> = {};

for await (const event of stream) {
  if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
    toolUseBlocks[event.index] = { id: event.content_block.id, name: event.content_block.name };
    inputBuffers[event.index] = '';
  }
  if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
    inputBuffers[event.index] += event.delta.partial_json; // 拼接
  }
  if (event.type === 'content_block_stop' && toolUseBlocks[event.index]) {
    const input = JSON.parse(inputBuffers[event.index]); // 此时才完整
    // 可以执行工具了
  }
}
```

---

## Q8: Agentic Loop 包含几个阶段？

### 短答

工程实现上是 **4 个步骤**，对应 ReAct 论文的 3 个抽象阶段。

### ReAct 抽象 vs 工程实现

| ReAct 抽象 | 工程实现 |
|-----------|---------|
| Thought | 发请求 → 等响应（LLM 在"思考"） |
| Action | 执行工具 |
| Observation | 注入  |
tool_result
然后回到 Thought（下一轮请求），循环往复，直到 `stop_reason === 'end_turn'`。

---

## Q9: ReAct 三阶段在 Claude Code 源码中的对应实现

### 总览

Claude Code 的 Loop 实现在 `src/query.ts` 的 `queryLoop()` 函数中，是一个 `while(true)` 循环（非递归）。

| ReAct 阶段 | 工程步骤 | query.ts 关键代码 |
|-----------|---------|-----------------|
| **Thought** | 发请求 → 流式接收响应 | `streamQuery()` 调用 API，收集 `assistantMessages` |
| **Action** | 执行工具 | `runTools()` / `StreamingToolExecutor` |
| **Observation** | 注入 tool_result | `toolResults` 数组 → 合并进下一轮 `messages` |

### Phase 1 — Thought（发请求 + 流式接收）

```typescript
// query.ts — 流式接收响应，收集 tool_use blocks
const toolUseBlocks: ToolUseBlock[] = []
let needsFollowUp = false

// 流式处理每条 assistant 消息
const msgToolUseBlocks = content.filter(c => c.type === 'tool_use')
if (msgToolUseBlocks.length > 0) {
  toolUseBlocks.push(...msgToolUseBlocks)
  needsFollowUp = true   // ← Loop 继续的信号
}
```

注意：源码注释说 `stop_reason === 'tool_use'` **不可靠**，实际用 `needsFollowUp` 作为循环继续信号。

### Phase 2 — Action（执行工具）

```typescript
// query.ts ~L1429
const toolUpdates = streamingToolExecutor
  ? streamingToolExecutor.getRemainingResults()   // 流式执行模式
  : runTools(toolUseBlocks, assistantMessages, canUseTool, toolUseContext)  // 批量执行模式

for await (const update of toolUpdates) {
  if (update.message) {
    yield update.message          // 向 UI 推送工具执行进度
    toolResults.push(...)         // 收集 tool_result
  }
}
```

### Phase 3 — Observation（注入结果，进入下一轮）

```typescript
// query.ts ~L1762 — while(true) 循环的末尾
const next: State = {
	messages: [
		...messagesForQuery, // 原有消息
		...assistantMessages, // Thought 阶段的 assistant 消息
		...toolResults, // Observation：tool_result 注入
	],
	turnCount: nextTurnCount,
	transition: { reason: "next_turn" },
};
state = next; // 更新状态，while(true) 继续下一轮
```

Loop 不是递归调用，而是 `while(true)` + `state = next` 的状态机模式。
