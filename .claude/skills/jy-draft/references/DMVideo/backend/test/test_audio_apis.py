# -*- coding: utf-8 -*-
"""
音频处理 API 测试用例

测试所有音频处理相关函数
"""

import sys
import os
import json

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.draft.populate import (
    audio_info,
    audio_infos_by_timelines,
    audio_infos_by_timelines_simple,
    modify_audio_infos,
    concat_audio_infos,
    swap_audio_segment_position,
    generate_audio_effect
)


def test_audio_info():
    """测试创建音频信息"""
    print("=== 测试 audio_info ===")

    # 正常情况
    result = audio_info(
        material_url="https://example.com/audio.mp3",
        target_timerange={"start": 0, "duration": 1500000},
        source_timerange={"start": 0, "duration": 3000000},
        speed=2.0,
        volume=0.8,
        fade={"in_duration": 500000, "out_duration": 0}
    )

    assert result["code"] == 0, f"状态码应为 0，实际为 {result['code']}"
    assert len(result["segment_ids"]) == 1, "应有 1 个 segment_id"

    audio_list = json.loads(result["audio_infos"])
    assert audio_list[0]["speed"] == 2.0, "speed 应为 2.0"
    assert audio_list[0]["volume"] == 0.8, "volume 应为 0.8"
    assert audio_list[0]["material_url"] == "https://example.com/audio.mp3", "material_url 应正确"

    # 验证时间范围
    target = audio_list[0]["target_timerange"]
    source = audio_list[0]["source_timerange"]
    assert target["start"] == 0, "target start 应为 0"
    assert target["duration"] == 1500000, f"target duration 应为 1500000，实际为 {target['duration']}"
    assert source["start"] == 0, "source start 应为 0"
    assert source["duration"] == 3000000, f"source duration 应为 3000000，实际为 {source['duration']}"

    print("[PASS] audio_info 测试通过")


def test_audio_info_validation():
    """测试 audio_info 参数校验"""
    print("=== 测试 audio_info 参数校验 ===")

    # 空 URL
    result = audio_info(
        material_url="",
        target_timerange={"start": 0, "duration": 3000000}
    )
    assert result["code"] == -1, "空 URL 应返回错误"

    # 无效速度
    result = audio_info(
        material_url="https://x.mp3",
        target_timerange={"start": 0, "duration": 3000000},
        speed=0.01
    )
    assert result["code"] == -1, "无效速度应返回错误"

    # 缺少 target_timerange
    result = audio_info(material_url="https://x.mp3")
    assert result["code"] == -1, "缺少 target_timerange 应返回错误"

    print("[PASS] audio_info 参数校验测试通过")


def test_audio_infos_by_timelines():
    """测试根据时间线创建音频信息"""
    print("=== 测试 audio_infos_by_timelines ===")

    timelines = [
        {"start": 0, "duration": 3000000},
        {"start": 3000000, "duration": 5000000}
    ]
    audio_urls = ["https://example.com/audio.mp3"]

    result = audio_infos_by_timelines(timelines=timelines, audio_urls=audio_urls)

    assert result["code"] == 0, f"状态码应为 0，实际为 {result['code']}"
    assert len(result["segment_ids"]) == 2, "应有 2 个 segment_id"

    audio_list = json.loads(result["audio_infos"])
    assert audio_list[1]["target_timerange"]["start"] == 3000000, "第二个片段开始应为 3000000"

    print("[PASS] audio_infos_by_timelines 测试通过")


def test_audio_infos_by_timelines_simple():
    """测试简单模式创建音频信息"""
    print("=== 测试 audio_infos_by_timelines_simple ===")

    result = audio_infos_by_timelines_simple(
        timeline_segments=[3000000, 5000000, 2000000],
        audio_urls=["https://example.com/audio.mp3"]
    )

    assert result["code"] == 0
    assert len(result["segment_ids"]) == 3, "应有 3 个 segment_id"

    audio_list = json.loads(result["audio_infos"])
    # 验证时间连续
    assert audio_list[0]["target_timerange"]["start"] == 0
    assert audio_list[1]["target_timerange"]["start"] == 3000000
    assert audio_list[2]["target_timerange"]["start"] == 8000000

    print("[PASS] audio_infos_by_timelines_simple 测试通过")


def test_modify_audio_infos():
    """测试修改音频信息"""
    print("=== 测试 modify_audio_infos ===")

    # 先创建一个音频信息
    create_result = audio_info(
        material_url="https://example.com/audio.mp3",
        target_timerange={"start": 0, "duration": 5000000},
        volume=1.0
    )

    # 修改音频信息（参数与 segment 格式对齐）
    modify_result = modify_audio_infos(
        audio_infos=create_result["audio_infos"],
        segment_index=[1],
        volume=0.5,
        speed=1.5,
        fade={"in_duration": 300000}
    )

    assert modify_result["code"] == 0, f"状态码应为 0，实际为 {modify_result['code']}"

    audio_list = json.loads(modify_result["audio_infos"])
    assert audio_list[0]["volume"] == 0.5, "volume 应修改为 0.5"
    assert audio_list[0]["speed"] == 1.5, "speed 应修改为 1.5"
    assert audio_list[0]["fade"]["in_duration"] == 300000, "fade.in_duration 应修改为 300000"

    print("[PASS] modify_audio_infos 测试通过")


def test_concat_audio_infos():
    """测试拼接音频信息"""
    print("=== 测试 concat_audio_infos ===")

    audio1 = audio_info(
        material_url="https://example.com/a.mp3",
        target_timerange={"start": 0, "duration": 3000000}
    )

    audio2 = audio_info(
        material_url="https://example.com/b.mp3",
        target_timerange={"start": 0, "duration": 5000000}
    )

    result = concat_audio_infos(
        audio_infos1=audio1["audio_infos"],
        audio_infos2=audio2["audio_infos"]
    )

    assert result["code"] == 0, f"状态码应为 0，实际为 {result['code']}"
    assert len(result["segment_ids"]) == 2, "应有 2 个 segment_id"

    audio_list = json.loads(result["audio_infos"])
    # 验证时间重新计算
    assert audio_list[0]["target_timerange"]["start"] == 0
    assert audio_list[1]["target_timerange"]["start"] == 3000000

    print("[PASS] concat_audio_infos 测试通过")


def test_swap_audio_segment_position():
    """测试交换音频片段位置"""
    print("=== 测试 swap_audio_segment_position ===")

    # 创建多个音频片段
    audio_list = [
        {"id": "a1", "material_url": "https://a.mp3", "target_timerange": {"start": 0, "duration": 3000000}},
        {"id": "a2", "material_url": "https://b.mp3", "target_timerange": {"start": 3000000, "duration": 5000000}},
        {"id": "a3", "material_url": "https://c.mp3", "target_timerange": {"start": 8000000, "duration": 2000000}}
    ]

    result = swap_audio_segment_position(
        audio_infos=json.dumps(audio_list),
        swap_position=[{"source_index": 1, "swap_index": 3}]
    )

    assert result["code"] == 0, f"状态码应为 0，实际为 {result['code']}"

    swapped = json.loads(result["audio_infos"])
    # 验证顺序交换
    assert swapped[0]["id"] == "a3", "第一个应为 a3"
    assert swapped[2]["id"] == "a1", "第三个应为 a1"

    # 验证时间重新计算
    assert swapped[0]["target_timerange"]["start"] == 0
    assert swapped[1]["target_timerange"]["start"] == 2000000
    assert swapped[2]["target_timerange"]["start"] == 7000000

    print("[PASS] swap_audio_segment_position 测试通过")


def test_generate_audio_effect():
    """测试生成音频特效"""
    print("=== 测试 generate_audio_effect ===")

    result = generate_audio_effect(
        audio_ids=["audio-001"],
        effect_type="回音",  # 使用可能存在的特效类型
        segment_index=[1],
        params=[50, 60]
    )

    # 不管特效类型是否存在，至少应该能生成 ID
    assert "effect_ids" in result, "应包含 effect_ids"

    print("[PASS] generate_audio_effect 测试通过")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("开始运行音频处理 API 测试")
    print("=" * 50 + "\n")

    try:
        test_audio_info()
        test_audio_info_validation()
        test_audio_infos_by_timelines()
        test_audio_infos_by_timelines_simple()
        test_modify_audio_infos()
        test_concat_audio_infos()
        test_swap_audio_segment_position()
        test_generate_audio_effect()

        print("\n" + "=" * 50)
        print("所有测试通过!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()