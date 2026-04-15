# -*- coding: utf-8 -*-
"""
创建音频片段信息 API

根据音频 URL 和参数，自动创建一段音频素材信息。
输出的音频片段格式与 generate_template.py 的 _add_audio_segment 所需格式完全对齐。
"""

import uuid
import json
from typing import Dict, Any, Optional, List


def audio_info(
    material_url: str,
    target_timerange: Dict[str, int],
    source_timerange: Optional[Dict[str, int]] = None,
    volume: float = 1.0,
    speed: Optional[float] = None,
    change_pitch: bool = False,
    material_name: Optional[str] = None,
    fade: Optional[Dict[str, int]] = None,
    effects: Optional[List[Dict[str, Any]]] = None,
    keyframes: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    自动创建一段音频片段信息

    入参数据结构与 generate_template.py 的 _add_audio_segment 所消费的
    segment 字段完全对齐:

    Args:
        material_url: 音频素材文件路径/URL（对应 _add_audio_segment 的 material_url）
        target_timerange: 片段在轨道上的目标时间范围 (微秒)
            {"start": int, "duration": int}
        source_timerange: 截取的素材片段时间范围 (微秒)，可选
            {"start": int, "duration": int}
            若不提供则根据 target_timerange 和 speed 自动计算
        volume: 音量，默认 1.0（100%）
        speed: 播放速度，可选，取值范围 0.1~50.0
        change_pitch: 是否跟随变速改变音调，默认 False
        material_name: 素材名称，可选
        fade: 淡入淡出效果
            {"in_duration": int, "out_duration": int}  (微秒)
        effects: 音频特效列表
            [{"type": "特效名", "params": [0-100]}]
        keyframes: 音量关键帧列表
            [{"time_offset": int, "volume": float}]  (微秒)

    Returns:
        包含音频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - audio_infos: 音频素材信息（JSON 字符串，可直接传给 add_audios）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = audio_info(
        ...     material_url="https://example.com/audio.mp3",
        ...     target_timerange={"start": 0, "duration": 3000000},
        ...     source_timerange={"start": 0, "duration": 6000000},
        ...     speed=2.0,
        ...     volume=0.8,
        ...     change_pitch=True,
        ...     fade={"in_duration": 500000, "out_duration": 500000},
        ...     effects=[{"type": "大叔", "params": [50]}],
        ...     keyframes=[{"time_offset": 0, "volume": 1.0}]
        ... )
    """
    # ========== 参数校验 ==========
    if not material_url:
        return {
            "code": -1,
            "message": "material_url 不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    if not target_timerange or "start" not in target_timerange or "duration" not in target_timerange:
        return {
            "code": -1,
            "message": "target_timerange 必须包含 start 和 duration 字段",
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

    if fade:
        if fade.get("in_duration", 0) < 0 or fade.get("out_duration", 0) < 0:
            return {
                "code": -1,
                "message": "淡入淡出时长不能为负数",
                "audio_infos": "[]",
                "segment_ids": []
            }

    # ========== 构建 segment ==========

    # 生成唯一 ID
    segment_id = uuid.uuid4().hex

    # 确定 source_timerange
    target_start = target_timerange["start"]
    target_duration = target_timerange["duration"]

    if source_timerange is not None:
        # 用户显式提供了 source_timerange
        final_source = {
            "start": source_timerange.get("start", 0),
            "duration": source_timerange.get("duration", target_duration)
        }
    elif speed is not None and speed != 1.0:
        # 有变速但没有 source_timerange，自动计算
        final_source = {
            "start": 0,
            "duration": round(target_duration * speed)
        }
    else:
        # 默认：source 与 target 一致
        final_source = {
            "start": 0,
            "duration": target_duration
        }

    # 构建 segment（字段完全对齐 _add_audio_segment）
    segment_data: Dict[str, Any] = {
        "id": segment_id,
        "material_url": material_url,
        "target_timerange": {
            "start": target_start,
            "duration": target_duration
        },
        "source_timerange": final_source,
        "volume": volume,
        "change_pitch": change_pitch
    }

    if speed is not None:
        segment_data["speed"] = speed

    if material_name:
        segment_data["material_name"] = material_name

    if fade:
        segment_data["fade"] = {
            "in_duration": fade.get("in_duration", 0),
            "out_duration": fade.get("out_duration", 0)
        }

    if effects:
        segment_data["effects"] = effects

    if keyframes:
        segment_data["keyframes"] = keyframes

    return {
        "code": 0,
        "message": "Success",
        "audio_infos": json.dumps([segment_data], ensure_ascii=False),
        "segment_ids": [segment_id]
    }


def parse_audio_infos(audio_infos_str: str) -> list:
    """
    解析音频信息 JSON 字符串

    Args:
        audio_infos_str: JSON 字符串

    Returns:
        音频信息列表
    """
    try:
        return json.loads(audio_infos_str)
    except json.JSONDecodeError:
        return []


def format_audio_info_output(result: Dict[str, Any]) -> str:
    """
    格式化音频信息输出

    Args:
        result: audio_info 返回的结果

    Returns:
        格式化后的字符串
    """
    if result["code"] != 0:
        return f"错误: {result['message']}"

    audio_infos = parse_audio_infos(result["audio_infos"])
    if not audio_infos:
        return "无音频信息"

    lines = []
    for i, info in enumerate(audio_infos, 1):
        target = info.get("target_timerange", {})
        source = info.get("source_timerange", {})
        lines.append(f"音频 {i}:")
        lines.append(f"  ID: {info.get('id')}")
        lines.append(f"  URL: {info.get('material_url')}")
        lines.append(f"  轨道位置: {target.get('start', 0) / 1_000_000:.2f}s ~ {(target.get('start', 0) + target.get('duration', 0)) / 1_000_000:.2f}s")
        lines.append(f"  素材截取: {source.get('start', 0) / 1_000_000:.2f}s ~ {(source.get('start', 0) + source.get('duration', 0)) / 1_000_000:.2f}s")
        lines.append(f"  播放速度: {info.get('speed', 1.0)}x")
        lines.append(f"  音量: {info.get('volume', 1.0) * 100:.0f}%")

        if info.get("fade"):
            fade = info["fade"]
            lines.append(f"  淡入: {fade.get('in_duration', 0) / 1_000_000:.2f}s")
            lines.append(f"  淡出: {fade.get('out_duration', 0) / 1_000_000:.2f}s")

    return "\n".join(lines)


if __name__ == "__main__":
    # 测试示例
    result = audio_info(
        material_url="https://example.com/audio.mp3",
        target_timerange={"start": 0, "duration": 3000000},
        source_timerange={"start": 0, "duration": 6000000},
        speed=2.0,
        volume=0.8,
        change_pitch=True,
        fade={"in_duration": 500000, "out_duration": 500000}
    )
    print(format_audio_info_output(result))
