/**
 * 学习示例 04: Multi-Agent 协作
 *
 * 参考 Claude Code 的 AgentTool 架构，实现一个简化版 Multi-Agent 系统：
 * - 主 Agent (Orchestrator) 分析任务并拆分
 * - 3 个专家子 Agent 并行执行（景点/美食/交通）
 * - 主 Agent 汇总整合为最终方案
 *
 * 关键概念：
 * - 子 Agent = 一次独立的 API 调用（有自己的 system prompt）
 * - 并行调度 = Promise.all
 * - 结果汇总 = 再调一次 LLM 整合
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
// Agent 定义
interface AgentDefinition {
	name: string              // 如 'scenic', 'food', 'transport'
	role: string              // 角色描述，用于 system prompt
	systemPrompt: string      // 专属提示词
}

// 子 Agent 返回结果
interface AgentResult {
	agentName: string
	content: string           // 子 Agent 的完整回复
}


// ==========================
// 第二步：定义三个专家 agent
// 参考 exploreAgent.ts 的模式，每个 Agent 有专属 system prompt
// ==========================

const AGENTS: Record<string, AgentDefinition> = {
	scenic: {
		name: 'scenic',
		role: '景点规划专家',
		systemPrompt: `你是一个北京旅游景点规划专家。
你的任务是规划合理的游览路线。
输出格式要求：
- 按时间线排列（上午/下午/晚上）
- 标注景点之间的距离和交通方式
- 推荐游览时长
只输出景点路线规划，不要包含餐厅和住宿推荐。`,
	},
	food: {
		name: 'food',
		role: '美食推荐专家',
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
		systemPrompt: `你是一个北京交通和住宿规划专家。
你的任务是根据行程推荐交通方案和住宿选择。
输出格式要求：
- 推荐住宿区域（考虑三天的行程路线）
- 每日交通方案（地铁/公交/打车）
- 大致费用估算
只输出交通和住宿建议。`,
	},
}

// ==========================
// 第三步：agentCall() — spawn 子 Agent
// 这是核心函数。参考 Claude Code 的 runAgent.ts，子 Agent 本质上就是一次独立的 API 调用
// ==========================

/**
 * 调用子 Agent 执行任务
 * 类比 Claude Code 中 AgentTool 内部调用 query()
 *
 * @param agent Agent 定义（含专属 system prompt）
 * @param task  具体任务描述
 * @returns Agent 的回复内容
 */
async function agentCall(agent: AgentDefinition, task: string): Promise<AgentResult> {
	const startTime = Date.now()
	console.log(`  ⏳ [${agent.role}] 思考中...`)

	const messages = [
		{ role: 'system', content: agent.systemPrompt },
		{ role: 'user', content: task },
	]

	const content = await callLLM(messages)
	const elapsed = Date.now() - startTime
	console.log(`  ✅ [${agent.role}] 完成 (${elapsed}ms)`)

	return { agentName: agent.name, content }
}


// ==========================
// 第四步：orchestrate() — 编排器
// 这是主 Agent 的大脑，负责拆分任务、并行调度、汇总结果
// ==========================

/**
 * 编排器 — 主 Agent 的逻辑
 *
 * 1. 分析用户需求
 * 2. 并行 spawn 3 个子 Agent
 * 3. 汇总结果
 */
async function orchestrate(userRequest: string): Promise<string> {
	console.log('\n📋 主 Agent 分析任务...')

	// === 阶段 1：并行调用 3 个子 Agent ===
	const tasks = Object.values(AGENTS).map(agent => {
		const taskPrompt = `用户需求: ${userRequest}\n\n请根据以上需求，完成你的专业规划。`
		console.log(`  → 派发给 ${agent.role}...`)
		return agentCall(agent, taskPrompt)
	})

	// Promise.all 并行执行 — 3 个 Agent 同时工作
	const results = await Promise.all(tasks)

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
	console.log('=== Multi-Agent 旅行规划系统 ===')
	console.log('='.repeat(40))
	console.log(`📝 模型: ${MODEL}`)
	console.log('🔑 API Key: ' + (GLM_API_KEY ? '已配置 ✓' : '未配置 ❌'))
	console.log('输入你的旅行需求（输入 "退出" 结束）\n')

	while (true) {
		const userInput = await readUserInput()

		if (!userInput) continue
		if (userInput === '退出') {
			console.log('👋 再见！')
			break
		}

		await orchestrate(userInput)
		console.log()
	}
}

main().catch(console.error)
