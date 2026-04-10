# Claude Code 权限系统源码解析

> 基于 `src/types/permissions.ts`、`src/utils/permissions/` 目录源码分析

## 目录

1. [类型体系](#1-类型体系)
2. [权限检查管道（核心流程）](#2-权限检查管道核心流程)
3. [规则系统](#3-规则系统)
4. [模式匹配引擎](#4-模式匹配引擎)
5. [拒绝追踪与熔断](#5-拒绝追踪与熔断)
6. [工具特定权限](#6-工具特定权限)
7. [用户交互流程](#7-用户交互流程)
8. [安全设计原则](#8-安全设计原则)

---

## 1. 类型体系

### 1.1 权限模式（PermissionMode）

```
用户可配置的外部模式（ExternalPermissionMode）:
┌─────────────────┬──────────────────────────────────────────────┐
│ 模式             │ 含义                                         │
├─────────────────┼──────────────────────────────────────────────┤
│ default          │ 正常模式：未知操作弹窗询问用户                   │
│ bypassPermissions│ 跳过所有权限检查（= --dangerously-skip-permissions）│
│ dontAsk          │ 自动拒绝所有需要询问的操作（批处理/无人值守）     │
│ acceptEdits      │ 自动允许文件编辑操作                            │
│ plan             │ Plan 模式（只读规划，除非原始是 bypass）          │
└─────────────────┴──────────────────────────────────────────────┘

内部扩展模式（InternalPermissionMode）:
┌─────────────────┼──────────────────────────────────────────────┤
│ auto             │ AI 分类器自动决策（TRANSCRIPT_CLASSIFIER feature）│
│ bubble           │ 保留位，未使用                                 │
└─────────────────┴──────────────────────────────────────────────┘
```

源码定义（`src/types/permissions.ts:16-38`）：
```typescript
export const EXTERNAL_PERMISSION_MODES = [
  'acceptEdits', 'bypassPermissions', 'default', 'dontAsk', 'plan',
] as const

export type InternalPermissionMode = ExternalPermissionMode | 'auto' | 'bubble'
```

### 1.2 权限行为（PermissionBehavior）

```typescript
// src/types/permissions.ts:44
export type PermissionBehavior = 'allow' | 'deny' | 'ask'
```

**三元决策模型**的核心：
- `allow` — 放行，工具正常执行
- `deny` — 拒绝，工具不执行，告知 LLM "被拒绝"
- `ask` — 需要用户确认（平衡安全与便利的中间态）

### 1.3 权限规则（PermissionRule）

```typescript
// src/types/permissions.ts:54-79
type PermissionRuleSource =
  | 'policySettings'   // 管理员/组织策略（最高优先级）
  | 'flagSettings'     // CLI flag 注入
  | 'userSettings'     // 用户全局配置 (~/.claude/settings.json)
  | 'projectSettings'  // 项目级配置 (.claude/settings.json)
  | 'localSettings'    // 目录级配置
  | 'cliArg'           // CLI 参数
  | 'command'          // 命令注入
  | 'session'          // 会话级（内存中，不持久化）

type PermissionRuleValue = {
  toolName: string       // 工具名，如 "Bash"
  ruleContent?: string   // 可选的内容匹配，如 "git commit"
}

type PermissionRule = {
  source: PermissionRuleSource
  ruleBehavior: PermissionBehavior  // allow / deny / ask
  ruleValue: PermissionRuleValue
}
```

**规则示例**：
```json
{
  "source": "userSettings",
  "ruleBehavior": "allow",
  "ruleValue": { "toolName": "Bash", "ruleContent": "git commit" }
}
```
→ 含义：用户全局配置允许 `Bash(git commit)` 命令

### 1.4 权限决策（PermissionDecision）

```typescript
// src/types/permissions.ts:174-246
type PermissionAllowDecision = {
  behavior: 'allow'
  updatedInput?: Input          // 工具可能修改用户输入
  userModified?: boolean        // 用户是否手动修改过
  decisionReason?: PermissionDecisionReason
}

type PermissionAskDecision = {
  behavior: 'ask'
  message: string               // 展示给用户的提示信息
  suggestions?: PermissionUpdate[]  // 建议的规则更新
  pendingClassifierCheck?: PendingClassifierCheck  // 异步分类器检查
}

type PermissionDenyDecision = {
  behavior: 'deny'
  message: string
  decisionReason: PermissionDecisionReason  // deny 必须有 reason
}
```

### 1.5 权限上下文（ToolPermissionContext）

```typescript
// src/types/permissions.ts:427-441
type ToolPermissionContext = {
  readonly mode: PermissionMode
  readonly additionalWorkingDirectories: ReadonlyMap<string, AdditionalWorkingDirectory>
  readonly alwaysAllowRules: ToolPermissionRulesBySource
  readonly alwaysDenyRules: ToolPermissionRulesBySource
  readonly alwaysAskRules: ToolPermissionRulesBySource
  readonly isBypassPermissionsModeAvailable: boolean
  readonly strippedDangerousRules?: ToolPermissionRulesBySource
  readonly shouldAvoidPermissionPrompts?: boolean
  readonly awaitAutomatedChecksBeforeDialog?: boolean
  readonly prePlanMode?: PermissionMode
}
```

---

## 2. 权限检查管道（核心流程）

### 2.1 总览

权限检查的入口是 `hasPermissionsToUseTool()`（`src/utils/permissions/permissions.ts:473`），核心实现在 `hasPermissionsToUseToolInner()`（L1158）。

```
工具请求执行
  │
  ▼
hasPermissionsToUseTool(tool, input, context)
  │
  ├─ 内层: hasPermissionsToUseToolInner()  ← 10 步管道
  │    │
  │    ├─ 步骤 1a: deny 规则检查 ─── 命中 → 返回 deny
  │    ├─ 步骤 1b: ask 规则检查 ──── 命中 → 返回 ask
  │    ├─ 步骤 1c: tool.checkPermissions()  ← 工具自定义逻辑
  │    ├─ 步骤 1d: 工具实现拒绝 ─── 命中 → 返回 deny
  │    ├─ 步骤 1e: 需要用户交互的工具 → 返回 ask
  │    ├─ 步骤 1f: 内容级 ask 规则 ── 命中 → 返回 ask (bypass-immune)
  │    ├─ 步骤 1g: 安全检查 ──────── 命中 → 返回 ask (bypass-immune)
  │    ├─ 步骤 2a: bypassPermissions 模式 → 返回 allow
  │    ├─ 步骤 2b: alwaysAllow 规则 ── 命中 → 返回 allow
  │    └─ 步骤 3:  passthrough → ask 转换
  │
  ├─ 后置: 模式转换
  │    ├─ allow → 记录成功，返回 allow
  │    ├─ ask + dontAsk → 转为 deny
  │    └─ ask + auto → AI 分类器决策
  │
  └─ 返回最终 PermissionDecision
```

### 2.2 步骤详解

#### 步骤 1a: deny 规则检查（L1169-1181）

```typescript
const denyRule = getDenyRuleForTool(appState.toolPermissionContext, tool)
if (denyRule) {
  return {
    behavior: 'deny',
    decisionReason: { type: 'rule', rule: denyRule },
    message: `Permission to use ${tool.name} has been denied.`,
  }
}
```

**设计原则**：deny 最高优先级，一旦命中立即返回，后续所有步骤都不执行。

#### 步骤 1b: ask 规则检查（L1183-1206）

```typescript
const askRule = getAskRuleForTool(appState.toolPermissionContext, tool)
if (askRule) {
  // 特殊：如果 Bash 在沙箱中执行，跳过 ask 规则
  const canSandboxAutoAllow =
    tool.name === BASH_TOOL_NAME &&
    SandboxManager.isSandboxingEnabled() &&
    shouldUseSandbox(input)

  if (!canSandboxAutoAllow) {
    return { behavior: 'ask', ... }
  }
  // 沙箱中的命令继续往下走，交给 Bash 的 checkPermissions 处理
}
```

#### 步骤 1c: 工具特定 checkPermissions()（L1208-1223）

```typescript
const parsedInput = tool.inputSchema.parse(input)
toolPermissionResult = await tool.checkPermissions(parsedInput, context)
```

**关键**：每个工具有自己的 `checkPermissions()` 实现，执行工具级别的精细检查。

#### 步骤 1d: 工具实现拒绝（L1225-1228）

```typescript
if (toolPermissionResult?.behavior === 'deny') {
  return toolPermissionResult  // 工具自己拒绝了
}
```

#### 步骤 1e: 需要用户交互的工具（L1230-1236）

```typescript
if (tool.requiresUserInteraction?.() &&
    toolPermissionResult?.behavior === 'ask') {
  return toolPermissionResult  // 某些工具即使在 bypass 模式也需要用户交互
}
```

#### 步骤 1f: 内容级 ask 规则（L1238-1250）

```typescript
// 例如 Bash(npm publish:*) → 工具的 checkPermissions 返回 ask + rule 标记
if (toolPermissionResult?.behavior === 'ask' &&
    toolPermissionResult.decisionReason?.type === 'rule' &&
    toolPermissionResult.decisionReason.rule.ruleBehavior === 'ask') {
  return toolPermissionResult  // bypass-immune：bypass 模式也不能跳过
}
```

#### 步骤 1g: 安全检查（L1252-1260）

```typescript
// .git/, .claude/, .vscode/, shell configs 等敏感路径
if (toolPermissionResult?.behavior === 'ask' &&
    toolPermissionResult.decisionReason?.type === 'safetyCheck') {
  return toolPermissionResult  // bypass-immune
}
```

#### 步骤 2a: bypassPermissions 模式（L1262-1281）

```typescript
const shouldBypassPermissions =
  appState.toolPermissionContext.mode === 'bypassPermissions' ||
  (appState.toolPermissionContext.mode === 'plan' &&
   appState.toolPermissionContext.isBypassPermissionsModeAvailable)

if (shouldBypassPermissions) {
  return { behavior: 'allow', ... }
}
```

**注意**：bypass 只在步骤 1a-1g 都没拦截时才生效。deny 规则和 bypass-immune 的安全检查优先于 bypass 模式。

#### 步骤 2b: alwaysAllow 规则（L1283-1297）

```typescript
const alwaysAllowedRule = toolAlwaysAllowedRule(appState.toolPermissionContext, tool)
if (alwaysAllowedRule) {
  return { behavior: 'allow', ... }
}
```

#### 步骤 3: passthrough → ask 转换（L1299-1310）

```typescript
// 工具没有明确表态（passthrough），默认转为 ask
const result = toolPermissionResult.behavior === 'passthrough'
  ? { ...toolPermissionResult, behavior: 'ask' as const }
  : toolPermissionResult
```

### 2.3 后置模式转换

在 `hasPermissionsToUseTool()` 的外层（L473-517）：

```typescript
// 允许结果：记录成功（重置拒绝计数器）
if (result.behavior === 'allow') {
  recordSuccess(denialState)
  return result
}

// dontAsk 模式：ask → deny
if (result.behavior === 'ask' && appState.toolPermissionContext.mode === 'dontAsk') {
  return { behavior: 'deny', message: DONT_ASK_REJECT_MESSAGE(tool.name) }
}

// auto 模式：ask → AI 分类器决策
if (result.behavior === 'ask' && appState.toolPermissionContext.mode === 'auto') {
  // 运行分类器（YOLO + fast 两阶段）
  // 分类器结果：allow / deny / 降级为手动 prompt
}
```

### 2.4 管道的 bypass-immune 机制

**核心安全设计**：以下检查即使在 `bypassPermissions` 模式下也不可跳过：

| 步骤 | bypass-immune | 原因 |
|------|:---:|------|
| 1a. deny 规则 | **是** | deny 永远最高优先 |
| 1f. 内容级 ask 规则 | **是** | 用户显式配置的 ask 规则 |
| 1g. 安全检查 | **是** | 保护 .git/、.claude/ 等敏感路径 |
| 2a. bypass 短路 | 否 | 这是 bypass 本身 |
| 2b. alwaysAllow | 否 | 只是 allow 规则 |

---

## 3. 规则系统

### 3.1 规则来源层级

```
policySettings (管理员策略)
  ↓ 不可被覆盖
flagSettings (CLI flag)
  ↓
userSettings (~/.claude/settings.json)
  ↓
projectSettings (.claude/settings.json)
  ↓
localSettings (目录级)
  ↓
cliArg (CLI 参数)
  ↓
command (命令注入)
  ↓
session (会话内存，不持久化)
```

当 `allowManagedPermissionRulesOnly = true` 时，只加载 `policySettings` 的规则（企业管控）。

### 3.2 规则格式

规则以字符串存储在 `settings.json` 的 `permissions` 字段中：

```json
{
  "permissions": {
    "allow": ["Bash(git commit)", "Read", "Bash(npm:*)"],
    "deny": ["Bash(rm -rf *)"],
    "ask": ["Bash(npm publish:*)"]
  }
}
```

**格式解析**（`src/utils/permissions/permissionRuleParser.ts`）：
```
"Bash(git commit)"     → { toolName: "Bash", ruleContent: "git commit" }
"Read"                 → { toolName: "Read", ruleContent: undefined }
"Bash(npm:*)"          → { toolName: "Bash", ruleContent: "npm:*" }
```

### 3.3 规则加载

```typescript
// src/utils/permissions/permissionsLoader.ts:120-133
export function loadAllPermissionRulesFromDisk(): PermissionRule[] {
  if (shouldAllowManagedPermissionRulesOnly()) {
    return getPermissionRulesForSource('policySettings')
  }
  const rules: PermissionRule[] = []
  for (const source of getEnabledSettingSources()) {
    rules.push(...getPermissionRulesForSource(source))
  }
  return rules
}

// settingsJsonToRules: 解析 JSON 中的 allow/deny/ask 数组
function settingsJsonToRules(data, source): PermissionRule[] {
  const rules = []
  for (const behavior of ['allow', 'deny', 'ask']) {
    for (const ruleString of data.permissions[behavior]) {
      rules.push({
        source,
        ruleBehavior: behavior,
        ruleValue: permissionRuleValueFromString(ruleString),
      })
    }
  }
  return rules
}
```

### 3.4 规则持久化

**添加规则**（`permissionsLoader.ts:229-296`）：
```typescript
export function addPermissionRulesToSettings({ ruleValues, ruleBehavior }, source) {
  // 1. 读取现有设置（先验证模式，失败则宽松模式）
  // 2. 去重：通过 parse→serialize 往返标准化
  // 3. 追加新规则到对应 behavior 数组
  // 4. 写回 settings.json
}
```

**删除规则**（`permissionsLoader.ts:163-216`）：
```typescript
export function deletePermissionRuleFromSettings(rule) {
  // 1. 验证 source 是可编辑的（userSettings/projectSettings/localSettings）
  // 2. 标准化规则名（处理遗留名称如 "KillShell" → "TaskStop"）
  // 3. 从 behavior 数组中过滤掉匹配项
  // 4. 写回 settings.json
}
```

### 3.5 权限更新操作

```typescript
// src/types/permissions.ts:98-131
type PermissionUpdate =
  | { type: 'addRules', destination, rules, behavior }
  | { type: 'replaceRules', destination, rules, behavior }
  | { type: 'removeRules', destination, rules, behavior }
  | { type: 'setMode', destination, mode }
  | { type: 'addDirectories', destination, directories }
  | { type: 'removeDirectories', destination, directories }
```

`destination` 决定规则存储位置（`userSettings` / `projectSettings` / `localSettings` / `session`）。

---

## 4. 模式匹配引擎

### 4.1 三种匹配类型

```typescript
// src/utils/permissions/shellRuleMatching.ts:25-37
type ShellPermissionRule =
  | { type: 'exact', command: string }     // "git commit"
  | { type: 'prefix', prefix: string }     // "npm" (legacy "npm:*")
  | { type: 'wildcard', pattern: string }  // "git * --force"
```

### 4.2 解析逻辑

```typescript
// shellRuleMatching.ts:159-184
function parsePermissionRule(rule): ShellPermissionRule {
  // 1. 检查 legacy :* 前缀语法
  if (rule.endsWith(':*')) return { type: 'prefix', prefix: rule.slice(0, -2) }

  // 2. 检查通配符（未转义的 *）
  if (hasWildcards(rule)) return { type: 'wildcard', pattern: rule }

  // 3. 精确匹配
  return { type: 'exact', command: rule }
}
```

### 4.3 通配符匹配实现

`matchWildcardPattern()`（shellRuleMatching.ts:90-154）将通配符模式转为正则：

```
输入: "git * --force"
  │
  ├─ 1. 处理转义序列
  │     "\*" → 占位符 \x00ESCAPED_STAR\x00
  │     "\\" → 占位符 \x00ESCAPED_BACKSLASH\x00
  │
  ├─ 2. 转义正则特殊字符（保留 * 不转义）
  │     "git * --force" → "git .* --force"
  │
  ├─ 3. 还原占位符为转义字面量
  │     \x00ESCAPED_STAR\x00 → \*
  │
  ├─ 4. 尾部单通配符可选化
  │     "git .*" → "git( .*)?"  ← "git" 也能匹配
  │
  └─ 5. 构建正则
        new RegExp(`^git( .*)?$`, 's')
```

**特殊处理**：
- `git *` 匹配 `git add` 和裸 `git`（尾部空格+通配符变可选）
- `\*` 匹配字面星号
- `\\` 匹配字面反斜杠
- `s` flag 使 `.` 匹配换行符

### 4.4 通配符检测

```typescript
// shellRuleMatching.ts:54-78
function hasWildcards(pattern): boolean {
  // 以 :* 结尾的是 legacy 前缀语法，不算通配符
  if (pattern.endsWith(':*')) return false

  // 统计 * 前的反斜杠数量
  // 偶数（含 0）→ 未转义 → 有通配符
  // 奇数 → 已转义 → 无通配符
}
```

---

## 5. 拒绝追踪与熔断

### 5.1 状态结构

```typescript
// src/utils/permissions/denialTracking.ts
type DenialTrackingState = {
  consecutiveDenials: number   // 连续拒绝次数
  totalDenials: number         // 总拒绝次数
}

const DENIAL_LIMITS = {
  maxConsecutive: 3,   // 连续拒绝 3 次 → 降级
  maxTotal: 20,        // 总共拒绝 20 次 → 降级
}
```

### 5.2 熔断机制

```
auto 模式运行中
  │
  ├─ 工具被允许 → recordSuccess() → consecutiveDenials = 0
  │
  ├─ 工具被拒绝 → recordDenial() → consecutiveDenials++, totalDenials++
  │
  └─ shouldFallbackToPrompting()?
       ├─ consecutiveDenials >= 3 → 降级为手动 prompt
       └─ totalDenials >= 20    → 降级为手动 prompt
```

**设计意图**：防止 auto 模式下 AI 分类器反复做出错误判断，连续拒绝 3 次或累计 20 次后强制回到人类监督。

---

## 6. 工具特定权限

每个工具实现自己的 `checkPermissions(input, context)` 方法：

### 6.1 BashTool

**位置**：`src/tools/BashTool/BashTool.tsx`

- **命令分类**：判断命令危险级别
- **沙箱集成**：在沙箱中运行的命令可自动允许
- **sleep 检测**：阻止 `sleep` 等无用等待命令
- **输出重定向**：检测并剥离 `> /dev/null` 等重定向
- **PowerShell 特殊处理**：Windows 下检测下载执行模式（`iex (iwr ...)`）

### 6.2 FileTools (Read/Edit/Write)

**位置**：`src/utils/permissions/filesystem.ts`

- **路径安全检查**（`checkPathSafetyForAutoEdit`）：
  - 阻断 UNC 路径（`\\server\share`）
  - 检测 Windows 可疑模式（ADS、短文件名）
  - 保护 `.git/`、`.claude/`、`.vscode/` 目录
  - 保护 shell 配置文件（`.bashrc`、`.zshrc` 等）
- **工作目录验证**：只允许在工作目录内操作
- **acceptEdits 快速路径**：工作目录内的编辑可跳过分类器

### 6.3 AgentTool

**位置**：`src/tools/AgentTool/`

- 子 Agent 继承父 Agent 的权限上下文
- 子 Agent 有独立的工具白名单/黑名单
- 嵌套 Agent 不可用（`disallowedTools` 包含 `AgentTool`）

---

## 7. 用户交互流程

### 7.1 完整流程

```
工具请求执行
  │
  ▼
useCanUseTool hook (src/hooks/useCanUseTool.tsx)
  │
  ├─ 创建 PermissionContext
  ├─ 调用 hasPermissionsToUseTool()
  │
  ├─ result.behavior === 'allow' → 工具直接执行
  ├─ result.behavior === 'deny'  → 返回拒绝消息给 LLM
  └─ result.behavior === 'ask'   → 显示权限提示 UI
       │
       ▼
PermissionRequest 组件 (src/components/permissions/)
  │
  ├─ 根据 tool.name 路由到具体组件:
  │   BashTool     → BashPermissionRequest
  │   FileEditTool → FileEditPermissionRequest
  │   其他工具     → 通用 PermissionRequest
  │
  ├─ 用户选项:
  │   [1] Yes (本次允许)
  │   [2] Yes, and allow all edits during this session (会话级)
  │   [3] No (拒绝)
  │
  └─ 处理用户选择:
      ├─ handleAcceptOnce()  → onAllow() 不生成规则
      ├─ handleAcceptSession() → onAllow() + PermissionUpdate[]
      │    └─ generateSuggestions() 自动生成建议规则
      └─ handleReject()     → onReject() + 可选反馈
```

### 7.2 规则生成

用户选择 "Always Allow" 时，系统自动生成规则建议：

```typescript
// 精确命令匹配 → 生成精确规则
suggestionForExactCommand("Bash", "git commit")
// → { type: 'addRules', rules: [{ toolName: "Bash", ruleContent: "git commit" }],
//      behavior: 'allow', destination: 'localSettings' }

// 前缀匹配 → 生成前缀规则
suggestionForPrefix("Bash", "npm")
// → { type: 'addRules', rules: [{ toolName: "Bash", ruleContent: "npm:*" }],
//      behavior: 'allow', destination: 'localSettings' }
```

### 7.3 持久化时机

```
用户选择 "Always Allow"
  → PermissionUpdate[] 生成
  → applyPermissionUpdate() 更新内存中的 ToolPermissionContext
  → persistPermissionUpdates() 写入 settings.json
    ├─ 'userSettings'  → ~/.claude/settings.json
    ├─ 'projectSettings' → .claude/settings.json
    └─ 'session' → 仅内存，不写入磁盘
```

---

## 8. 安全设计原则

### 8.1 五条核心原则

| 原则 | 实现 |
|------|------|
| **默认拒绝** | 未知工具/操作默认返回 `ask`（不是 `allow`） |
| **deny 最高优先** | 步骤 1a 最先检查 deny 规则，后续无法覆盖 |
| **bypass-immune** | 1f/1g 的检查在 `bypassPermissions` 模式下也不可跳过 |
| **最小权限** | 规则匹配越精确越好，`*` 通配符有特殊限制 |
| **熔断保护** | auto 模式连续拒绝 3 次或累计 20 次后降级 |

### 8.2 多层防御

```
第 1 层: 管理员策略 (policySettings + allowManagedPermissionRulesOnly)
  ↓
第 2 层: deny 规则 (最高优先级，不可被 bypass 跳过)
  ↓
第 3 层: 安全检查 (sensitive paths, bypass-immune)
  ↓
第 4 层: 工具自定义 checkPermissions()
  ↓
第 5 层: 用户交互确认 (ask → 弹窗)
  ↓
第 6 层: 沙箱隔离 (Bash 在沙箱中执行)
```

### 8.3 企业管控

```typescript
// permissionsLoader.ts:31-36
function shouldAllowManagedPermissionRulesOnly(): boolean {
  return getSettingsForSource('policySettings')?.allowManagedPermissionRulesOnly === true
}
```

启用后：
- 只加载 `policySettings` 的规则
- 用户无法添加/修改规则
- "Always Allow" 按钮隐藏

---

## 附录: 关键源码文件索引

| 文件 | 职责 |
|------|------|
| `src/types/permissions.ts` | 所有权限相关类型定义 |
| `src/utils/permissions/permissions.ts` | 核心检查管道 `hasPermissionsToUseTool` |
| `src/utils/permissions/permissionsLoader.ts` | 规则加载/添加/删除 |
| `src/utils/permissions/shellRuleMatching.ts` | 通配符/前缀/精确匹配 |
| `src/utils/permissions/denialTracking.ts` | 拒绝计数与熔断 |
| `src/utils/permissions/filesystem.ts` | 文件路径安全检查 |
| `src/utils/permissions/PermissionUpdate.ts` | 权限更新应用与持久化 |
| `src/utils/permissions/yoloClassifier.ts` | auto 模式 AI 分类器 |
| `src/hooks/useCanUseTool.tsx` | 连接权限检查与 UI 的 hook |
| `src/components/permissions/` | 权限提示 UI 组件 |
