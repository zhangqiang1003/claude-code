# -*- coding: utf-8 -*-
"""
MCP Server 配置文件

用于配置 Claude Desktop、Cursor 等 AI 客户端的 MCP 连接。
"""

import os
import sys
from pathlib import Path


def get_mcp_server_config(
    server_name: str = "剪映草稿服务",
    python_path: str = None,
    server_script: str = None
) -> dict:
    """
    获取 MCP 服务器配置

    Args:
        server_name: 服务名称
        python_path: Python 解释器路径，默认使用当前环境
        server_script: 服务器脚本路径，默认使用内置服务器

    Returns:
        MCP 配置字典
    """
    if python_path is None:
        python_path = sys.executable

    if server_script is None:
        server_script = str(Path(__file__).parent / "server.py")

    return {
        "mcpServers": {
            server_name: {
                "command": python_path,
                "args": [server_script],
                "env": {}
            }
        }
    }


def get_claude_desktop_config() -> dict:
    """
    获取 Claude Desktop 配置

    将此配置添加到 Claude Desktop 的配置文件中:
    - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
    - Windows: %APPDATA%\\Claude\\claude_desktop_config.json
    - Linux: ~/.config/Claude/claude_desktop_config.json
    """
    return get_mcp_server_config("dmvideo-draft")


def get_cursor_config() -> dict:
    """
    获取 Cursor 配置

    将此配置添加到 Cursor 的 MCP 设置中。
    """
    return get_mcp_server_config("dmvideo-draft")


def save_claude_desktop_config():
    """
    保存配置到 Claude Desktop 配置文件
    """
    import json
    import platform

    # 确定配置文件路径
    system = platform.system()
    if system == "Darwin":  # macOS
        config_dir = Path.home() / "Library" / "Application Support" / "Claude"
    elif system == "Windows":
        config_dir = Path(os.environ.get("APPDATA", "")) / "Claude"
    else:  # Linux
        config_dir = Path.home() / ".config" / "Claude"

    config_file = config_dir / "claude_desktop_config.json"

    # 创建目录
    config_dir.mkdir(parents=True, exist_ok=True)

    # 读取现有配置
    existing_config = {}
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                existing_config = json.load(f)
        except Exception:
            pass

    # 合并配置
    new_config = get_claude_desktop_config()
    if "mcpServers" not in existing_config:
        existing_config["mcpServers"] = {}

    existing_config["mcpServers"].update(new_config["mcpServers"])

    # 保存配置
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(existing_config, f, indent=2, ensure_ascii=False)

    print(f"配置已保存到: {config_file}")
    return config_file


def print_usage():
    """打印使用说明"""
    print("""
=====================================
MCP Server 使用说明
=====================================

1. 直接运行 (stdio 模式):
   python -m core.mcp.server

2. HTTP 模式运行:
   python -m core.mcp.server --http [port]

3. 配置 Claude Desktop:
   将以下配置添加到 Claude Desktop 配置文件:

   macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
   Windows: %APPDATA%\\Claude\\claude_desktop_config.json
   Linux: ~/.config/Claude/claude_desktop_config.json

   配置内容:
   """)

    config = get_claude_desktop_config()
    import json
    print(json.dumps(config, indent=2, ensure_ascii=False))

    print("""
4. 自动配置 Claude Desktop:
   python -c "from core.mcp.config import save_claude_desktop_config; save_claude_desktop_config()"

=====================================
可用工具列表:
=====================================
""")

    from .tools import get_all_tools
    for tool in get_all_tools():
        print(f"  - {tool.name}: {tool.description}")


if __name__ == "__main__":
    print_usage()