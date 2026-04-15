# -*- coding: utf-8 -*-
"""
交换文本片段位置 API

支持交换两个文本片段的位置，或移动文本片段到指定位置。
交换后自动重新计算所有片段的 target_timerange，保证时间连续。
"""

import json
from typing import Dict, Any, List


def swap_text_segment_position(
    text_infos: str,
    swap_position: List[Dict[str, int]],
    target_timerange_start: int = 0
) -> Dict[str, Any]:
    """
    交换文本片段的位置

    支持一次交换多对片段。交换后自动重新计算所有片段的
    target_timerange，使片段时间连续排列。

    Args:
        text_infos: 文本素材信息（JSON 字符串）
        swap_position: 交换位置配置数组，每项包含:
            - source_index: 源位置（从 1 开始）
            - swap_index: 目标位置（从 1 开始）
        target_timerange_start: 重排后起始时间（微秒），默认 0

    Returns:
        包含交换后文本信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - text_infos: 交换后的文本素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = swap_text_segment_position(
        ...     text_infos='[{...}, {...}, {...}]',
        ...     swap_position=[{"source_index": 1, "swap_index": 3}]
        ... )
    """
    # 参数校验
    if not text_infos:
        return {"code": -1, "message": "文本素材信息不能为空", "text_infos": "[]", "segment_ids": []}

    if not swap_position:
        return {"code": -1, "message": "交换位置配置不能为空", "text_infos": "[]", "segment_ids": []}

    # 解析 JSON
    try:
        text_list = json.loads(text_infos)
    except (json.JSONDecodeError, TypeError) as e:
        return {"code": -1, "message": f"文本素材信息 JSON 格式错误: {e}", "text_infos": "[]", "segment_ids": []}

    if not isinstance(text_list, list):
        text_list = [text_list]

    if len(text_list) < 2:
        return {"code": -1, "message": "片段数量少于 2，无法交换", "text_infos": text_infos, "segment_ids": []}

    # 校验 swap_position 格式和索引范围
    for i, swap in enumerate(swap_position):
        if not isinstance(swap, dict):
            return {"code": -1, "message": f"交换配置 {i} 不是有效的对象", "text_infos": "[]", "segment_ids": []}

        source_index = swap.get("source_index")
        swap_index = swap.get("swap_index")

        if source_index is None or swap_index is None:
            return {
                "code": -1,
                "message": f"交换配置 {i} 缺少 source_index 或 swap_index 字段",
                "text_infos": "[]",
                "segment_ids": []
            }

        if not isinstance(source_index, int) or not isinstance(swap_index, int):
            return {
                "code": -1,
                "message": f"交换配置 {i} 的 source_index 和 swap_index 必须为整数",
                "text_infos": "[]",
                "segment_ids": []
            }

        if source_index < 1 or source_index > len(text_list):
            return {
                "code": -1,
                "message": f"source_index={source_index} 超出范围（1~{len(text_list)}）",
                "text_infos": "[]",
                "segment_ids": []
            }

        if swap_index < 1 or swap_index > len(text_list):
            return {
                "code": -1,
                "message": f"swap_index={swap_index} 超出范围（1~{len(text_list)}）",
                "text_infos": "[]",
                "segment_ids": []
            }

    # 执行交换
    for swap in swap_position:
        src = swap["source_index"] - 1  # 转为 0 基索引
        swp = swap["swap_index"] - 1

        # 跳过自身交换
        if src == swp:
            continue

        text_list[src], text_list[swp] = text_list[swp], text_list[src]

    # 重新计算 target_timerange（保持时间连续）
    _recalculate_target_timerange(text_list, target_timerange_start)

    return {
        "code": 0,
        "message": "成功",
        "text_infos": json.dumps(text_list, ensure_ascii=False),
        "segment_ids": [item.get("id", "") for item in text_list]
    }


def move_text_segment(
    text_infos: str,
    from_index: int,
    to_index: int,
    target_timerange_start: int = 0
) -> Dict[str, Any]:
    """
    移动文本片段到指定位置

    将指定片段从当前位置移动到目标位置，其他片段顺延。
    移动后自动重新计算所有片段的 target_timerange。

    Args:
        text_infos: 文本素材信息（JSON 字符串）
        from_index: 原始位置（从 1 开始）
        to_index: 目标位置（从 1 开始）
        target_timerange_start: 重排后起始时间（微秒），默认 0

    Returns:
        包含移动后文本信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - text_infos: 移动后的文本素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = move_text_segment(
        ...     text_infos='[{...}, {...}, {...}]',
        ...     from_index=1,
        ...     to_index=3
        ... )
    """
    # 参数校验
    if not text_infos:
        return {"code": -1, "message": "文本素材信息不能为空", "text_infos": "[]", "segment_ids": []}

    # 解析 JSON
    try:
        text_list = json.loads(text_infos)
    except (json.JSONDecodeError, TypeError) as e:
        return {"code": -1, "message": f"文本素材信息 JSON 格式错误: {e}", "text_infos": "[]", "segment_ids": []}

    if not isinstance(text_list, list):
        text_list = [text_list]

    if len(text_list) < 2:
        return {"code": -1, "message": "片段数量少于 2，无法移动", "text_infos": text_infos, "segment_ids": []}

    # 校验索引
    if not isinstance(from_index, int) or not isinstance(to_index, int):
        return {"code": -1, "message": "from_index 和 to_index 必须为整数", "text_infos": "[]", "segment_ids": []}

    from_idx = from_index - 1
    to_idx = to_index - 1

    if from_idx < 0 or from_idx >= len(text_list):
        return {
            "code": -1,
            "message": f"from_index={from_index} 超出范围（1~{len(text_list)}）",
            "text_infos": "[]",
            "segment_ids": []
        }

    if to_idx < 0 or to_idx >= len(text_list):
        return {
            "code": -1,
            "message": f"to_index={to_index} 超出范围（1~{len(text_list)}）",
            "text_infos": "[]",
            "segment_ids": []
        }

    # 跳过无效移动（原地不动）
    if from_idx == to_idx:
        return {
            "code": 0,
            "message": "成功",
            "text_infos": json.dumps(text_list, ensure_ascii=False),
            "segment_ids": [item.get("id", "") for item in text_list]
        }

    # 执行移动
    item = text_list.pop(from_idx)
    text_list.insert(to_idx, item)

    # 重新计算 target_timerange
    _recalculate_target_timerange(text_list, target_timerange_start)

    return {
        "code": 0,
        "message": "成功",
        "text_infos": json.dumps(text_list, ensure_ascii=False),
        "segment_ids": [item.get("id", "") for item in text_list]
    }


def _recalculate_target_timerange(text_list: list, start: int = 0) -> None:
    """
    重新计算片段列表的 target_timerange，保证时间连续

    Args:
        text_list: 文本片段列表（原地修改）
        start: 起始时间（微秒）
    """
    current = start
    for item in text_list:
        duration = item.get("target_timerange", {}).get("duration", 0)
        item["target_timerange"] = {"start": current, "duration": duration}
        current += duration
