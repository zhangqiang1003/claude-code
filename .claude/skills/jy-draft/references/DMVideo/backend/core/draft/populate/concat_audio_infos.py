# -*- coding: utf-8 -*-
"""
拼接音频信息 API

将两个音频信息拼接成一个新的音频信息。
"""

import json
from typing import Dict, Any, List


def concat_audio_infos(
    audio_infos1: str,
    audio_infos2: str
) -> Dict[str, Any]:
    """
    拼接两个音频素材信息

    Args:
        audio_infos1: 待拼接的第一个音频素材（JSON 字符串）
        audio_infos2: 待拼接的第二个音频素材（JSON 字符串）

    Returns:
        包含拼接后音频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - audio_infos: 拼接后的音频素材（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = concat_audio_infos(
        ...     audio_infos1='[{"id":"1","audio_url":"https://a.mp3","target_timerange":{"start":0,"duration":5000000}}]',
        ...     audio_infos2='[{"id":"2","audio_url":"https://b.mp3","target_timerange":{"start":0,"duration":3000000}}]'
        ... )
    """
    # 参数校验
    if not audio_infos1 and not audio_infos2:
        return {
            "code": -1,
            "message": "两个音频素材信息都为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 解析音频信息
    try:
        list1 = json.loads(audio_infos1) if audio_infos1 else []
    except json.JSONDecodeError:
        return {
            "code": -1,
            "message": "第一个音频素材信息 JSON 格式错误",
            "audio_infos": "[]",
            "segment_ids": []
        }

    try:
        list2 = json.loads(audio_infos2) if audio_infos2 else []
    except json.JSONDecodeError:
        return {
            "code": -1,
            "message": "第二个音频素材信息 JSON 格式错误",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 合并列表
    combined_list = list1 + list2

    if not combined_list:
        return {
            "code": -1,
            "message": "合并后的音频素材列表为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 重新计算时间范围
    current_time = 0
    for item in combined_list:
        target_range = item.get("target_timerange", {})
        duration = target_range.get("duration", 0)

        # 更新开始时间
        item["target_timerange"] = {
            "start": current_time,
            "duration": duration
        }

        current_time += duration

    # 提取所有 segment_ids
    segment_ids = [item.get("id", "") for item in combined_list]

    return {
        "code": 0,
        "message": "拼接成功",
        "audio_infos": json.dumps(combined_list, ensure_ascii=False),
        "segment_ids": segment_ids
    }


def concat_audio_infos_list(
    audio_infos_list: List[str]
) -> Dict[str, Any]:
    """
    拼接多个音频素材信息

    Args:
        audio_infos_list: 音频素材信息列表（JSON 字符串列表）

    Returns:
        包含拼接后音频信息的字典

    Example:
        >>> result = concat_audio_infos_list([
        ...     '[{"id":"1","audio_url":"https://a.mp3","target_timerange":{"start":0,"duration":5000000}}]',
        ...     '[{"id":"2","audio_url":"https://b.mp3","target_timerange":{"start":0,"duration":3000000}}]',
        ...     '[{"id":"3","audio_url":"https://c.mp3","target_timerange":{"start":0,"duration":4000000}}]'
        ... ])
    """
    if not audio_infos_list:
        return {
            "code": -1,
            "message": "音频素材信息列表不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 逐个拼接
    result = None
    current_combined = "[]"

    for i, audio_infos in enumerate(audio_infos_list):
        if i == 0:
            current_combined = audio_infos
        else:
            result = concat_audio_infos(current_combined, audio_infos)
            if result["code"] != 0:
                return result
            current_combined = result["audio_infos"]

    # 返回最终结果
    try:
        final_list = json.loads(current_combined)
    except json.JSONDecodeError:
        return {
            "code": -1,
            "message": "拼接结果解析错误",
            "audio_infos": "[]",
            "segment_ids": []
        }

    return {
        "code": 0,
        "message": "拼接成功",
        "audio_infos": current_combined,
        "segment_ids": [item.get("id", "") for item in final_list]
    }


if __name__ == "__main__":
    # 测试示例
    audio1 = json.dumps([{
        "id": "audio-001",
        "audio_url": "https://example.com/a.mp3",
        "target_timerange": {"start": 0, "duration": 5000000},
        "fade": {"in_duration": 500000, "out_duration": 500000}
    }])

    audio2 = json.dumps([
        {"id": "audio-002", "audio_url": "https://example.com/b.mp3", "target_timerange": {"start": 0, "duration": 3000000}},
        {"id": "audio-003", "audio_url": "https://example.com/c.mp3", "target_timerange": {"start": 0, "duration": 4000000}}
    ])

    result = concat_audio_infos(audio1, audio2)
    print(f"code: {result['code']}")
    print(f"message: {result['message']}")
    print(f"segment_ids: {result['segment_ids']}")

    # 解析并打印结果
    combined = json.loads(result["audio_infos"])
    print("\n拼接后的时间范围:")
    for item in combined:
        target = item.get("target_timerange", {})
        print(f"  {item['id']}: start={target['start']/1_000_000}s, duration={target['duration']/1_000_000}s")