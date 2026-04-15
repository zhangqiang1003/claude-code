# -*- coding: utf-8 -*-
"""
MCP Server 模块

提供基于 Model Context Protocol (MCP) 的工具封装，
允许 AI 模型通过 MCP 协议调用剪映草稿 API。

使用方式:
1. stdio 模式: python -m core.mcp
2. HTTP 模式: python -m core.mcp --http --port 3000
3. 查看配置: python -m core.mcp --config
"""

from .server import MCPServer, create_server, run_stdio, run_http
from .tools import (
    MCPTool,
    DraftTools,
    TimelineTools,
    VideoTools,
    AudioTools,
    TextTools,
    StickerTools,
    EffectTools,
    KeyframeTools,
    get_all_tools
)
from .config import (
    get_mcp_server_config,
    get_claude_desktop_config,
    get_cursor_config,
    save_claude_desktop_config,
    print_usage
)

__all__ = [
    # Server
    'MCPServer',
    'create_server',
    'run_stdio',
    'run_http',
    # Tools
    'MCPTool',
    'DraftTools',
    'TimelineTools',
    'VideoTools',
    'AudioTools',
    'TextTools',
    'StickerTools',
    'EffectTools',
    'KeyframeTools',
    'get_all_tools',
    # Config
    'get_mcp_server_config',
    'get_claude_desktop_config',
    'get_cursor_config',
    'save_claude_desktop_config',
    'print_usage'
]