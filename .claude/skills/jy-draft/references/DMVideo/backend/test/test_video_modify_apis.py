# -*- coding: utf-8 -*-
"""
修改视频信息 API 测试用例

测试 modify_video_infos 函数的所有功能
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
    "modify_video_infos",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "core", "draft", "populate", "modify_video_infos.py")
)
modify_video_infos = _modify_mod.modify_video_infos


def _make_video_infos(segments):
    """辅助函数：构造 video_infos JSON 字符串"""
    return json.dumps(segments, ensure_ascii=False)


def _base_segment(**overrides):
    """辅助函数：创建一个基础视频片段"""
    seg = {
        "id": "test-001",
        "material_url": "https://example.com/video.mp4",
        "material_name": "测试视频",
        "target_timerange": {"start": 0, "duration": 5000000},
        "source_timerange": {"start": 0, "duration": 5000000},
        "speed": 1.0,
        "volume": 1.0,
        "change_pitch": False
    }
    seg.update(overrides)
    return seg


# ==================== 参数校验测试 ====================

def test_validation_empty_video_infos():
    """测试空 video_infos"""
    print("=== 测试参数校验：空 video_infos ===")

    result = modify_video_infos(video_infos="", segment_index=[1])
    assert result["code"] == -1
    assert "不能为空" in result["message"]

    print("[PASS] 空 video_infos 校验通过")


def test_validation_empty_segment_index():
    """测试空 segment_index"""
    print("=== 测试参数校验：空 segment_index ===")

    result = modify_video_infos(video_infos="[]", segment_index=[])
    assert result["code"] == -1
    assert "不能为空" in result["message"]

    print("[PASS] 空 segment_index 校验通过")


def test_validation_invalid_json():
    """测试无效 JSON"""
    print("=== 测试参数校验：无效 JSON ===")

    result = modify_video_infos(video_infos="not json", segment_index=[1])
    assert result["code"] == -1
    assert "JSON" in result["message"]

    print("[PASS] 无效 JSON 校验通过")


def test_validation_invalid_speed():
    """测试无效速度"""
    print("=== 测试参数校验：无效速度 ===")

    infos = _make_video_infos([_base_segment()])

    result = modify_video_infos(video_infos=infos, segment_index=[1], speed=0.01)
    assert result["code"] == -1

    result = modify_video_infos(video_infos=infos, segment_index=[1], speed=50.0)
    assert result["code"] == -1

    print("[PASS] 无效速度校验通过")


def test_validation_invalid_index():
    """测试无效索引"""
    print("=== 测试参数校验：无效索引 ===")

    infos = _make_video_infos([_base_segment()])

    # 索引超出范围
    result = modify_video_infos(video_infos=infos, segment_index=[5], volume=0.5)
    assert result["code"] == -1

    print("[PASS] 无效索引校验通过")


# ==================== 基础字段修改测试 ====================

def test_modify_volume():
    """测试修改音量"""
    print("=== 测试修改 volume ===")

    infos = _make_video_infos([_base_segment()])
    result = modify_video_infos(video_infos=infos, segment_index=[1], volume=0.5)

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["volume"] == 0.5

    print("[PASS] volume 修改通过")


def test_modify_speed():
    """测试修改速度（自动重算 target_timerange.duration）"""
    print("=== 测试修改 speed ===")

    infos = _make_video_infos([_base_segment(
        source_timerange={"start": 0, "duration": 10000000}
    )])
    result = modify_video_infos(video_infos=infos, segment_index=[1], speed=2.0)

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["speed"] == 2.0
    assert seg["target_timerange"]["duration"] == 5000000  # 10000000 / 2.0

    print("[PASS] speed 修改通过")


def test_modify_change_pitch():
    """测试修改 change_pitch"""
    print("=== 测试修改 change_pitch ===")

    infos = _make_video_infos([_base_segment()])
    result = modify_video_infos(video_infos=infos, segment_index=[1], change_pitch=True)

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["change_pitch"] == True

    print("[PASS] change_pitch 修改通过")


def test_modify_material_url():
    """测试修改素材 URL"""
    print("=== 测试修改 material_url ===")

    infos = _make_video_infos([_base_segment()])
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        material_url="https://example.com/new_video.mp4"
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["material_url"] == "https://example.com/new_video.mp4"

    print("[PASS] material_url 修改通过")


def test_modify_material_metadata():
    """测试修改素材元数据字段"""
    print("=== 测试修改素材元数据字段 ===")

    infos = _make_video_infos([_base_segment()])
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        material_name="新名称",
        material_type="photo",
        width=1920,
        height=1080,
        material_duration=10000000,
        local_material_id="local-456",
        uniform_scale=True
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["material_name"] == "新名称"
    assert seg["material_type"] == "photo"
    assert seg["width"] == 1920
    assert seg["height"] == 1080
    assert seg["material_duration"] == 10000000
    assert seg["local_material_id"] == "local-456"
    assert seg["uniform_scale"] == True

    print("[PASS] 素材元数据字段修改通过")


# ==================== 时间范围修改测试 ====================

def test_modify_target_timerange():
    """测试修改 target_timerange（部分更新）"""
    print("=== 测试修改 target_timerange ===")

    infos = _make_video_infos([_base_segment()])
    # 只修改 duration，保留 start
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        target_timerange={"duration": 3000000}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["target_timerange"]["start"] == 0  # 保留原值
    assert seg["target_timerange"]["duration"] == 3000000

    # 修改 start 和 duration
    infos2 = _make_video_infos([_base_segment()])
    result2 = modify_video_infos(
        video_infos=infos2,
        segment_index=[1],
        target_timerange={"start": 1000000, "duration": 4000000}
    )
    seg2 = json.loads(result2["video_infos"])[0]
    assert seg2["target_timerange"]["start"] == 1000000
    assert seg2["target_timerange"]["duration"] == 4000000

    print("[PASS] target_timerange 修改通过")


def test_modify_source_timerange():
    """测试修改 source_timerange（自动重算 target）"""
    print("=== 测试修改 source_timerange ===")

    infos = _make_video_infos([_base_segment(speed=2.0)])
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        source_timerange={"duration": 10000000}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["source_timerange"]["duration"] == 10000000
    assert seg["target_timerange"]["duration"] == 5000000  # 10000000 / 2.0

    print("[PASS] source_timerange 修改通过")


# ==================== 嵌套结构修改测试 ====================

def test_modify_clip_settings():
    """测试修改 clip_settings（部分更新）"""
    print("=== 测试修改 clip_settings ===")

    infos = _make_video_infos([_base_segment(clip_settings={
        "transform_x": 0.0, "transform_y": 0.0,
        "scale_x": 1.0, "scale_y": 1.0,
        "rotation": 0.0, "alpha": 1.0,
        "flip_horizontal": False, "flip_vertical": False
    })])

    # 只修改 scale_x 和 scale_y
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        clip_settings={"scale_x": 1.38, "scale_y": 1.38}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["clip_settings"]["scale_x"] == 1.38
    assert seg["clip_settings"]["scale_y"] == 1.38
    assert seg["clip_settings"]["transform_x"] == 0.0  # 保留原值
    assert seg["clip_settings"]["alpha"] == 1.0  # 保留原值

    print("[PASS] clip_settings 修改通过")


def test_modify_clip_settings_new():
    """测试在无 clip_settings 的片段上新增"""
    print("=== 测试新增 clip_settings ===")

    infos = _make_video_infos([_base_segment()])
    assert "clip_settings" not in json.loads(infos)[0]

    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        clip_settings={"rotation": 90.0, "alpha": 0.8}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["clip_settings"]["rotation"] == 90.0
    assert seg["clip_settings"]["alpha"] == 0.8

    print("[PASS] 新增 clip_settings 通过")


def test_modify_crop_settings():
    """测试修改 crop_settings"""
    print("=== 测试修改 crop_settings ===")

    infos = _make_video_infos([_base_segment()])
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        crop_settings={"upper_left_x": 0.1, "lower_right_x": 0.9}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["crop_settings"]["upper_left_x"] == 0.1
    assert seg["crop_settings"]["lower_right_x"] == 0.9

    print("[PASS] crop_settings 修改通过")


def test_modify_fade():
    """测试修改 fade（部分更新）"""
    print("=== 测试修改 fade ===")

    infos = _make_video_infos([_base_segment(fade={"in_duration": 300000, "out_duration": 0})])

    # 只修改 out_duration
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        fade={"out_duration": 500000}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["fade"]["in_duration"] == 300000  # 保留原值
    assert seg["fade"]["out_duration"] == 500000

    print("[PASS] fade 修改通过")


def test_modify_effects():
    """测试修改 effects"""
    print("=== 测试修改 effects ===")

    infos = _make_video_infos([_base_segment()])
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        effects=[{"type": "模糊", "params": [50]}, {"type": "故障", "params": [60, 30]}]
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert len(seg["effects"]) == 2
    assert seg["effects"][0]["type"] == "模糊"
    assert seg["effects"][1]["params"] == [60, 30]

    print("[PASS] effects 修改通过")


def test_modify_filters():
    """测试修改 filters"""
    print("=== 测试修改 filters ===")

    infos = _make_video_infos([_base_segment()])
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        filters=[{"type": "暖色", "intensity": 80}]
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["filters"][0]["type"] == "暖色"
    assert seg["filters"][0]["intensity"] == 80

    print("[PASS] filters 修改通过")


def test_modify_mask():
    """测试修改 mask（部分更新）"""
    print("=== 测试修改 mask ===")

    infos = _make_video_infos([_base_segment(mask={
        "type": "circle", "center_x": 0.5, "center_y": 0.5,
        "size": 0.8, "feather": 5.0, "invert": False
    })])

    # 只修改 size 和 invert
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        mask={"size": 0.6, "invert": True}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["mask"]["size"] == 0.6
    assert seg["mask"]["invert"] == True
    assert seg["mask"]["center_x"] == 0.5  # 保留原值
    assert seg["mask"]["type"] == "circle"  # 保留原值

    print("[PASS] mask 修改通过")


def test_modify_transition():
    """测试修改 transition"""
    print("=== 测试修改 transition ===")

    infos = _make_video_infos([_base_segment()])
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        transition={"type": "叠化", "duration": 300000}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["transition"]["type"] == "叠化"
    assert seg["transition"]["duration"] == 300000

    print("[PASS] transition 修改通过")


def test_modify_background_filling():
    """测试修改 background_filling（部分更新）"""
    print("=== 测试修改 background_filling ===")

    infos = _make_video_infos([_base_segment(background_filling={
        "type": "blur", "blur": 0.0625, "color": "#00000000"
    })])

    # 只修改 blur
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        background_filling={"blur": 0.1}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["background_filling"]["blur"] == 0.1
    assert seg["background_filling"]["type"] == "blur"  # 保留原值

    print("[PASS] background_filling 修改通过")


def test_modify_animations():
    """测试修改 animations（部分更新）"""
    print("=== 测试修改 animations ===")

    infos = _make_video_infos([_base_segment(animations={
        "intro": {"type": "放大", "duration": 500000}
    })])

    # 只修改 outro，保留 intro
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        animations={"outro": {"type": "渐隐", "duration": 300000}}
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert seg["animations"]["intro"]["type"] == "放大"  # 保留原值
    assert seg["animations"]["outro"]["type"] == "渐隐"
    assert seg["animations"]["outro"]["duration"] == 300000

    print("[PASS] animations 修改通过")


def test_modify_keyframes():
    """测试修改 keyframes"""
    print("=== 测试修改 keyframes ===")

    infos = _make_video_infos([_base_segment()])
    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        keyframes=[
            {"property": "alpha", "time_offset": 0, "value": 1.0},
            {"property": "alpha", "time_offset": 5000000, "value": 0.0}
        ]
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]
    assert len(seg["keyframes"]) == 2
    assert seg["keyframes"][0]["property"] == "alpha"
    assert seg["keyframes"][1]["value"] == 0.0

    print("[PASS] keyframes 修改通过")


# ==================== 多片段修改测试 ====================

def test_modify_multiple_segments():
    """测试同时修改多个片段"""
    print("=== 测试同时修改多个片段 ===")

    infos = _make_video_infos([
        _base_segment(id="seg-1", volume=1.0),
        _base_segment(id="seg-2", volume=1.0),
        _base_segment(id="seg-3", volume=1.0)
    ])

    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1, 3],
        volume=0.5,
        speed=2.0
    )

    assert result["code"] == 0
    video_list = json.loads(result["video_infos"])

    # 片段 1 和 3 应被修改
    assert video_list[0]["volume"] == 0.5
    assert video_list[0]["speed"] == 2.0
    # 片段 2 不应被修改
    assert video_list[1]["volume"] == 1.0
    assert "speed" not in video_list[1] or video_list[1]["speed"] == 1.0
    # 片段 3 应被修改
    assert video_list[2]["volume"] == 0.5
    assert video_list[2]["speed"] == 2.0

    # 验证 segment_ids
    assert result["segment_ids"] == ["seg-1", "seg-2", "seg-3"]

    print("[PASS] 多片段修改通过")


# ==================== 组合修改测试 ====================

def test_modify_combined():
    """测试组合修改（模拟真实场景）"""
    print("=== 测试组合修改 ===")

    infos = _make_video_infos([_base_segment(
        source_timerange={"start": 0, "duration": 10000000}
    )])

    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        volume=0.8,
        speed=1.5,
        change_pitch=True,
        clip_settings={"scale_x": 1.38, "scale_y": 1.38},
        fade={"in_duration": 500000},
        effects=[{"type": "模糊", "params": [50]}],
        filters=[{"type": "暖色", "intensity": 70}],
        animations={"intro": {"type": "放大", "duration": 500000}},
        transition={"type": "叠化", "duration": 300000},
        keyframes=[
            {"property": "alpha", "time_offset": 0, "value": 1.0},
            {"property": "alpha", "time_offset": 6666667, "value": 0.0}
        ]
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    assert seg["volume"] == 0.8
    assert seg["speed"] == 1.5
    assert seg["change_pitch"] == True
    assert seg["clip_settings"]["scale_x"] == 1.38
    assert seg["fade"]["in_duration"] == 500000
    assert len(seg["effects"]) == 1
    assert len(seg["filters"]) == 1
    assert seg["animations"]["intro"]["type"] == "放大"
    assert seg["transition"]["type"] == "叠化"
    assert len(seg["keyframes"]) == 2
    # speed=1.5, source=10000000, target = 10000000/1.5 ≈ 6666667
    assert seg["target_timerange"]["duration"] == 6666667

    print("[PASS] 组合修改通过")


def test_modify_preserves_unmodified_fields():
    """测试修改部分字段不影响其他字段"""
    print("=== 测试未修改字段保留 ===")

    infos = _make_video_infos([_base_segment(
        material_name="原始名称",
        width=1920,
        height=1080,
        change_pitch=True,
        fade={"in_duration": 300000, "out_duration": 200000},
        mask={"type": "circle", "center_x": 0.5, "size": 0.8}
    )])

    result = modify_video_infos(
        video_infos=infos,
        segment_index=[1],
        volume=0.3
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    # volume 被修改
    assert seg["volume"] == 0.3
    # 其他字段保留
    assert seg["material_name"] == "原始名称"
    assert seg["width"] == 1920
    assert seg["height"] == 1080
    assert seg["change_pitch"] == True
    assert seg["fade"]["in_duration"] == 300000
    assert seg["mask"]["type"] == "circle"

    print("[PASS] 未修改字段保留通过")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("开始运行修改视频信息 API 测试")
    print("=" * 50 + "\n")

    try:
        # 参数校验
        test_validation_empty_video_infos()
        test_validation_empty_segment_index()
        test_validation_invalid_json()
        test_validation_invalid_speed()
        test_validation_invalid_index()

        # 基础字段修改
        test_modify_volume()
        test_modify_speed()
        test_modify_change_pitch()
        test_modify_material_url()
        test_modify_material_metadata()

        # 时间范围修改
        test_modify_target_timerange()
        test_modify_source_timerange()

        # 嵌套结构修改
        test_modify_clip_settings()
        test_modify_clip_settings_new()
        test_modify_crop_settings()
        test_modify_fade()
        test_modify_effects()
        test_modify_filters()
        test_modify_mask()
        test_modify_transition()
        test_modify_background_filling()
        test_modify_animations()
        test_modify_keyframes()

        # 多片段
        test_modify_multiple_segments()

        # 组合
        test_modify_combined()
        test_modify_preserves_unmodified_fields()

        print("\n" + "=" * 50)
        print("所有测试通过!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()
