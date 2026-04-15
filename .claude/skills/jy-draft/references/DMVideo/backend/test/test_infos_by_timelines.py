# -*- coding: utf-8 -*-
"""
text_infos_by_timelines 和 video_infos_by_timelines 测试用例
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
_text_tl_mod = _load_module(
    "text_infos_by_timelines",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "core", "draft", "populate", "text_infos_by_timelines.py")
)
text_infos_by_timelines = _text_tl_mod.text_infos_by_timelines

_video_tl_mod = _load_module(
    "video_infos_by_timelines",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "core", "draft", "populate", "video_infos_by_timelines.py")
)
video_infos_by_timelines = _video_tl_mod.video_infos_by_timelines
video_infos_by_timelines_simple = _video_tl_mod.video_infos_by_timelines_simple


# ==================== text_infos_by_timelines 测试 ====================

def test_text_tl_basic():
    """测试基本创建"""
    print("=== 测试文本基本创建 ===")

    result = text_infos_by_timelines(
        timelines=[{"start": 0, "duration": 5000000}, {"start": 5000000, "duration": 3000000}],
        texts=["第一段", "第二段"]
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert len(segs) == 2
    assert segs[0]["content"] == "第一段"
    assert segs[0]["target_timerange"]["start"] == 0
    assert segs[0]["target_timerange"]["duration"] == 5000000
    assert segs[1]["content"] == "第二段"
    assert len(result["segment_ids"]) == 2

    print("[PASS] 文本基本创建通过")


def test_text_tl_field_names():
    """测试输出字段名与 segment 格式对齐"""
    print("=== 测试文本输出字段名 ===")

    result = text_infos_by_timelines(
        timelines=[{"start": 0, "duration": 5000000}],
        texts=["测试"]
    )

    assert result["code"] == 0
    seg = json.loads(result["text_infos"])[0]

    # 必须是 content（不是 text）
    assert "content" in seg
    assert "text" not in seg

    # 必须是 target_timerange（不是 timerange）
    assert "target_timerange" in seg
    assert "timerange" not in seg

    print("[PASS] 文本输出字段名对齐通过")


def test_text_tl_url_reuse():
    """测试 URL 不足时循环使用"""
    print("=== 测试文本循环使用 ===")

    result = text_infos_by_timelines(
        timelines=[
            {"start": 0, "duration": 3000000},
            {"start": 3000000, "duration": 5000000},
            {"start": 8000000, "duration": 2000000}
        ],
        texts=["只有一段"]
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])
    assert len(segs) == 3
    # 所有片段使用同一段文本
    assert segs[0]["content"] == "只有一段"
    assert segs[1]["content"] == "只有一段"
    assert segs[2]["content"] == "只有一段"

    print("[PASS] 文本循环使用通过")


def test_text_tl_validation_empty_timelines():
    """测试空时间线"""
    print("=== 测试文本校验：空时间线 ===")

    result = text_infos_by_timelines([], ["文本"])
    assert result["code"] == -1

    print("[PASS] 空时间线校验通过")


def test_text_tl_validation_empty_texts():
    """测试空文本列表"""
    print("=== 测试文本校验：空文本列表 ===")

    result = text_infos_by_timelines([{"start": 0, "duration": 5000000}], [])
    assert result["code"] == -1

    print("[PASS] 空文本列表校验通过")


def test_text_tl_validation_missing_fields():
    """测试时间线缺少字段"""
    print("=== 测试文本校验：缺少字段 ===")

    # 缺少 duration
    result = text_infos_by_timelines([{"start": 0}], ["文本"])
    assert result["code"] == -1
    assert "缺少" in result["message"]

    # 缺少 start
    result = text_infos_by_timelines([{"duration": 5000000}], ["文本"])
    assert result["code"] == -1

    print("[PASS] 时间线缺少字段校验通过")


def test_text_tl_validation_non_dict():
    """测试非字典类型的时间线"""
    print("=== 测试文本校验：非字典类型 ===")

    result = text_infos_by_timelines(["not a dict"], ["文本"])
    assert result["code"] == -1

    print("[PASS] 非字典类型校验通过")


def test_text_tl_segment_ids_unique():
    """测试 segment_ids 唯一性"""
    print("=== 测试文本 segment_ids 唯一 ===")

    result = text_infos_by_timelines(
        timelines=[
            {"start": 0, "duration": 3000000},
            {"start": 3000000, "duration": 5000000}
        ],
        texts=["A", "B"]
    )

    assert result["code"] == 0
    assert len(result["segment_ids"]) == 2
    assert result["segment_ids"][0] != result["segment_ids"][1]

    print("[PASS] segment_ids 唯一性通过")


# ==================== video_infos_by_timelines 测试 ====================

def test_video_tl_basic():
    """测试基本创建"""
    print("=== 测试视频基本创建 ===")

    result = video_infos_by_timelines(
        timelines=[{"start": 0, "duration": 5000000}, {"start": 5000000, "duration": 3000000}],
        video_urls=["https://example.com/a.mp4", "https://example.com/b.mp4"]
    )

    assert result["code"] == 0
    segs = json.loads(result["video_infos"])
    assert len(segs) == 2

    assert segs[0]["material_url"] == "https://example.com/a.mp4"
    assert segs[0]["target_timerange"]["start"] == 0
    assert segs[0]["target_timerange"]["duration"] == 5000000
    assert segs[0]["source_timerange"]["start"] == 0
    assert segs[0]["source_timerange"]["duration"] == 5000000

    assert segs[1]["material_url"] == "https://example.com/b.mp4"
    assert segs[1]["target_timerange"]["start"] == 5000000

    print("[PASS] 视频基本创建通过")


def test_video_tl_field_names():
    """测试输出字段名与 segment 格式对齐"""
    print("=== 测试视频输出字段名 ===")

    result = video_infos_by_timelines(
        timelines=[{"start": 0, "duration": 5000000}],
        video_urls=["https://example.com/a.mp4"]
    )

    assert result["code"] == 0
    seg = json.loads(result["video_infos"])[0]

    # 必须有 material_url（不是 video_url）
    assert "material_url" in seg
    assert "video_url" not in seg
    # 必须有 target_timerange 和 source_timerange
    assert "target_timerange" in seg
    assert "source_timerange" in seg

    print("[PASS] 视频输出字段名对齐通过")


def test_video_tl_url_reuse():
    """测试 URL 不足时循环使用"""
    print("=== 测试视频循环使用 URL ===")

    result = video_infos_by_timelines(
        timelines=[
            {"start": 0, "duration": 3000000},
            {"start": 3000000, "duration": 5000000},
            {"start": 8000000, "duration": 2000000}
        ],
        video_urls=["https://example.com/only.mp4"]
    )

    assert result["code"] == 0
    segs = json.loads(result["video_infos"])
    assert len(segs) == 3
    assert segs[0]["material_url"] == "https://example.com/only.mp4"
    assert segs[1]["material_url"] == "https://example.com/only.mp4"
    assert segs[2]["material_url"] == "https://example.com/only.mp4"

    print("[PASS] 视频 URL 循环使用通过")


def test_video_tl_validation():
    """测试参数校验"""
    print("=== 测试视频参数校验 ===")

    # 空时间线
    result = video_infos_by_timelines([], ["url"])
    assert result["code"] == -1

    # 空 URL
    result = video_infos_by_timelines([{"start": 0, "duration": 5000000}], [])
    assert result["code"] == -1

    # 缺少字段
    result = video_infos_by_timelines([{"start": 0}], ["url"])
    assert result["code"] == -1

    # 非字典类型
    result = video_infos_by_timelines(["not dict"], ["url"])
    assert result["code"] == -1

    print("[PASS] 视频参数校验通过")


def test_video_tl_segment_ids():
    """测试 segment_ids"""
    print("=== 测试视频 segment_ids ===")

    result = video_infos_by_timelines(
        timelines=[{"start": 0, "duration": 3000000}, {"start": 3000000, "duration": 5000000}],
        video_urls=["https://a.mp4", "https://b.mp4"]
    )

    assert result["code"] == 0
    assert len(result["segment_ids"]) == 2
    assert result["segment_ids"][0] != result["segment_ids"][1]

    # segment_ids 与 video_infos 中的 id 一致
    segs = json.loads(result["video_infos"])
    assert segs[0]["id"] == result["segment_ids"][0]
    assert segs[1]["id"] == result["segment_ids"][1]

    print("[PASS] 视频 segment_ids 通过")


# ==================== video_infos_by_timelines_simple 测试 ====================

def test_video_tl_simple_basic():
    """测试简单模式基本创建"""
    print("=== 测试视频简单模式 ===")

    result = video_infos_by_timelines_simple(
        timeline_segments=[3000000, 5000000, 2000000],
        video_urls=["https://example.com/video.mp4"]
    )

    assert result["code"] == 0
    segs = json.loads(result["video_infos"])
    assert len(segs) == 3

    # 自动计算 start
    assert segs[0]["target_timerange"]["start"] == 0
    assert segs[0]["target_timerange"]["duration"] == 3000000
    assert segs[1]["target_timerange"]["start"] == 3000000
    assert segs[1]["target_timerange"]["duration"] == 5000000
    assert segs[2]["target_timerange"]["start"] == 8000000
    assert segs[2]["target_timerange"]["duration"] == 2000000

    print("[PASS] 视频简单模式通过")


def test_video_tl_simple_with_offset():
    """测试带偏移的简单模式"""
    print("=== 测试视频简单模式带偏移 ===")

    result = video_infos_by_timelines_simple(
        timeline_segments=[3000000, 5000000],
        video_urls=["https://example.com/video.mp4"],
        start_offset=1000000
    )

    assert result["code"] == 0
    segs = json.loads(result["video_infos"])
    assert segs[0]["target_timerange"]["start"] == 1000000
    assert segs[1]["target_timerange"]["start"] == 1000000 + 3000000

    print("[PASS] 视频简单模式带偏移通过")


def test_video_tl_simple_validation():
    """测试简单模式校验"""
    print("=== 测试视频简单模式校验 ===")

    # 空参数
    result = video_infos_by_timelines_simple([], ["url"])
    assert result["code"] == -1

    # 负时长
    result = video_infos_by_timelines_simple([-1], ["url"])
    assert result["code"] == -1

    print("[PASS] 视频简单模式校验通过")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("开始运行 text_infos_by_timelines 和 video_infos_by_timelines 测试")
    print("=" * 50 + "\n")

    try:
        # text_infos_by_timelines 测试
        test_text_tl_basic()
        test_text_tl_field_names()
        test_text_tl_url_reuse()
        test_text_tl_validation_empty_timelines()
        test_text_tl_validation_empty_texts()
        test_text_tl_validation_missing_fields()
        test_text_tl_validation_non_dict()
        test_text_tl_segment_ids_unique()

        # video_infos_by_timelines 测试
        test_video_tl_basic()
        test_video_tl_field_names()
        test_video_tl_url_reuse()
        test_video_tl_validation()
        test_video_tl_segment_ids()

        # video_infos_by_timelines_simple 测试
        test_video_tl_simple_basic()
        test_video_tl_simple_with_offset()
        test_video_tl_simple_validation()

        print("\n" + "=" * 50)
        print("所有测试通过!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()
