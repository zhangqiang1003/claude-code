/**
 * 学习示例 04: Multi-Agent 协作（增强版）
 *
 * 参考 Claude Code 的 AgentTool 架构，实现 Multi-Agent 系统：
 * - 主 Agent (Orchestrator) 动态路由 + 编排
 * - 3 个专家子 Agent（景点/美食/交通），各有专属工具和 system prompt
 * - 串行 + 并行混合调度（景点先出路线，美食/交通基于景点结果并行）
 * - Tool Calling 循环（子 Agent 可调用工具获取实时信息）
 * - 错误隔离（单个 Agent 失败不影响整体）
 * - 流式整合输出
 * - Human-in-the-Loop 权限系统（工具执行前用户确认 + 规则持久化 + 权限模式）
 *
 * 关键概念（对应 Claude Code 源码）：
 * - 动态路由 = subagent_type 参数 + whenToUse 描述（AgentTool.tsx）
 * - 串行 Pipeline = "先研究再实现" 模式（prompt.ts）
 * - Tool Calling = tools 白名单/黑名单机制（agentToolUtils.ts）
 * - 错误隔离 = 独立 try/finally（runAgent.ts）
 * - 上下文优化 = 按角色过滤上下文（runAgent.ts 的 omitClaudeMd）
 * - 权限系统 = allow/deny/ask 三元决策 + 规则模式匹配 + 管道（permissions.ts）
 * - 权限模式 = default/bypass/dontAsk 三种模式改变管道行为
 *
 * 运行方式：
 * 1. 设置环境变量： export GLM_API_KEY="your-api-key"
 * 2. 运行： bun run learn-examples/04-multi-agent.ts
 */

import * as readline from 'readline'

// ==========================
// 配置（复用 02 的 GLM API 配置）
// ==========================

const GLM_API_KEY = process.env.GLM_API_KEY || '6f73bcf2b4e646ac97e650a18fb2bdd2.EhGpUILl8hA38RQm'
const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/coding/paas/v4'
const MODEL = 'glm-5.1'

if (!GLM_API_KEY) {
	console.error('❌ 请设置环境变量 GLM_API_KEY')
	process.exit(1)
}

// ==========================
// 通用 LLM 调用函数
// ==========================

const API_HEADERS = {
	'Content-Type': 'application/json',
	'Authorization': `Bearer ${GLM_API_KEY}`,
}

const MAX_RETRIES = 3
const RETRY_BASE_DELAY = 2000 // 基础等待 2 秒

// GLM 可重试的错误码：限流、服务过载、服务繁忙
const RETRYABLE_ERROR_CODES = new Set(['1305', '1301', '1302'])

/**
 * 判断是否为可重试的错误
 * 检查两个维度：HTTP 状态码 + GLM 错误码
 */
function isRetryableError(status: number, errorCode?: string): boolean {
	// HTTP 层面：429 限流 或 5xx 服务端错误
	if (status === 429 || status >= 500) return true
	// GLM 错误码层面：限流/过载
	if (errorCode && RETRYABLE_ERROR_CODES.has(errorCode)) return true
	return false
}

/**
 * 带重试的 fetch 请求
 * 策略：指数退避（2s → 4s → 8s），仅对限流和服务端错误重试
 */
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		const response = await fetch(url, options)

		// 成功 → 直接返回
		if (response.ok) return response

		// 失败 → 读取错误体，判断是否可重试
		let errorData: any
		try {
			errorData = await response.json()
		} catch {
			// JSON 解析失败，按 HTTP 状态码判断
			errorData = {}
		}

		const errorCode = String(errorData.error?.code || '')
		if (!isRetryableError(response.status, errorCode)) {
			// 不可重试的错误（如 401 鉴权失败），直接抛出
			throw new Error(`API 调用失败: ${JSON.stringify(errorData)}`)
		}

		// 可重试的错误
		const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1)

		if (attempt < MAX_RETRIES) {
			console.log(`  ⚠️ 请求失败 (${errorCode || response.status}): 第 ${attempt}/${MAX_RETRIES} 次重试，${delay / 1000}s 后重试...`)
			await new Promise(resolve => setTimeout(resolve, delay))
		} else {
			throw new Error(`API 调用失败（已重试 ${MAX_RETRIES} 次）: ${JSON.stringify(errorData)}`)
		}
	}

	throw new Error('不应到达此处')
}

/**
 * 调用 GLM API（非流式）
 * 子 Agent 不需要流式输出，直接拿完整结果
 */
async function callLLM(messages: { role: string; content: string }[]): Promise<string> {
	const response = await fetchWithRetry(`${GLM_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: API_HEADERS,
		body: JSON.stringify({
			model: MODEL,
			messages,
			temperature: 0.7,
			max_tokens: 2048,
			stream: false,
		}),
	})

	const data = await response.json() as any
	return data.choices[0].message.content || '（无响应）'
}

/**
 * 调用 GLM API（流式）
 * 主 Agent 整合结果时使用，实时输出给用户看
 *
 * SSE 解析流程：chunk → buffer → 按行分割 → "data: {json}" → delta.content
 */
async function callLLMStream(messages: { role: string; content: string }[]): Promise<string> {
	const response = await fetchWithRetry(`${GLM_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: API_HEADERS,
		body: JSON.stringify({
			model: MODEL,
			messages,
			temperature: 0.7,
			max_tokens: 4096,
			stream: true,
		}),
	})

	const reader = response.body!.getReader()
	const decoder = new TextDecoder()
	let fullContent = ''
	let buffer = ''

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split('\n')
		buffer = lines.pop() || '' // 保留最后一个不完整的行

		for (const line of lines) {
			if (!line.trim() || !line.startsWith('data: ')) continue

			const jsonStr = line.slice(6)
			if (jsonStr === '[DONE]') continue

			try {
				const data = JSON.parse(jsonStr)
				const delta = data.choices?.[0]?.delta
				if (delta?.content) {
					fullContent += delta.content
					process.stdout.write(delta.content) // 实时输出，不换行
				}
			} catch {
				// JSON 不完整，跳过
			}
		}
	}

	return fullContent
}

// ==========================
// 类型定义
// ==========================

// 工具定义 — 参考 Claude Code 的 tools 白名单/黑名单机制
interface ToolDefinition {
	name: string
	description: string
	parameters: Record<string, any>   // JSON Schema
	execute: (args: any) => Promise<string>
}

// Agent 定义
interface AgentDefinition {
	name: string              // 如 'scenic', 'food', 'transport'
	role: string              // 角色描述，用于 system prompt
	whenToUse: string         // 描述什么场景该用我（供路由参考）
	systemPrompt: string      // 专属提示词
	tools?: ToolDefinition[]  // 可用工具列表（可选，类比 Claude Code 的 tools 配置）
}

// 子 Agent 返回结果
interface AgentResult {
	agentName: string
	content: string           // 子 Agent 的完整回复
	toolCallsCount: number    // 本次调用中工具被使用的次数
}

// ==========================
// Human-in-the-Loop 权限系统
// 参考 Claude Code 的 permissions 模块
//
// 架构：Rule 匹配 → Mode 转换 → 用户交互
//   1. matchRules()   — 规则模式匹配（deny 优先 → ask → allow）
//   2. checkPermission() — 权限管道（bypass 短路 → 规则 → 模式转换）
//   3. promptPermission() — 终端交互（Allow/Always Allow/Deny/Always Deny）
// ==========================

// 权限决策：三元组 — 参考 Claude Code 的 PermissionBehavior
type PermissionDecision = 'allow' | 'deny' | 'ask'

// 权限模式 — 参考 Claude Code 的 PermissionMode
// - default:  正常管道，未知工具 ask
// - bypass:   跳过所有检查（= --dangerously-skip-permissions）
// - dontAsk:  ask 自动变 deny（批处理/无人值守）
type PermissionMode = 'default' | 'bypass' | 'dontAsk'

// 权限规则 — 参考 Claude Code 的 .claude/settings.json
interface PermissionRule {
	toolPattern: string        // 工具名模式：精确匹配 'get_weather' 或通配符 '*'
	decision: PermissionDecision
	source: 'config' | 'session' | 'default'
}

// 会话级规则存储（模拟 Claude Code 的 settings.json 持久化）
// 会话期间 Always Allow/Deny 的规则存在这里
const sessionRules: PermissionRule[] = []

// 当前权限模式
let permissionMode: PermissionMode = 'default'

/**
 * 模式匹配 — 参考 Claude Code 的 pattern matching
 * 支持：精确匹配 'get_weather' 和通配符 '*'
 *
 * Claude Code 还支持 Bash(rm *) 这种 参数通配符，
 * 这里简化为工具名级别匹配（教学目的）
 */
function matchPattern(toolName: string, pattern: string): boolean {
	if (pattern === '*') return true
	return toolName === pattern
}

/**
 * 规则匹配引擎 — deny 优先原则
 * 参考 Claude Code 的 checkPermissions() 流程
 *
 * 检查顺序：deny 规则 → ask 规则 → allow 规则 → 默认 ask
 * deny 永远最高优先级（安全第一）
 */
function matchRules(toolName: string, rules: PermissionRule[]): PermissionDecision {
	// 第 1 轮：查 deny 规则（最高优先级）
	for (const rule of rules) {
		if (rule.decision === 'deny' && matchPattern(toolName, rule.toolPattern)) {
			return 'deny'
		}
	}
	// 第 2 轮：查 ask 规则
	for (const rule of rules) {
		if (rule.decision === 'ask' && matchPattern(toolName, rule.toolPattern)) {
			return 'ask'
		}
	}
	// 第 3 轮：查 allow 规则
	for (const rule of rules) {
		if (rule.decision === 'allow' && matchPattern(toolName, rule.toolPattern)) {
			return 'allow'
		}
	}
	// 兜底：未知工具默认 ask（安全第一）
	return 'ask'
}

/**
 * 权限检查管道 — 完整的 check 流程
 * 参考 Claude Code 的 permission pipeline
 *
 * 流程：bypass 短路 → 规则匹配 → 模式转换 → 返回最终决策
 *
 * @param toolName 工具名称
 * @returns 最终决策：allow / deny / ask
 */
function checkPermission(toolName: string): PermissionDecision {
	// 短路 1：bypass 模式直接放行（跳过所有规则！）
	// 这就是 --dangerously-skip-permissions 的效果
	if (permissionMode === 'bypass') return 'allow'

	// 正常管道：先查规则
	const ruleResult = matchRules(toolName, sessionRules)

	// 短路 2：dontAsk 模式将 ask 转为 deny
	if (permissionMode === 'dontAsk' && ruleResult === 'ask') return 'deny'

	return ruleResult
}

/**
 * 终端交互式权限提示
 * 参考 Claude Code REPL 的 PermissionPrompt 组件
 *
 * 用户选项（映射 Claude Code 的 4 个按钮）：
 * - [1] Allow        → 本次放行
 * - [2] Always Allow → 放行 + 生成规则（存入 sessionRules）
 * - [3] Deny         → 本次拒绝
 * - [4] Always Deny  → 拒绝 + 生成规则
 *
 * @returns 'allow' | 'deny'
 */
async function promptPermission(toolName: string, args: any): Promise<'allow' | 'deny'> {
	console.log(`\n  🔒 权限请求: 工具 [${toolName}] 想要执行`)
	console.log(`     参数: ${JSON.stringify(args)}`)
	console.log(`  ─────────────────────────────`)
	console.log(`    [1] ✅ Allow         (本次放行)`)
	console.log(`    [2] ✅ Always Allow  (永久放行)`)
	console.log(`    [3] ❌ Deny          (本次拒绝)`)
	console.log(`    [4] ❌ Always Deny   (永久拒绝)`)
	console.log(`  ─────────────────────────────`)

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
	const answer = await new Promise<string>(resolve => {
		rl.question('  你的选择 [1-4]: ', a => { rl.close(); resolve(a.trim()) })
	})

	switch (answer) {
		case '2': {
			// Always Allow → 持久化规则到会话
			sessionRules.push({ toolPattern: toolName, decision: 'allow', source: 'session' })
			console.log(`  📌 已记住: ${toolName} → Always Allow`)
			return 'allow'
		}
		case '3':
			console.log(`  🚫 已拒绝: ${toolName}`)
			return 'deny'
		case '4': {
			// Always Deny → 持久化规则到会话
			sessionRules.push({ toolPattern: toolName, decision: 'deny', source: 'session' })
			console.log(`  📌 已记住: ${toolName} → Always Deny`)
			return 'deny'
		}
		default: // [1] Allow
			return 'allow'
	}
}

/**
 * 显示当前权限状态（/perm 命令调用）
 */
function showPermissionStatus(): void {
	console.log('\n📋 权限系统状态')
	console.log('─'.repeat(30))
	console.log(`  模式: ${permissionMode}`)
	console.log(`  规则数: ${sessionRules.length}`)
	if (sessionRules.length > 0) {
		for (const rule of sessionRules) {
			const icon = rule.decision === 'allow' ? '✅' : rule.decision === 'deny' ? '🚫' : '❓'
			console.log(`    ${icon} ${rule.toolPattern} → ${rule.decision} (${rule.source})`)
		}
	}
	console.log('─'.repeat(30))
}


// ==========================
// Context Window 管理 & Compaction
// 参考 Claude Code 的 services/compact/ 模块
//
// 架构（简化版 2 层管道）：
//   Layer 1: Token 追踪 — 每轮读取 API usage 数据
//   Layer 2: Autocompact — 超过阈值时调 LLM 生成摘要，替换旧消息
//
// Claude Code 实际有 4 层（Microcompact → SessionMemory → Autocompact → Reactive），
// 这里简化为 2 层做教学演示。
// ==========================

const MAX_CONTEXT_TOKENS = 128000  // 模型的 context window 上限
const COMPACT_THRESHOLD = 0.8      // 80% 时触发压缩
const KEEP_RECENT_ROUNDS = 3       // 压缩时保留最近 N 轮（含 system + user）
// 摘要输出上限（compactMessages 内部通过 callLLM 的 prompt 控制）

/**
 * 判断是否需要压缩
 * 参考 Claude Code 的 shouldAutoCompact() — 阈值 = 有效窗口 - buffer
 */
function shouldCompact(usageTokens: number): boolean {
	return usageTokens > MAX_CONTEXT_TOKENS * COMPACT_THRESHOLD
}

/**
 * 估算消息数组的 token 数（粗略）
 * 参考 Claude Code 的 roughTokenCountEstimation()
 * 实际生产中应该用 API 返回的 usage 数据，这里作为 fallback
 */
function estimateTokens(messages: any[]): number {
	let total = 0
	for (const msg of messages) {
		if (typeof msg.content === 'string') {
			// 粗估：1 个中文字符 ≈ 2 tokens，1 个英文单词 ≈ 1.3 tokens
			total += Math.ceil(msg.content.length * 1.5)
		}
		// tool_calls 的 arguments 也算
		if (msg.tool_calls) {
			for (const tc of msg.tool_calls) {
				total += Math.ceil(JSON.stringify(tc).length * 1.5)
			}
		}
	}
	return total
}

/**
 * 核心压缩函数 — 用 LLM 摘要替换旧消息
 * 参考 Claude Code 的 compactConversation()
 *
 * 策略：
 * 1. 保留前 2 条消息（system prompt + 用户原始请求）
 * 2. 保留最近 KEEP_RECENT_ROUNDS 条消息（当前上下文）
 * 3. 中间的旧消息 → 调 LLM 生成摘要 → 替换为一条 summary 消息
 *
 * @param messages 当前消息数组
 * @param usageTokens API 返回的精确 token 数（可选）
 * @returns 压缩后的消息数组
 */
async function compactMessages(messages: any[], usageTokens?: number): Promise<any[]> {
	const currentTokens = usageTokens ?? estimateTokens(messages)
	console.log(`\n  🗜️ [Compaction] 开始压缩...`)
	console.log(`     当前: ${currentTokens} tokens / ${messages.length} 条消息`)

	// 至少需要 4 条消息才有意义压缩（system + user + 至少 1 轮 + 最近几条）
	if (messages.length < 4 + KEEP_RECENT_ROUNDS) {
		console.log(`     消息太少，跳过压缩`)
		return messages
	}

	// 优先级分层 — 参考 Claude Code 的 priority-based retention
	const systemAndFirstUser = messages.slice(0, 2)           // system + 用户原始请求（永不压缩）
	const recentMessages = messages.slice(-KEEP_RECENT_ROUNDS) // 最近 N 轮（保留原样）
	const oldMessages = messages.slice(2, -KEEP_RECENT_ROUNDS) // 中间的旧消息（要压缩）

	if (oldMessages.length === 0) {
		console.log(`     没有旧消息需要压缩`)
		return messages
	}

	console.log(`     保留: 前 2 条 + 最近 ${KEEP_RECENT_ROUNDS} 条`)
	console.log(`     压缩: 中间 ${oldMessages.length} 条 → LLM 摘要`)

	// 构建摘要 prompt — 参考 Claude Code 的 getCompactPrompt()
	const summaryPrompt = `请将以下对话历史压缩成一段简洁的摘要。

要求：
1. 保留所有关键决策和结论
2. 保留用户的具体需求和偏好
3. 保留工具调用的重要结果（如查询到的数据）
4. 丢弃无关紧要的细节（如问候语、重复信息）
5. 用中文输出，不超过 500 字

对话历史：
---
${oldMessages.map(m => {
	if (typeof m.content === 'string') return `[${m.role}]: ${m.content.slice(0, 500)}`
	if (m.tool_calls) return `[assistant tool_calls]: ${JSON.stringify(m.tool_calls).slice(0, 300)}`
	return `[${m.role}]: (工具结果)`
}).join('\n')}
---`

	// 调用 LLM 生成摘要
	const summary = await callLLM([
		{ role: 'system', content: '你是一个对话摘要助手。请将对话历史压缩成简洁的摘要，保留所有关键信息。' },
		{ role: 'user', content: summaryPrompt },
	])

	console.log(`     ✅ 摘要生成完成 (${summary.length} 字符)`)

	// 组装压缩后的消息数组
	const compacted = [
		...systemAndFirstUser,
		// 摘要消息 — 替代被压缩的旧消息
		{ role: 'user', content: `[对话摘要] 以下是之前对话的摘要：\n${summary}` },
		{ role: 'assistant', content: '收到，我已了解之前的对话内容。请问还有什么需要帮助的？' },
		...recentMessages,
	]

	const newEstimate = estimateTokens(compacted)
	console.log(`     压缩后: ~${newEstimate} tokens / ${compacted.length} 条消息`)
	console.log(`     节省: ~${currentTokens - newEstimate} tokens`)

	return compacted
}


// ==========================
// 定义三个专家 agent + 工具
// 参考 Claude Code 的 tools 白名单/黑名单机制
// ==========================

// --- 工具定义 ---

// 天气查询工具（模拟） — 给 transport Agent 使用
const weatherTool: ToolDefinition = {
	name: 'get_weather',
	description: '获取指定城市未来几天的天气预报，包括温度和天气状况',
	parameters: {
		type: 'object',
		properties: {
			city: { type: 'string', description: '城市名称，如"北京"' },
			days: { type: 'number', description: '预报天数，默认3天' },
		},
		required: ['city'],
	},
	execute: async (args) => {
		// 模拟天气 API（实际项目中替换为真实 API 调用）
		const city = args.city || '北京'
		const days = args.days || 3
		console.log(`    🔧 [工具调用] get_weather(${city}, ${days}天)`)
		// 模拟返回数据
		const forecasts = [
			{ day: '第1天', temp: '18-25°C', condition: '晴转多云' },
			{ day: '第2天', temp: '15-22°C', condition: '多云转小雨' },
			{ day: '第3天', temp: '12-20°C', condition: '晴' },
		]
		return JSON.stringify({ city, forecasts: forecasts.slice(0, days) })
	},
}

// 景点门票查询工具（模拟） — 给 scenic Agent 使用
const ticketTool: ToolDefinition = {
	name: 'get_ticket_info',
	description: '查询北京景点的门票价格、开放时间、预约信息',
	parameters: {
		type: 'object',
		properties: {
			attraction: { type: 'string', description: '景点名称，如"故宫"、"长城"' },
		},
		required: ['attraction'],
	},
	execute: async (args) => {
		const attraction = args.attraction
		console.log(`    🔧 [工具调用] get_ticket_info(${attraction})`)
		// 模拟门票数据
		const tickets: Record<string, any> = {
			'故宫': { price: '60元（旺季）/ 40元（淡季）', hours: '8:30-17:00', needReservation: true },
			'长城': { price: '40元（八达岭）', hours: '6:30-19:00', needReservation: true },
			'颐和园': { price: '30元（联票60元）', hours: '6:30-18:00', needReservation: false },
			'天坛': { price: '15元（联票34元）', hours: '6:00-22:00', needReservation: false },
		}
		const info = tickets[attraction] || { price: '待查询', hours: '待查询', needReservation: false }
		return JSON.stringify({ attraction, ...info })
	},
}

const AGENTS: Record<string, AgentDefinition> = {
	scenic: {
		name: 'scenic',
		role: '景点规划专家',
		whenToUse: '用户需要景点推荐、游览路线规划、行程安排时使用',
		tools: [ticketTool],   // 景点 Agent 可以查门票信息
		systemPrompt: `你是一个北京旅游景点规划专家。
你的任务是规划合理的游览路线。
你可以使用 get_ticket_info 工具查询景点门票价格和开放时间，请在规划路线时查询相关景点信息以提供更准确的建议。
输出格式要求：
- 按时间线排列（上午/下午/晚上）
- 标注景点之间的距离和交通方式
- 标注门票价格和开放时间
- 推荐游览时长
只输出景点路线规划，不要包含餐厅和住宿推荐。`,
	},
	food: {
		name: 'food',
		role: '美食推荐专家',
		whenToUse: '用户需要美食推荐、餐厅选择、特色小吃、用餐安排时使用',
		// 美食 Agent 暂无工具，纯靠知识回答
		systemPrompt: `你是一个北京美食推荐专家。
你的任务是根据景点位置推荐附近的美食。
输出格式要求：
- 按早/中/晚餐分类
- 推荐具体餐厅名称和大致价格
- 标注距离景点的距离
只输出美食推荐，不要包含景点和交通推荐。`,
	},
	transport: {
		name: 'transport',
		role: '交通住宿专家',
		whenToUse: '用户需要交通方案、住宿推荐、出行方式、费用估算时使用',
		tools: [weatherTool],  // 交通 Agent 可以查天气预报
		systemPrompt: `你是一个北京交通和住宿规划专家。
你的任务是根据行程推荐交通方案和住宿选择。
你可以使用 get_weather 工具查询目的地天气，根据天气情况给出出行建议（如是否需要带伞、穿什么衣服）。
输出格式要求：
- 推荐住宿区域（考虑三天的行程路线）
- 每日交通方案（地铁/公交/打车）
- 天气预报和穿衣建议
- 大致费用估算
只输出交通和住宿建议。`,
	},
}

// ==========================
// 第三步：agentCall() — spawn 子 Agent
// 这是核心函数。参考 Claude Code 的 runAgent.ts，子 Agent 本质上就是一次独立的 API 调用
// ==========================

/**
 * 动态路由 — 让 LLM 判断需要哪些 Agent
 * 参考 Claude Code 的 subagent_type 参数 + whenToUse 描述机制
 */
async function routeAgents(userRequest: string): Promise<string[]> {
	const agentList = Object.values(AGENTS)
		.map(a => `- ${a.name}: ${a.whenToUse}`)
		.join('\n')

	const prompt = `用户需求: ${userRequest}

可选专家:
${agentList}

请判断需要哪些专家来回答这个问题。
只输出需要的专家名称，逗号分隔（如: scenic,food）
如果都不需要，输出: none`

	const result = await callLLM([{ role: 'user', content: prompt }])
	if (result.trim().toLowerCase() === 'none') return []
	return result.split(',').map(s => s.trim()).filter(Boolean)
}

/**
 * 调用子 Agent 执行任务（支持 Tool Calling）
 * 类比 Claude Code 中 AgentTool 内部调用 query()
 *
 * Tool Calling 循环：
 * 1. 发送消息 + 工具定义给 LLM
 * 2. LLM 返回 tool_call → 执行工具 → 结果喂回 LLM
 * 3. LLM 基于工具结果生成最终回复
 * 4. 最多循环 MAX_TOOL_ROUNDS 次，防止无限调用
 *
 * @param agent Agent 定义（含专属 system prompt + 可选工具）
 * @param task  具体任务描述
 * @returns Agent 的回复内容
 */
const MAX_TOOL_ROUNDS = 5

async function agentCall(agent: AgentDefinition, task: string): Promise<AgentResult> {
	const startTime = Date.now()
	console.log(`  ⏳ [${agent.role}] 思考中...`)

	// 无工具的 Agent：直接调 LLM
	if (!agent.tools || agent.tools.length === 0) {
		const messages = [
			{ role: 'system', content: agent.systemPrompt },
			{ role: 'user', content: task },
		]
		const content = await callLLM(messages)
		const elapsed = Date.now() - startTime
		console.log(`  ✅ [${agent.role}] 完成 (${elapsed}ms)`)
		return { agentName: agent.name, content, toolCallsCount: 0 }
	}

	// 有工具的 Agent：支持 Tool Calling 循环
	const toolsSchema = agent.tools.map(t => ({
		type: 'function' as const,
		function: {
			name: t.name,
			description: t.description,
			parameters: t.parameters,
		},
	}))

	// 用 any[] 因为消息类型在多轮中会混合 text 和 tool_result
	const messages: any[] = [
		{ role: 'system', content: agent.systemPrompt },
		{ role: 'user', content: task },
	]

	let totalToolCalls = 0

	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		// 调用 LLM（带工具定义）
		const response = await fetchWithRetry(`${GLM_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: API_HEADERS,
			body: JSON.stringify({
				model: MODEL,
				messages,
				tools: toolsSchema,
				temperature: 0.7,
				max_tokens: 2048,
				stream: false,
			}),
		})

		const data = await response.json() as any
		const choice = data.choices[0]
		const assistantMsg = choice.message

		// === Token 用量追踪 — 参考 Claude Code 的 tokenCountWithEstimation() ===
		if (data.usage) {
			const used = data.usage.prompt_tokens as number
			const pct = Math.round((used / MAX_CONTEXT_TOKENS) * 100)
			console.log(`    📊 Token: ${used}/${MAX_CONTEXT_TOKENS} (${pct}%)`)

			// === Autocompact 触发 — 超过阈值时压缩 ===
			if (shouldCompact(used)) {
				console.log(`    ⚠️ 接近上下文上限 (${pct}%)，触发自动压缩...`)
				const compacted = await compactMessages(messages, used)
				messages.length = 0           // 清空原数组
				messages.push(...compacted)    // 替换为压缩后的消息
			}
		}

		// 没有工具调用 → LLM 直接给了最终回复
		if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
			const elapsed = Date.now() - startTime
			console.log(`  ✅ [${agent.role}] 完成 (${elapsed}ms, ${totalToolCalls} 次工具调用)`)
			return { agentName: agent.name, content: assistantMsg.content || '（无响应）', toolCallsCount: totalToolCalls }
		}

		// 有工具调用 → 权限检查 → 执行工具 → 结果喂回
		messages.push(assistantMsg) // 保留 assistant 的 tool_call 消息
		for (const toolCall of assistantMsg.tool_calls) {
			const tool = agent.tools!.find(t => t.name === toolCall.function.name)
			if (!tool) {
				messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `工具 ${toolCall.function.name} 不存在` })
				continue
			}

			totalToolCalls++
			const args = JSON.parse(toolCall.function.arguments)

			// === Human-in-the-Loop 权限检查 ===
			// 参考 Claude Code：工具执行前先走权限管道
			const decision = checkPermission(tool.name)

			if (decision === 'deny') {
				// 直接拒绝 — 告诉 LLM 工具被拒绝
				console.log(`  🚫 [权限] ${tool.name} 被规则拒绝`)
				messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `[权限拒绝] 工具 ${tool.name} 被用户配置的安全规则拒绝执行。请不使用此工具继续回答。` })
				continue
			}

			if (decision === 'ask') {
				// 需要用户确认 — await 暂停 Agentic Loop
				const userChoice = await promptPermission(tool.name, args)
				if (userChoice === 'deny') {
					messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `[权限拒绝] 用户拒绝了工具 ${tool.name} 的执行。请不使用此工具继续回答。` })
					continue
				}
			}
			// decision === 'allow' → 直接执行，无需交互

			const toolResult = await tool.execute(args)
			messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult })
		}
	}

	// 超过最大轮次，强制取最后一次 LLM 回复
	const elapsed = Date.now() - startTime
	console.log(`  ⚠️ [${agent.role}] 达到最大工具调用轮次 (${MAX_TOOL_ROUNDS})`)
	return { agentName: agent.name, content: messages[messages.length - 1]?.content || '（超时）', toolCallsCount: totalToolCalls }
}

/**
 * 按角色构建差异化的任务提示词
 * 参考 Claude Code 的上下文过滤：按 Agent 角色传递不同信息
 *
 * @param agent      Agent 定义
 * @param userRequest 用户原始需求
 * @param scenicCtx  景点 Agent 的输出（可选，用于上下文传递）
 */
function buildTaskPrompt(agent: AgentDefinition, userRequest: string, scenicCtx?: string): string {
	let prompt = `用户需求: ${userRequest}\n`

	// 美食 Agent：注入景点路线，推荐沿途餐厅
	if (agent.name === 'food' && scenicCtx) {
		prompt += `\n## 景点路线参考\n${scenicCtx}\n\n请根据以上路线推荐沿途附近的美食。`
	}
	// 交通 Agent：注入景点位置，推荐合理住宿
	else if (agent.name === 'transport' && scenicCtx) {
		prompt += `\n## 景点位置参考\n${scenicCtx}\n\n请根据景点分布推荐住宿区域和交通方案。`
	}
	// 景点 Agent 或无上下文：只传用户需求
	else {
		prompt += '\n请根据以上需求，完成你的专业规划。'
	}

	return prompt
}


// ==========================
// 第四步：orchestrate() — 编排器
// 这是主 Agent 的大脑，负责拆分任务、并行调度、汇总结果
// ==========================

/**
 * 编排器 — 主 Agent 的逻辑
 *
 * 0. 动态路由：LLM 判断需要哪些 Agent
 * 1. 并行 spawn 选中的子 Agent（错误隔离）
 * 2. 汇总结果
 * 3. 流式整合输出
 */
async function orchestrate(userRequest: string): Promise<string> {
	console.log('\n📋 主 Agent 分析任务...')

	// === 阶段 0：动态路由 — 判断需要哪些 Agent ===
	console.log('  🧭 路由分析中...')
	const neededAgentNames = await routeAgents(userRequest)
	const agentsToRun = neededAgentNames
		.map(name => AGENTS[name])
		.filter((a): a is AgentDefinition => a !== undefined)

	if (agentsToRun.length === 0) {
		// 无需子 Agent，直接回答
		console.log('  ℹ️ 无需子 Agent，直接回答')
		return callLLMStream([
			{ role: 'system', content: '你是一个旅行规划助手。请直接回答用户的问题。' },
			{ role: 'user', content: userRequest },
		])
	}

	console.log(`  → 需要的专家: ${agentsToRun.map(a => a.role).join(', ')}`)

	// === 阶段 1：串行 + 并行混合调度 ===
	// 参考 Claude Code 的 "先研究再实现" 模式
	// 景点 Agent 先出路线 → 美食/交通基于景点结果并行
	const results: AgentResult[] = []
	const failures: string[] = []
	const hasScenic = agentsToRun.some(a => a.name === 'scenic')
	const dependentAgents = agentsToRun.filter(a => a.name !== 'scenic')

	// 1a. 景点 Agent 先执行（独立，无依赖）
	let scenicContext = ''
	if (hasScenic) {
		console.log('  📍 [串行阶段] 景点 Agent 先规划路线...')
		const taskPrompt = buildTaskPrompt(AGENTS.scenic, userRequest)
		try {
			const scenicResult = await agentCall(AGENTS.scenic, taskPrompt)
			results.push(scenicResult)
			scenicContext = scenicResult.content
		} catch (e: any) {
			console.log(`  ❌ [景点规划专家] 执行失败: ${e.message}`)
			failures.push('景点规划专家')
		}
	}

	// 1b. 其他 Agent 基于景点结果并行执行
	if (dependentAgents.length > 0) {
		console.log(`  🔄 [并行阶段] ${dependentAgents.map(a => a.role).join(' / ')} 并行执行...`)
		const depTasks = dependentAgents.map(agent => {
			const taskPrompt = buildTaskPrompt(agent, userRequest, scenicContext)
			return agentCall(agent, taskPrompt)
		})

		// 错误隔离 — 单个失败不影响整体
		const settled = await Promise.all(depTasks.map(t => t.catch(e => e)))
		for (let i = 0; i < settled.length; i++) {
			const r = settled[i]
			if (r instanceof Error) {
				console.log(`  ❌ [${dependentAgents[i].role}] 执行失败: ${r.message}`)
				failures.push(dependentAgents[i].role)
			} else {
				results.push(r)
			}
		}
	}

	if (results.length === 0) {
		throw new Error('所有 Agent 均执行失败')
	}

	// === 阶段 2：汇总结果 ===
	console.log('\n📊 主 Agent 汇总结果...')

	let summary = '# 北京三日游攻略\n\n'
	for (const result of results) {
		const agent = Object.values(AGENTS).find(a => a.name === result.agentName)!
		summary += `## ${agent.role}的建议\n\n${result.content}\n\n---\n\n`
	}

	// === 阶段 3：流式输出整合结果 ===
	console.log('\n📝 最终行程方案：')
	console.log('-'.repeat(40))

	const finalMessages = [
		{
			role: 'system',
			content: '你是一个旅行规划整合专家。将以下三个专家的建议整合为一份完整的三日游行程表，按 Day1/Day2/Day3 组织，要自然流畅，去除重复内容。用 markdown 格式输出。',
		},
		{ role: 'user', content: summary },
	]

	// 流式输出 — 用户实时看到整合过程
	const result = await callLLMStream(finalMessages)
	console.log('\n' + '-'.repeat(40))
	return result
}


// ==========================
// 第五步：main() — 整体流程
// ==========================

function readUserInput(): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	return new Promise(resolve => {
		rl.question('\n你: ', answer => {
			rl.close()
			resolve(answer.trim())
		})
	})
}

async function main() {
	console.log('=== Multi-Agent 旅行规划系统 (含权限 + Compaction) ===')
	console.log('='.repeat(40))
	console.log(`📝 模型: ${MODEL}`)
	console.log(`🔐 权限模式: ${permissionMode}`)
	console.log(`📏 Context Window: ${MAX_CONTEXT_TOKENS} tokens`)
	console.log('🔑 API Key: ' + (GLM_API_KEY ? '已配置 ✓' : '未配置 ❌'))
	console.log('输入你的旅行需求（输入 "退出" 结束）')
	console.log('命令: /perm 权限状态 | /mode 切换模式 | /compact 手动压缩\n')

	while (true) {
		const userInput = await readUserInput()

		if (!userInput) continue
		if (userInput === '退出') {
			console.log('👋 再见！')
			break
		}

		// === 权限系统命令 ===
		if (userInput === '/perm') {
			showPermissionStatus()
			continue
		}

		if (userInput.startsWith('/mode')) {
			const modeArg = userInput.split(' ')[1]
			if (modeArg === 'default' || modeArg === 'bypass' || modeArg === 'dontAsk') {
				permissionMode = modeArg
				console.log(`🔐 权限模式已切换为: ${permissionMode}`)
			} else {
				console.log('用法: /mode <default|bypass|dontAsk>')
				console.log('  default  — 正常模式，未知工具需用户确认')
				console.log('  bypass   — 跳过所有权限检查（慎用！）')
				console.log('  dontAsk  — 自动拒绝未授权的工具调用')
			}
			continue
		}

		// === Compaction 演示命令 ===
		if (userInput === '/compact') {
			console.log('\n🗜️ Compaction 系统说明')
			console.log('─'.repeat(30))
			console.log(`  Context Window: ${MAX_CONTEXT_TOKENS} tokens`)
			console.log(`  压缩阈值: ${COMPACT_THRESHOLD * 100}% (${Math.round(MAX_CONTEXT_TOKENS * COMPACT_THRESHOLD)} tokens)`)
			console.log(`  保留最近: ${KEEP_RECENT_ROUNDS} 轮消息`)
			console.log(`  压缩策略: 旧消息 → LLM 摘要替换`)
			console.log('')
			console.log('  触发方式:')
			console.log('    自动 — agentCall() 中 token 超过阈值时自动触发')
			console.log('    /compact — 本命令（展示压缩能力演示）')
			// 演示：构建模拟消息并压缩
			console.log('')
			console.log('  📋 演示：模拟 20 条消息的压缩过程...')
			const demoMessages: any[] = [
				{ role: 'system', content: '你是一个旅行助手' },
				{ role: 'user', content: '帮我规划北京三日游' },
			]
			for (let i = 1; i <= 9; i++) {
				demoMessages.push({ role: 'assistant', content: `第${i}轮：这是模拟的助手回复内容，包含景点推荐和路线规划...` })
				demoMessages.push({ role: 'user', content: `第${i}轮：用户的追问或反馈...` })
			}
			const compacted = await compactMessages(demoMessages)
			console.log(`  压缩前: ${demoMessages.length} 条消息`)
			console.log(`  压缩后: ${compacted.length} 条消息`)
			console.log('─'.repeat(30))
			continue
		}

		await orchestrate(userInput)
		console.log()
	}
}

main().catch(console.error)
