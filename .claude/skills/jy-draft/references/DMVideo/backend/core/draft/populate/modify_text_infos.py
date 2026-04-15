# -*- coding: utf-8 -*-
"""
修改文本信息 API

根据 segment 格式修改文本素材信息。
入参数据结构与 generate_template.py 的 _add_text_segment 所消费的 segment 字段完全对齐。
"""

import json
from typing import Dict, Any, List, Optional


def _deep_update(target: dict, source: dict) -> dict:
    """
    深度合并 source 到 target（用于嵌套字典的部分更新）

    - 对于嵌套字典，递归合并
    - 对于其他类型，直接覆盖
    - source 中值为 None 的键会被跳过（不更新）
    """
    for key, value in source.items():
        if value is None:
            continue
        if key in target and isinstance(target[key], dict) and isinstance(value, dict):
            _deep_update(target[key], value)
        else:
            target[key] = value
    return target


def modify_text_infos(
    text_infos: str,
    segment_index: List[int],
    content: Optional[str] = None,
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
    修改文本素材信息

    保留 text_infos: str 和 segment_index: List[int] 两个定位字段，
    其余参数与 _add_text_segment 所消费的 segment 字段完全对齐。

    嵌套字典参数支持部分更新：只更新传入的字段，未传入的字段保持原值。

    Args:
        text_infos: 文本素材信息（JSON 字符串）
        segment_index: 要修改的素材片段索引数组（从 1 开始）
        content: 文本内容
        target_timerange: 片段在轨道上的目标时间范围 (微秒)
            {"start": int, "duration": int}
        style: 文本样式（部分更新）
            {"size": float, "bold": bool, "italic": bool, "underline": bool,
             "color": str/list, "alpha": float, "align": int,
             "vertical": bool, "letter_spacing": int, "line_spacing": int,
             "auto_wrapping": bool, "max_line_width": float, "font": str}
        font: 字体名称（也可在 style.font 中指定）
        clip_settings: 位置变换设置（部分更新）
            {"transform_x": float, "transform_y": float,
             "scale_x": float, "scale_y": float,
             "rotation": float, "alpha": float,
             "flip_horizontal": bool, "flip_vertical": bool}
        uniform_scale: 是否锁定 XY 轴缩放比例
        border: 文本描边（部分更新）
            {"alpha": float, "color": str/list, "width": float}
        background: 文本背景（部分更新）
            {"color": str, "style": int, "alpha": float,
             "round_radius": float, "height": float, "width": float,
             "horizontal_offset": float, "vertical_offset": float}
        shadow: 文本阴影（部分更新）
            {"alpha": float, "color": str/list,
             "diffuse": float, "distance": float, "angle": float}
        bubble: 文本气泡（部分更新）
            {"effect_id": str, "resource_id": str}
        effect: 花字效果（部分更新）
            {"effect_id": str}
        animations: 动画配置（部分更新）
            {"intro": {"type": str, "duration": int},
             "outro": {"type": str, "duration": int},
             "loop": {"type": str}}
        keyframes: 关键帧列表（整体替换）
            [{"property": str, "time_offset": int, "value": float}]

    Returns:
        包含修改后文本信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - text_infos: 修改后的文本素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = modify_text_infos(
        ...     text_infos='[{"id":"t1","content":"hello",...}]',
        ...     segment_index=[1],
        ...     content="new text",
        ...     style={"size": 12.0, "bold": True},
        ...     clip_settings={"transform_y": -0.5},
        ...     animations={"intro": {"type": "放大", "duration": 500000}}
        ... )
    """
    # 参数校验
    if not text_infos:
        return {"code": -1, "message": "text_infos 不能为空", "text_infos": "[]", "segment_ids": []}

    if not segment_index:
        return {"code": -1, "message": "segment_index 不能为空", "text_infos": "[]", "segment_ids": []}

    try:
        text_list = json.loads(text_infos)
    except (json.JSONDecodeError, TypeError):
        return {"code": -1, "message": "text_infos JSON 格式错误", "text_infos": "[]", "segment_ids": []}

    if not isinstance(text_list, list):
        text_list = [text_list]

    # 将 1-based 索引转为 0-based，并校验范围
    indices = []
    for idx in segment_index:
        if not isinstance(idx, int) or idx < 1 or idx > len(text_list):
            return {
                "code": -1,
                "message": f"segment_index 超出范围: {idx}，有效范围 1~{len(text_list)}",
                "text_infos": "[]",
                "segment_ids": []
            }
        indices.append(idx - 1)

    for idx in indices:
        item = text_list[idx]

        # 修改文本内容
        if content is not None:
            item["content"] = content

        # 修改目标时间范围
        if target_timerange is not None:
            existing = item.get("target_timerange", {})
            item["target_timerange"] = {
                "start": target_timerange.get("start", existing.get("start", 0)),
                "duration": target_timerange.get("duration", existing.get("duration", 5000000))
            }

        # 修改文本样式（部分更新）
        if style is not None:
            existing_style = item.get("style", {})
            item["style"] = _deep_update(existing_style, style)

        # 修改字体（顶层 font 覆盖 style.font）
        if font is not None:
            if "style" not in item:
                item["style"] = {}
            item["style"]["font"] = font

        # 修改位置变换（部分更新）
        if clip_settings is not None:
            existing_clip = item.get("clip_settings", {})
            item["clip_settings"] = _deep_update(existing_clip, clip_settings)

        # 修改 uniform_scale
        if uniform_scale is not None:
            item["uniform_scale"] = uniform_scale

        # 修改文本描边（部分更新）
        if border is not None:
            existing_border = item.get("border", {})
            item["border"] = _deep_update(existing_border, border)

        # 修改文本背景（部分更新）
        if background is not None:
            existing_bg = item.get("background", {})
            item["background"] = _deep_update(existing_bg, background)

        # 修改文本阴影（部分更新）
        if shadow is not None:
            existing_shadow = item.get("shadow", {})
            item["shadow"] = _deep_update(existing_shadow, shadow)

        # 修改文本气泡（部分更新）
        if bubble is not None:
            existing_bubble = item.get("bubble", {})
            item["bubble"] = _deep_update(existing_bubble, bubble)

        # 修改花字效果（部分更新）
        if effect is not None:
            existing_effect = item.get("effect", {})
            item["effect"] = _deep_update(existing_effect, effect)

        # 修改动画（部分更新）
        if animations is not None:
            existing_anim = item.get("animations", {})
            item["animations"] = _deep_update(existing_anim, animations)

        # 修改关键帧（整体替换）
        if keyframes is not None:
            item["keyframes"] = keyframes

    return {
        "code": 0,
        "message": "修改成功",
        "text_infos": json.dumps(text_list, ensure_ascii=False),
        "segment_ids": [item.get("id", "") for item in text_list]
    }
