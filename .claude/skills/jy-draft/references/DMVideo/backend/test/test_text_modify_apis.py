# -*- coding: utf-8 -*-
"""
修改文本信息 API 测试用例

测试 modify_text_infos 函数的所有功能
"""

import sys
import os
import json
import importlib.util

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _load_module(module_name, file_path):
    """直接加载模块，避免 __init__.py 链式导入问题"""
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# 加载被测模块
_modify_mod = _load_module(
    "modify_text_infos",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "core", "draft", "populate", "modify_text_infos.py")
)
modify_text_infos = _modify_mod.modify_text_infos


def _make_text_segments(count=3):
    """辅助函数：创建测试文本片段列表"""
    segments = []
    for i in range(count):
        segments.append({
            "id": f"t{i+1}",
            "content": f"文本{i+1}",
            "target_timerange": {"start": i * 5000000, "duration": 5000000},
            "style": {
                "size": 8.0,
                "bold": False,
                "italic": False,
                "underline": False,
                "color": [1.0, 1.0, 1.0],
                "alpha": 1.0,
                "align": 0,
                "vertical": False,
                "letter_spacing": 0,
                "line_spacing": 0,
                "auto_wrapping": False,
                "max_line_width": 0.82
            },
            "clip_settings": {
                "transform_x": 0.0,
                "transform_y": 0.0,
                "scale_x": 1.0,
                "scale_y": 1.0,
                "rotation": 0.0,
                "alpha": 1.0,
                "flip_horizontal": False,
                "flip_vertical": False
            },
            "border": {
                "alpha": 1.0,
                "color": [0.0, 0.0, 0.0],
                "width": 40.0
            },
            "background": {
                "color": "#000000",
                "style": 1,
                "alpha": 1.0,
                "round_radius": 0.0,
                "height": 0.14,
                "width": 0.14,
                "horizontal_offset": 0.5,
                "vertical_offset": 0.5
            },
            "shadow": {
                "alpha": 1.0,
                "color": [0.0, 0.0, 0.0],
                "diffuse": 15.0,
                "distance": 5.0,
                "angle": -45.0
            },
            "animations": {
                "intro": {"type": "放大", "duration": 500000},
                "outro": {"type": "渐隐", "duration": 300000}
            }
        })
    return json.dumps(segments, ensure_ascii=False)


# ==================== 参数校验测试 ====================

def test_modify_validation_empty_infos():
    """测试空 text_infos"""
    print("=== 测试校验：空 text_infos ===")

    result = modify_text_infos("", [1])
    assert result["code"] == -1

    print("[PASS] 空 text_infos 校验通过")


def test_modify_validation_empty_index():
    """测试空 segment_index"""
    print("=== 测试校验：空 segment_index ===")

    result = modify_text_infos(_make_text_segments(2), [])
    assert result["code"] == -1

    print("[PASS] 空 segment_index 校验通过")


def test_modify_validation_invalid_json():
    """测试无效 JSON"""
    print("=== 测试校验：无效 JSON ===")

    result = modify_text_infos("not json", [1])
    assert result["code"] == -1
    assert "JSON" in result["message"]

    print("[PASS] 无效 JSON 校验通过")


def test_modify_validation_index_out_of_range():
    """测试索引超出范围"""
    print("=== 测试校验：索引超出范围 ===")

    # index = 0 (无效)
    result = modify_text_infos(_make_text_segments(3), [0])
    assert result["code"] == -1

    # index = 5 (超出范围，只有 3 个片段)
    result = modify_text_infos(_make_text_segments(3), [5])
    assert result["code"] == -1
    assert "超出范围" in result["message"]

    print("[PASS] 索引超出范围校验通过")


# ==================== 基本修改测试 ====================

def test_modify_content():
    """测试修改文本内容"""
    print("=== 测试修改文本内容 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        content="新文本内容"
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert segs[0]["content"] == "新文本内容"
    # 其他片段不变
    assert segs[1]["content"] == "文本2"

    print("[PASS] 修改文本内容通过")


def test_modify_target_timerange():
    """测试修改目标时间范围"""
    print("=== 测试修改目标时间范围 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [2],
        target_timerange={"start": 1000000, "duration": 3000000}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert segs[1]["target_timerange"]["start"] == 1000000
    assert segs[1]["target_timerange"]["duration"] == 3000000

    print("[PASS] 修改目标时间范围通过")


def test_modify_target_timerange_partial():
    """测试部分修改目标时间范围（只改 start）"""
    print("=== 测试部分修改目标时间范围 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        target_timerange={"start": 999}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert segs[0]["target_timerange"]["start"] == 999
    # duration 保持原值
    assert segs[0]["target_timerange"]["duration"] == 5000000

    print("[PASS] 部分修改目标时间范围通过")


# ==================== style 部分更新测试 ====================

def test_modify_style_partial():
    """测试 style 部分更新"""
    print("=== 测试 style 部分更新 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        style={"size": 12.0, "bold": True}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    style = segs[0]["style"]

    # 修改的值
    assert style["size"] == 12.0
    assert style["bold"] == True
    # 未修改的值保持原值
    assert style["italic"] == False
    assert style["alpha"] == 1.0
    assert style["align"] == 0

    print("[PASS] style 部分更新通过")


def test_modify_style_color():
    """测试修改 style 颜色"""
    print("=== 测试修改 style 颜色 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        style={"color": [0.5, 0.3, 0.8]}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    color = segs[0]["style"]["color"]
    assert abs(color[0] - 0.5) < 0.01
    assert abs(color[1] - 0.3) < 0.01
    assert abs(color[2] - 0.8) < 0.01

    print("[PASS] style 颜色修改通过")


def test_modify_font_top_level():
    """测试顶层 font 参数"""
    print("=== 测试顶层 font 参数 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        font="思源宋体"
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert segs[0]["style"]["font"] == "思源宋体"

    print("[PASS] 顶层 font 参数通过")


def test_modify_font_in_style():
    """测试在 style 中指定字体"""
    print("=== 测试在 style 中指定字体 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        style={"font": "思源黑体", "size": 10.0}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert segs[0]["style"]["font"] == "思源黑体"
    assert segs[0]["style"]["size"] == 10.0

    print("[PASS] style 中指定字体通过")


# ==================== clip_settings 部分更新测试 ====================

def test_modify_clip_settings_partial():
    """测试 clip_settings 部分更新"""
    print("=== 测试 clip_settings 部分更新 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        clip_settings={"transform_y": -0.5, "scale_x": 1.5}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    clip = segs[0]["clip_settings"]

    # 修改的值
    assert clip["transform_y"] == -0.5
    assert clip["scale_x"] == 1.5
    # 未修改的值保持原值
    assert clip["transform_x"] == 0.0
    assert clip["scale_y"] == 1.0
    assert clip["rotation"] == 0.0

    print("[PASS] clip_settings 部分更新通过")


# ==================== uniform_scale 测试 ====================

def test_modify_uniform_scale():
    """测试修改 uniform_scale"""
    print("=== 测试修改 uniform_scale ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        uniform_scale=True
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert segs[0]["uniform_scale"] == True

    print("[PASS] uniform_scale 通过")


# ==================== border 部分更新测试 ====================

def test_modify_border_partial():
    """测试 border 部分更新"""
    print("=== 测试 border 部分更新 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        border={"alpha": 0.5, "width": 20.0}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    b = segs[0]["border"]

    # 修改的值
    assert b["alpha"] == 0.5
    assert b["width"] == 20.0
    # 未修改的值保持原值
    assert b["color"] == [0.0, 0.0, 0.0]

    print("[PASS] border 部分更新通过")


def test_modify_border_color():
    """测试修改 border 颜色"""
    print("=== 测试修改 border 颜色 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        border={"color": [1.0, 0.0, 0.0]}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert segs[0]["border"]["color"] == [1.0, 0.0, 0.0]
    # alpha 和 width 保持原值
    assert segs[0]["border"]["alpha"] == 1.0
    assert segs[0]["border"]["width"] == 40.0

    print("[PASS] border 颜色修改通过")


# ==================== background 部分更新测试 ====================

def test_modify_background_partial():
    """测试 background 部分更新"""
    print("=== 测试 background 部分更新 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        background={"color": "#FFFFFF", "alpha": 0.7}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    bg = segs[0]["background"]

    # 修改的值
    assert bg["color"] == "#FFFFFF"
    assert bg["alpha"] == 0.7
    # 未修改的值保持原值
    assert bg["style"] == 1
    assert bg["round_radius"] == 0.0

    print("[PASS] background 部分更新通过")


# ==================== shadow 部分更新测试 ====================

def test_modify_shadow_partial():
    """测试 shadow 部分更新"""
    print("=== 测试 shadow 部分更新 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        shadow={"alpha": 0.3, "distance": 10.0, "angle": -30.0}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    sh = segs[0]["shadow"]

    # 修改的值
    assert sh["alpha"] == 0.3
    assert sh["distance"] == 10.0
    assert sh["angle"] == -30.0
    # 未修改的值保持原值
    assert sh["diffuse"] == 15.0

    print("[PASS] shadow 部分更新通过")


# ==================== bubble 测试 ====================

def test_modify_bubble():
    """测试修改 bubble"""
    print("=== 测试修改 bubble ===")

    result = modify_text_infos(
        _make_text_segments(1),
        [1],
        bubble={"effect_id": "bubble-new", "resource_id": "res-new"}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    # _make_text_segments 不包含 bubble，所以是新增
    assert segs[0]["bubble"]["effect_id"] == "bubble-new"
    assert segs[0]["bubble"]["resource_id"] == "res-new"

    print("[PASS] bubble 修改通过")


# ==================== effect 测试 ====================

def test_modify_effect():
    """测试修改 effect"""
    print("=== 测试修改 effect ===")

    result = modify_text_infos(
        _make_text_segments(1),
        [1],
        effect={"effect_id": "font-effect-new"}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert segs[0]["effect"]["effect_id"] == "font-effect-new"

    print("[PASS] effect 修改通过")


# ==================== animations 部分更新测试 ====================

def test_modify_animations_partial():
    """测试 animations 部分更新"""
    print("=== 测试 animations 部分更新 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        animations={"intro": {"type": "左移入", "duration": 200000}}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    anim = segs[0]["animations"]

    # intro 被更新
    assert anim["intro"]["type"] == "左移入"
    assert anim["intro"]["duration"] == 200000
    # outro 保持原值
    assert anim["outro"]["type"] == "渐隐"
    assert anim["outro"]["duration"] == 300000

    print("[PASS] animations 部分更新通过")


def test_modify_animations_add_loop():
    """测试 animations 添加 loop 动画"""
    print("=== 测试 animations 添加 loop ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        animations={"loop": {"type": "呼吸"}}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    anim = segs[0]["animations"]

    # loop 被添加
    assert anim["loop"]["type"] == "呼吸"
    # intro/outro 保持原值
    assert anim["intro"]["type"] == "放大"
    assert anim["outro"]["type"] == "渐隐"

    print("[PASS] animations 添加 loop 通过")


# ==================== keyframes 测试 ====================

def test_modify_keyframes():
    """测试修改 keyframes（整体替换）"""
    print("=== 测试修改 keyframes ===")

    result = modify_text_infos(
        _make_text_segments(1),
        [1],
        keyframes=[
            {"property": "alpha", "time_offset": 0, "value": 1.0},
            {"property": "alpha", "time_offset": 5000000, "value": 0.0}
        ]
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert len(segs[0]["keyframes"]) == 2
    assert segs[0]["keyframes"][0]["property"] == "alpha"
    assert segs[0]["keyframes"][1]["value"] == 0.0

    print("[PASS] keyframes 通过")


# ==================== 多片段同时修改测试 ====================

def test_modify_multiple_segments():
    """测试同时修改多个片段"""
    print("=== 测试同时修改多个片段 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1, 3],
        style={"size": 10.0, "bold": True}
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    # 片段 1 和 3 被修改
    assert segs[0]["style"]["size"] == 10.0
    assert segs[0]["style"]["bold"] == True
    assert segs[2]["style"]["size"] == 10.0
    assert segs[2]["style"]["bold"] == True
    # 片段 2 未修改
    assert segs[1]["style"]["size"] == 8.0
    assert segs[1]["style"]["bold"] == False

    print("[PASS] 多片段同时修改通过")


# ==================== 组合修改测试 ====================

def test_modify_combined():
    """测试组合修改多个参数"""
    print("=== 测试组合修改 ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        content="新内容",
        target_timerange={"start": 0, "duration": 3000000},
        style={"size": 12.0, "bold": True, "color": [0.5, 0.3, 0.8]},
        font="思源黑体",
        clip_settings={"transform_y": -0.5, "scale_x": 1.2},
        uniform_scale=True,
        border={"alpha": 0.8, "width": 3.0},
        background={"color": "#FF0000", "alpha": 0.5},
        shadow={"distance": 10.0, "angle": -30.0},
        animations={"intro": {"type": "左移入", "duration": 200000}},
        keyframes=[
            {"property": "alpha", "time_offset": 0, "value": 1.0},
            {"property": "alpha", "time_offset": 3000000, "value": 0.0}
        ]
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    seg = segs[0]

    assert seg["content"] == "新内容"
    assert seg["target_timerange"]["duration"] == 3000000
    assert seg["style"]["size"] == 12.0
    assert seg["style"]["bold"] == True
    assert seg["style"]["font"] == "思源黑体"
    assert seg["clip_settings"]["transform_y"] == -0.5
    assert seg["uniform_scale"] == True
    assert seg["border"]["alpha"] == 0.8
    assert seg["background"]["color"] == "#FF0000"
    assert seg["shadow"]["distance"] == 10.0
    assert seg["animations"]["intro"]["type"] == "左移入"
    assert len(seg["keyframes"]) == 2

    print("[PASS] 组合修改通过")


# ==================== 不修改未传参数测试 ====================

def test_modify_preserves_existing():
    """测试不修改未传的参数"""
    print("=== 测试保留未传参数 ===")

    # 只修改 content，其他全部保持
    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        content="只改内容"
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    seg = segs[0]

    assert seg["content"] == "只改内容"
    # style 完全保持
    assert seg["style"]["size"] == 8.0
    assert seg["style"]["bold"] == False
    assert seg["style"]["color"] == [1.0, 1.0, 1.0]
    # clip_settings 完全保持
    assert seg["clip_settings"]["transform_x"] == 0.0
    assert seg["clip_settings"]["scale_x"] == 1.0
    # border 完全保持
    assert seg["border"]["alpha"] == 1.0
    assert seg["border"]["width"] == 40.0
    # animations 完全保持
    assert seg["animations"]["intro"]["type"] == "放大"

    print("[PASS] 保留未传参数通过")


# ==================== segment_ids 返回测试 ====================

def test_modify_segment_ids():
    """测试返回正确的 segment_ids"""
    print("=== 测试 segment_ids ===")

    result = modify_text_infos(
        _make_text_segments(3),
        [1],
        content="test"
    )

    assert result["code"] == 0
    assert result["segment_ids"] == ["t1", "t2", "t3"]

    print("[PASS] segment_ids 通过")


# ==================== 无修改操作测试 ====================

def test_modify_no_changes():
    """测试不传任何修改参数（仅校验通过）"""
    print("=== 测试无修改操作 ===")

    original = _make_text_segments(3)

    result = modify_text_infos(original, [1])

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    original_segs = json.loads(original)

    # 数据完全不变
    assert segs[0] == original_segs[0]
    assert segs[1] == original_segs[1]
    assert segs[2] == original_segs[2]

    print("[PASS] 无修改操作通过")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("开始运行修改文本信息 API 测试")
    print("=" * 50 + "\n")

    try:
        # 参数校验测试
        test_modify_validation_empty_infos()
        test_modify_validation_empty_index()
        test_modify_validation_invalid_json()
        test_modify_validation_index_out_of_range()

        # 基本修改测试
        test_modify_content()
        test_modify_target_timerange()
        test_modify_target_timerange_partial()

        # style 部分更新测试
        test_modify_style_partial()
        test_modify_style_color()
        test_modify_font_top_level()
        test_modify_font_in_style()

        # clip_settings 部分更新测试
        test_modify_clip_settings_partial()

        # uniform_scale 测试
        test_modify_uniform_scale()

        # border 部分更新测试
        test_modify_border_partial()
        test_modify_border_color()

        # background 部分更新测试
        test_modify_background_partial()

        # shadow 部分更新测试
        test_modify_shadow_partial()

        # bubble 测试
        test_modify_bubble()

        # effect 测试
        test_modify_effect()

        # animations 部分更新测试
        test_modify_animations_partial()
        test_modify_animations_add_loop()

        # keyframes 测试
        test_modify_keyframes()

        # 多片段修改测试
        test_modify_multiple_segments()

        # 组合修改测试
        test_modify_combined()

        # 保留未传参数测试
        test_modify_preserves_existing()

        # segment_ids 测试
        test_modify_segment_ids()

        # 无修改操作测试
        test_modify_no_changes()

        print("\n" + "=" * 50)
        print("所有测试通过!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()
