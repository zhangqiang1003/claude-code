# -*- coding: utf-8 -*-
"""
修改音频信息 API

修改一个音频素材信息，指定修改音频素材片段的基本信息。
入参数据结构与 generate_template.py 的 _add_audio_segment 所消费的 segment 字段完全对齐。
"""

import json
from typing import Dict, Any, List, Optional


def modify_audio_infos(
    audio_infos: str,
    segment_index: List[int],
    target_timerange: Optional[Dict[str, int]] = None,
    source_timerange: Optional[Dict[str, int]] = None,
    volume: Optional[float] = None,
    speed: Optional[float] = None,
    change_pitch: Optional[bool] = None,
    material_url: Optional[str] = None,
    material_name: Optional[str] = None,
    fade: Optional[Dict[str, int]] = None,
    effects: Optional[List[Dict[str, Any]]] = None,
    keyframes: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    修改音频素材信息

    入参数据结构与 generate_template.py 的 _add_audio_segment 所消费的
    segment 字段完全对齐，同时保留 segment_index 和 audio_infos 参数。

    Args:
        audio_infos: 音频素材信息（JSON 字符串）
        segment_index: 要修改的素材片段索引列表，从 1 开始，如 [1, 2, 3, 5]
        target_timerange: 片段在轨道上的目标时间范围 (微秒)
            {"start": int, "duration": int}
        source_timerange: 截取的素材片段时间范围 (微秒)
            {"start": int, "duration": int}
        volume: 音量
        speed: 播放速度，取值范围：0.1~50.0
        change_pitch: 是否跟随变速改变音调
        material_url: 音频素材文件路径/URL
        material_name: 素材名称
        fade: 淡入淡出效果 (微秒)
            {"in_duration": int, "out_duration": int}
        effects: 音频特效列表
            [{"type": "特效名", "params": [0-100]}]
        keyframes: 音量关键帧列表
            [{"time_offset": int, "volume": float}]

    Returns:
        包含修改后音频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - audio_infos: 修改后的音频素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = modify_audio_infos(
        ...     audio_infos='[{"id":"123","material_url":"https://x.mp3","target_timerange":{"start":0,"duration":5000000}}]',
        ...     segment_index=[1],
        ...     volume=0.8,
        ...     speed=1.5,
        ...     fade={"in_duration": 500000, "out_duration": 0},
        ...     effects=[{"type": "大叔", "params": [50]}],
        ...     keyframes=[{"time_offset": 0, "volume": 1.0}]
        ... )
    """
    # 参数校验
    if not audio_infos:
        return {
            "code": -1,
            "message": "音频素材信息不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    if not segment_index:
        return {
            "code": -1,
            "message": "素材片段索引列表不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    if speed is not None and (speed < 0.1 or speed > 50.0):
        return {
            "code": -1,
            "message": "播放速度必须在 0.1~50.0 范围内",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 解析音频信息
    try:
        audio_list = json.loads(audio_infos)
    except json.JSONDecodeError:
        return {
            "code": -1,
            "message": "音频素材信息 JSON 格式错误",
            "audio_infos": "[]",
            "segment_ids": []
        }

    if not isinstance(audio_list, list):
        audio_list = [audio_list]

    # 获取所有需要修改的索引（转换为 0 基索引）
    indices_to_modify = [idx - 1 for idx in segment_index if 0 < idx <= len(audio_list)]

    if not indices_to_modify:
        return {
            "code": -1,
            "message": "没有有效的素材片段索引",
            "audio_infos": audio_infos,
            "segment_ids": []
        }

    # 修改指定的音频信息
    for idx in indices_to_modify:
        audio_item = audio_list[idx]

        # 修改 material_url
        if material_url is not None:
            audio_item["material_url"] = material_url

        # 修改 material_name
        if material_name is not None:
            audio_item["material_name"] = material_name

        # 修改 target_timerange
        if target_timerange is not None:
            current = audio_item.get("target_timerange", {})
            if "start" in target_timerange:
                current["start"] = target_timerange["start"]
            if "duration" in target_timerange:
                current["duration"] = target_timerange["duration"]
            audio_item["target_timerange"] = current

        # 修改 source_timerange
        if source_timerange is not None:
            current = audio_item.get("source_timerange", {})
            if "start" in source_timerange:
                current["start"] = source_timerange["start"]
            if "duration" in source_timerange:
                current["duration"] = source_timerange["duration"]
            audio_item["source_timerange"] = current

            # 如果修改了 source_timerange.duration 且没有同时修改 target_timerange.duration，
            # 则根据 speed 重新计算 target_timerange.duration
            if "duration" in source_timerange and target_timerange is None:
                current_speed = speed if speed is not None else audio_item.get("speed", 1.0)
                audio_item.setdefault("target_timerange", {})["duration"] = round(source_timerange["duration"] / current_speed)

        # 修改 speed
        if speed is not None:
            audio_item["speed"] = speed
            # 如果没有同时修改 source_timerange，则根据新速度重新计算 target_timerange.duration
            if source_timerange is None:
                src_duration = audio_item.get("source_timerange", {}).get("duration", 0)
                if src_duration:
                    audio_item.setdefault("target_timerange", {})["duration"] = round(src_duration / speed)

        # 修改 volume
        if volume is not None:
            audio_item["volume"] = volume

        # 修改 change_pitch
        if change_pitch is not None:
            audio_item["change_pitch"] = change_pitch

        # 修改 fade
        if fade is not None:
            current_fade = audio_item.get("fade", {"in_duration": 0, "out_duration": 0})
            if "in_duration" in fade:
                current_fade["in_duration"] = fade["in_duration"]
            if "out_duration" in fade:
                current_fade["out_duration"] = fade["out_duration"]
            audio_item["fade"] = current_fade

        # 修改 effects
        if effects is not None:
            audio_item["effects"] = effects

        # 修改 keyframes
        if keyframes is not None:
            audio_item["keyframes"] = keyframes

    # 提取所有 segment_ids
    segment_ids = [item.get("id", "") for item in audio_list]

    return {
        "code": 0,
        "message": "Success",
        "audio_infos": json.dumps(audio_list, ensure_ascii=False),
        "segment_ids": segment_ids
    }


def modify_audio_info_by_id(
    audio_infos: str,
    segment_id: str,
    **kwargs
) -> Dict[str, Any]:
    """
    通过 ID 修改音频素材信息

    Args:
        audio_infos: 音频素材信息（JSON 字符串）
        segment_id: 要修改的素材片段 ID
        **kwargs: 其他修改参数（与 modify_audio_infos 相同的 segment 格式参数）

    Returns:
        包含修改后音频信息的字典
    """
    try:
        audio_list = json.loads(audio_infos)
    except json.JSONDecodeError:
        return {
            "code": -1,
            "message": "音频素材信息 JSON 格式错误",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 找到对应 ID 的索引
    for i, item in enumerate(audio_list):
        if item.get("id") == segment_id:
            return modify_audio_infos(audio_infos, [i + 1], **kwargs)

    return {
        "code": -1,
        "message": f"未找到 ID 为 {segment_id} 的音频片段",
        "audio_infos": audio_infos,
        "segment_ids": []
    }


if __name__ == "__main__":
    # 测试示例
    test_audio_infos = json.dumps([{
        "id": "test-001",
        "material_url": "https://example.com/audio.mp3",
        "target_timerange": {"start": 0, "duration": 5000000},
        "source_timerange": {"start": 0, "duration": 5000000},
        "speed": 1.0,
        "volume": 1.0
    }])

    result = modify_audio_infos(
        audio_infos=test_audio_infos,
        segment_index=[1],
        volume=0.8,
        speed=2.0,
        fade={"in_duration": 500000}
    )
    print(f"code: {result['code']}")
    print(f"modified audio_infos: {result['audio_infos']}")
