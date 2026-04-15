# -*- coding: utf-8 -*-
"""
DMVideo Backend - HTTP 服务入口

提供剪映草稿 API 的 HTTP 服务。
"""

import os
import sys
import logging
from contextlib import asynccontextmanager

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
import uvicorn

# 导入 HTTP 模块
from core.api.router import router, app as draft_app


# 从 LOG_LEVEL 环境变量解析日志级别，默认 INFO
def get_log_level() -> int:
    """从 LOG_LEVEL 环境变量解析日志级别，默认 INFO"""
    level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    level_map = {
        "DEBUG": logging.DEBUG, "INFO": logging.INFO,
        "WARNING": logging.WARNING, "WARN": logging.WARNING,
        "ERROR": logging.ERROR, "CRITICAL": logging.CRITICAL,
    }
    return level_map.get(level_str, logging.INFO)


# 配置日志
logging.basicConfig(
    level=get_log_level(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("DMVideo Backend 服务启动...")
    yield
    # 关闭时
    logger.info("DMVideo Backend 服务关闭...")


# 创建 FastAPI 应用
app = FastAPI(
    title="DMVideo Backend",
    description="""
## 剪映草稿 API 服务

提供完整的剪映草稿创建、编辑、保存等功能。

### 主要功能模块

- **草稿管理**: 创建、保存、删除草稿
- **视频处理**: 视频/图片片段创建、修改、特效、滤镜
- **音频处理**: 音频片段创建、修改、特效
- **文本处理**: 文本片段创建、样式设置、动画
- **贴纸处理**: 贴纸创建、修改
- **关键帧**: 位置、缩放、旋转、音量等动画

### 时间单位说明

所有时间单位均为**微秒**（μs），1 秒 = 1,000,000 微秒。
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)


# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 注册路由
app.include_router(router, tags=["Draft"])


# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器"""
    logger.error(f"全局异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "code": -1,
            "message": f"服务器内部错误: {str(exc)}"
        }
    )


# 健康检查
@app.get("/health", tags=["Health"])
async def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "service": "DMVideo Backend",
        "version": "1.0.0"
    }


# 根路由
@app.get("/", tags=["Root"])
async def root():
    """根路由"""
    return {
        "message": "DMVideo Backend API",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health"
    }


# 获取草稿数据接口（用于剪映导入）
@app.get("/draft/content/{draft_id}", tags=["Draft"])
async def get_draft_content(draft_id: str):
    """
    获取草稿内容（用于剪映导入）

    返回 draft_content.json 格式的数据。
    """
    from core.draft import generate_draft_content_json

    result = generate_draft_content_json(draft_id)

    if result["code"] != 0:
        return JSONResponse(
            status_code=404,
            content={"code": -1, "message": result["message"]}
        )

    return result["content"]


# 导出草稿为 JSON
@app.get("/draft/export/{draft_id}", tags=["Draft"])
async def export_draft(draft_id: str):
    """
    导出草稿数据

    返回完整的草稿数据，包含所有轨道和素材信息。
    """
    from core.draft import export_draft_content

    content = export_draft_content(draft_id)

    if not content:
        return JSONResponse(
            status_code=404,
            content={"code": -1, "message": "草稿不存在或已过期"}
        )

    return content


if __name__ == "__main__":
    # 从环境变量获取配置
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 26312))

    # Nuitka 编译后不支持 reload（无法 spawn Python 子进程，且 watchfiles 会触发无限重载）
    is_nuitka = "__compiled__" in dir()
    debug = (not is_nuitka) and (os.getenv("DEBUG", "true").lower() == "true")

    logger.info(f"启动服务: http://{host}:{port}")
    logger.info(f"API 文档: http://{host}:{port}/docs")
    if is_nuitka:
        logger.info("检测到 Nuitka 编译环境，已禁用 reload 模式")

    if debug:
        # 开发模式：使用字符串导入 + reload
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            reload=True,
            log_level=logging.getLevelName(get_log_level()).lower()
        )
    else:
        # 生产/Nuitka 模式：直接传递 app 对象，无需 reload
        uvicorn.run(
            app,
            host=host,
            port=port,
            log_level=logging.getLevelName(get_log_level()).lower()
        )