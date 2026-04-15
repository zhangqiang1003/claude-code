# -*- coding: utf-8 -*-
"""
时间线生成 API 测试用例

测试 generate_timelines 和相关函数
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.draft.populate.generate_timelines import (
    generate_timelines,
    get_total_duration,
    format_timeline_output
)


def test_generate_timelines_basic():
    """测试基础时间线生成"""
    print("=== 测试 generate_timelines 基础功能 ===")

    # 测试正常情况
    result = generate_timelines([3000000, 7000000, 2000000])

    assert result["code"] == 0, "状态码应为 0"
    assert result["message"] == "成功", "消息应为'成功'"
    assert len(result["target"]["timelines"]) == 3, "应有 3 个分段"

    # 验证分段数据
    timelines = result["target"]["timelines"]
    assert timelines[0]["start"] == 0, "第一个分段开始应为 0"
    assert timelines[0]["duration"] == 3000000, "第一个分段时长应为 3000000"

    assert timelines[1]["start"] == 3000000, "第二个分段开始应为 3000000"
    assert timelines[1]["duration"] == 7000000, "第二个分段时长应为 7000000"

    assert timelines[2]["start"] == 10000000, "第三个分段开始应为 10000000"
    assert timelines[2]["duration"] == 2000000, "第三个分段时长应为 2000000"

    # 验证总时间线
    all_timelines = result["target"]["all_timelines"]
    assert all_timelines[0]["start"] == 0, "总时间线开始应为 0"
    assert all_timelines[0]["duration"] == 12000000, "总时长应为 12000000"

    print("[PASS] 基础功能测试通过")


def test_generate_timelines_empty():
    """测试空列表情况"""
    print("=== 测试空列表情况 ===")

    result = generate_timelines([])

    assert result["code"] == -1, "空列表应返回错误"
    assert "不能为空" in result["message"], "错误消息应包含'不能为空'"

    print("[PASS] 空列表测试通过")


def test_generate_timelines_negative():
    """测试负数情况"""
    print("=== 测试负数情况 ===")

    result = generate_timelines([3000000, -1000000, 2000000])

    assert result["code"] == -1, "负数应返回错误"
    assert "负数" in result["message"], "错误消息应包含'负数'"

    print("[PASS] 负数测试通过")


def test_generate_timelines_single():
    """测试单个分段"""
    print("=== 测试单个分段 ===")

    result = generate_timelines([5000000])

    assert result["code"] == 0, "状态码应为 0"
    assert len(result["target"]["timelines"]) == 1, "应有 1 个分段"
    assert result["target"]["timelines"][0]["start"] == 0, "开始应为 0"
    assert result["target"]["timelines"][0]["duration"] == 5000000, "时长应为 5000000"

    print("[PASS] 单个分段测试通过")


def test_get_total_duration():
    """测试获取总时长"""
    print("=== 测试 get_total_duration ===")

    # 正常情况
    total = get_total_duration([3000000, 7000000, 2000000])
    assert total == 12000000, "总时长应为 12000000"

    # 空列表
    total = get_total_duration([])
    assert total == 0, "空列表总时长应为 0"

    print("[PASS] get_total_duration 测试通过")


def test_format_timeline_output():
    """测试格式化输出"""
    print("=== 测试 format_timeline_output ===")

    # 正常情况
    result = generate_timelines([3000000, 7000000, 2000000])
    output = format_timeline_output(result)

    assert "总时长" in output, "输出应包含'总时长'"
    assert "分段详情" in output, "输出应包含'分段详情'"
    assert "3.00" in output, "输出应包含'3.00'"

    # 错误情况
    error_result = generate_timelines([])
    error_output = format_timeline_output(error_result)
    assert "错误" in error_output, "错误输出应包含'错误'"

    print("[PASS] format_timeline_output 测试通过")


def test_generate_timelines_begin_end_time():
    """测试 begin_time/end_time 模式"""
    print("=== 测试 begin_time/end_time 模式 ===")

    result = generate_timelines([
        {"begin_time": 2300000, "end_time": 4600000},
        {"begin_time": 5300000, "end_time": 6700000},
    ])

    assert result["code"] == 0, "状态码应为 0"
    timelines = result["target"]["timelines"]
    assert len(timelines) == 2, "应有 2 个分段"

    assert timelines[0]["start"] == 2300000, "第一段开始应为 2300000"
    assert timelines[0]["duration"] == 2300000, "第一段时长应为 2300000"

    assert timelines[1]["start"] == 5300000, "第二段开始应为 5300000"
    assert timelines[1]["duration"] == 1400000, "第二段时长应为 1400000"

    # 总时间线：首段 begin_time 到末段 end_time
    all_tl = result["target"]["all_timelines"]
    assert all_tl[0]["start"] == 2300000, "总时间线开始应为 2300000"
    assert all_tl[0]["duration"] == 4400000, "总时间线时长应为 4400000"

    print("[PASS] begin_time/end_time 模式测试通过")


def test_generate_timelines_begin_end_time_single():
    """测试 begin_time/end_time 单段"""
    print("=== 测试 begin_time/end_time 单段 ===")

    result = generate_timelines([{"begin_time": 1000000, "end_time": 5000000}])

    assert result["code"] == 0, "状态码应为 0"
    timelines = result["target"]["timelines"]
    assert len(timelines) == 1, "应有 1 个分段"
    assert timelines[0]["start"] == 1000000, "开始应为 1000000"
    assert timelines[0]["duration"] == 4000000, "时长应为 4000000"

    all_tl = result["target"]["all_timelines"]
    assert all_tl[0]["start"] == 1000000, "总时间线开始应为 1000000"
    assert all_tl[0]["duration"] == 4000000, "总时间线时长应为 4000000"

    print("[PASS] begin_time/end_time 单段测试通过")


def test_generate_timelines_begin_end_time_invalid():
    """测试 begin_time/end_time 无效数据（end < begin）"""
    print("=== 测试 begin_time/end_time 无效数据 ===")

    result = generate_timelines([{"begin_time": 5000000, "end_time": 2000000}])

    assert result["code"] == -1, "无效数据应返回错误"
    assert "无效" in result["message"], "错误消息应包含'无效'"

    print("[PASS] begin_time/end_time 无效数据测试通过")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("开始运行 generate_timelines 测试")
    print("=" * 50 + "\n")

    try:
        test_generate_timelines_basic()
        test_generate_timelines_empty()
        test_generate_timelines_negative()
        test_generate_timelines_single()
        test_generate_timelines_begin_end_time()
        test_generate_timelines_begin_end_time_single()
        test_generate_timelines_begin_end_time_invalid()
        test_get_total_duration()
        test_format_timeline_output()

        print("\n" + "=" * 50)
        print("所有测试通过!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()