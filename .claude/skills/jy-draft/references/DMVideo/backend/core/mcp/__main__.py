# -*- coding: utf-8 -*-
"""
MCP Server 入口

支持通过 python -m core.mcp 运行。
"""

import sys
import argparse


def main():
    parser = argparse.ArgumentParser(
        description="剪映草稿 MCP Server",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--http",
        action="store_true",
        help="以 HTTP 模式运行"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=3000,
        help="HTTP 模式监听端口 (默认: 3000)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="HTTP 模式监听地址 (默认: 0.0.0.0)"
    )
    parser.add_argument(
        "--config",
        action="store_true",
        help="打印 Claude Desktop 配置"
    )

    args = parser.parse_args()

    if args.config:
        from .config import print_usage
        print_usage()
        return

    if args.http:
        from .server import run_http
        run_http(host=args.host, port=args.port)
    else:
        from .server import run_stdio
        run_stdio()


if __name__ == "__main__":
    main()