# -*- coding: utf-8 -*-
"""
交换视频/图片片段位置 API

支持交换两个片段的位置，或移动片段到指定位置。
交换后自动重新计算所有片段的 target_timerange，保证时间连续。
"""

import json
from typing import Dict, Any, List


def swap_video_segment_position(
    video_infos: str,
    swap_position: List[Dict[str, int]],
    target_timerange_start: int = 0
) -> Dict[str, Any]:
    """
    交换视频片段的位置

    支持一次交换多对片段。交换后自动重新计算所有片段的
    target_timerange，使片段时间连续排列。

    Args:
        video_infos: 视频素材信息（JSON 字符串）
        swap_position: 交换位置配置数组，每项包含:
            - source_index: 源位置（从 1 开始）
            - swap_index: 目标位置（从 1 开始）
        target_timerange_start: 重排后起始时间（微秒），默认 0

    Returns:
        包含交换后视频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - video_infos: 交换后的视频素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = swap_video_segment_position(
        ...     video_infos='[{...}, {...}, {...}]',
        ...     swap_position=[{"source_index": 1, "swap_index": 3}]
        ... )
    """
    # 参数校验
    if not video_infos:
        return {"code": -1, "message": "视频素材信息不能为空", "video_infos": "[]", "segment_ids": []}

    if not swap_position:
        return {"code": -1, "message": "交换位置配置不能为空", "video_infos": "[]", "segment_ids": []}

    # 解析 JSON
    try:
        video_list = json.loads(video_infos)
    except (json.JSONDecodeError, TypeError) as e:
        return {"code": -1, "message": f"视频素材信息 JSON 格式错误: {e}", "video_infos": "[]", "segment_ids": []}

    if not isinstance(video_list, list):
        video_list = [video_list]

    if len(video_list) < 2:
        return {"code": -1, "message": "片段数量少于 2，无法交换", "video_infos": video_infos, "segment_ids": []}

    # 校验 swap_position 格式和索引范围
    for i, swap in enumerate(swap_position):
        if not isinstance(swap, dict):
            return {"code": -1, "message": f"交换配置 {i} 不是有效的对象", "video_infos": "[]", "segment_ids": []}

        source_index = swap.get("source_index")
        swap_index = swap.get("swap_index")

        if source_index is None or swap_index is None:
            return {
                "code": -1,
                "message": f"交换配置 {i} 缺少 source_index 或 swap_index 字段",
                "video_infos": "[]",
                "segment_ids": []
            }

        if not isinstance(source_index, int) or not isinstance(swap_index, int):
            return {
                "code": -1,
                "message": f"交换配置 {i} 的 source_index 和 swap_index 必须为整数",
                "video_infos": "[]",
                "segment_ids": []
            }

        if source_index < 1 or source_index > len(video_list):
            return {
                "code": -1,
                "message": f"source_index={source_index} 超出范围（1~{len(video_list)}）",
                "video_infos": "[]",
                "segment_ids": []
            }

        if swap_index < 1 or swap_index > len(video_list):
            return {
                "code": -1,
                "message": f"swap_index={swap_index} 超出范围（1~{len(video_list)}）",
                "video_infos": "[]",
                "segment_ids": []
            }

    # 执行交换
    for swap in swap_position:
        src = swap["source_index"] - 1  # 转为 0 基索引
        swp = swap["swap_index"] - 1

        # 跳过自身交换
        if src == swp:
            continue

        video_list[src], video_list[swp] = video_list[swp], video_list[src]

    # 重新计算 target_timerange（保持时间连续）
    _recalculate_target_timerange(video_list, target_timerange_start)

    return {
        "code": 0,
        "message": "成功",
        "video_infos": json.dumps(video_list, ensure_ascii=False),
        "segment_ids": [item.get("id", "") for item in video_list]
    }


def move_video_segment(
    video_infos: str,
    from_index: int,
    to_index: int,
    target_timerange_start: int = 0
) -> Dict[str, Any]:
    """
    移动视频片段到指定位置

    将指定片段从当前位置移动到目标位置，其他片段顺延。
    移动后自动重新计算所有片段的 target_timerange。

    Args:
        video_infos: 视频素材信息（JSON 字符串）
        from_index: 原始位置（从 1 开始）
        to_index: 目标位置（从 1 开始）
        target_timerange_start: 重排后起始时间（微秒），默认 0

    Returns:
        包含移动后视频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - video_infos: 移动后的视频素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = move_video_segment(
        ...     video_infos='[{...}, {...}, {...}]',
        ...     from_index=1,
        ...     to_index=3
        ... )
    """
    # 参数校验
    if not video_infos:
        return {"code": -1, "message": "视频素材信息不能为空", "video_infos": "[]", "segment_ids": []}

    # 解析 JSON
    try:
        video_list = json.loads(video_infos)
    except (json.JSONDecodeError, TypeError) as e:
        return {"code": -1, "message": f"视频素材信息 JSON 格式错误: {e}", "video_infos": "[]", "segment_ids": []}

    if not isinstance(video_list, list):
        video_list = [video_list]

    if len(video_list) < 2:
        return {"code": -1, "message": "片段数量少于 2，无法移动", "video_infos": video_infos, "segment_ids": []}

    # 校验索引
    if not isinstance(from_index, int) or not isinstance(to_index, int):
        return {"code": -1, "message": "from_index 和 to_index 必须为整数", "video_infos": "[]", "segment_ids": []}

    from_idx = from_index - 1
    to_idx = to_index - 1

    if from_idx < 0 or from_idx >= len(video_list):
        return {
            "code": -1,
            "message": f"from_index={from_index} 超出范围（1~{len(video_list)}）",
            "video_infos": "[]",
            "segment_ids": []
        }

    if to_idx < 0 or to_idx >= len(video_list):
        return {
            "code": -1,
            "message": f"to_index={to_index} 超出范围（1~{len(video_list)}）",
            "video_infos": "[]",
            "segment_ids": []
        }

    # 跳过无效移动（原地不动）
    if from_idx == to_idx:
        return {
            "code": 0,
            "message": "成功",
            "video_infos": json.dumps(video_list, ensure_ascii=False),
            "segment_ids": [item.get("id", "") for item in video_list]
        }

    # 执行移动
    item = video_list.pop(from_idx)
    video_list.insert(to_idx, item)

    # 重新计算 target_timerange
    _recalculate_target_timerange(video_list, target_timerange_start)

    return {
        "code": 0,
        "message": "成功",
        "video_infos": json.dumps(video_list, ensure_ascii=False),
        "segment_ids": [item.get("id", "") for item in video_list]
    }


def _recalculate_target_timerange(video_list: list, start: int = 0) -> None:
    """
    重新计算片段列表的 target_timerange，保证时间连续

    Args:
        video_list: 视频片段列表（原地修改）
        start: 起始时间（微秒）
    """
    current = start
    for item in video_list:
        duration = item.get("target_timerange", {}).get("duration", 0)
        item["target_timerange"] = {"start": current, "duration": duration}
        current += duration


if __name__ == "__main__":
    # 测试交换
    test_data = [
        {"id": "v1", "material_url": "https://a.mp4", "target_timerange": {"start": 0, "duration": 3000000}},
        {"id": "v2", "material_url": "https://b.mp4", "target_timerange": {"start": 3000000, "duration": 5000000}},
        {"id": "v3", "material_url": "https://c.mp4", "target_timerange": {"start": 8000000, "duration": 2000000}}
    ]

    print("=== 交换片段 1 和 3 ===")
    result = swap_video_segment_position(
        json.dumps(test_data),
        [{"source_index": 1, "swap_index": 3}]
    )
    swapped = json.loads(result["video_infos"])
    for seg in swapped:
        print(f"  {seg['id']}: start={seg['target_timerange']['start']}, duration={seg['target_timerange']['duration']}")

    print("\n=== 移动片段 1 到位置 3 ===")
    result = move_video_segment(json.dumps(test_data), 1, 3)
    moved = json.loads(result["video_infos"])
    for seg in moved:
        print(f"  {seg['id']}: start={seg['target_timerange']['start']}, duration={seg['target_timerange']['duration']}")
