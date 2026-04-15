# -*- coding: utf-8 -*-
"""
MCP Server 实现

提供基于 Model Context Protocol (MCP) 的服务器实现，
支持 stdio 和 SSE 两种传输方式。
"""

import json
import os
import asyncio
import logging
from typing import Any, Callable, Dict, List, Optional, Union
from dataclasses import dataclass

from .tools import MCPTool, get_all_tools


# 从 LOG_LEVEL 环境变量解析日志级别，默认 INFO
def _get_log_level() -> int:
    level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    level_map = {
        "DEBUG": logging.DEBUG, "INFO": logging.INFO,
        "WARNING": logging.WARNING, "WARN": logging.WARNING,
        "ERROR": logging.ERROR, "CRITICAL": logging.CRITICAL,
    }
    return level_map.get(level_str, logging.INFO)


# 配置日志
logging.basicConfig(level=_get_log_level())
logger = logging.getLogger(__name__)


@dataclass
class MCPRequest:
    """MCP 请求"""
    jsonrpc: str = "2.0"
    id: Optional[Union[int, str]] = None
    method: str = ""
    params: Optional[Dict[str, Any]] = None


@dataclass
class MCPResponse:
    """MCP 响应"""
    jsonrpc: str = "2.0"
    id: Optional[Union[int, str]] = None
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None


class MCPServer:
    """
    MCP 服务器

    实现 Model Context Protocol (MCP) 规范，提供工具调用能力。

    Example:
        >>> server = MCPServer(name="剪映草稿服务")
        >>> server.start()
    """

    def __init__(
        self,
        name: str = "剪映草稿 MCP 服务",
        version: str = "1.0.0",
        tools: Optional[List[MCPTool]] = None
    ):
        """
        初始化 MCP 服务器

        Args:
            name: 服务名称
            version: 服务版本
            tools: 工具列表，默认使用所有内置工具
        """
        self.name = name
        self.version = version
        self.tools = tools or get_all_tools()
        self._tool_map: Dict[str, MCPTool] = {}
        self._running = False

        # 构建工具映射
        for tool in self.tools:
            self._tool_map[tool.name] = tool

        logger.info(f"MCP Server 初始化完成，共 {len(self.tools)} 个工具")

    def get_server_info(self) -> Dict[str, Any]:
        """获取服务器信息"""
        return {
            "name": self.name,
            "version": self.version,
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {
                    "listChanged": False
                }
            }
        }

    def get_tools_list(self) -> List[Dict[str, Any]]:
        """获取工具列表"""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.input_schema
            }
            for tool in self.tools
        ]

    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理 MCP 请求

        Args:
            request: MCP 请求字典

        Returns:
            MCP 响应字典
        """
        method = request.get("method", "")
        params = request.get("params", {})
        request_id = request.get("id")

        try:
            if method == "initialize":
                result = self.get_server_info()
            elif method == "tools/list":
                result = {"tools": self.get_tools_list()}
            elif method == "tools/call":
                result = self._handle_tool_call(params)
            elif method == "ping":
                result = {}
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}"
                    }
                }

            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": result
            }

        except Exception as e:
            logger.error(f"处理请求失败: {e}", exc_info=True)
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                }
            }

    def _handle_tool_call(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理工具调用

        Args:
            params: 工具调用参数

        Returns:
            工具调用结果
        """
        tool_name = params.get("name")
        arguments = params.get("arguments", {})

        if not tool_name:
            raise ValueError("Tool name is required")

        if tool_name not in self._tool_map:
            raise ValueError(f"Tool not found: {tool_name}")

        tool = self._tool_map[tool_name]
        logger.info(f"调用工具: {tool_name}, 参数: {arguments}")

        try:
            result = tool.handler(arguments)

            # 解析 JSON 结果
            if isinstance(result, str):
                try:
                    result = json.loads(result)
                except json.JSONDecodeError:
                    pass

            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, ensure_ascii=False, indent=2)
                    }
                ]
            }

        except Exception as e:
            logger.error(f"工具调用失败: {e}", exc_info=True)
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps({
                            "error": str(e),
                            "code": -1,
                            "message": f"工具调用失败: {str(e)}"
                        }, ensure_ascii=False)
                    }
                ],
                "isError": True
            }

    async def run_stdio(self):
        """
        以 stdio 模式运行服务器

        从标准输入读取请求，将响应写入标准输出。
        """
        self._running = True
        logger.info("MCP Server 启动 (stdio 模式)")

        import sys

        while self._running:
            try:
                # 读取一行输入
                line = await asyncio.get_event_loop().run_in_executor(
                    None, sys.stdin.readline
                )

                if not line:
                    break

                line = line.strip()
                if not line:
                    continue

                # 解析请求
                try:
                    request = json.loads(line)
                except json.JSONDecodeError as e:
                    logger.error(f"JSON 解析错误: {e}")
                    continue

                # 处理请求
                response = self.handle_request(request)

                # 写入响应
                print(json.dumps(response), flush=True)

            except Exception as e:
                logger.error(f"处理请求异常: {e}", exc_info=True)

        logger.info("MCP Server 停止")

    def stop(self):
        """停止服务器"""
        self._running = False


def create_server(
    name: str = "剪映草稿 MCP 服务",
    tools: Optional[List[MCPTool]] = None
) -> MCPServer:
    """
    创建 MCP 服务器实例

    Args:
        name: 服务名称
        tools: 自定义工具列表

    Returns:
        MCPServer 实例
    """
    return MCPServer(name=name, tools=tools)


def run_stdio():
    """
    以 stdio 模式运行 MCP 服务器

    用于 Claude Desktop、Cursor 等 AI 客户端通过 MCP 协议调用。
    """
    import sys

    # 设置日志输出到 stderr
    logging.basicConfig(
        level=_get_log_level(),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        stream=sys.stderr
    )

    server = create_server()
    asyncio.run(server.run_stdio())


def run_http(host: str = "0.0.0.0", port: int = 3000):
    """
    以 HTTP/SSE 模式运行 MCP 服务器

    Args:
        host: 监听地址
        port: 监听端口
    """
    try:
        from fastapi import FastAPI, Request
        from fastapi.responses import JSONResponse, StreamingResponse
        from fastapi.middleware.cors import CORSMiddleware
        import uvicorn
    except ImportError:
        raise ImportError("请安装 fastapi 和 uvicorn: pip install fastapi uvicorn")

    app = FastAPI(title="MCP Server", version="1.0.0")

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    server = create_server()

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/tools")
    async def list_tools():
        return {"tools": server.get_tools_list()}

    @app.post("/call")
    async def call_tool(request: Request):
        body = await request.json()
        tool_name = body.get("name")
        arguments = body.get("arguments", {})

        if not tool_name:
            return JSONResponse(
                {"error": "Tool name is required"},
                status_code=400
            )

        result = server._handle_tool_call({"name": tool_name, "arguments": arguments})
        return result

    @app.post("/mcp")
    async def mcp_endpoint(request: Request):
        body = await request.json()
        response = server.handle_request(body)
        return response

    logger.info(f"启动 MCP HTTP 服务: http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level=logging.getLevelName(_get_log_level()).lower())


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--http":
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
        run_http(port=port)
    else:
        run_stdio()