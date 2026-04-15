# -*- coding: utf-8 -*-
"""
创建视频/图片片段信息 API

根据视频/图片 URL 和参数，自动创建一段视频或图片素材信息。
入参数据结构与 generate_template.py 的 _add_video_segment 所消费的 segment 字段完全对齐。
"""

import uuid
import json
from typing import Dict, Any, Optional, List


def video_info(
    material_url: str,
    target_timerange: Optional[Dict[str, int]] = None,
    source_timerange: Optional[Dict[str, int]] = None,
    speed: Optional[float] = None,
    volume: float = 1.0,
    change_pitch: bool = False,
    material_name: Optional[str] = None,
    material_type: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    material_duration: Optional[int] = None,
    local_material_id: Optional[str] = None,
    uniform_scale: Optional[bool] = None,
    crop_settings: Optional[Dict[str, float]] = None,
    clip_settings: Optional[Dict[str, Any]] = None,
    fade: Optional[Dict[str, int]] = None,
    effects: Optional[List[Dict[str, Any]]] = None,
    filters: Optional[List[Dict[str, Any]]] = None,
    mask: Optional[Dict[str, Any]] = None,
    transition: Optional[Dict[str, Any]] = None,
    background_filling: Optional[Dict[str, Any]] = None,
    animations: Optional[Dict[str, Any]] = None,
    keyframes: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    自动创建一个视频/图片片段信息

    入参数据结构与 generate_template.py 的 _add_video_segment 所消费的
    segment 字段完全对齐。

    Args:
        material_url: 视频/图片素材的 URL 地址
        target_timerange: 片段在轨道上的目标时间范围 (微秒)
            {"start": int, "duration": int}
        source_timerange: 截取的素材片段时间范围 (微秒)
            {"start": int, "duration": int}
        speed: 播放速度，取值范围 0.1~42.0
        volume: 音量，默认 1.0
        change_pitch: 是否跟随变速改变音调，默认 False
        material_name: 素材名称
        material_type: 素材类型，"video" 或 "photo"
        width: 素材宽度（像素）
        height: 素材高度（像素）
        material_duration: 素材原始时长（微秒）
        local_material_id: 本地素材 ID
        uniform_scale: 是否锁定 XY 轴缩放比例
        crop_settings: 裁剪设置
            {"upper_left_x": float, "upper_left_y": float,
             "upper_right_x": float, "upper_right_y": float,
             "lower_left_x": float, "lower_left_y": float,
             "lower_right_x": float, "lower_right_y": float}
        clip_settings: 位置变换设置
            {"transform_x": float, "transform_y": float,
             "scale_x": float, "scale_y": float,
             "rotation": float, "alpha": float,
             "flip_horizontal": bool, "flip_vertical": bool}
        fade: 音频淡入淡出效果 (微秒)
            {"in_duration": int, "out_duration": int}
        effects: 视频特效列表
            [{"type": "特效名", "params": [0-100]}]
        filters: 视频滤镜列表
            [{"type": "滤镜名", "intensity": 0-100}]
        mask: 蒙版配置
            {"type": str, "center_x": float, "center_y": float,
             "size": float, "rotation": float, "feather": float,
             "invert": bool, "rect_width": float, "round_corner": float}
        transition: 转场配置
            {"type": str, "duration": int}
        background_filling: 背景填充配置
            {"type": str, "blur": float, "color": str}
        animations: 动画配置
            {"intro": {"type": str, "duration": int},
             "outro": {"type": str, "duration": int},
             "group": {"type": str, "duration": int}}
        keyframes: 关键帧列表
            [{"property": "属性名", "time_offset": 微秒, "value": 值}]

    Returns:
        包含视频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - video_infos: 视频素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = video_info(
        ...     material_url="https://example.com/video.mp4",
        ...     target_timerange={"start": 0, "duration": 5000000},
        ...     source_timerange={"start": 0, "duration": 5000000},
        ...     speed=1.0,
        ...     volume=0.8,
        ...     fade={"in_duration": 500000, "out_duration": 0}
        ... )
    """
    # 参数校验
    if not material_url:
        return {
            "code": -1,
            "message": "素材 URL 不能为空",
            "video_infos": "[]",
            "segment_ids": []
        }

    effective_speed = speed if speed is not None else 1.0

    if effective_speed < 0.1 or effective_speed > 42.0:
        return {
            "code": -1,
            "message": "播放速度必须在 0.1~42.0 范围内",
            "video_infos": "[]",
            "segment_ids": []
        }

    # 解析时间范围
    target_start = (target_timerange or {}).get("start", 0)
    target_duration = (target_timerange or {}).get("duration")
    source_start = (source_timerange or {}).get("start", 0)
    source_duration = (source_timerange or {}).get("duration")

    # 计算缺失的时间范围
    if source_duration is not None and target_duration is not None:
        # 两个都有，直接使用
        pass
    elif source_duration is not None:
        # 根据 source_duration 和 speed 计算 target_duration
        target_duration = round(source_duration / effective_speed)
    elif target_duration is not None:
        # 根据 target_duration 和 speed 计算 source_duration
        source_duration = round(target_duration * effective_speed)
    else:
        return {
            "code": -1,
            "message": "必须提供 target_timerange.duration 或 source_timerange.duration",
            "video_infos": "[]",
            "segment_ids": []
        }

    # 生成唯一 ID
    segment_id = uuid.uuid4().hex

    # 构建视频信息（完全对齐 _add_video_segment 消费的 segment 字段）
    video_info_obj = {
        "id": segment_id,
        "material_url": material_url,
        "target_timerange": {
            "start": target_start,
            "duration": target_duration
        },
        "source_timerange": {
            "start": source_start,
            "duration": source_duration
        },
        "volume": volume,
        "change_pitch": change_pitch
    }

    # 设置 speed（仅在明确传入时才设置）
    if speed is not None:
        video_info_obj["speed"] = speed

    # 设置素材名称
    if material_name is not None:
        video_info_obj["material_name"] = material_name

    # 设置素材元数据字段
    if material_type is not None:
        video_info_obj["material_type"] = material_type
    if width is not None:
        video_info_obj["width"] = width
    if height is not None:
        video_info_obj["height"] = height
    if material_duration is not None:
        video_info_obj["material_duration"] = material_duration
    if local_material_id is not None:
        video_info_obj["local_material_id"] = local_material_id

    # 设置 uniform_scale
    if uniform_scale is not None:
        video_info_obj["uniform_scale"] = uniform_scale

    # 设置裁剪设置 (crop_settings)
    if crop_settings is not None:
        video_info_obj["crop_settings"] = {
            "upper_left_x": crop_settings.get("upper_left_x", 0.0),
            "upper_left_y": crop_settings.get("upper_left_y", 0.0),
            "upper_right_x": crop_settings.get("upper_right_x", 1.0),
            "upper_right_y": crop_settings.get("upper_right_y", 0.0),
            "lower_left_x": crop_settings.get("lower_left_x", 0.0),
            "lower_left_y": crop_settings.get("lower_left_y", 1.0),
            "lower_right_x": crop_settings.get("lower_right_x", 1.0),
            "lower_right_y": crop_settings.get("lower_right_y", 1.0)
        }

    # 设置位置变换 (clip_settings)
    if clip_settings is not None:
        video_info_obj["clip_settings"] = {
            "transform_x": clip_settings.get("transform_x", 0.0),
            "transform_y": clip_settings.get("transform_y", 0.0),
            "scale_x": clip_settings.get("scale_x", 1.0),
            "scale_y": clip_settings.get("scale_y", 1.0),
            "rotation": clip_settings.get("rotation", 0.0),
            "alpha": clip_settings.get("alpha", 1.0),
            "flip_horizontal": clip_settings.get("flip_horizontal", False),
            "flip_vertical": clip_settings.get("flip_vertical", False)
        }

    # 设置淡入淡出 (fade)
    if fade is not None:
        video_info_obj["fade"] = {
            "in_duration": fade.get("in_duration", 0),
            "out_duration": fade.get("out_duration", 0)
        }

    # 设置视频特效 (effects)
    if effects is not None:
        video_info_obj["effects"] = effects

    # 设置滤镜 (filters)
    if filters is not None:
        video_info_obj["filters"] = filters

    # 设置蒙版 (mask)
    if mask is not None:
        video_info_obj["mask"] = {
            "type": mask.get("type", ""),
            "center_x": mask.get("center_x", 0.0),
            "center_y": mask.get("center_y", 0.0),
            "size": mask.get("size", 0.5),
            "rotation": mask.get("rotation", 0.0),
            "feather": mask.get("feather", 0.0),
            "invert": mask.get("invert", False)
        }
        if mask.get("rect_width") is not None:
            video_info_obj["mask"]["rect_width"] = mask["rect_width"]
        if mask.get("round_corner") is not None:
            video_info_obj["mask"]["round_corner"] = mask["round_corner"]

    # 设置转场 (transition)
    if transition is not None:
        video_info_obj["transition"] = {
            "type": transition.get("type", ""),
            "duration": transition.get("duration")
        }

    # 设置背景填充 (background_filling)
    if background_filling is not None:
        video_info_obj["background_filling"] = {
            "type": background_filling.get("type", "blur"),
            "blur": background_filling.get("blur", 0.0625),
            "color": background_filling.get("color", "#00000000")
        }

    # 设置动画 (animations)
    if animations is not None:
        video_info_obj["animations"] = {}

        intro = animations.get("intro")
        if intro:
            video_info_obj["animations"]["intro"] = {
                "type": intro.get("type", ""),
                "duration": intro.get("duration")
            }

        outro = animations.get("outro")
        if outro:
            video_info_obj["animations"]["outro"] = {
                "type": outro.get("type", ""),
                "duration": outro.get("duration")
            }

        group = animations.get("group")
        if group:
            video_info_obj["animations"]["group"] = {
                "type": group.get("type", ""),
                "duration": group.get("duration")
            }

        # 如果 animations 为空对象则移除
        if not video_info_obj["animations"]:
            del video_info_obj["animations"]

    # 设置关键帧 (keyframes)
    if keyframes is not None:
        video_info_obj["keyframes"] = keyframes

    return {
        "code": 0,
        "message": "成功",
        "video_infos": json.dumps([video_info_obj], ensure_ascii=False),
        "segment_ids": [segment_id]
    }


def parse_video_infos(video_infos_str: str) -> list:
    """解析视频信息 JSON 字符串"""
    try:
        return json.loads(video_infos_str)
    except json.JSONDecodeError:
        return []


if __name__ == "__main__":
    # 测试示例
    result = video_info(
        material_url="https://example.com/video.mp4",
        source_timerange={"start": 0, "duration": 5000000},
        speed=1.0,
        clip_settings={"scale_x": 1.38, "scale_y": 1.38},
        animations={"intro": {"type": "放大", "duration": 500000}},
        transition={"type": "叠化", "duration": 300000}
    )
    print(f"code: {result['code']}")
    print(f"segment_ids: {result['segment_ids']}")
    data = json.loads(result['video_infos'])
    print(f"material_url: {data[0]['material_url']}")
    print(f"source_timerange: {data[0]['source_timerange']}")
