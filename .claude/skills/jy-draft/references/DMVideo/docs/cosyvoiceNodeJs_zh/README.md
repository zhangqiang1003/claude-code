# 🎙️ CosyVoice WebSocket 语音合成服务 (Node.js)

基于 Express + Socket.IO + WebSocket 的阿里云 CosyVoice 语音合成服务，Node.js 实现版本。

[![Node Version](https://img.shields.io/badge/node-14%2B-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](.)

## ✨ 特点

- 🚀 **一键启动** - 自动检查环境、安装依赖
- 🌍 **跨平台** - 支持 Windows、macOS、Linux
- ⚡ **实时合成** - WebSocket 流式传输
- 🎨 **多音色** - 支持 CosyVoice 全系列音色
- 📦 **轻量高效** - Node.js 异步非阻塞架构

## 🚀 快速开始

### 前置要求

- Node.js 14 或更高版本
- npm 或 yarn
- 阿里云 DashScope API Key

### 1. 获取 API Key

根据官方文档获取API Key并配置到环境变量

### 2. 启动服务

**macOS/Linux:**
```bash
./start.sh
```

**Windows:**
```cmd
start.bat
```

**使用 npm:**
```bash
npm install    # 首次运行需要
npm start
```

### 3. 使用服务

打开浏览器访问: **http://localhost:9000**

## 📁 项目结构

```
cosyvoiceNodeJs/
├── server.js           # Node.js 服务端主程序 ⭐
├── package.json        # npm 配置文件
├── start.sh            # Shell 启动脚本
├── get_api_key.js     # API Key 获取指引
├── views/
│   └── index.html     # Web 前端页面
```

## ⚙️ 配置

### 设置环境变量

**macOS/Linux:**
```bash
export DASHSCOPE_API_KEY='sk-xxxxxxxxxxxx'
```

**Windows (CMD):**
```cmd
set DASHSCOPE_API_KEY=sk-xxxxxxxxxxxx
```

**Windows (PowerShell):**
```powershell
$env:DASHSCOPE_API_KEY='sk-xxxxxxxxxxxx'
```

### 修改端口

编辑 `server.js` 第 12 行：
```javascript
const PORT = process.env.PORT || 9000;  // 修改默认端口
```

或使用环境变量：
```bash
PORT=8080 npm start
```

## 🛠️ 开发模式

安装开发依赖：
```bash
npm install
```

使用 nodemon 自动重启：
```bash
npm run dev
```

## 📦 依赖包

### 核心依赖
- **express** - Web 框架
- **socket.io** - 实时双向通信
- **ws** - WebSocket 客户端
- **uuid** - 唯一 ID 生成

### 开发依赖
- **nodemon** - 自动重启工具


## 🔧 常见问题

### Q1: 端口被占用

**macOS/Linux:**
```bash
lsof -i :9000
kill -9 <PID>
```

**Windows:**
```cmd
netstat -ano | findstr :9000
taskkill /PID <PID> /F
```

### Q2: 依赖安装失败

使用淘宝镜像：
```bash
npm install --registry=https://registry.npmmirror.com
```

或使用 cnpm：
```bash
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

### Q3: Node.js 版本过低

升级 Node.js:
- **macOS:** `brew upgrade node`
- **Windows:** 从 [nodejs.org](https://nodejs.org/) 下载最新版
- **Linux:** 使用 nvm 或包管理器升级

## 🔗 API 说明

### Socket.IO 事件

**客户端 → 服务端:**
```javascript
socket.emit('synthesize', {
  input: '要合成的文本',
  voice: 'longanyang'  // 可选
});
```

**服务端 → 客户端:**
```javascript
// 开始接收音频
socket.on('audio_start', () => { ... });

// 音频数据块
socket.on('audio_chunk', (data) => {
  const audioBuffer = data.data;
});

// 音频结束
socket.on('audio_end', () => { ... });

// 错误信息
socket.on('synthesis_error', (data) => {
  console.error(data.message);
});
```

## 📊 性能优化

1. **连接复用** - 每个客户端维护独立的 WebSocket 连接
2. **异步处理** - Node.js 事件循环，天然支持高并发
3. **流式传输** - 边接收边播放，减少延迟
4. **文本分段** - 自动按句子切割，提高响应速度

## 🔒 安全建议

1. **环境变量** - 不要在代码中硬编码 API Key
2. **HTTPS** - 生产环境使用 HTTPS + WSS
3. **限流** - 添加请求频率限制
4. **认证** - 生产环境添加用户认证
