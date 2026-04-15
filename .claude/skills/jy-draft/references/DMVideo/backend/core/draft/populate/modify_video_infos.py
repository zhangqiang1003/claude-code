# -*- coding: utf-8 -*-
"""
修改视频/图片信息 API

修改视频素材信息，指定修改素材片段的基本信息。
入参数据结构与 generate_template.py 的 _add_video_segment 所消费的 segment 字段完全对齐，
同时保留 segment_index 和 video_infos 参数。
"""

import json
from typing import Dict, Any, List, Optional


def modify_video_infos(
    video_infos: str,
    segment_index: List[int],
    target_timerange: Optional[Dict[str, int]] = None,
    source_timerange: Optional[Dict[str, int]] = None,
    speed: Optional[float] = None,
    volume: Optional[float] = None,
    change_pitch: Optional[bool] = None,
    material_url: Optional[str] = None,
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
    修改视频/图片素材信息

    入参数据结构与 generate_template.py 的 _add_video_segment 所消费的
    segment 字段完全对齐，同时保留 segment_index 和 video_infos 参数。

    Args:
        video_infos: 视频素材信息（JSON 字符串）
        segment_index: 要修改的素材片段索引列表，从 1 开始，如 [1, 2, 3, 5]
        target_timerange: 片段在轨道上的目标时间范围 (微秒)
            {"start": int, "duration": int}，支持部分更新
        source_timerange: 截取的素材片段时间范围 (微秒)
            {"start": int, "duration": int}，支持部分更新
        speed: 播放速度，取值范围 0.1~42.0
        volume: 音量
        change_pitch: 是否跟随变速改变音调
        material_url: 视频/图片素材文件路径/URL
        material_name: 素材名称
        material_type: 素材类型 ("video" 或 "photo")
        width: 素材宽度（像素）
        height: 素材高度（像素）
        material_duration: 素材原始时长（微秒）
        local_material_id: 本地素材 ID
        uniform_scale: 是否锁定 XY 轴缩放比例
        crop_settings: 裁剪设置
            {"upper_left_x/y", "upper_right_x/y", "lower_left_x/y", "lower_right_x/y"}
        clip_settings: 位置变换设置
            {"transform_x/y", "scale_x/y", "rotation", "alpha",
             "flip_horizontal", "flip_vertical"}
        fade: 淡入淡出效果 (微秒)
            {"in_duration": int, "out_duration": int}
        effects: 视频特效列表 [{"type": "特效名", "params": [0-100]}]
        filters: 视频滤镜列表 [{"type": "滤镜名", "intensity": 0-100}]
        mask: 蒙版配置 {"type", "center_x/y", "size", "rotation", "feather",
             "invert", "rect_width", "round_corner"}
        transition: 转场配置 {"type": str, "duration": int}
        background_filling: 背景填充配置 {"type", "blur", "color"}
        animations: 动画配置 {"intro": {type, duration}, "outro": {type, duration},
                   "group": {type, duration}}
        keyframes: 关键帧列表 [{"property": "属性名", "time_offset": 微秒, "value": 值}]

    Returns:
        包含修改后视频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - video_infos: 修改后的视频素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = modify_video_infos(
        ...     video_infos='[{"id":"123","material_url":"https://x.mp4",...}]',
        ...     segment_index=[1],
        ...     volume=0.8,
        ...     speed=1.5,
        ...     clip_settings={"scale_x": 1.38, "scale_y": 1.38},
        ...     fade={"in_duration": 500000}
        ... )
    """
    # 参数校验
    if not video_infos:
        return {
            "code": -1,
            "message": "视频素材信息不能为空",
            "video_infos": "[]",
            "segment_ids": []
        }

    if not segment_index:
        return {
            "code": -1,
            "message": "素材片段索引列表不能为空",
            "video_infos": "[]",
            "segment_ids": []
        }

    if speed is not None and (speed < 0.1 or speed > 42.0):
        return {
            "code": -1,
            "message": "播放速度必须在 0.1~42.0 范围内",
            "video_infos": "[]",
            "segment_ids": []
        }

    # 解析视频信息
    try:
        video_list = json.loads(video_infos)
    except json.JSONDecodeError:
        return {
            "code": -1,
            "message": "视频素材信息 JSON 格式错误",
            "video_infos": "[]",
            "segment_ids": []
        }

    if not isinstance(video_list, list):
        video_list = [video_list]

    # 获取所有需要修改的索引（转换为 0 基索引）
    indices_to_modify = [idx - 1 for idx in segment_index if 0 < idx <= len(video_list)]

    if not indices_to_modify:
        return {
            "code": -1,
            "message": "没有有效的素材片段索引",
            "video_infos": video_infos,
            "segment_ids": []
        }

    # 修改指定的视频信息
    for idx in indices_to_modify:
        item = video_list[idx]

        # 修改 material_url
        if material_url is not None:
            item["material_url"] = material_url

        # 修改 material_name
        if material_name is not None:
            item["material_name"] = material_name

        # 修改 material_type
        if material_type is not None:
            item["material_type"] = material_type

        # 修改 width
        if width is not None:
            item["width"] = width

        # 修改 height
        if height is not None:
            item["height"] = height

        # 修改 material_duration
        if material_duration is not None:
            item["material_duration"] = material_duration

        # 修改 local_material_id
        if local_material_id is not None:
            item["local_material_id"] = local_material_id

        # 修改 target_timerange（支持部分更新）
        if target_timerange is not None:
            current = item.get("target_timerange", {})
            if "start" in target_timerange:
                current["start"] = target_timerange["start"]
            if "duration" in target_timerange:
                current["duration"] = target_timerange["duration"]
            item["target_timerange"] = current

        # 修改 source_timerange（支持部分更新）
        if source_timerange is not None:
            current = item.get("source_timerange", {})
            if "start" in source_timerange:
                current["start"] = source_timerange["start"]
            if "duration" in source_timerange:
                current["duration"] = source_timerange["duration"]
            item["source_timerange"] = current

            # 如果修改了 source_timerange.duration 且没有同时修改 target_timerange.duration，
            # 则根据 speed 重新计算 target_timerange.duration
            if "duration" in source_timerange and target_timerange is None:
                current_speed = speed if speed is not None else item.get("speed", 1.0)
                item.setdefault("target_timerange", {})["duration"] = round(source_timerange["duration"] / current_speed)

        # 修改 speed
        if speed is not None:
            item["speed"] = speed
            # 如果没有同时修改 source_timerange，则根据新速度重新计算 target_timerange.duration
            if source_timerange is None:
                src_duration = item.get("source_timerange", {}).get("duration", 0)
                if src_duration:
                    item.setdefault("target_timerange", {})["duration"] = round(src_duration / speed)

        # 修改 volume
        if volume is not None:
            item["volume"] = volume

        # 修改 change_pitch
        if change_pitch is not None:
            item["change_pitch"] = change_pitch

        # 修改 uniform_scale
        if uniform_scale is not None:
            item["uniform_scale"] = uniform_scale

        # 修改 crop_settings（支持部分更新）
        if crop_settings is not None:
            current_crop = item.get("crop_settings", {
                "upper_left_x": 0.0, "upper_left_y": 0.0,
                "upper_right_x": 1.0, "upper_right_y": 0.0,
                "lower_left_x": 0.0, "lower_left_y": 1.0,
                "lower_right_x": 1.0, "lower_right_y": 1.0
            })
            for key in ["upper_left_x", "upper_left_y", "upper_right_x", "upper_right_y",
                        "lower_left_x", "lower_left_y", "lower_right_x", "lower_right_y"]:
                if key in crop_settings:
                    current_crop[key] = crop_settings[key]
            item["crop_settings"] = current_crop

        # 修改 clip_settings（支持部分更新）
        if clip_settings is not None:
            current_clip = item.get("clip_settings", {
                "transform_x": 0.0, "transform_y": 0.0,
                "scale_x": 1.0, "scale_y": 1.0,
                "rotation": 0.0, "alpha": 1.0,
                "flip_horizontal": False, "flip_vertical": False
            })
            for key in ["transform_x", "transform_y", "scale_x", "scale_y",
                        "rotation", "alpha", "flip_horizontal", "flip_vertical"]:
                if key in clip_settings:
                    current_clip[key] = clip_settings[key]
            item["clip_settings"] = current_clip

        # 修改 fade（支持部分更新）
        if fade is not None:
            current_fade = item.get("fade", {"in_duration": 0, "out_duration": 0})
            if "in_duration" in fade:
                current_fade["in_duration"] = fade["in_duration"]
            if "out_duration" in fade:
                current_fade["out_duration"] = fade["out_duration"]
            item["fade"] = current_fade

        # 修改 effects
        if effects is not None:
            item["effects"] = effects

        # 修改 filters
        if filters is not None:
            item["filters"] = filters

        # 修改 mask（支持部分更新）
        if mask is not None:
            current_mask = item.get("mask", {})
            for key in ["type", "center_x", "center_y", "size", "rotation",
                        "feather", "invert", "rect_width", "round_corner"]:
                if key in mask:
                    current_mask[key] = mask[key]
            item["mask"] = current_mask

        # 修改 transition
        if transition is not None:
            current_trans = item.get("transition", {})
            if "type" in transition:
                current_trans["type"] = transition["type"]
            if "duration" in transition:
                current_trans["duration"] = transition["duration"]
            item["transition"] = current_trans

        # 修改 background_filling（支持部分更新）
        if background_filling is not None:
            current_bg = item.get("background_filling", {})
            for key in ["type", "blur", "color"]:
                if key in background_filling:
                    current_bg[key] = background_filling[key]
            item["background_filling"] = current_bg

        # 修改 animations（支持部分更新）
        if animations is not None:
            current_anim = item.get("animations", {})
            for anim_type in ["intro", "outro", "group"]:
                if anim_type in animations:
                    current_anim[anim_type] = animations[anim_type]
            item["animations"] = current_anim

        # 修改 keyframes
        if keyframes is not None:
            item["keyframes"] = keyframes

    # 提取所有 segment_ids
    segment_ids = [item.get("id", "") for item in video_list]

    return {
        "code": 0,
        "message": "成功",
        "video_infos": json.dumps(video_list, ensure_ascii=False),
        "segment_ids": segment_ids
    }


if __name__ == "__main__":
    # 测试示例
    test_video_infos = json.dumps([{
        "id": "test-001",
        "material_url": "https://example.com/video.mp4",
        "target_timerange": {"start": 0, "duration": 5000000},
        "source_timerange": {"start": 0, "duration": 5000000},
        "speed": 1.0,
        "volume": 1.0
    }])

    result = modify_video_infos(
        video_infos=test_video_infos,
        segment_index=[1],
        volume=0.8,
        speed=2.0,
        clip_settings={"scale_x": 1.38, "scale_y": 1.38},
        fade={"in_duration": 500000}
    )
    print(f"code: {result['code']}")
    print(f"modified video_infos: {result['video_infos']}")
