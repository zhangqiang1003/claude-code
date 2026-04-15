# -*- coding: utf-8 -*-
"""
视频处理 API 测试用例

测试所有视频处理相关函数
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
_video_info_mod = _load_module(
    "video_info",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "core", "draft", "populate", "video_info.py")
)
video_info = _video_info_mod.video_info


def test_video_info_basic():
    """测试创建基本视频信息"""
    print("=== 测试 video_info 基本功能 ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        source_timerange={"start": 0, "duration": 5000000},
        speed=1.0,
        volume=0.8
    )

    assert result["code"] == 0, f"状态码应为 0，实际为 {result['code']}"
    assert len(result["segment_ids"]) == 1, "应有 1 个 segment_id"

    video_list = json.loads(result["video_infos"])
    assert len(video_list) == 1
    seg = video_list[0]

    # 验证基础字段
    assert seg["material_url"] == "https://example.com/video.mp4"
    assert seg["volume"] == 0.8
    assert seg["change_pitch"] == False

    # 验证时间范围
    assert seg["target_timerange"]["start"] == 0
    assert seg["target_timerange"]["duration"] == 5000000
    assert seg["source_timerange"]["start"] == 0
    assert seg["source_timerange"]["duration"] == 5000000

    print("[PASS] video_info 基本功能测试通过")


def test_video_info_validation():
    """测试 video_info 参数校验"""
    print("=== 测试 video_info 参数校验 ===")

    # 空 URL
    result = video_info(
        material_url="",
        target_timerange={"start": 0, "duration": 5000000}
    )
    assert result["code"] == -1, "空 URL 应返回错误"

    # 无效速度（太慢）
    result = video_info(
        material_url="https://x.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        speed=0.01
    )
    assert result["code"] == -1, "无效速度应返回错误"

    # 无效速度（太快）
    result = video_info(
        material_url="https://x.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        speed=50.0
    )
    assert result["code"] == -1, "无效速度应返回错误"

    # 缺少时间范围
    result = video_info(material_url="https://x.mp4")
    assert result["code"] == -1, "缺少时间范围应返回错误"

    print("[PASS] video_info 参数校验测试通过")


def test_video_info_speed_calculation():
    """测试速度自动计算时间范围"""
    print("=== 测试速度自动计算 ===")

    # 根据 target + speed 计算 source
    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        speed=2.0
    )
    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["target_timerange"]["duration"] == 5000000
    assert seg["source_timerange"]["duration"] == 10000000  # target * speed
    assert seg["speed"] == 2.0

    # 根据 source + speed 计算 target
    result = video_info(
        material_url="https://example.com/video.mp4",
        source_timerange={"start": 0, "duration": 10000000},
        speed=2.0
    )
    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["source_timerange"]["duration"] == 10000000
    assert seg["target_timerange"]["duration"] == 5000000  # source / speed

    # source 和 target 都提供时，直接使用
    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 3000000},
        source_timerange={"start": 0, "duration": 6000000},
        speed=2.0
    )
    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["target_timerange"]["duration"] == 3000000
    assert seg["source_timerange"]["duration"] == 6000000

    # 无 speed 时默认 1.0（target ≈ source）
    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000}
    )
    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["source_timerange"]["duration"] == 5000000  # target * 1.0

    print("[PASS] 速度自动计算测试通过")


def test_video_info_clip_settings():
    """测试位置变换设置 (clip_settings)"""
    print("=== 测试 clip_settings ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        clip_settings={
            "transform_x": 0.1,
            "transform_y": -0.5,
            "scale_x": 1.38,
            "scale_y": 1.38,
            "rotation": 90.0,
            "alpha": 0.8,
            "flip_horizontal": True,
            "flip_vertical": False
        }
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    cs = seg["clip_settings"]

    assert cs["transform_x"] == 0.1
    assert cs["transform_y"] == -0.5
    assert cs["scale_x"] == 1.38
    assert cs["scale_y"] == 1.38
    assert cs["rotation"] == 90.0
    assert cs["alpha"] == 0.8
    assert cs["flip_horizontal"] == True
    assert cs["flip_vertical"] == False

    print("[PASS] clip_settings 测试通过")


def test_video_info_crop_settings():
    """测试裁剪设置 (crop_settings)"""
    print("=== 测试 crop_settings ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        crop_settings={
            "upper_left_x": 0.1,
            "upper_left_y": 0.2,
            "upper_right_x": 0.9,
            "upper_right_y": 0.2,
            "lower_left_x": 0.1,
            "lower_left_y": 0.8,
            "lower_right_x": 0.9,
            "lower_right_y": 0.8
        }
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    crop = seg["crop_settings"]

    assert crop["upper_left_x"] == 0.1
    assert crop["upper_left_y"] == 0.2
    assert crop["upper_right_x"] == 0.9
    assert crop["lower_left_y"] == 0.8

    print("[PASS] crop_settings 测试通过")


def test_video_info_fade():
    """测试淡入淡出 (fade)"""
    print("=== 测试 fade ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        fade={"in_duration": 500000, "out_duration": 300000}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert seg["fade"]["in_duration"] == 500000
    assert seg["fade"]["out_duration"] == 300000

    print("[PASS] fade 测试通过")


def test_video_info_effects_and_filters():
    """测试特效和滤镜"""
    print("=== 测试 effects 和 filters ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        effects=[
            {"type": "模糊", "params": [50]},
            {"type": "故障", "params": [60, 30]}
        ],
        filters=[
            {"type": "黑白", "intensity": 80},
            {"type": "复古", "intensity": 60}
        ]
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert len(seg["effects"]) == 2
    assert seg["effects"][0]["type"] == "模糊"
    assert seg["effects"][0]["params"] == [50]
    assert seg["effects"][1]["params"] == [60, 30]

    assert len(seg["filters"]) == 2
    assert seg["filters"][0]["type"] == "黑白"
    assert seg["filters"][0]["intensity"] == 80
    assert seg["filters"][1]["intensity"] == 60

    print("[PASS] effects 和 filters 测试通过")


def test_video_info_mask():
    """测试蒙版 (mask)"""
    print("=== 测试 mask ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        mask={
            "type": "circle",
            "center_x": 0.5,
            "center_y": 0.5,
            "size": 0.8,
            "rotation": 45.0,
            "feather": 10.0,
            "invert": True
        }
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert seg["mask"]["type"] == "circle"
    assert seg["mask"]["center_x"] == 0.5
    assert seg["mask"]["center_y"] == 0.5
    assert seg["mask"]["size"] == 0.8
    assert seg["mask"]["rotation"] == 45.0
    assert seg["mask"]["feather"] == 10.0
    assert seg["mask"]["invert"] == True

    # 测试矩形蒙版特有参数
    result2 = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        mask={
            "type": "rect",
            "rect_width": 0.6,
            "round_corner": 0.1
        }
    )
    seg2 = json.loads(result2["video_infos"])[0]
    assert seg2["mask"]["rect_width"] == 0.6
    assert seg2["mask"]["round_corner"] == 0.1

    print("[PASS] mask 测试通过")


def test_video_info_transition():
    """测试转场 (transition)"""
    print("=== 测试 transition ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        transition={"type": "叠化", "duration": 300000}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert seg["transition"]["type"] == "叠化"
    assert seg["transition"]["duration"] == 300000

    print("[PASS] transition 测试通过")


def test_video_info_background_filling():
    """测试背景填充 (background_filling)"""
    print("=== 测试 background_filling ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        background_filling={"type": "blur", "blur": 0.0625, "color": "#00000000"}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert seg["background_filling"]["type"] == "blur"
    assert seg["background_filling"]["blur"] == 0.0625
    assert seg["background_filling"]["color"] == "#00000000"

    print("[PASS] background_filling 测试通过")


def test_video_info_animations():
    """测试动画 (animations)"""
    print("=== 测试 animations ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        animations={
            "intro": {"type": "放大", "duration": 500000},
            "outro": {"type": "渐隐", "duration": 300000},
            "group": {"type": "弹入", "duration": 400000}
        }
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert seg["animations"]["intro"]["type"] == "放大"
    assert seg["animations"]["intro"]["duration"] == 500000
    assert seg["animations"]["outro"]["type"] == "渐隐"
    assert seg["animations"]["outro"]["duration"] == 300000
    assert seg["animations"]["group"]["type"] == "弹入"
    assert seg["animations"]["group"]["duration"] == 400000

    # 只设置部分动画
    result2 = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        animations={
            "intro": {"type": "左移入", "duration": 200000}
        }
    )
    seg2 = json.loads(result2["video_infos"])[0]
    assert "intro" in seg2["animations"]
    assert "outro" not in seg2["animations"]

    print("[PASS] animations 测试通过")


def test_video_info_keyframes():
    """测试关键帧 (keyframes)"""
    print("=== 测试 keyframes ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        keyframes=[
            {"property": "alpha", "time_offset": 0, "value": 1.0},
            {"property": "alpha", "time_offset": 5000000, "value": 0.0},
            {"property": "scale_x", "time_offset": 0, "value": 1.0},
            {"property": "scale_x", "time_offset": 2500000, "value": 1.5}
        ]
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert len(seg["keyframes"]) == 4
    assert seg["keyframes"][0]["property"] == "alpha"
    assert seg["keyframes"][0]["time_offset"] == 0
    assert seg["keyframes"][0]["value"] == 1.0
    assert seg["keyframes"][1]["value"] == 0.0
    assert seg["keyframes"][2]["property"] == "scale_x"

    print("[PASS] keyframes 测试通过")


def test_video_info_material_metadata():
    """测试素材元数据字段"""
    print("=== 测试素材元数据字段 ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        material_name="测试视频",
        material_type="video",
        width=1920,
        height=1080,
        material_duration=10000000,
        local_material_id="local-abc-123",
        uniform_scale=True
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert seg["material_name"] == "测试视频"
    assert seg["material_type"] == "video"
    assert seg["width"] == 1920
    assert seg["height"] == 1080
    assert seg["material_duration"] == 10000000
    assert seg["local_material_id"] == "local-abc-123"
    assert seg["uniform_scale"] == True

    print("[PASS] 素材元数据字段测试通过")


def test_video_info_combined():
    """测试组合参数（模拟真实使用场景）"""
    print("=== 测试组合参数 ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000},
        source_timerange={"start": 0, "duration": 10000000},
        speed=2.0,
        volume=0.8,
        change_pitch=True,
        material_name="测试视频",
        material_type="video",
        width=1920,
        height=1080,
        uniform_scale=True,
        crop_settings={
            "upper_left_x": 0.0, "upper_left_y": 0.0,
            "upper_right_x": 1.0, "upper_right_y": 0.0,
            "lower_left_x": 0.0, "lower_left_y": 1.0,
            "lower_right_x": 1.0, "lower_right_y": 1.0
        },
        clip_settings={
            "transform_x": 0, "transform_y": 0,
            "scale_x": 1.38, "scale_y": 1.38,
            "rotation": 0, "alpha": 1.0,
            "flip_horizontal": False, "flip_vertical": False
        },
        fade={"in_duration": 500000, "out_duration": 0},
        effects=[{"type": "抖动", "params": [50]}],
        filters=[{"type": "暖色", "intensity": 70}],
        animations={
            "intro": {"type": "放大", "duration": 500000},
            "outro": {"type": "渐隐", "duration": 300000}
        },
        transition={"type": "叠化", "duration": 300000},
        keyframes=[
            {"property": "alpha", "time_offset": 0, "value": 1.0},
            {"property": "alpha", "time_offset": 5000000, "value": 0.0}
        ]
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    # 验证所有字段存在且正确
    assert seg["material_url"] == "https://example.com/video.mp4"
    assert seg["speed"] == 2.0
    assert seg["volume"] == 0.8
    assert seg["change_pitch"] == True
    assert seg["material_name"] == "测试视频"
    assert seg["width"] == 1920
    assert seg["uniform_scale"] == True
    assert seg["clip_settings"]["scale_x"] == 1.38
    assert seg["fade"]["in_duration"] == 500000
    assert len(seg["effects"]) == 1
    assert len(seg["filters"]) == 1
    assert seg["animations"]["intro"]["type"] == "放大"
    assert seg["transition"]["type"] == "叠化"
    assert len(seg["keyframes"]) == 2

    print("[PASS] 组合参数测试通过")


def test_video_info_optional_fields_not_present():
    """测试可选字段未传入时不出现在输出中"""
    print("=== 测试可选字段不传入时不出现在输出中 ===")

    result = video_info(
        material_url="https://example.com/video.mp4",
        target_timerange={"start": 0, "duration": 5000000}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    # 必须存在的字段
    assert "material_url" in seg
    assert "target_timerange" in seg
    assert "source_timerange" in seg
    assert "volume" in seg
    assert "change_pitch" in seg

    # 未传入的可选字段不应存在
    assert "material_name" not in seg
    assert "material_type" not in seg
    assert "width" not in seg
    assert "height" not in seg
    assert "uniform_scale" not in seg
    assert "crop_settings" not in seg
    assert "clip_settings" not in seg
    assert "fade" not in seg
    assert "effects" not in seg
    assert "filters" not in seg
    assert "mask" not in seg
    assert "transition" not in seg
    assert "background_filling" not in seg
    assert "animations" not in seg
    assert "keyframes" not in seg

    print("[PASS] 可选字段不传入测试通过")


def test_video_info_photo_type():
    """测试图片类型素材"""
    print("=== 测试图片类型素材 ===")

    result = video_info(
        material_url="https://example.com/photo.jpg",
        target_timerange={"start": 0, "duration": 3000000},
        material_type="photo",
        width=1080,
        height=1920,
        background_filling={"type": "blur", "blur": 0.0625}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert seg["material_type"] == "photo"
    assert seg["width"] == 1080
    assert seg["height"] == 1920
    assert seg["background_filling"]["type"] == "blur"

    print("[PASS] 图片类型素材测试通过")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("开始运行视频处理 API 测试")
    print("=" * 50 + "\n")

    try:
        test_video_info_basic()
        test_video_info_validation()
        test_video_info_speed_calculation()
        test_video_info_clip_settings()
        test_video_info_crop_settings()
        test_video_info_fade()
        test_video_info_effects_and_filters()
        test_video_info_mask()
        test_video_info_transition()
        test_video_info_background_filling()
        test_video_info_animations()
        test_video_info_keyframes()
        test_video_info_material_metadata()
        test_video_info_combined()
        test_video_info_optional_fields_not_present()
        test_video_info_photo_type()

        print("\n" + "=" * 50)
        print("所有测试通过!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()
