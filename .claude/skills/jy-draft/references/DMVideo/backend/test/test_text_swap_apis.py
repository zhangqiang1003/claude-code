# -*- coding: utf-8 -*-
"""
交换文本片段位置 API 测试用例

测试 swap_text_segment_position 和 move_text_segment 函数
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
_swap_mod = _load_module(
    "swap_text_segment_position",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "core", "draft", "populate", "swap_text_segment_position.py")
)
swap_text_segment_position = _swap_mod.swap_text_segment_position
move_text_segment = _swap_mod.move_text_segment


def _make_segments(count=3):
    """辅助函数：创建测试文本片段列表"""
    durations = [3000000, 5000000, 2000000, 4000000, 1000000]
    segments = []
    current = 0
    for i in range(count):
        dur = durations[i % len(durations)]
        segments.append({
            "id": f"t{i+1}",
            "content": f"文本{i+1}",
            "target_timerange": {"start": current, "duration": dur}
        })
        current += dur
    return json.dumps(segments, ensure_ascii=False)


# ==================== swap_text_segment_position 测试 ====================

def test_swap_basic():
    """测试基本交换"""
    print("=== 测试基本交换 ===")

    result = swap_text_segment_position(
        _make_segments(3),
        [{"source_index": 1, "swap_index": 3}]
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    # 顺序应为 t3, t2, t1
    assert segs[0]["id"] == "t3"
    assert segs[1]["id"] == "t2"
    assert segs[2]["id"] == "t1"

    print("[PASS] 基本交换通过")


def test_swap_time_recalculation():
    """测试交换后时间重新计算"""
    print("=== 测试交换后时间重新计算 ===")

    result = swap_text_segment_position(
        _make_segments(3),
        [{"source_index": 1, "swap_index": 3}]
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    # t3(2000000) + t2(5000000) + t1(3000000)
    assert segs[0]["target_timerange"]["start"] == 0
    assert segs[0]["target_timerange"]["duration"] == 2000000  # t3 的 duration
    assert segs[1]["target_timerange"]["start"] == 2000000
    assert segs[1]["target_timerange"]["duration"] == 5000000  # t2 的 duration
    assert segs[2]["target_timerange"]["start"] == 7000000
    assert segs[2]["target_timerange"]["duration"] == 3000000  # t1 的 duration

    print("[PASS] 时间重新计算通过")


def test_swap_with_offset():
    """测试带偏移起始时间的交换"""
    print("=== 测试带偏移起始时间 ===")

    result = swap_text_segment_position(
        _make_segments(3),
        [{"source_index": 1, "swap_index": 2}],
        1000000  # target_timerange_start
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    assert segs[0]["target_timerange"]["start"] == 1000000
    assert segs[1]["target_timerange"]["start"] == 1000000 + segs[0]["target_timerange"]["duration"]

    print("[PASS] 带偏移起始时间通过")


def test_swap_multiple():
    """测试多对交换"""
    print("=== 测试多对交换 ===")

    result = swap_text_segment_position(
        _make_segments(4),
        [
            {"source_index": 1, "swap_index": 2},
            {"source_index": 3, "swap_index": 4}
        ]
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    # 初始: t1,t2,t3,t4
    # swap(1,2): t2,t1,t3,t4
    # swap(3,4): t2,t1,t4,t3
    assert segs[0]["id"] == "t2"
    assert segs[1]["id"] == "t1"
    assert segs[2]["id"] == "t4"
    assert segs[3]["id"] == "t3"

    print("[PASS] 多对交换通过")


def test_swap_same_index():
    """测试交换相同索引（应跳过，不影响结果）"""
    print("=== 测试交换相同索引 ===")

    result = swap_text_segment_position(
        _make_segments(3),
        [{"source_index": 2, "swap_index": 2}]
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    # 顺序不变
    assert segs[0]["id"] == "t1"
    assert segs[1]["id"] == "t2"
    assert segs[2]["id"] == "t3"

    print("[PASS] 相同索引交换通过")


def test_swap_segment_ids():
    """测试返回正确的 segment_ids"""
    print("=== 测试 segment_ids ===")

    result = swap_text_segment_position(
        _make_segments(3),
        [{"source_index": 1, "swap_index": 3}]
    )

    assert result["code"] == 0
    assert result["segment_ids"] == ["t3", "t2", "t1"]

    print("[PASS] segment_ids 通过")


# ==================== swap 参数校验测试 ====================

def test_swap_validation_empty_infos():
    """测试空 text_infos"""
    print("=== 测试 swap 校验：空 text_infos ===")

    result = swap_text_segment_position("", [{"source_index": 1, "swap_index": 2}])
    assert result["code"] == -1

    print("[PASS] 空 text_infos 校验通过")


def test_swap_validation_empty_swap():
    """测试空 swap_position"""
    print("=== 测试 swap 校验：空 swap_position ===")

    result = swap_text_segment_position(_make_segments(3), [])
    assert result["code"] == -1

    print("[PASS] 空 swap_position 校验通过")


def test_swap_validation_invalid_json():
    """测试无效 JSON"""
    print("=== 测试 swap 校验：无效 JSON ===")

    result = swap_text_segment_position("not json", [{"source_index": 1, "swap_index": 2}])
    assert result["code"] == -1
    assert "JSON" in result["message"]

    print("[PASS] 无效 JSON 校验通过")


def test_swap_validation_missing_fields():
    """测试 swap_position 缺少必要字段"""
    print("=== 测试 swap 校验：缺少字段 ===")

    # 缺少 swap_index
    result = swap_text_segment_position(
        _make_segments(3),
        [{"source_index": 1}]
    )
    assert result["code"] == -1
    assert "缺少" in result["message"]

    # 缺少 source_index
    result = swap_text_segment_position(
        _make_segments(3),
        [{"swap_index": 2}]
    )
    assert result["code"] == -1

    print("[PASS] 缺少字段校验通过")


def test_swap_validation_out_of_range():
    """测试索引超出范围"""
    print("=== 测试 swap 校验：索引超出范围 ===")

    # source_index = 0
    result = swap_text_segment_position(
        _make_segments(3),
        [{"source_index": 0, "swap_index": 2}]
    )
    assert result["code"] == -1
    assert "超出范围" in result["message"]

    # swap_index = 5
    result = swap_text_segment_position(
        _make_segments(3),
        [{"source_index": 1, "swap_index": 5}]
    )
    assert result["code"] == -1

    print("[PASS] 索引超出范围校验通过")


def test_swap_validation_too_few_segments():
    """测试片段数量不足"""
    print("=== 测试 swap 校验：片段不足 ===")

    result = swap_text_segment_position(
        json.dumps([{"id": "only-one"}]),
        [{"source_index": 1, "swap_index": 2}]
    )
    assert result["code"] == -1
    assert "少于 2" in result["message"]

    print("[PASS] 片段不足校验通过")


def test_swap_validation_non_int_index():
    """测试非整数索引"""
    print("=== 测试 swap 校验：非整数索引 ===")

    result = swap_text_segment_position(
        _make_segments(3),
        [{"source_index": 1.5, "swap_index": 2}]
    )
    assert result["code"] == -1
    assert "整数" in result["message"]

    print("[PASS] 非整数索引校验通过")


def test_swap_validation_non_dict_swap():
    """测试非对象类型的交换配置"""
    print("=== 测试 swap 校验：非对象类型 ===")

    result = swap_text_segment_position(
        _make_segments(3),
        ["not a dict"]
    )
    assert result["code"] == -1
    assert "不是有效的对象" in result["message"]

    print("[PASS] 非对象类型校验通过")


# ==================== move_text_segment 测试 ====================

def test_move_forward():
    """测试向前移动片段（后移）"""
    print("=== 测试向前移动 ===")

    # t1,t2,t3 → t2,t3,t1（t1 从位置 1 移到 3）
    result = move_text_segment(_make_segments(3), 1, 3)

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    assert segs[0]["id"] == "t2"
    assert segs[1]["id"] == "t3"
    assert segs[2]["id"] == "t1"

    # 时间连续
    assert segs[0]["target_timerange"]["start"] == 0
    assert segs[1]["target_timerange"]["start"] == segs[0]["target_timerange"]["duration"]
    assert segs[2]["target_timerange"]["start"] == segs[0]["target_timerange"]["duration"] + segs[1]["target_timerange"]["duration"]

    print("[PASS] 向前移动通过")


def test_move_backward():
    """测试向后移动片段（前移）"""
    print("=== 测试向后移动 ===")

    # t1,t2,t3 → t3,t1,t2（t3 从位置 3 移到 1）
    result = move_text_segment(_make_segments(3), 3, 1)

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    assert segs[0]["id"] == "t3"
    assert segs[1]["id"] == "t1"
    assert segs[2]["id"] == "t2"

    print("[PASS] 向后移动通过")


def test_move_same_position():
    """测试移动到相同位置（原地不动）"""
    print("=== 测试移动到相同位置 ===")

    result = move_text_segment(_make_segments(3), 2, 2)

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    # 顺序不变
    assert segs[0]["id"] == "t1"
    assert segs[1]["id"] == "t2"
    assert segs[2]["id"] == "t3"

    print("[PASS] 相同位置移动通过")


def test_move_with_offset():
    """测试带偏移起始时间的移动"""
    print("=== 测试带偏移起始时间的移动 ===")

    result = move_text_segment(
        _make_segments(3),
        1, 3,
        5000000  # target_timerange_start
    )

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    assert segs[0]["target_timerange"]["start"] == 5000000

    print("[PASS] 带偏移移动通过")


def test_move_multiple_segments():
    """测试在多片段列表中移动"""
    print("=== 测试多片段列表中移动 ===")

    result = move_text_segment(_make_segments(5), 1, 5)

    assert result["code"] == 0
    segs = json.loads(result["text_infos"])

    # t2,t3,t4,t5,t1
    assert segs[0]["id"] == "t2"
    assert segs[1]["id"] == "t3"
    assert segs[2]["id"] == "t4"
    assert segs[3]["id"] == "t5"
    assert segs[4]["id"] == "t1"

    # 验证时间连续
    current = 0
    for seg in segs:
        assert seg["target_timerange"]["start"] == current
        current += seg["target_timerange"]["duration"]

    print("[PASS] 多片段移动通过")


def test_move_segment_ids():
    """测试移动后返回正确的 segment_ids"""
    print("=== 测试 move segment_ids ===")

    result = move_text_segment(_make_segments(3), 1, 3)

    assert result["code"] == 0
    assert result["segment_ids"] == ["t2", "t3", "t1"]

    print("[PASS] move segment_ids 通过")


# ==================== move 参数校验测试 ====================

def test_move_validation_empty_infos():
    """测试空 text_infos"""
    print("=== 测试 move 校验：空 text_infos ===")

    result = move_text_segment("", 1, 2)
    assert result["code"] == -1

    print("[PASS] 空 text_infos 校验通过")


def test_move_validation_invalid_json():
    """测试无效 JSON"""
    print("=== 测试 move 校验：无效 JSON ===")

    result = move_text_segment("not json", 1, 2)
    assert result["code"] == -1
    assert "JSON" in result["message"]

    print("[PASS] 无效 JSON 校验通过")


def test_move_validation_out_of_range():
    """测试索引超出范围"""
    print("=== 测试 move 校验：索引超出范围 ===")

    # from_index = 0
    result = move_text_segment(_make_segments(3), 0, 2)
    assert result["code"] == -1
    assert "超出范围" in result["message"]

    # to_index = 5
    result = move_text_segment(_make_segments(3), 1, 5)
    assert result["code"] == -1

    print("[PASS] 索引超出范围校验通过")


def test_move_validation_too_few():
    """测试片段数量不足"""
    print("=== 测试 move 校验：片段不足 ===")

    result = move_text_segment(json.dumps([{"id": "only"}]), 1, 2)
    assert result["code"] == -1
    assert "少于 2" in result["message"]

    print("[PASS] 片段不足校验通过")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("开始运行交换文本片段位置 API 测试")
    print("=" * 50 + "\n")

    try:
        # swap 功能测试
        test_swap_basic()
        test_swap_time_recalculation()
        test_swap_with_offset()
        test_swap_multiple()
        test_swap_same_index()
        test_swap_segment_ids()

        # swap 校验测试
        test_swap_validation_empty_infos()
        test_swap_validation_empty_swap()
        test_swap_validation_invalid_json()
        test_swap_validation_missing_fields()
        test_swap_validation_out_of_range()
        test_swap_validation_too_few_segments()
        test_swap_validation_non_int_index()
        test_swap_validation_non_dict_swap()

        # move 功能测试
        test_move_forward()
        test_move_backward()
        test_move_same_position()
        test_move_with_offset()
        test_move_multiple_segments()
        test_move_segment_ids()

        # move 校验测试
        test_move_validation_empty_infos()
        test_move_validation_invalid_json()
        test_move_validation_out_of_range()
        test_move_validation_too_few()

        print("\n" + "=" * 50)
        print("所有测试通过!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()
