# Multi-Agent 增强：借鉴 Claude Code 的 5 个扩展方向

> 基于 `src/tools/AgentTool/` 源码分析，对 `04-multi-agent.ts` 提出的功能增强方案

## 当前状态 vs Claude Code 差距

| 能力 | 当前 demo | Claude Code 实际 |
|------|----------|-----------------|
| Agent 选择 | 硬编码 3 个全部调用 | 主 Agent 动态决定调哪些（`subagent_type` 参数） |
| 子 Agent 工具 | 无（纯 LLM 调用） | 每个 Agent 有独立工具集（`tools` / `disallowedTools`） |
| 执行顺序 | 全部并行 | 并行 + 串行混合（研究→实现 两阶段） |
| 错误隔离 | `Promise.all` 一个失败全挂 | 单个失败不影响整体（独立 try/finally） |
| 上下文传递 | 简单拼接用户需求 | 精细过滤、按角色省略 CLAUDE.md、按需传递 |

---

## 扩展 1: 错误隔离 — `Promise.allSettled`

### 对应 Claude Code 模式

`runAgent.ts` 中每个子 Agent 有独立的 `try/finally` 清理逻辑：

```typescript
// src/tools/AgentTool/runAgent.ts
try {
  // Agent 执行
} finally {
  await mcpCleanup()               // 清理 MCP 连接
  clearSessionHooks(...)            // 清理 hooks
  cleanupAgentTracking(agentId)     // 清理追踪
  killShellTasksForAgent(agentId)   // 终止后台任务
}
```

关键设计：**单个 Agent 失败不阻断其他 Agent**。

### 当前问题

```typescript
// 当前代码 — Promise.all 只要一个失败就全挂
const results = await Promise.all(tasks)
```

如果美食 Agent 限流报错，景点和交通的结果也白费了。

### 解决方案

用 `Promise.allSettled` 替换 `Promise.all`：

```typescript
// 改进后 — 单个失败不影响整体
const settled = await Promise.allSettled(tasks)

const results = settled
  .filter((r): r is PromiseFulfilledResult<AgentResult> => r.status === 'fulfilled')
  .map(r => r.value)

const failures = settled
  .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  .map(r => r.reason)

// 报告失败情况
for (const failure of failures) {
  console.log(`  ❌ 某个 Agent 失败: ${failure}`)
}

// 如果全部失败，提前退出
if (results.length === 0) {
  throw new Error('所有 Agent 均执行失败')
}
```

### 设计要点

- **容错优先**：部分结果 > 无结果
- **降级输出**：整合时只使用成功的部分，缺失的部分标注"暂无数据"
- **用户感知**：明确告知哪些 Agent 失败了

---

## 扩展 2: 动态 Agent 路由 — 让 LLM 决定调哪些

### 对应 Claude Code 模式

主 Agent 通过 `subagent_type` 参数显式选择子 Agent 类型：

```typescript
// src/tools/AgentTool/AgentTool.tsx
const effectiveType = subagent_type ?? (
  isForkSubagentEnabled() ? undefined : GENERAL_PURPOSE_AGENT.agentType
)
const found = agents.find(agent => agent.agentType === effectiveType)
```

主 Agent 根据 `whenToUse` 描述判断该用哪个 Agent：

```typescript
// exploreAgent.ts
whenToUse: '快速搜索专家。当你需要在 codebase 中快速查找文件或搜索代码时使用。'
```

### 当前问题

不管用户问什么，3 个 Agent 全部触发。用户如果只问"北京有什么好吃的"，景点和交通 Agent 是浪费的（浪费 API 调用 + 浪费时间）。

### 解决方案

增加一个路由阶段，让 LLM 先判断需要哪些 Agent：

```typescript
async function routeAgents(userRequest: string): Promise<string[]> {
  const agentList = Object.values(AGENTS)
    .map(a => `- ${a.name}: ${a.role}`)
    .join('\n')

  const prompt = `用户需求: ${userRequest}

可选专家:
${agentList}

请判断需要哪些专家来回答这个问题。
只输出需要的专家名称，逗号分隔（如: scenic,food）
如果都不需要，输出: none`

  const result = await callLLM([{ role: 'user', content: prompt }])
  if (result.trim() === 'none') return []
  return result.split(',').map(s => s.trim()).filter(Boolean)
}
```

### 编排器改造

```typescript
async function orchestrate(userRequest: string): Promise<string> {
  // 新增路由阶段
  const neededAgentNames = await routeAgents(userRequest)

  if (neededAgentNames.length === 0) {
    // 无需子 Agent，直接回答
    return callLLMStream([...])
  }

  const agentsToRun = neededAgentNames
    .map(name => AGENTS[name])
    .filter(Boolean)

  // 只调度需要的 Agent
  const results = await Promise.allSettled(
    agentsToRun.map(agent => agentCall(agent, taskPrompt))
  )
  // ...
}
```

### 设计要点

- **节省成本**：不触发不必要的 API 调用
- **灵活性**：Agent 注册表可以动态扩展，路由自动适应
- **权衡**：多一次 LLM 调用（路由判断），但节省了更多无用调用

---

## 扩展 3: 串行 Pipeline — Agent 间依赖

### 对应 Claude Code 模式

Claude Code 支持多轮 Agent 调用，后续 Agent 可以基于前面的结果：

```typescript
// src/tools/AgentTool/prompt.ts
// "Do research before jumping to implementation."
// 先 fork 研究 Agent → 拿到结果 → 再 fork 实现 Agent
```

主 Agent 在收到 `<task-notification>` 后，可以继续思考和调用新 Agent。

### 当前问题

3 个 Agent 完全并行，互不知道对方的输出。但实际中：
- 美食 Agent 应该根据**景点路线**推荐附近餐厅
- 交通 Agent 应该根据**景点位置**推荐住宿区域

### 解决方案

两阶段执行：景点 Agent 先出路线，美食和交通基于景点结果：

```typescript
async function orchestrate(userRequest: string): Promise<string> {
  // === 阶段 1: 景点 Agent 先执行（独立） ===
  const scenicResult = await agentCall(AGENTS.scenic, taskPrompt)

  // === 阶段 2: 美食和交通基于景点结果并行 ===
  const [foodResult, transportResult] = await Promise.allSettled([
    agentCall(AGENTS.food,
      `用户需求: ${userRequest}\n\n景点路线如下:\n${scenicResult.content}\n\n请推荐路线附近的美食`
    ),
    agentCall(AGENTS.transport,
      `用户需求: ${userRequest}\n\n景点路线如下:\n${scenicResult.content}\n\n请推荐交通方案`
    ),
  ])

  // === 阶段 3: 整合所有结果 ===
  // ...
}
```

### 执行流程对比

```
之前（全并行）：
  scenic ─────┐
  food   ─────┤──→ 汇总 → 整合
  transport ──┘
  总耗时 = max(scenic, food, transport)

之后（串行 + 并行混合）：
  scenic ──────┐
               ├──→ food   ─────┐
               └──→ transport ──┤──→ 汇总 → 整合
  总耗时 = scenic + max(food, transport)
```

### 设计要点

- **信息依赖建模**：明确哪些 Agent 有依赖关系
- **并行度最大化**：无依赖的 Agent 仍然并行
- **质量提升**：后续 Agent 基于前序结果工作，输出更精准

---

## 扩展 4: 带工具的子 Agent — Tool Use (Function Calling)

### 对应 Claude Code 模式

Explore Agent 有 Glob/Grep/Read 等工具，Plan Agent 继承相同工具集：

```typescript
// src/tools/AgentTool/built-in/exploreAgent.ts
disallowedTools: [
  AGENT_TOOL_NAME,       // 不能嵌套 spawn
  FILE_EDIT_TOOL_NAME,   // 不能编辑
  FILE_WRITE_TOOL_NAME,  // 不能写文件
]
// 白名单隐含：Glob, Grep, Read, Bash(只读)
```

工具解析逻辑（`agentToolUtils.ts`）：

```typescript
export function resolveAgentTools(agentDefinition, availableTools) {
  const hasWildcard = agentTools === undefined ||
    (agentTools.length === 1 && agentTools[0] === '*')

  if (hasWildcard) {
    return { hasWildcard: true, resolvedTools: allowedAvailableTools }
  }
  // 按 agent 定义的 tools 列表精确过滤
}
```

### 当前问题

子 Agent 是"瞎子"——只能靠训练知识回答，无法获取实时信息（如天气、价格、评分）。

### 解决方案

给子 Agent 注册可调用的工具函数，通过 OpenAI 兼容的 function calling 实现：

```typescript
// 1. 定义工具 schema
interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (args: any) => Promise<string>
}

const weatherTool: ToolDefinition = {
  name: 'get_weather',
  description: '获取指定城市的天气预报',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名' },
      days: { type: 'number', description: '预报天数' },
    },
    required: ['city'],
  },
  execute: async (args) => {
    // 实际调用天气 API
    return `北京未来3天：晴 22°C / 多云 18°C / 小雨 15°C`
  },
}

// 2. Agent 定义增加 tools 字段
interface AgentDefinition {
  name: string
  role: string
  systemPrompt: string
  tools?: ToolDefinition[]    // 新增
}

// 3. 子 Agent 调用时带上 tools
async function agentCallWithTools(agent: AgentDefinition, task: string) {
  const messages = [
    { role: 'system', content: agent.systemPrompt },
    { role: 'user', content: task },
  ]

  // 第一轮：LLM 可能请求调用工具
  const response = await callLLMWithTools(messages, agent.tools)

  // 如果 LLM 请求了 tool_call → 执行工具 → 把结果喂回 → 再调 LLM
  if (response.tool_calls) {
    for (const toolCall of response.tool_calls) {
      const tool = agent.tools!.find(t => t.name === toolCall.function.name)
      const result = await tool!.execute(JSON.parse(toolCall.function.arguments))
      messages.push({ role: 'tool', content: result, tool_call_id: toolCall.id })
    }
    // 第二轮：LLM 基于工具结果生成最终回复
    return callLLM(messages)
  }
}
```

### Tool Calling 流程

```
子 Agent 收到任务
  → LLM 思考：需要查天气
  → 返回 tool_call: { name: "get_weather", args: { city: "北京" } }
  → 你执行 weatherTool.execute()
  → 把结果作为 tool message 喂回 LLM
  → LLM 结合工具结果生成最终回复
```

### 设计要点

- **能力扩展**：子 Agent 从"只能回忆"变成"能查实时信息"
- **类 Claude Code 模式**：每个 Agent 有自己的工具集，精确控制能力边界
- **多轮交互**：一次 agentCall 可能触发多次 tool_call 循环

---

## 扩展 5: 上下文优化 — 精细传递

### 对应 Claude Code 模式

Explore/Plan Agent 省略 CLAUDE.md 节省 token；fork Agent 继承父对话上下文：

```typescript
// src/tools/AgentTool/runAgent.ts
// 只读 Agent 省略 CLAUDE.md（节省 ~5-15 Gtok/week）
const resolvedUserContext = shouldOmitClaudeMd
  ? userContextNoClaudeMd
  : baseUserContext

// 只读 Agent 省略过时的 git status
const resolvedSystemContext =
  agentDefinition.agentType === 'Explore' ||
  agentDefinition.agentType === 'Plan'
    ? systemContextNoGit
    : baseSystemContext
```

Fork 模式继承父对话：

```typescript
const contextMessages: Message[] = forkContextMessages
  ? filterIncompleteToolCalls(forkContextMessages)
  : []
const initialMessages: Message[] = [...contextMessages, ...promptMessages]
```

### 当前问题

传给每个子 Agent 的 prompt 完全一样，没有根据角色做差异化裁剪。所有 Agent 都收到了相同的信息，包含了大量对自己无用的上下文。

### 解决方案

按角色定制输入内容：

```typescript
function buildTaskPrompt(
  agent: AgentDefinition,
  userRequest: string,
  context?: Record<string, string>
): string {
  let prompt = `用户需求: ${userRequest}\n`

  // 按角色注入不同的上下文
  if (context) {
    if (agent.name === 'food' && context.scenic) {
      prompt += `\n## 景点路线参考\n${context.scenic}\n请推荐路线沿途的餐厅。`
    }
    if (agent.name === 'transport' && context.scenic) {
      prompt += `\n## 景点位置参考\n${context.scenic}\n请基于景点分布推荐住宿区域。`
    }
    // scenic Agent 不需要别人的上下文
  }

  return prompt
}
```

### Token 节省估算

```
假设每个 Agent 的完整上下文 = 2000 tokens

之前（无优化）：
  scenic: 2000 tokens
  food:   2000 tokens
  transport: 2000 tokens
  总计: 6000 tokens

之后（按需传递）：
  scenic: 1000 tokens（只需用户需求）
  food:   1500 tokens（用户需求 + 景点摘要）
  transport: 1500 tokens（用户需求 + 景点摘要）
  总计: 4000 tokens（节省 33%）
```

### 设计要点

- **最小信息原则**：只传 Agent 完成任务所需的最少上下文
- **质量 vs 成本权衡**：上下文太少可能影响输出质量
- **可测量**：可以统计 token 用量来量化优化效果

---

## 推荐实施顺序

```
当前状态 (并行 3 Agent + 重试 + 流式)
  |
  v
[扩展 1] 错误隔离 (Promise.allSettled)      ~10 分钟
  |     理解：容错设计
  v
[扩展 2] 动态路由 (LLM 选择 Agent)          ~30 分钟
  |     理解：Agent 编排、whenToUse 机制
  v
[扩展 3] 串行 Pipeline (Agent 间依赖)       ~30 分钟
  |     理解：混合调度、信息流建模
  v
[扩展 4] Tool Use (带工具的子 Agent)        ~1-2 小时
  |     理解：Function Calling、工具隔离
  v
[扩展 5] 上下文优化                         ~20 分钟
        理解：Token 效率、按需传递
```

每个扩展都可以独立应用，也可以组合使用（扩展 2 + 3 组合后效果最佳）。

---

## 最终架构总结（已实施）

所有 5 个扩展已集成到 `learn-examples/04-multi-agent.ts`（619 行）。

### 代码结构一览

```
04-multi-agent.ts
├── 配置层 (L1-37)
│   └── GLM_API_KEY / BASE_URL / MODEL
├── 基础设施层 (L38-179)
│   ├── fetchWithRetry()     带指数退避的重试（GLM 错误码 1305/1301/1302）
│   ├── callLLM()            非流式调用（子 Agent 用）
│   └── callLLMStream()      流式调用（主 Agent 整合输出用）
├── 类型层 (L181-207)
│   ├── ToolDefinition       工具定义（name + parameters + execute）
│   ├── AgentDefinition      Agent 定义（+ whenToUse + tools）
│   └── AgentResult          返回结果（+ toolCallsCount）
├── Agent 注册层 (L210-314)
│   ├── weatherTool          天气查询工具（模拟）→ transport Agent
│   ├── ticketTool           门票查询工具（模拟）→ scenic Agent
│   └── AGENTS{}             3 个专家 Agent 定义
├── 核心逻辑层 (L316-467)
│   ├── routeAgents()        [扩展2] 动态路由
│   ├── agentCall()          [扩展4] Tool Calling 循环
│   └── buildTaskPrompt()    [扩展5] 按角色构建上下文
├── 编排层 (L470-577)
│   └── orchestrate()
│       ├── 阶段0: 动态路由  [扩展2]
│       ├── 阶段1a: 串行执行景点 Agent  [扩展3]
│       ├── 阶段1b: 并行执行其他 Agent（错误隔离）[扩展1+3]
│       ├── 阶段2: 汇总结果
│       └── 阶段3: 流式整合输出
└── 入口层 (L580-619)
    └── main() 交互循环
```

### 各扩展在代码中的对应

| 扩展 | 代码位置 | Claude Code 参考 |
|------|---------|-----------------|
| **1. 错误隔离** | L535-545 `Promise.all(...map(t => t.catch()))` | `runAgent.ts` 独立 try/finally |
| **2. 动态路由** | L325-342 `routeAgents()` + 每个 Agent 的 `whenToUse` | `AgentTool.tsx` 的 `subagent_type` 参数 |
| **3. 串行 Pipeline** | L504-546 两阶段调度：景点先 → 美食/交通并行 | `prompt.ts` "先研究再实现" 模式 |
| **4. Tool Calling** | L360-440 `agentCall()` 工具循环 + `weatherTool` / `ticketTool` | `agentToolUtils.ts` 工具白名单 |
| **5. 上下文优化** | L450-467 `buildTaskPrompt()` 按角色注入不同上下文 | `runAgent.ts` 的 `omitClaudeMd` 过滤 |

### 增强后的执行流程

```
用户: "帮我规划北京三日游"
  │
  ▼
[路由] routeAgents() → LLM 判断需要: scenic, food, transport
  │
  ▼
[串行] 景点 Agent（带 ticketTool）
  │   → tool_call: get_ticket_info("故宫")  → 执行 → 喂回 LLM
  │   → tool_call: get_ticket_info("长城")  → 执行 → 喂回 LLM
  │   → tool_call: get_ticket_info("颐和园") → 执行 → 喂回 LLM
  │   → 最终路线输出（含门票价格和开放时间）
  │
  ▼
[并行] 美食 Agent（基于景点路线，无工具） ──┐
       交通 Agent（带 weatherTool）         ──┤── 错误隔离
  │   → tool_call: get_weather("北京", 3)    │
  │   → 天气预报 + 穿衣建议                   ┘
  │
  ▼
[汇总] 3 个结果拼接为 markdown
  │
  ▼
[流式] 整合为 Day1/Day2/Day3 行程表（实时输出给用户）
```

### 与 Claude Code 架构的映射关系

```
Claude Code                          04-multi-agent.ts
──────────────                       ──────────────────
AgentTool.tsx (工具入口)       ←→    orchestrate() 编排入口
subagent_type 参数             ←→    routeAgents() 动态路由
whenToUse 描述                 ←→    AgentDefinition.whenToUse
runAgent.ts (Agent 运行)       ←→    agentCall() 核心调用
tools / disallowedTools        ←→    AgentDefinition.tools[]
agentToolUtils.ts (工具解析)   ←→    toolsSchema 构建工具 JSON
resolveAgentTools()            ←→    agentCall() 内部的工具循环
<task-notification> XML        ←→    AgentResult 返回对象
omitClaudeMd 上下文过滤        ←→    buildTaskPrompt() 按角色构建
prompt.ts 多轮 Agent 调用      ←→    串行+并行混合调度
query.ts 流式处理              ←→    callLLMStream() SSE 解析
```
