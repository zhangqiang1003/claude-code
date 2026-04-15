# -*- coding: utf-8 -*-
"""
特效、滤镜、关键帧缓存功能测试

测试 populate 模块下的特效、滤镜、关键帧处理逻辑，验证缓存功能。
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.draft.populate import (
    # 视频特效
    generate_video_effect,
    get_video_effect_ids,
    get_video_effect_details,
    clear_video_effects,
    list_video_effects,
    # 视频滤镜
    generate_video_filter,
    get_video_filter_ids,
    get_video_filter_details,
    clear_video_filters,
    list_video_filters,
    # 音频特效
    generate_audio_effect,
    get_audio_effect_ids,
    get_audio_effect_details,
    clear_audio_effects,
    list_available_effects,
    # 关键帧
    generate_keyframe,
    generate_keyframe_for_audio,
    get_keyframe_ids,
    get_keyframe_details,
    get_audio_keyframe_ids,
    get_audio_keyframe_details,
    clear_keyframes,
    clear_audio_keyframes,
    list_keyframe_properties
)


def test_video_effect():
    """测试视频特效生成和缓存"""
    print("\n=== 测试视频特效 ===")

    draft_id = "test_draft_video_effect"

    # 列出可用特效
    result = list_video_effects()
    print(f"列出特效: code={result['code']}, count={len(result.get('effects', []))}")

    # 生成特效
    result = generate_video_effect(
        draft_id=draft_id,
        effect_type_name="模糊",
        segment_ids=["video-001", "video-002"],
        segment_index=[1, 2],
        params=[50]
    )
    print(f"生成特效: {result}")
    assert result["code"] == 0
    assert len(result["effect_ids"]) == 2

    # 获取缓存的特效ID
    effect_ids = get_video_effect_ids(draft_id)
    print(f"缓存的特效ID: {effect_ids}")
    assert len(effect_ids) == 2

    # 获取特效详情
    details = get_video_effect_details(draft_id)
    print(f"特效详情数量: {len(details)}")
    assert len(details) == 2
    assert details[0]["effect_type"] == "模糊"

    # 清除特效
    clear_video_effects(draft_id)
    assert len(get_video_effect_ids(draft_id)) == 0

    print("[PASS] 视频特效测试通过")


def test_video_filter():
    """测试视频滤镜生成和缓存"""
    print("\n=== 测试视频滤镜 ===")

    draft_id = "test_draft_video_filter"

    # 列出可用滤镜
    result = list_video_filters()
    print(f"列出滤镜: code={result['code']}, count={len(result.get('filters', []))}")

    # 生成滤镜
    result = generate_video_filter(
        draft_id=draft_id,
        filter_type_name="复古",
        segment_ids=["video-001"],
        segment_index=[1],
        intensity=80
    )
    print(f"生成滤镜: {result}")
    assert result["code"] == 0
    assert len(result["filter_ids"]) == 1

    # 获取缓存的滤镜ID
    filter_ids = get_video_filter_ids(draft_id)
    print(f"缓存的滤镜ID: {filter_ids}")
    assert len(filter_ids) == 1

    # 获取滤镜详情
    details = get_video_filter_details(draft_id)
    print(f"滤镜详情: {details}")
    assert details[0]["filter_type"] == "复古"
    assert details[0]["intensity"] == 80

    # 清除滤镜
    clear_video_filters(draft_id)
    assert len(get_video_filter_ids(draft_id)) == 0

    print("[PASS] 视频滤镜测试通过")


def test_audio_effect():
    """测试音频特效生成和缓存"""
    print("\n=== 测试音频特效 ===")

    draft_id = "test_draft_audio_effect"

    # 列出可用特效
    result = list_available_effects("tone")
    print(f"列出音色特效: code={result['code']}")

    # 生成特效
    result = generate_audio_effect(
        draft_id=draft_id,
        audio_ids=["audio-001", "audio-002"],
        effect_type="大叔",
        segment_index=[1, 2],
        params=[50, 80]
    )
    print(f"生成特效: {result}")
    assert result["code"] == 0
    assert len(result["effect_ids"]) == 2

    # 获取缓存的特效ID
    effect_ids = get_audio_effect_ids(draft_id)
    print(f"缓存的特效ID: {effect_ids}")
    assert len(effect_ids) == 2

    # 获取特效详情
    details = get_audio_effect_details(draft_id)
    print(f"特效详情数量: {len(details)}")
    assert len(details) == 2
    assert details[0]["effect_type"] == "大叔"

    # 清除特效
    clear_audio_effects(draft_id)
    assert len(get_audio_effect_ids(draft_id)) == 0

    print("[PASS] 音频特效测试通过")


def test_keyframe():
    """测试关键帧生成和缓存"""
    print("\n=== 测试关键帧 ===")

    draft_id = "test_draft_keyframe"

    # 列出可用属性
    result = list_keyframe_properties()
    print(f"列出属性: {result}")

    # 生成视频关键帧
    result = generate_keyframe(
        draft_id=draft_id,
        segment_ids=["video-001"],
        segment_type="video",
        property="alpha",
        time_offset=[0, 2500000, 5000000],
        value=[1.0, 0.5, 0.0],
        segment_index=[1]
    )
    print(f"生成视频关键帧: {result}")
    assert result["code"] == 0
    assert len(result["keyframe_ids"]) == 3

    # 获取缓存的关键帧ID
    kf_ids = get_keyframe_ids(draft_id)
    print(f"缓存的关键帧ID数量: {len(kf_ids)}")
    assert len(kf_ids) == 3

    # 获取关键帧详情
    details = get_keyframe_details(draft_id)
    print(f"关键帧详情数量: {len(details)}")
    assert len(details) == 3

    # 生成音频关键帧
    result = generate_keyframe_for_audio(
        draft_id=draft_id,
        audio_ids=["audio-001"],
        time_offset=[0, 3000000],
        volume=[1.0, 0.5],
        segment_index=[1]
    )
    print(f"生成音频关键帧: {result}")
    assert result["code"] == 0

    # 获取音频关键帧缓存
    audio_kf_ids = get_audio_keyframe_ids(draft_id)
    print(f"缓存的音频关键帧ID数量: {len(audio_kf_ids)}")
    assert len(audio_kf_ids) == 2

    # 获取音频关键帧详情
    audio_details = get_audio_keyframe_details(draft_id)
    print(f"音频关键帧详情数量: {len(audio_details)}")
    assert len(audio_details) == 2

    # 清除关键帧
    clear_keyframes(draft_id)
    assert len(get_keyframe_ids(draft_id)) == 0

    clear_audio_keyframes(draft_id)
    assert len(get_audio_keyframe_ids(draft_id)) == 0

    print("[PASS] 关键帧测试通过")


def test_multiple_calls():
    """测试多次调用累积缓存"""
    print("\n=== 测试多次调用累积 ===")

    draft_id = "test_draft_multiple"

    # 第一次调用
    result1 = generate_video_effect(
        draft_id=draft_id,
        effect_type_name="模糊",
        segment_ids=["video-001"],
        segment_index=[1]
    )
    assert result1["code"] == 0

    # 第二次调用
    result2 = generate_video_effect(
        draft_id=draft_id,
        effect_type_name="锐化",
        segment_ids=["video-002"],
        segment_index=[2]
    )
    assert result2["code"] == 0

    # 验证累积
    effect_ids = get_video_effect_ids(draft_id)
    print(f"累积的特效ID数量: {len(effect_ids)}")
    assert len(effect_ids) == 2

    details = get_video_effect_details(draft_id)
    print(f"累积的特效详情数量: {len(details)}")
    assert len(details) == 2
    assert details[0]["effect_type"] == "模糊"
    assert details[1]["effect_type"] == "锐化"

    # 清理
    clear_video_effects(draft_id)

    print("[PASS] 多次调用累积测试通过")


def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("开始特效、滤镜、关键帧缓存功能测试")
    print("=" * 60)

    test_video_effect()
    test_video_filter()
    test_audio_effect()
    test_keyframe()
    test_multiple_calls()

    print("\n" + "=" * 60)
    print("[PASS] 所有测试通过!")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()