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
          tool_use_id: tc.id,
        }))
      ]
    }
  }

  // LLM 直接回答
  return {
    role: 'assistant',
    content: choice.message.content || '（无响应）'
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

  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt() }
  ]

  while (true) {
    const userInput = await readUserInput()
    if (userInput === '退出') break

    for await (const event of agentLoop(messages, userInput)) {
      switch (event.type) {
        case 'tool_result':
          console.log(`📥 工具结果: ${JSON.stringify(event.data)}`)
          break
        case 'completed':
          console.log(`\n🎯 最终回答: ${event.data}`)
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
