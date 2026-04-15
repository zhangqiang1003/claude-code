# -*- coding: utf-8 -*-
"""
文本处理 API 测试用例

测试 text_info 函数的所有功能
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
_text_mod = _load_module(
    "text_info",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "core", "draft", "populate", "text_info.py")
)
text_info = _text_mod.text_info


# ==================== 基本功能测试 ====================

def test_text_info_basic():
    """测试基本文本创建"""
    print("=== 测试基本文本创建 ===")

    result = text_info(content="Hello World")

    assert result["code"] == 0, f"状态码应为 0，实际为 {result['code']}"
    assert len(result["segment_ids"]) == 1

    seg = json.loads(result["text_infos"])[0]
    assert seg["content"] == "Hello World"
    assert seg["target_timerange"]["start"] == 0
    assert seg["target_timerange"]["duration"] == 5000000  # 默认值

    print("[PASS] 基本文本创建通过")


def test_text_info_validation():
    """测试参数校验"""
    print("=== 测试参数校验 ===")

    # 空内容
    result = text_info(content="")
    assert result["code"] == -1

    print("[PASS] 参数校验通过")


def test_text_info_target_timerange():
    """测试 target_timerange"""
    print("=== 测试 target_timerange ===")

    result = text_info(
        content="测试",
        target_timerange={"start": 1000000, "duration": 3000000}
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    assert seg["target_timerange"]["start"] == 1000000
    assert seg["target_timerange"]["duration"] == 3000000

    print("[PASS] target_timerange 通过")


# ==================== style 测试 ====================

def test_text_info_style():
    """测试 style 样式"""
    print("=== 测试 style ===")

    result = text_info(
        content="样式测试",
        style={
            "size": 12.0,
            "bold": True,
            "italic": True,
            "underline": True,
            "alpha": 0.9,
            "align": 1,
            "vertical": False,
            "letter_spacing": 5,
            "line_spacing": 10,
            "auto_wrapping": True,
            "max_line_width": 0.7
        }
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    s = seg["style"]

    assert s["size"] == 12.0
    assert s["bold"] == True
    assert s["italic"] == True
    assert s["underline"] == True
    assert s["alpha"] == 0.9
    assert s["align"] == 1
    assert s["letter_spacing"] == 5
    assert s["line_spacing"] == 10
    assert s["auto_wrapping"] == True
    assert s["max_line_width"] == 0.7

    print("[PASS] style 通过")


def test_text_info_style_color_hex():
    """测试 style 颜色（十六进制）"""
    print("=== 测试 style 颜色（十六进制） ===")

    result = text_info(
        content="颜色测试",
        style={"color": "#FF0000"}
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    color = seg["style"]["color"]

    assert abs(color[0] - 1.0) < 0.01
    assert abs(color[1]) < 0.01
    assert abs(color[2]) < 0.01

    print("[PASS] style 颜色（十六进制）通过")


def test_text_info_style_color_rgb255():
    """测试 style 颜色（0-255 RGB）"""
    print("=== 测试 style 颜色（0-255 RGB） ===")

    result = text_info(
        content="颜色测试",
        style={"color": [255, 128, 0]}
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    color = seg["style"]["color"]

    assert abs(color[0] - 1.0) < 0.01
    assert abs(color[1] - 128/255.0) < 0.01
    assert abs(color[2]) < 0.01

    print("[PASS] style 颜色（0-255 RGB）通过")


def test_text_info_style_color_rgb01():
    """测试 style 颜色（0-1 RGB）"""
    print("=== 测试 style 颜色（0-1 RGB） ===")

    result = text_info(
        content="颜色测试",
        style={"color": [0.5, 0.3, 0.8]}
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    color = seg["style"]["color"]

    assert abs(color[0] - 0.5) < 0.01
    assert abs(color[1] - 0.3) < 0.01
    assert abs(color[2] - 0.8) < 0.01

    print("[PASS] style 颜色（0-1 RGB）通过")


def test_text_info_style_font():
    """测试 style 中的字体"""
    print("=== 测试 style font ===")

    # 在 style 中指定 font
    result = text_info(
        content="字体测试",
        style={"font": "思源黑体", "size": 10.0}
    )
    seg = json.loads(result["text_infos"])[0]
    assert seg["style"]["font"] == "思源黑体"

    print("[PASS] style font 通过")


def test_text_info_top_level_font():
    """测试顶层 font 参数"""
    print("=== 测试顶层 font 参数 ===")

    result = text_info(
        content="字体测试",
        font="思源宋体",
        style={"size": 10.0}
    )
    seg = json.loads(result["text_infos"])[0]
    assert seg["style"]["font"] == "思源宋体"

    # 顶层 font 覆盖 style.font
    result = text_info(
        content="字体覆盖",
        font="覆盖字体",
        style={"font": "被覆盖字体", "size": 10.0}
    )
    seg = json.loads(result["text_infos"])[0]
    assert seg["style"]["font"] == "覆盖字体"

    print("[PASS] 顶层 font 参数通过")


# ==================== clip_settings 测试 ====================

def test_text_info_clip_settings():
    """测试 clip_settings"""
    print("=== 测试 clip_settings ===")

    result = text_info(
        content="位置测试",
        clip_settings={
            "transform_x": 0.1,
            "transform_y": -0.5,
            "scale_x": 1.2,
            "scale_y": 1.2,
            "rotation": 45.0,
            "alpha": 0.8,
            "flip_horizontal": True,
            "flip_vertical": False
        }
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    cs = seg["clip_settings"]

    assert cs["transform_x"] == 0.1
    assert cs["transform_y"] == -0.5
    assert cs["scale_x"] == 1.2
    assert cs["rotation"] == 45.0
    assert cs["alpha"] == 0.8
    assert cs["flip_horizontal"] == True

    print("[PASS] clip_settings 通过")


def test_text_info_uniform_scale():
    """测试 uniform_scale"""
    print("=== 测试 uniform_scale ===")

    result = text_info(content="缩放测试", uniform_scale=True)
    seg = json.loads(result["text_infos"])[0]
    assert seg["uniform_scale"] == True

    print("[PASS] uniform_scale 通过")


# ==================== border 测试 ====================

def test_text_info_border():
    """测试 border（描边）"""
    print("=== 测试 border ===")

    result = text_info(
        content="描边测试",
        border={"alpha": 0.8, "color": [255, 0, 0], "width": 3.0}
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    b = seg["border"]

    assert b["alpha"] == 0.8
    assert abs(b["color"][0] - 1.0) < 0.01  # 255 → 1.0
    assert b["width"] == 3.0

    print("[PASS] border 通过")


# ==================== background 测试 ====================

def test_text_info_background():
    """测试 background（背景）"""
    print("=== 测试 background ===")

    result = text_info(
        content="背景测试",
        background={
            "color": "#000000",
            "style": 2,
            "alpha": 0.5,
            "round_radius": 0.1,
            "height": 0.2,
            "width": 0.3,
            "horizontal_offset": 0.4,
            "vertical_offset": 0.6
        }
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    bg = seg["background"]

    assert bg["color"] == "#000000"
    assert bg["style"] == 2
    assert bg["alpha"] == 0.5
    assert bg["round_radius"] == 0.1
    assert bg["height"] == 0.2
    assert bg["width"] == 0.3
    assert bg["horizontal_offset"] == 0.4
    assert bg["vertical_offset"] == 0.6

    print("[PASS] background 通过")


# ==================== shadow 测试 ====================

def test_text_info_shadow():
    """测试 shadow（阴影）"""
    print("=== 测试 shadow ===")

    result = text_info(
        content="阴影测试",
        shadow={
            "alpha": 0.7,
            "color": "#333333",
            "diffuse": 20.0,
            "distance": 8.0,
            "angle": -30.0
        }
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    sh = seg["shadow"]

    assert sh["alpha"] == 0.7
    assert sh["diffuse"] == 20.0
    assert sh["distance"] == 8.0
    assert sh["angle"] == -30.0

    print("[PASS] shadow 通过")


# ==================== bubble / effect 测试 ====================

def test_text_info_bubble():
    """测试 bubble（气泡）"""
    print("=== 测试 bubble ===")

    result = text_info(
        content="气泡测试",
        bubble={"effect_id": "bubble-001", "resource_id": "res-001"}
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    assert seg["bubble"]["effect_id"] == "bubble-001"
    assert seg["bubble"]["resource_id"] == "res-001"

    print("[PASS] bubble 通过")


def test_text_info_effect():
    """测试 effect（花字效果）"""
    print("=== 测试 effect ===")

    result = text_info(
        content="花字测试",
        effect={"effect_id": "font-effect-001"}
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    assert seg["effect"]["effect_id"] == "font-effect-001"

    print("[PASS] effect 通过")


# ==================== animations 测试 ====================

def test_text_info_animations():
    """测试 animations（动画）"""
    print("=== 测试 animations ===")

    result = text_info(
        content="动画测试",
        animations={
            "intro": {"type": "放大", "duration": 500000},
            "outro": {"type": "渐隐", "duration": 300000},
            "loop": {"type": "呼吸"}
        }
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    anim = seg["animations"]

    assert anim["intro"]["type"] == "放大"
    assert anim["intro"]["duration"] == 500000
    assert anim["outro"]["type"] == "渐隐"
    assert anim["outro"]["duration"] == 300000
    assert anim["loop"]["type"] == "呼吸"

    print("[PASS] animations 通过")


def test_text_info_animations_partial():
    """测试只设置部分动画"""
    print("=== 测试部分动画 ===")

    result = text_info(
        content="部分动画",
        animations={"intro": {"type": "左移入", "duration": 200000}}
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    assert "intro" in seg["animations"]
    assert "outro" not in seg["animations"]

    print("[PASS] 部分动画通过")


# ==================== keyframes 测试 ====================

def test_text_info_keyframes():
    """测试 keyframes（关键帧）"""
    print("=== 测试 keyframes ===")

    result = text_info(
        content="关键帧测试",
        keyframes=[
            {"property": "alpha", "time_offset": 0, "value": 1.0},
            {"property": "alpha", "time_offset": 5000000, "value": 0.0}
        ]
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]
    assert len(seg["keyframes"]) == 2
    assert seg["keyframes"][0]["property"] == "alpha"
    assert seg["keyframes"][1]["value"] == 0.0

    print("[PASS] keyframes 通过")


# ==================== 可选字段不存在测试 ====================

def test_text_info_optional_not_present():
    """测试可选字段未传入时不出现在输出中"""
    print("=== 测试可选字段不存在 ===")

    result = text_info(content="简单文本")
    seg = json.loads(result["text_infos"])[0]

    # 必须存在的字段
    assert "content" in seg
    assert "target_timerange" in seg
    assert "id" in seg

    # 未传入的可选字段不应存在
    assert "style" not in seg
    assert "clip_settings" not in seg
    assert "uniform_scale" not in seg
    assert "border" not in seg
    assert "background" not in seg
    assert "shadow" not in seg
    assert "bubble" not in seg
    assert "effect" not in seg
    assert "animations" not in seg
    assert "keyframes" not in seg

    print("[PASS] 可选字段不存在通过")


# ==================== 组合测试 ====================

def test_text_info_combined():
    """测试组合参数"""
    print("=== 测试组合参数 ===")

    result = text_info(
        content="组合测试",
        target_timerange={"start": 0, "duration": 5000000},
        style={
            "size": 10.0,
            "bold": True,
            "color": "#FFFFFF",
            "align": 1,
            "font": "思源黑体"
        },
        clip_settings={"transform_y": -0.5, "scale_x": 1.2, "scale_y": 1.2},
        uniform_scale=True,
        border={"color": [0, 0, 0], "width": 2.0},
        background={"color": "#000000", "alpha": 0.5},
        shadow={"distance": 5.0, "angle": -45.0},
        animations={"intro": {"type": "放大", "duration": 500000}},
        keyframes=[
            {"property": "alpha", "time_offset": 0, "value": 1.0},
            {"property": "alpha", "time_offset": 5000000, "value": 0.0}
        ]
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]

    assert seg["content"] == "组合测试"
    assert seg["style"]["font"] == "思源黑体"
    assert seg["style"]["bold"] == True
    assert seg["clip_settings"]["transform_y"] == -0.5
    assert seg["uniform_scale"] == True
    assert seg["border"]["width"] == 2.0
    assert seg["background"]["color"] == "#000000"
    assert seg["shadow"]["distance"] == 5.0
    assert seg["animations"]["intro"]["type"] == "放大"
    assert len(seg["keyframes"]) == 2

    print("[PASS] 组合参数通过")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("开始运行文本处理 API 测试")
    print("=" * 50 + "\n")

    try:
        test_text_info_basic()
        test_text_info_validation()
        test_text_info_target_timerange()
        test_text_info_style()
        test_text_info_style_color_hex()
        test_text_info_style_color_rgb255()
        test_text_info_style_color_rgb01()
        test_text_info_style_font()
        test_text_info_top_level_font()
        test_text_info_clip_settings()
        test_text_info_uniform_scale()
        test_text_info_border()
        test_text_info_background()
        test_text_info_shadow()
        test_text_info_bubble()
        test_text_info_effect()
        test_text_info_animations()
        test_text_info_animations_partial()
        test_text_info_keyframes()
        test_text_info_optional_not_present()
        test_text_info_combined()

        print("\n" + "=" * 50)
        print("所有测试通过!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()
