#!/bin/bash

# CosyVoice Node.js 一键启动脚本
# 作者: Auto Generated
# 日期: 2026-02-02

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CosyVoice Node.js 一键启动脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 检查 Node.js 是否安装
echo -e "${YELLOW}[1/5] 检查 Node.js 环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到 Node.js，请先安装 Node.js 14+${NC}"
    echo -e "${YELLOW}下载地址: https://nodejs.org/${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到 npm${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ npm 版本: $NPM_VERSION${NC}"
echo ""

# 2. 获取 API Key
echo -e "${YELLOW}[2/5] 检查 DASHSCOPE_API_KEY...${NC}"
if [ -z "$DASHSCOPE_API_KEY" ]; then
    echo -e "${YELLOW}⚠ 环境变量 DASHSCOPE_API_KEY 未设置${NC}"
    echo -e "${YELLOW}→ 运行 get_api_key.js 查看获取指引...${NC}"
    echo ""

    if [ -f "get_api_key.js" ]; then
        node get_api_key.js
    fi

    echo ""
    echo -e "${YELLOW}请输入你的 DASHSCOPE_API_KEY (或按 Ctrl+C 取消):${NC}"
    read -r API_KEY_INPUT
    if [ -n "$API_KEY_INPUT" ]; then
        export DASHSCOPE_API_KEY="$API_KEY_INPUT"
        echo -e "${GREEN}✓ API Key 已设置${NC}"
    else
        echo -e "${RED}❌ 错误: API Key 不能为空${NC}"
        echo -e "${YELLOW}提示: 运行 'node get_api_key.js' 查看获取方法${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ API Key 已设置 (来自环境变量)${NC}"
fi
echo ""

# 3. 检查并安装依赖
echo -e "${YELLOW}[3/5] 检查 Node.js 依赖...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 未找到 package.json${NC}"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}→ node_modules 不存在，正在安装依赖...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 依赖安装成功${NC}"
    else
        echo -e "${RED}❌ 依赖安装失败${NC}"
        echo -e "${YELLOW}尝试使用: npm install --registry=https://registry.npmmirror.com${NC}"
        exit 1
    fi
else
    # 检查关键依赖是否存在
    MISSING_DEPS=0
    for pkg in express socket.io ws uuid; do
        if [ ! -d "node_modules/$pkg" ]; then
            MISSING_DEPS=1
            break
        fi
    done

    if [ $MISSING_DEPS -eq 1 ]; then
        echo -e "${YELLOW}→ 检测到缺失依赖，正在安装...${NC}"
        npm install
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ 依赖安装成功${NC}"
        else
            echo -e "${RED}❌ 依赖安装失败${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ 所有依赖已安装${NC}"
    fi
fi
echo ""

# 4. 检查端口占用
echo -e "${YELLOW}[4/5] 检查端口占用...${NC}"
PORT=9000
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ 端口 $PORT 已被占用${NC}"
    echo -e "${YELLOW}占用进程信息:${NC}"
    lsof -i :$PORT
    echo ""
    echo -e "${YELLOW}是否终止占用进程并继续? (y/n)${NC}"
    read -r KILL_PROCESS
    if [ "$KILL_PROCESS" = "y" ] || [ "$KILL_PROCESS" = "Y" ]; then
        PID=$(lsof -ti :$PORT)
        kill -9 $PID 2>/dev/null
        sleep 1
        echo -e "${GREEN}✓ 已终止进程 (PID: $PID)${NC}"
    else
        echo -e "${RED}启动已取消${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ 端口 $PORT 可用${NC}"
fi
echo ""

# 5. 启动服务
echo -e "${YELLOW}[5/5] 启动 Node.js 服务...${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  服务启动中...${NC}"
echo -e "${GREEN}  访问地址: ${BLUE}http://localhost:$PORT${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}提示: 按 Ctrl+C 可停止服务${NC}"
echo ""

# 启动 Node.js 应用
node server.js
