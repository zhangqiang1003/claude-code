#!/usr/bin/env node
/**
 * CosyVoice WebSocket 语音合成服务 - Node.js 版本
 * 基于 Express + Socket.IO + WebSocket
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 配置
const PORT = process.env.PORT || 9000;
const API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URI = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';

// 创建 Express 应用
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 静态文件服务
app.use(express.static('public'));

// 路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 客户端管理器
class ClientManager {
  constructor() {
    this.clients = new Map(); // socketId -> client data
  }

  createClient(socketId, voice) {
    // 清理旧的客户端连接
    if (this.clients.has(socketId)) {
      const oldClient = this.clients.get(socketId);
      try {
        oldClient.client.close();
      } catch (e) {
        // 忽略关闭错误
      }
      this.clients.delete(socketId);
    }

    // 创建新的客户端
    try {
      const client = new TTSClient(API_KEY, DASHSCOPE_URI, voice, socketId);
      this.clients.set(socketId, {
        client: client,
        voice: voice
      });
      client.run();
      return client;
    } catch (error) {
      console.error(`创建 TTS 客户端失败: ${error.message}`);
      return null;
    }
  }

  getClient(socketId) {
    return this.clients.get(socketId);
  }

  removeClient(socketId) {
    if (this.clients.has(socketId)) {
      const clientData = this.clients.get(socketId);
      try {
        clientData.client.close();
      } catch (e) {
        // 忽略关闭错误
      }
      this.clients.delete(socketId);
    }
  }
}

const clientManager = new ClientManager();

// TTS 客户端类
class TTSClient {
  constructor(apiKey, uri, voice = 'longanyang', socketId = null) {
    this.apiKey = apiKey;
    this.uri = uri;
    this.voice = voice;
    this.socketId = socketId;
    this.taskId = uuidv4();
    this.ws = null;
    this.taskStarted = false;
    this.taskFinished = false;
    this.taskStartedPromise = null;
    this.taskStartedResolve = null;
  }

  onOpen() {
    try {
      const runTaskCmd = {
        header: {
          action: 'run-task',
          task_id: this.taskId,
          streaming: 'duplex'
        },
        payload: {
          task_group: 'audio',
          task: 'tts',
          function: 'SpeechSynthesizer',
          model: 'cosyvoice-v3-flash',
          parameters: {
            text_type: 'PlainText',
            voice: this.voice,
            format: 'mp3',
            sample_rate: 22050,
            volume: 50,
            rate: 1,
            pitch: 1
          },
          input: {}
        }
      };
      this.ws.send(JSON.stringify(runTaskCmd));
      console.log(`已发送 run-task 指令 (sid: ${this.socketId})`);
    } catch (error) {
      console.error(`发送 run-task 指令失败: ${error.message}`);
      this.sendError(`发送指令失败: ${error.message}`);
    }
  }

  onMessage(data) {
    try {
      // 尝试将 Buffer 转换为字符串并解析为 JSON
      let isJson = false;
      let msgJson = null;

      if (Buffer.isBuffer(data)) {
        try {
          const text = data.toString('utf8');
          msgJson = JSON.parse(text);
          isJson = true;
        } catch (e) {
          // 不是 JSON，是音频数据
          isJson = false;
        }
      } else if (typeof data === 'string') {
        try {
          msgJson = JSON.parse(data);
          isJson = true;
        } catch (e) {
          isJson = false;
        }
      }

      if (isJson && msgJson) {
        const header = msgJson.header || {};
        const event = header.event || '';

        if (event === 'task-started') {
          this.taskStarted = true;
          if (this.taskStartedResolve) {
            this.taskStartedResolve();
          }
          io.to(this.socketId).emit('audio_start');
        } else if (event === 'task-finished' || event === 'task-failed') {
          this.taskFinished = true;
          io.to(this.socketId).emit('audio_end');
          this.close();
          console.log(`任务完成 (sid: ${this.socketId})`);
        }
      } else {
        // 二进制音频数据
        io.to(this.socketId).emit('audio_chunk', { data: data });
      }
    } catch (error) {
      console.error(`处理消息失败: ${error.message}`);
      this.sendError(`处理消息失败: ${error.message}`);
    }
  }

  onError(error) {
    console.error(`WebSocket 出错 (sid: ${this.socketId}): ${error.message}`);
    this.sendError(`WebSocket 错误: ${error.message}`);
  }

  onClose(code, reason) {
    console.log(`WebSocket 已关闭 (sid: ${this.socketId}): ${reason} (${code})`);
    clientManager.removeClient(this.socketId);
    if (this.taskStartedResolve) {
      this.taskStartedResolve();
    }
  }

  sendContinueTask(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket 未连接，无法发送数据');
      return false;
    }

    try {
      const cmd = {
        header: {
          action: 'continue-task',
          task_id: this.taskId,
          streaming: 'duplex'
        },
        payload: {
          input: {
            text: text
          }
        }
      };
      this.ws.send(JSON.stringify(cmd));
      return true;
    } catch (error) {
      console.error(`发送 continue-task 失败: ${error.message}`);
      this.sendError(`发送文本失败: ${error.message}`);
      return false;
    }
  }

  sendFinishTask() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket 未连接，无法发送完成指令');
      return false;
    }

    try {
      const cmd = {
        header: {
          action: 'finish-task',
          task_id: this.taskId,
          streaming: 'duplex'
        },
        payload: {
          input: {}
        }
      };
      this.ws.send(JSON.stringify(cmd));
      console.log(`已发送 finish-task 指令 (sid: ${this.socketId})`);
      return true;
    } catch (error) {
      console.error(`发送 finish-task 失败: ${error.message}`);
      this.sendError(`发送结束指令失败: ${error.message}`);
      return false;
    }
  }

  close() {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    } catch (e) {
      // 忽略关闭错误
    }
  }

  run() {
    try {
      this.taskStartedPromise = new Promise((resolve) => {
        this.taskStartedResolve = resolve;
      });

      this.ws = new WebSocket(this.uri, {
        headers: {
          'Authorization': `bearer ${this.apiKey}`,
          'X-DashScope-DataInspection': 'enable'
        }
      });

      this.ws.on('open', () => this.onOpen());
      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('error', (error) => this.onError(error));
      this.ws.on('close', (code, reason) => this.onClose(code, reason));
    } catch (error) {
      console.error(`启动 WebSocket 失败: ${error.message}`);
      this.sendError(`连接失败: ${error.message}`);
    }
  }

  sendError(message) {
    try {
      io.to(this.socketId).emit('synthesis_error', { message: message });
    } catch (e) {
      // 忽略发送错误
    } finally {
      clientManager.removeClient(this.socketId);
    }
  }

  async waitForTaskStarted(timeout = 10000) {
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve(false), timeout);
    });
    const result = await Promise.race([this.taskStartedPromise, timeoutPromise]);
    return result !== false;
  }
}

// Socket.IO 事件处理
io.on('connection', (socket) => {
  console.log(`客户端已连接: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`客户端断开连接: ${socket.id}`);
    clientManager.removeClient(socket.id);
  });

  socket.on('synthesize', async (data) => {
    const inputText = data.input || '';
    const voice = data.voice || 'longanyang';

    if (!inputText) {
      console.log(`收到空文本，忽略 (sid: ${socket.id})`);
      socket.emit('synthesis_error', { message: '输入文本不能为空' });
      return;
    }

    console.log(`收到合成请求 (sid: ${socket.id}): ${inputText.substring(0, 20)}... 音色: ${voice}`);

    try {
      // 为当前客户端创建语音合成客户端
      const client = clientManager.createClient(socket.id, voice);
      if (!client) {
        socket.emit('synthesis_error', { message: '创建合成客户端失败' });
        return;
      }

      // 等待任务启动（最多 10 秒）
      const started = await client.waitForTaskStarted(10000);
      if (!started) {
        console.log(`任务启动超时 (sid: ${socket.id})`);
        socket.emit('synthesis_error', { message: '任务启动超时' });
        return;
      }

      // 按句子边界切割文本
      const SENTENCE_DELIMITERS = ['.', '?', '!', '。', '？', '！', '\n'];
      const fragments = [];
      let startIndex = 0;
      let i = 0;

      while (i < inputText.length) {
        if (SENTENCE_DELIMITERS.includes(inputText[i])) {
          let endIndex = i + 1;
          while (endIndex < inputText.length && SENTENCE_DELIMITERS.includes(inputText[endIndex])) {
            endIndex++;
          }
          fragments.push(inputText.substring(startIndex, endIndex));
          startIndex = endIndex;
          i = endIndex - 1;
        }
        i++;
      }

      if (startIndex < inputText.length) {
        fragments.push(inputText.substring(startIndex));
      }

      // 发送所有文本片段
      for (const fragment of fragments) {
        if (!client.sendContinueTask(fragment)) {
          socket.emit('synthesis_error', { message: '发送文本失败' });
          return;
        }
      }

      // 发送结束任务指令
      if (!client.sendFinishTask()) {
        socket.emit('synthesis_error', { message: '发送结束指令失败' });
        return;
      }
    } catch (error) {
      const errorMsg = `处理请求失败: ${error.message}`;
      console.error(`${errorMsg} (sid: ${socket.id})\n${error.stack}`);
      socket.emit('synthesis_error', { message: errorMsg });
    }
  });
});

// 检查 API Key
if (!API_KEY) {
  console.error('错误: 未设置 DASHSCOPE_API_KEY 环境变量');
  console.error('请运行: export DASHSCOPE_API_KEY=\'your-api-key\'');
  process.exit(1);
}

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log(`  CosyVoice WebSocket 服务 (Node.js)`);
  console.log('='.repeat(50));
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API Key: ${API_KEY.substring(0, 10)}...`);
  console.log('='.repeat(50));
  console.log('');
  console.log('按 Ctrl+C 停止服务');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
