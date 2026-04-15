"""
时间线分段生成 API

根据输入的时长分段，自动计算并生成时间线。
"""

from typing import List, Dict, Any


def generate_timelines(timeline_segment: List[int] | List[Dict[str, int]]) -> Dict[str, Any]:
    """
    根据时长分段自动生成时间线 /根据开始结束时间点自动生成时间线（总时间线等于  最后一个 元素的end_time 减去 第一个元素的  begin_time）

    Args:
        timeline_segment: 时间线分段列表，每个元素为时长（单位：微秒）
                         例如: [3000000, 7000000, 2000000] 表示三个分段，时长分别为 3秒、7秒、2秒
                         或
                         [{"begin_time": 2300000, "end_time": 4600000},{"begin_time": 5300000, "end_time": 6700000}],
                         表示两段，时长分别是 4600000-2300000 和 6700000-5300000

    Returns:
        包含时间线信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - target: 响应数据
            - all_timelines: 总时间线数组（包含 start 和 duration）
            - timelines: 分段时间线数组（每个分段包含 start 和 duration）

    Example1:
        >>> result = generate_timelines([3000000, 7000000, 2000000])
        >>> print(result['target']['timelines'])
        [{'start': 0, 'duration': 3000000}, {'start': 3000000, 'duration': 7000000}, {'start': 10000000, 'duration': 2000000}]

    Example2:
        >>> result = generate_timelines([{"begin_time": 2300000, "end_time": 4600000},{"begin_time": 5300000, "end_time": 6700000}])
        >>> print(result['target']['timelines'])
        [{'start': 2300000, 'duration': 2300000}, {'start': 5300000, 'duration': 1400000}]
    """
    if not timeline_segment:
        return {
            "code": -1,
            "message": "时间线分段列表不能为空",
            "target": {
                "all_timelines": [],
                "timelines": []
            }
        }

    timelines = []

    # 判断输入类型：字典列表（begin_time/end_time）还是整数列表（时长）
    first = timeline_segment[0]
    if isinstance(first, dict):
        # 模式2：根据 begin_time / end_time 生成时间线
        for seg in timeline_segment:
            begin_time = seg.get("begin_time", 0)
            end_time = seg.get("end_time", 0)
            duration = end_time - begin_time

            if duration < 0:
                return {
                    "code": -1,
                    "message": f"时间段无效，end_time({end_time}) 小于 begin_time({begin_time})",
                    "target": {
                        "all_timelines": [],
                        "timelines": []
                    }
                }

            timelines.append({
                "start": begin_time,
                "duration": duration
            })

        # 总时间线：从第一个分段的 begin_time 到最后一个分段的 end_time
        first_begin = timeline_segment[0].get("begin_time", 0)
        last_end = timeline_segment[-1].get("end_time", 0)
        all_timelines = [{
            "start": first_begin,
            "duration": last_end - first_begin
        }]
    else:
        # 模式1：根据时长分段，从 0 开始累加
        current_start = 0
        total_duration = 0

        for duration in timeline_segment:
            if duration < 0:
                return {
                    "code": -1,
                    "message": f"时长不能为负数: {duration}",
                    "target": {
                        "all_timelines": [],
                        "timelines": []
                    }
                }

            timelines.append({
                "start": current_start,
                "duration": duration
            })
            current_start += duration
            total_duration += duration

        all_timelines = [{
            "start": 0,
            "duration": total_duration
        }]

    return {
        "code": 0,
        "message": "成功",
        "target": {
            "all_timelines": all_timelines,
            "timelines": timelines
        }
    }


def get_total_duration(timeline_segment: List[int]) -> int:
    """
    获取时间线总时长

    Args:
        timeline_segment: 时间线分段列表（微秒）

    Returns:
        总时长（微秒）
    """
    return sum(timeline_segment)


def format_timeline_output(result: Dict[str, Any]) -> str:
    """
    格式化时间线输出为可读字符串

    Args:
        result: generate_timelines 返回的结果

    Returns:
        格式化后的字符串
    """
    if result["code"] != 0:
        return f"错误: {result['message']}"

    timelines = result["target"]["timelines"]
    total = result["target"]["all_timelines"][0]

    lines = [f"总时长: {total['duration'] / 1_000_000:.2f} 秒"]
    lines.append("分段详情:")

    for i, segment in enumerate(timelines, 1):
        start_sec = segment['start'] / 1_000_000
        duration_sec = segment['duration'] / 1_000_000
        lines.append(f"  分段 {i}: 开始 {start_sec:.2f}s, 时长 {duration_sec:.2f}s")

    return "\n".join(lines)


if __name__ == "__main__":
    # 测试示例
    print("=== 模式1: 时长分段 ===")
    test_segments = [3000000, 7000000, 200000, 4000000]
    result = generate_timelines(test_segments)
    print(format_timeline_output(result))

    print("\n=== 模式2: begin_time/end_time ===")
    test_segments2 = [
        {"begin_time": 2300000, "end_time": 4600000},
        {"begin_time": 5300000, "end_time": 6700000}
    ]
    result2 = generate_timelines(test_segments2)
    print(format_timeline_output(result2))
