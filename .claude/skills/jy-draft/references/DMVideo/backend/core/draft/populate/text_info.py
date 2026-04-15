# -*- coding: utf-8 -*-
"""
创建文本片段信息 API

根据文本内容和样式参数，自动创建一段文本素材信息。
入参数据结构与 generate_template.py 的 _add_text_segment 所消费的 segment 字段完全对齐。
"""

import uuid
import json
from typing import Dict, Any, Optional, List


def _normalize_color(color_value):
    """
    统一颜色格式为 RGB 元组（0-1 范围）

    支持:
    - 十六进制字符串 "#FFFFFF"
    - RGB 0-255 整数列表 [255, 255, 255]
    - RGB 0-1 浮点数列表 [1.0, 1.0, 1.0]
    """
    if color_value is None:
        return None

    if isinstance(color_value, str):
        hex_color = color_value.lstrip("#")
        return [int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4)]

    if isinstance(color_value, (list, tuple)) and len(color_value) == 3:
        if all(isinstance(c, int) for c in color_value):
            return [c / 255.0 for c in color_value]
        return list(color_value)

    return None


def text_info(
    content: str,
    target_timerange: Optional[Dict[str, int]] = None,
    style: Optional[Dict[str, Any]] = None,
    font: Optional[str] = None,
    clip_settings: Optional[Dict[str, Any]] = None,
    uniform_scale: Optional[bool] = None,
    border: Optional[Dict[str, Any]] = None,
    background: Optional[Dict[str, Any]] = None,
    shadow: Optional[Dict[str, Any]] = None,
    bubble: Optional[Dict[str, Any]] = None,
    effect: Optional[Dict[str, Any]] = None,
    animations: Optional[Dict[str, Any]] = None,
    keyframes: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    自动创建一个文本片段信息

    入参数据结构与 generate_template.py 的 _add_text_segment 所消费的
    segment 字段完全对齐。

    Args:
        content: 文本内容
        target_timerange: 片段在轨道上的目标时间范围 (微秒)
            {"start": int, "duration": int}
        style: 文本样式
            {"size": float, "bold": bool, "italic": bool, "underline": bool,
             "color": [int/float/str], "alpha": float, "align": int,
             "vertical": bool, "letter_spacing": int, "line_spacing": int,
             "auto_wrapping": bool, "max_line_width": float, "font": str}
        font: 字体名称（也可在 style.font 中指定）
        clip_settings: 位置变换设置
            {"transform_x": float, "transform_y": float,
             "scale_x": float, "scale_y": float,
             "rotation": float, "alpha": float,
             "flip_horizontal": bool, "flip_vertical": bool}
        uniform_scale: 是否锁定 XY 轴缩放比例
        border: 文本描边
            {"alpha": float, "color": [int/float/str], "width": float}
        background: 文本背景
            {"color": str, "style": int, "alpha": float,
             "round_radius": float, "height": float, "width": float,
             "horizontal_offset": float, "vertical_offset": float}
        shadow: 文本阴影
            {"alpha": float, "color": [int/float/str],
             "diffuse": float, "distance": float, "angle": float}
        bubble: 文本气泡 {"effect_id": str, "resource_id": str}
        effect: 花字效果 {"effect_id": str}
        animations: 动画配置
            {"intro": {"type": str, "duration": int},
             "outro": {"type": str, "duration": int},
             "loop": {"type": str}}
        keyframes: 关键帧列表
            [{"property": str, "time_offset": int, "value": float}]

    Returns:
        包含文本信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - text_infos: 文本素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = text_info(
        ...     content="Hello World",
        ...     target_timerange={"start": 0, "duration": 5000000},
        ...     style={"size": 10.0, "bold": True, "color": "#FFFFFF"},
        ...     clip_settings={"transform_y": -0.5},
        ...     animations={"intro": {"type": "放大", "duration": 500000}}
        ... )
    """
    # 参数校验
    if not content:
        return {
            "code": -1,
            "message": "文本内容不能为空",
            "text_infos": "[]",
            "segment_ids": []
        }

    # 生成唯一 ID
    segment_id = uuid.uuid4().hex

    # 时间范围
    target_start = (target_timerange or {}).get("start", 0)
    target_duration = (target_timerange or {}).get("duration", 5000000)

    # 构建文本信息（完全对齐 _add_text_segment 消费的 segment 字段）
    text_info_obj = {
        "id": segment_id,
        "content": content,
        "target_timerange": {
            "start": target_start,
            "duration": target_duration
        }
    }

    # 设置文本样式 (style)
    if style is not None:
        style_obj = {
            "size": style.get("size", 8.0),
            "bold": style.get("bold", False),
            "italic": style.get("italic", False),
            "underline": style.get("underline", False),
            "alpha": style.get("alpha", 1.0),
            "align": style.get("align", 0),
            "vertical": style.get("vertical", False),
            "letter_spacing": style.get("letter_spacing", 0),
            "line_spacing": style.get("line_spacing", 0),
            "auto_wrapping": style.get("auto_wrapping", False),
            "max_line_width": style.get("max_line_width", 0.82)
        }

        # 处理颜色（支持十六进制、0-255、0-1 三种格式）
        color = style.get("color")
        if color is not None:
            style_obj["color"] = _normalize_color(color) or [1.0, 1.0, 1.0]
        else:
            style_obj["color"] = [1.0, 1.0, 1.0]

        # 字体（可在 style 中或顶层指定）
        style_font = style.get("font") or font
        if style_font:
            style_obj["font"] = style_font

        text_info_obj["style"] = style_obj
    elif font:
        # 只有顶层 font，创建最小 style
        text_info_obj["style"] = {"font": font}

    # 顶层 font 覆盖（当 style 中没有 font 时）
    if font and "style" in text_info_obj:
        text_info_obj["style"]["font"] = font

    # 设置 uniform_scale
    if uniform_scale is not None:
        text_info_obj["uniform_scale"] = uniform_scale

    # 设置位置变换 (clip_settings)
    if clip_settings is not None:
        text_info_obj["clip_settings"] = {
            "transform_x": clip_settings.get("transform_x", 0.0),
            "transform_y": clip_settings.get("transform_y", 0.0),
            "scale_x": clip_settings.get("scale_x", 1.0),
            "scale_y": clip_settings.get("scale_y", 1.0),
            "rotation": clip_settings.get("rotation", 0.0),
            "alpha": clip_settings.get("alpha", 1.0),
            "flip_horizontal": clip_settings.get("flip_horizontal", False),
            "flip_vertical": clip_settings.get("flip_vertical", False)
        }

    # 设置文本描边 (border)
    if border is not None:
        border_obj = {
            "alpha": border.get("alpha", 1.0),
            "width": border.get("width", 40.0)
        }
        border_color = border.get("color")
        if border_color is not None:
            border_obj["color"] = _normalize_color(border_color) or [0.0, 0.0, 0.0]
        else:
            border_obj["color"] = [0.0, 0.0, 0.0]
        text_info_obj["border"] = border_obj

    # 设置文本背景 (background)
    if background is not None:
        text_info_obj["background"] = {
            "color": background.get("color", "#000000"),
            "style": background.get("style", 1),
            "alpha": background.get("alpha", 1.0),
            "round_radius": background.get("round_radius", 0.0),
            "height": background.get("height", 0.14),
            "width": background.get("width", 0.14),
            "horizontal_offset": background.get("horizontal_offset", 0.5),
            "vertical_offset": background.get("vertical_offset", 0.5)
        }

    # 设置文本阴影 (shadow)
    if shadow is not None:
        shadow_obj = {
            "alpha": shadow.get("alpha", 1.0),
            "diffuse": shadow.get("diffuse", 15.0),
            "distance": shadow.get("distance", 5.0),
            "angle": shadow.get("angle", -45.0)
        }
        shadow_color = shadow.get("color")
        if shadow_color is not None:
            shadow_obj["color"] = _normalize_color(shadow_color) or [0.0, 0.0, 0.0]
        else:
            shadow_obj["color"] = [0.0, 0.0, 0.0]
        text_info_obj["shadow"] = shadow_obj

    # 设置文本气泡 (bubble)
    if bubble is not None:
        text_info_obj["bubble"] = {
            "effect_id": bubble.get("effect_id", ""),
            "resource_id": bubble.get("resource_id", "")
        }

    # 设置花字效果 (effect)
    if effect is not None:
        text_info_obj["effect"] = {
            "effect_id": effect.get("effect_id", "")
        }

    # 设置动画 (animations)
    if animations is not None:
        anim_obj = {}

        intro = animations.get("intro")
        if intro:
            anim_obj["intro"] = {
                "type": intro.get("type", ""),
                "duration": intro.get("duration")
            }

        outro = animations.get("outro")
        if outro:
            anim_obj["outro"] = {
                "type": outro.get("type", ""),
                "duration": outro.get("duration")
            }

        loop = animations.get("loop")
        if loop:
            if isinstance(loop, str):
                anim_obj["loop"] = {"type": loop}
            else:
                anim_obj["loop"] = {"type": loop.get("type", "")}

        if anim_obj:
            text_info_obj["animations"] = anim_obj

    # 设置关键帧 (keyframes)
    if keyframes is not None:
        text_info_obj["keyframes"] = keyframes

    return {
        "code": 0,
        "message": "成功",
        "text_infos": json.dumps([text_info_obj], ensure_ascii=False),
        "segment_ids": [segment_id]
    }


def parse_text_infos(text_infos_str: str) -> list:
    """解析文本信息 JSON 字符串"""
    try:
        return json.loads(text_infos_str)
    except json.JSONDecodeError:
        return []
