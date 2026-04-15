# -*- coding: utf-8 -*-
"""
HTTP 接口模块

提供基于 FastAPI 的 HTTP 接口封装，用于剪映草稿 API 服务。
"""

from .router import router, app
from .schemas import (
    CreateDraftRequest, CreateDraftResponse,
    AddVideosRequest, AddAudiosRequest, AddTextsRequest, 
    TimelineRequest, TimelineByAudioRequest,
    ApiResponse
)

__all__ = [
    'router',
    'app',
    # Schemas
    'CreateDraftRequest',
    'CreateDraftResponse',
    'AddVideosRequest',
    'AddAudiosRequest',
    'AddTextsRequest',
    'VideoInfoRequest',
    'AudioInfoRequest',
    'TextInfoRequest',
    'TimelineRequest',
    'TimelineByAudioRequest',
    'ApiResponse'
]