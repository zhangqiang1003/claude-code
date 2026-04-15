# -*- coding: utf-8 -*-
"""
创建草稿 API

创建一个新的剪映草稿项目。
"""

import uuid
from typing import Dict, Any

from .draft_cache import (
    draft_cache,
    format_draft_key,
    DRAFT_TEMPLATE,
    DEFAULT_EXPIRE_SECONDS
)


def create_draft(
    width: int,
    height: int
) -> Dict[str, Any]:
    """
    创建草稿

    Args:
        width: 视频画面的宽度（像素）
        height: 视频画面的高度（像素）

    Returns:
        包含草稿信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - draft_id: 草稿唯一标识

    Example:
        >>> result = create_draft(1920, 1080)
        >>> print(result['draft_id'])
    """
    # 参数校验
    if not width or width <= 0:
        return {
            "code": -1,
            "message": "宽度必须大于 0",
            "draft_id": ""
        }

    if not height or height <= 0:
        return {
            "code": -1,
            "message": "高度必须大于 0",
            "draft_id": ""
        }

    # 生成草稿 ID
    draft_id = uuid.uuid4().hex

    # 缓存草稿模板信息
    template_data = {
        "width": width,
        "height": height
    }

    key = format_draft_key(draft_id, DRAFT_TEMPLATE)
    draft_cache.set(key, template_data, DEFAULT_EXPIRE_SECONDS)

    return {
        "code": 0,
        "message": "success",
        "draft_id": draft_id
    }


def get_draft_template(draft_id: str) -> Dict[str, Any]:
    """
    获取草稿模板信息

    Args:
        draft_id: 草稿ID

    Returns:
        模板信息字典，包含 width 和 height
    """
    key = format_draft_key(draft_id, DRAFT_TEMPLATE)
    return draft_cache.get(key) or {}


def check_draft_exists(draft_id: str) -> bool:
    """
    检查草稿是否存在

    Args:
        draft_id: 草稿ID

    Returns:
        是否存在
    """
    key = format_draft_key(draft_id, DRAFT_TEMPLATE)
    return draft_cache.exists(key)


def delete_draft(draft_id: str) -> Dict[str, Any]:
    """
    删除草稿

    删除草稿的所有相关数据（模板、视频、音频、文本、贴纸、特效、滤镜、关键帧等）。

    Args:
        draft_id: 草稿ID

    Returns:
        包含结果的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息

    Example:
        >>> result = delete_draft("xxx")
        >>> print(result['code'])
    """
    if not draft_id:
        return {"code": -1, "message": "草稿 ID 不能为空"}

    if not check_draft_exists(draft_id):
        return {"code": -1, "message": "草稿不存在或已过期"}

    # 获取所有与此草稿相关的键
    prefix = f"draft:{draft_id}:"
    keys = draft_cache.keys(prefix)

    # 删除所有相关键
    deleted_count = 0
    for key in keys:
        if draft_cache.delete(key):
            deleted_count += 1

    return {
        "code": 0,
        "message": "success",
        "deleted_keys": deleted_count
    }


if __name__ == "__main__":
    # 测试
    result = create_draft(1920, 1080)
    print(f"创建草稿: {result}")

    if result["code"] == 0:
        template = get_draft_template(result["draft_id"])
        print(f"模板信息: {template}")