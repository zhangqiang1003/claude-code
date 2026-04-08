/**
 * 学习示例 01: 最小化 Agentic Loop
 *
 * 这个文件演示了 AI Agent 的核心循环：
 * 1. 调用 LLM API
 * 2. 检测是否有工具调用
 * 3. 执行工具
 * 4. 将结果返回给 LLM
 * 5. 循环直到没有工具调用
 *
 * 运行方式：bun run learn-examples/01-minimal-agent.ts
 */

import * as readline from 'readline'

// ============================================
// 第一步：定义工具 Schema
// ============================================

interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
  execute: (input: Record<string, unknown>) => Promise<string>
}

// 示例工具：获取天气
const getWeatherTool: Tool = {
  name: 'get_weather',
  description: '获取指定城市的当前天气',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名称' },
    },
    required: ['city'],
  },
  execute: async (input) => {
    const city = input.city as string
    // 模拟天气 API
    const weathers = ['晴天', '多云', '小雨', '大雨', '雪']
    const temp = Math.floor(Math.random() * 30) + 5
    return `${city} 今天是 ${weathers[Math.floor(Math.random() * weathers.length)]}，气温 ${temp}°C`
  },
}

// 示例工具：计算器
const calculatorTool: Tool = {
  name: 'calculator',
  description: '执行数学计算',
  inputSchema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: '数学表达式，如 "2 + 3 * 4"' },
    },
    required: ['expression'],
  },
  execute: async (input) => {
    const expr = input.expression as string
    try {
      // 注意：实际生产中不要用 eval，这里只是演示
      const result = Function(`"use strict"; return (${expr})`)()
      return `计算结果: ${expr} = ${result}`
    } catch {
      return `计算错误: 无法解析表达式 "${expr}"`
    }
  },
}

// 获取时间
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
    })}`;
  }
}

const tools: Tool[] = [getWeatherTool, calculatorTool, getTimeTool]

// ============================================
// System Prompt 构建
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

// 添加token计数
// 简单估算：4 字符 ≈ 1 token
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
// 第二步：模拟 LLM API 调用
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

/**
 * 模拟 LLM API 调用
 * 实际项目中会调用 OpenAI/Claude API
 */
async function callLLM(messages: Message[], tools: Tool[]): Promise<Message> {
  // 这里我们模拟一个简单的"智能"响应
  // 实际项目中，这里会调用真实的 LLM API

  const lastMessage = messages[messages.length - 1]
  const userInput = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : lastMessage.content.map(b => b.text || '').join('')

  // 模拟 LLM 决定调用工具
  if (userInput.includes('天气') || userInput.includes('weather')) {
    const cityMatch = userInput.match(/([北京上海广州深圳])/)
    const city = cityMatch ? cityMatch[1] : '北京'
    return {
      role: 'assistant',
      content: [
        { type: 'text', text: `让我查一下${city}的天气。` },
        {
          type: 'tool_use',
          name: 'get_weather',
          input: { city },
          tool_use_id: `tool_${Date.now()}`,
        },
      ],
    }
  }

  if (userInput.includes('计算') || /[\d+\-*/]/.test(userInput)) {
    const exprMatch = userInput.match(/([\d+\-*/\s()]+)/)
    const expr = exprMatch ? exprMatch[1].trim() : '1+1'
    return {
      role: 'assistant',
      content: [
        { type: 'text', text: `让我计算一下。` },
        {
          type: 'tool_use',
          name: 'calculator',
          input: { expression: expr },
          tool_use_id: `tool_${Date.now()}`,
        },
      ],
    }
  }

  if (userInput.includes("时间") || userInput.includes("几点")) {
    return {
      role: 'assistant',
      content: [
        { type: 'text', text: `让我获取当前的时间。` },
        {
          type: 'tool_use',
          name: 'get_time',
          input: { expression: userInput },
          tool_use_id: `tool_${Date.now()}`,
        },
      ],
    }
  }

  // 无需工具调用，直接回答
  return {
    role: 'assistant',
    content: `我理解你的问题是：${userInput}。但我目前只能查询天气、做计算、获取当前时间，请尝试问我这些方面的问题。`,
  }
}

// ============================================
// 第三步：核心 Agentic Loop
// ============================================

async function* agentLoop(
  messages: Message[],
  userMessage: string,
  maxIterations: number = 10,
): AsyncGenerator<{ type: string; data: unknown }, void, unknown> {
  messages.push({"role": "user", "content": userMessage})

  let iteration = 0

  while (iteration < maxIterations) {
    iteration++
    console.log(`\n--- 迭代 ${iteration} ---`)

    // Token 预算检查
    const totalTokens = countMessagesTokens(messages)
    if (totalTokens > 8000) {
      console.log(`⚠️ Token 使用: ${totalTokens}，建议压缩对话`)
    }

    // 1. 调用 LLM
    console.log('📤 调用 LLM...')
    const assistantMessage = await callLLM(messages, tools)
    messages.push(assistantMessage)

    // 2. 检查是否有工具调用
    const contentBlocks = Array.isArray(assistantMessage.content)
      ? assistantMessage.content
      : [{ type: 'text' as const, text: assistantMessage.content }]

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

    // 模拟 LLM 处理工具结果后给出最终回答
    // 实际中这会进入下一轮循环，由 LLM 决定是否继续
    if (iteration === 1) {
      // 第一次工具调用后，模拟 LLM 整理结果
      const lastResult = toolResults[toolResults.length - 1]
      messages.push({
        role: 'assistant',
        content: `根据查询结果：${lastResult.content}`,
      })
      yield { type: 'completed', data: `根据查询结果：${lastResult.content}` }
      return
    }
  }

  yield { type: 'max_iterations', data: '达到最大迭代次数' }
}

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


// ============================================
// 第四步：运行示例
// ============================================

async function main() {
  console.log('🤖 最小化 Agentic Loop 示例')
  console.log('='.repeat(50))
  const messages: Message[] = [
    {"role": "system", "content": buildSystemPrompt()}
  ]

  while(true) {
    const userInput = await readUserInput();
    if (userInput === "退出") break;
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
// 学习任务
// ============================================
//
// 1. 运行这个文件，观察输出
// 2. 修改 userInput 尝试不同的输入
// 3. 添加一个新工具（如：获取时间）
// 4. 修改 callLLM 函数，连接真实的 LLM API
//
// 进阶挑战：
// - 实现流式响应（逐字输出）
// - 实现并行工具执行
// - 添加错误重试机制
