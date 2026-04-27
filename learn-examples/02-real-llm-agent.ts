/**
 * 学习示例 02: 接入真实 LLM API
 *
 * 这个文件演示了如何将模拟的 callLLM 替换为真实的 GLM API 调用
 *
 * 运行方式：
 * 1. 设置环境变量： export GLM_API_KEY="your-api-key"
 * 2. 运行： bun run learn-examples/02-real-llm-agent.ts
 */

import * as readline from 'readline'
<<<<<<< HEAD
import { appendFileSync, mkdirSync } from 'node:fs'
=======
>>>>>>> main

// ============================================
// 配置
// ============================================

const GLM_API_KEY = process.env.GLM_API_KEY || '6f73bcf2b4e646ac97e650a18fb2bdd2.EhGpUILl8hA38RQm'
const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/coding/paas/v4'

if (!GLM_API_KEY) {
  console.error('❌ 请设置环境变量 GLM_API_KEY')
  console.error('   例如: export GLM_API_KEY="your-api-key"')
  process.exit(1)
}

// ============================================
// 工具定义（与 01 相同）
// ============================================

interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
  execute: (input: Record<string, unknown>) => Promise<string>
}

const getWeatherTool: Tool = {
  name: "get_weather",
  description: "获取指定城市的当前天气",
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", description: "城市名称" },
    },
    required: ["city"],
  },
  execute: async (input) => {
    const city = input.city as string
    const weathers = ['晴天', '多云', '小雨', '大雨', '雪']
    const temp = Math.floor(Math.random() * 30) + 5
    return `${city} 今天是 ${weathers[Math.floor(Math.random() * weathers.length)]}，气温 ${temp}°C`
  },
}

const calculatorTool: Tool = {
  name: "calculator",
  description: "执行数学计算",
  inputSchema: {
    type: "object",
    properties: {
      expression: { type: "string", description: "数学表达式" },
    },
    required: ["expression"],
  },
  execute: async (input) => {
    const expr = input.expression as string
    try {
      const result = Function(`"use strict"; return (${expr})`)()
      return `计算结果: ${expr} = ${result}`
    } catch {
      return `计算错误: 无法解析表达式 "${expr}"`
    }
  },
}

const getTimeTool: Tool = {
  name: "get_time",
  description: "获取当前时间",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    return `当前时间是：${new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`
  }
}

const tools: Tool[] = [getWeatherTool, calculatorTool, getTimeTool]

// ============================================
// GLM API 调用
// ============================================

interface GLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
}

interface GLMToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface GLMResponse {
  id: string
  choices: {
    index: number
    finish_reason: 'stop' | 'tool_calls'
    message: {
      role: 'assistant'
      content: string | null
      tool_calls?: GLMToolCall[]
    }
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * 将工具转换为 GLM 格式
 */
function toolsToGLMFormat(tools: Tool[]) {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }
  }))
}

/**
 * 调用真实的 GLM API
 */
async function callGLM(messages: Message[], tools: Tool[]): Promise<Message> {
  // 1. 转换消息格式
  const glmMessages: GLMMessage[] = messages.map(msg => {
    if (msg.role === 'system') {
      return { role: 'system' as const, content: msg.content as string }
    }

    if (typeof msg.content === 'string') {
      return { role: msg.role as 'user' | 'assistant', content: msg.content }
    }

    // 处理 tool_result
    const blocks = msg.content as ContentBlock[]
    const toolResults = blocks.filter(b => b.type === 'tool_result')
    if (toolResults.length > 0 && msg.role === 'user') {
      // GLM 格式：tool 角色的消息
      return {
        role: 'tool' as const,
        tool_call_id: toolResults[0].tool_use_id,
        content: toolResults[0].content || '',
      }
    }

    // 普通 assistant 消息
    const textBlock = blocks.find(b => b.type === 'text')
    const toolUseBlocks = blocks.filter(b => b.type === 'tool_use')

    let content = textBlock?.text || ''
    if (toolUseBlocks.length > 0) {
      content += '\n' + toolUseBlocks.map(b =>
        `[调用工具: ${b.name}(${JSON.stringify(b.input)})]`
      ).join('\n')
    }

    return { role: 'assistant' as const, content }
  })

  // 2. 发送请求
  console.log('📤 调用 GLM API...')
  const startTime = Date.now()

  const response = await fetch(`${GLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-5.1',  // 或 'glm-4-plus', 'glm-4-air'
      messages: glmMessages,
      tools: toolsToGLMFormat(tools),
      temperature: 0.7,
      max_tokens: 1024,
<<<<<<< HEAD
      stream: true,
    }),
  })

  // ============================================
  // 流式响应处理
  // ============================================

  if (!response.ok) {
    const errorData = await response.json() as any
    console.error('❌ GLM API 错误:', errorData)
    return {
      role: 'assistant',
      content: `API 调用失败: ${JSON.stringify(errorData)}`
    }
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  // 累积的内容
  let fullContent = ''
  let finishReason = ''
  const toolCalls: { id: string; name: string; arguments: string }[] = []

  // 用于处理跨 chunk 的不完整数据
  let buffer = ''

  console.log('📝 流式输出: ')

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    // 将新数据追加到 buffer
    buffer += decoder.decode(value, { stream: true })

    // 按双换行符分割 SSE 事件
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''  // 保留最后一个不完整的行

    for (const line of lines) {
      // 跳过空行
      if (!line.trim()) continue

      // SSE 格式: "data: {...}"
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6)  // 去掉 "data: "

        // 流结束标记
        if (jsonStr === '[DONE]') {
          continue
        }

        try {
          const data = JSON.parse(jsonStr)
          const delta = data.choices?.[0]?.delta
          finishReason = data.choices?.[0]?.finish_reason || finishReason

          if (delta) {
            // 1. 文本内容
            if (delta.content) {
              fullContent += delta.content
              // 实时输出（不换行）
              process.stdout.write(delta.content)
            }

            // 2. 工具调用（流式返回）
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolCalls[idx]) {
                  toolCalls[idx] = { id: tc.id || '', name: '', arguments: '' }
                }
                if (tc.id) toolCalls[idx].id = tc.id
                if (tc.function?.name) toolCalls[idx].name = tc.function.name
                if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments
              }
            }
          }
        } catch (e) {
          // JSON 解析失败，可能是数据不完整
          // console.log('解析错误:', e)
        }
      }
    }
  }

  const elapsed = Date.now() - startTime
  console.log(`\n\n✅ 流式响应完成 (${elapsed}ms)`)

  // 处理工具调用
  if (finishReason === 'tool_calls' && toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: [
        { type: 'text', text: fullContent },
        ...toolCalls.map(tc => ({
          type: 'tool_use' as const,
          name: tc.name,
          input: JSON.parse(tc.arguments),
=======
    }),
  })

  const data = await response.json() as any
  const elapsed = Date.now() - startTime
  console.log(`✅ GLM 响应 (${elapsed}ms)`)

  // 调试：打印完整响应
  console.log('📦 响应数据:', JSON.stringify(data, null, 2).slice(0, 500))

  if (!response.ok) {
    console.error('❌ GLM API 错误:', data)
    return {
      role: 'assistant',
      content: `API 调用失败: ${JSON.stringify(data)}`
    }
  }

  // 3. 解析响应
  const choice = data.choices[0]

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    // LLM 想要调用工具
    const toolCalls = choice.message.tool_calls
    return {
      role: 'assistant',
      content: [
        { type: 'text', text: choice.message.content || '' },
        ...toolCalls.map(tc => ({
          type: 'tool_use' as const,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
>>>>>>> main
          tool_use_id: tc.id,
        }))
      ]
    }
  }

<<<<<<< HEAD
  // 普通文本回答
  return {
    role: 'assistant',
    content: fullContent || '（无响应）'
=======
  // LLM 直接回答
  return {
    role: 'assistant',
    content: choice.message.content || '（无响应）'
>>>>>>> main
  }
}

// ============================================
// 消息类型（与 01 相同）
// ============================================

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentBlock[]
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
  is_error?: boolean
}

// ============================================
// System Prompt
// ============================================

function buildSystemPrompt(): string {
  const sections = [
    '# 角色定义',
    '你是一个有用的助手，可以使用工具来帮助用户。',
    '',
    '# 可用工具',
    ...tools.map(t => `- ${t.name}: ${t.description}`),
    '',
    '# 输出风格',
    '回答要简洁，使用中文。',
  ]
  return sections.join('\n')
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function countMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content)
    return sum + estimateTokens(content)
  }, 0)
}

// ============================================
// Agentic Loop
// ============================================

async function* agentLoop(
  messages: Message[],
  userMessage: string,
  maxIterations: number = 10,
): AsyncGenerator<{ type: string; data: unknown }, void, unknown> {
  messages.push({ role: 'user', content: userMessage })

  let iteration = 0

  while (iteration < maxIterations) {
    iteration++
    console.log(`\n--- 迭代 ${iteration} ---`)

    const totalTokens = countMessagesTokens(messages)
    if (totalTokens > 8000) {
      console.log(`⚠️ Token 使用: ${totalTokens}，建议压缩对话`)
    }

    // 1. 调用 GLM
    const assistantMessage = await callGLM(messages, tools)
    messages.push(assistantMessage)

    // 2. 检查是否有工具调用
    const contentBlocks = Array.isArray(assistantMessage.content)
      ? assistantMessage.content
      : [{ type: 'text' as const, text: assistantMessage.content as string }]

    const toolUseBlocks = contentBlocks.filter(
      (block) => block.type === 'tool_use',
    )

    // 3. 如果没有工具调用，循环结束
    if (toolUseBlocks.length === 0) {
      console.log('✅ 无工具调用，循环结束')
      const textBlock = contentBlocks.find((b) => b.type === 'text')
      yield {
        type: 'completed',
        data: textBlock?.text || assistantMessage.content,
      }
      return
    }

    // 4. 执行工具
    console.log(`🔧 执行 ${toolUseBlocks.length} 个工具...`)
    const toolResults: ContentBlock[] = []

    for (const toolUse of toolUseBlocks) {
      const tool = tools.find((t) => t.name === toolUse.name)
      if (!tool) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.tool_use_id!,
          content: `错误：未知工具 ${toolUse.name}`,
          is_error: true,
        })
        continue
      }

      console.log(`   执行 ${tool.name}(${JSON.stringify(toolUse.input)})`)
      const result = await tool.execute(toolUse.input || {})

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.tool_use_id!,
        content: result,
      })

      yield { type: 'tool_result', data: { tool: tool.name, result } }
    }

    // 5. 将工具结果加入消息历史
    messages.push({
      role: 'user',
      content: toolResults,
    })

    // 简化：执行一次工具后就返回结果
    if (iteration === 1) {
      const lastResult = toolResults[toolResults.length - 1]
      yield { type: 'completed', data: `根据查询结果：${lastResult.content}` }
      return
    }
  }

  yield { type: 'max_iterations', data: '达到最大迭代次数' }
}

// ============================================
<<<<<<< HEAD
// Memory 持久化（参考 Claude Code 三层方案）
// ============================================
//
// 第一层：JSONL 对话历史 — 实时追加，崩溃安全
// 第二层：Compaction — 消息过多时智能压缩
// 第三层：Memory 摘要 — 跨会话持久记忆
//

const MEMORY_DIR = 'learn-examples/.agent-memory'
const TRANSCRIPT_FILE = `${MEMORY_DIR}/transcript.jsonl`
const SUMMARY_FILE = `${MEMORY_DIR}/summary.md`
const COMPACTION_THRESHOLD = 30  // 超过 N 条消息时触发压缩
const KEEP_RECENT = 10           // 压缩后保留最近 N 条

class MemoryManager {
  private transcriptPath: string
  private summaryPath: string
  private compactionThreshold: number
  private keepRecent: number

  constructor(opts: {
    transcriptPath: string
    summaryPath: string
    compactionThreshold: number
    keepRecent: number
  }) {
    this.transcriptPath = opts.transcriptPath
    this.summaryPath = opts.summaryPath
    this.compactionThreshold = opts.compactionThreshold
    this.keepRecent = opts.keepRecent
  }

  // ---- 第一层：JSONL 对话历史 ----

  /** 追加一条消息到 JSONL 文件（崩溃安全） */
  append(message: Message): void {
    // 确保目录存在
    mkdirSync(MEMORY_DIR, { recursive: true })

    const line = JSON.stringify({
      role: message.role,
      content: message.content,
      ts: new Date().toISOString(),
    }) + '\n'

    // 追加写入（不是覆盖）
    appendFileSync(this.transcriptPath, line, 'utf-8')
  }

  /** 从 JSONL 文件加载所有消息 */
  async loadTranscript(): Promise<Message[]> {
    try {
      const file = Bun.file(this.transcriptPath)
      const text = await file.text()
      const lines = text.trim().split('\n').filter(Boolean)

      return lines.map(line => {
        const obj = JSON.parse(line)
        return {
          role: obj.role,
          content: obj.content,
        } as Message
      })
    } catch {
      return []
    }
  }

  // ---- 第二层：Compaction 压缩 ----

  /** 检查是否需要压缩，如果需要则执行 */
  async compactIfNeeded(messages: Message[]): Promise<Message[]> {
    const nonSystem = messages.filter(m => m.role !== 'system')
    if (nonSystem.length <= this.compactionThreshold) {
      return messages  // 不需要压缩
    }

    console.log(`\n📦 触发压缩：${nonSystem.length} 条消息 → 保留最近 ${this.keepRecent} 条`)

    // 1. 提取要压缩的旧消息
    const systemMsg = messages.find(m => m.role === 'system')
    const oldMessages = nonSystem.slice(0, -this.keepRecent)
    const recentMessages = nonSystem.slice(-this.keepRecent)

    // 2. 将旧消息生成摘要
    const summary = this.generateSummary(oldMessages)
    await this.saveSummary(summary)

    // 3. 重构：system + summary + 最近消息
    const result: Message[] = []
    if (systemMsg) result.push(systemMsg)

    // 把摘要作为一条 system 消息插入
    result.push({
      role: 'system',
      content: `# 历史对话摘要\n\n${summary}`,
    })

    result.push(...recentMessages)

    // 4. 重写 JSONL（只保留压缩后的消息）
    await this.rewriteTranscript(result)

    return result
  }

  /** 简单摘要生成（不调 LLM，直接提取关键信息） */
  private generateSummary(messages: Message[]): string {
    const userMessages = messages
      .filter(m => m.role === 'user' && typeof m.content === 'string')
      .map(m => `- 用户问: ${(m.content as string).slice(0, 100)}`)

    const assistantMessages = messages
      .filter(m => m.role === 'assistant' && typeof m.content === 'string')
      .map(m => `- AI 答: ${(m.content as string).slice(0, 100)}`)

    const parts: string[] = []
    if (userMessages.length > 0) {
      parts.push('## 用户问题\n' + userMessages.slice(-5).join('\n'))
    }
    if (assistantMessages.length > 0) {
      parts.push('## AI 回答\n' + assistantMessages.slice(-5).join('\n'))
    }

    return parts.join('\n\n') || '（无历史记录）'
  }

  /** 重写 JSONL 文件（压缩后） */
  private async rewriteTranscript(messages: Message[]): Promise<void> {
    mkdirSync(MEMORY_DIR, { recursive: true })
    const lines = messages.map(m =>
      JSON.stringify({ role: m.role, content: m.content, ts: new Date().toISOString() })
    ).join('\n') + '\n'

    await Bun.write(this.transcriptPath, lines)
  }

  // ---- 第三层：Memory 摘要 ----

  /** 加载之前的摘要 */
  async loadSummary(): Promise<string> {
    try {
      const file = Bun.file(this.summaryPath)
      return await file.text()
    } catch {
      return ''
    }
  }

  /** 保存摘要到文件 */
  private async saveSummary(summary: string): Promise<void> {
    const header = `# 对话记忆摘要\n> 自动生成于 ${new Date().toLocaleString('zh-CN')}\n\n`
    await Bun.write(this.summaryPath, header + summary, { createPath: true })
  }

  // ---- 初始化 ----

  /** 加载完整上下文：summary + transcript */
  async loadAll(): Promise<Message[]> {
    const messages = await this.loadTranscript()

    // 如果没有历史记录，返回空
    if (messages.length === 0) return []

    // 确保 system prompt 在最前面
    const hasSystem = messages.some(m => m.role === 'system')
    if (!hasSystem) {
      messages.unshift({ role: 'system', content: buildSystemPrompt() })
    }

    return messages
  }

  /** 清除所有记忆 */
  async clear(): Promise<void> {
    mkdirSync(MEMORY_DIR, { recursive: true })
    await Bun.write(this.transcriptPath, '')
    await Bun.write(this.summaryPath, '')
  }
}

// ============================================
=======
>>>>>>> main
// REPL
// ============================================

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
  console.log('🤖 真实 LLM Agent 示例（GLM API）')
  console.log('='.repeat(50))
  console.log('📝 使用模型: glm-4-flash')
  console.log('🔑 API Key: ' + (GLM_API_KEY ? '已配置 ✓' : '未配置 ❌'))

<<<<<<< HEAD
  // 初始化 Memory Manager（Claude Code 三层方案）
  const memory = new MemoryManager({
    transcriptPath: TRANSCRIPT_FILE,
    summaryPath: SUMMARY_FILE,
    compactionThreshold: COMPACTION_THRESHOLD,
    keepRecent: KEEP_RECENT,
  })

  // 从 JSONL 加载历史消息
  const savedMessages = await memory.loadAll()
  const messages: Message[] = savedMessages.length > 0
    ? savedMessages
    : [{ role: 'system', content: buildSystemPrompt() }]

  if (savedMessages.length > 0) {
    console.log(`📂 已加载 ${savedMessages.length} 条历史消息`)
  }

  while (true) {
    const userInput = await readUserInput()

    // 特殊命令：清除记忆
    if (userInput === '清除记忆') {
      await memory.clear()
      messages.length = 0
      messages.push({ role: 'system', content: buildSystemPrompt() })
      console.log('🗑️ 记忆已清除')
      continue
    }

    // 特殊命令：手动压缩
    if (userInput === '压缩') {
      const compacted = await memory.compactIfNeeded(messages)
      messages.length = 0
      messages.push(...compacted)
      console.log(`📦 压缩完成，当前 ${messages.length} 条消息`)
      continue
    }

    if (userInput === '退出') {
      console.log('💾 对话已保存，下次启动可继续')
      break
    }

    // 追加用户消息（实时写入 JSONL）
    memory.append({ role: 'user', content: userInput })
=======
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt() }
  ]

  while (true) {
    const userInput = await readUserInput()
    if (userInput === '退出') break
>>>>>>> main

    for await (const event of agentLoop(messages, userInput)) {
      switch (event.type) {
        case 'tool_result':
          console.log(`📥 工具结果: ${JSON.stringify(event.data)}`)
<<<<<<< HEAD
          // 实时追加 assistant 消息 + tool_result
          break
        case 'completed':
          console.log(`\n🎯 最终回答: ${event.data}`)
          // 追加 assistant 回答
          const lastMsg = messages[messages.length - 1]
          if (lastMsg?.role === 'assistant') {
            memory.append(lastMsg)
          }
          // 检查是否需要压缩
          const compacted = await memory.compactIfNeeded(messages)
          if (compacted.length !== messages.length) {
            messages.length = 0
            messages.push(...compacted)
          }
=======
          break
        case 'completed':
          console.log(`\n🎯 最终回答: ${event.data}`)
>>>>>>> main
          break
        case 'max_iterations':
          console.log(`⚠️ ${event.data}`)
          break
      }
    }
  }
}

main().catch(console.error)

// ============================================
// 学习要点
// ============================================
//
// 1. API 调用格式：每个 LLM 提供商的消息格式略有不同
//    - OpenAI: tools[{type: 'function', function: {...}}]
//    - Claude: tools[{name, description, input_schema}]
//    - GLM: tools[{type: 'function', function: {...}}]
//
// 2. Tool Call 响应处理：
//    - 检查 finish_reason === 'tool_calls'
//    - 解析 tool_calls 数组
//    - 将工具结果作为 role: 'tool' 的消息返回
//
// 3. 错误处理：
//    - 网络错误
//    - API 限流
//    - 无效响应
//
// 进阶挑战：
// - 实现流式响应（stream: true）
// - 添加重试机制
// - 支持 Claude/OpenAI 格式
