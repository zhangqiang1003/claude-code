# -*- coding: utf-8 -*-
"""
根据时间线创建文本素材信息 API

根据输入的时间线数组和文本列表，批量创建文本素材信息。
输出的每个文本片段与 text_info.py 生成的格式完全对齐。
"""

import uuid
import json
from typing import Dict, Any, List


def text_infos_by_timelines(
    timelines: List[Dict[str, int]],
    texts: List[str]
) -> Dict[str, Any]:
    """
    根据时间线对象创建文本素材信息

    Args:
        timelines: 时间线数组，每个元素包含 start 和 duration（微秒）
        texts: 文本内容列表

    Returns:
        包含文本信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - text_infos: 文本素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = text_infos_by_timelines(
        ...     timelines=[{"start": 0, "duration": 5000000}, {"start": 5000000, "duration": 3000000}],
        ...     texts=["第一段文本", "第二段文本"]
        ... )
    """
    # 参数校验
    if not timelines:
        return {"code": -1, "message": "时间线数组不能为空", "text_infos": "[]", "segment_ids": []}

    if not texts:
        return {"code": -1, "message": "文本列表不能为空", "text_infos": "[]", "segment_ids": []}

    # 检查时间线格式
    for i, tl in enumerate(timelines):
        if not isinstance(tl, dict):
            return {"code": -1, "message": f"时间线 {i} 不是有效的对象", "text_infos": "[]", "segment_ids": []}
        if "start" not in tl or "duration" not in tl:
            return {"code": -1, "message": f"时间线 {i} 缺少 start 或 duration 字段", "text_infos": "[]", "segment_ids": []}

    text_infos = []
    segment_ids = []

    for i, tl in enumerate(timelines):
        text = texts[i % len(texts)]
        segment_id = uuid.uuid4().hex

        text_infos.append({
            "id": segment_id,
            "content": text,
            "target_timerange": {
                "start": tl["start"],
                "duration": tl["duration"]
            }
        })
        segment_ids.append(segment_id)

    return {"code": 0, "message": "成功", "text_infos": json.dumps(text_infos, ensure_ascii=False), "segment_ids": segment_ids}
