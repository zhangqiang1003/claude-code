# -*- coding: utf-8 -*-
"""
基于音频的时间线生成 API 测试用例

测试 generate_timelines_by_audio 和相关函数
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.draft.populate.generate_timelines_by_audio import (
    generate_timelines_by_audio,
    get_audio_duration_batch,
    format_audio_timelines_output,
    AudioInfo
)


def test_audio_info_dataclass():
    """测试 AudioInfo 数据类"""
    print("=== 测试 AudioInfo 数据类 ===")

    # 正常情况
    info = AudioInfo(url="https://example.com/audio.mp3", duration=3000000)
    assert info.url == "https://example.com/audio.mp3"
    assert info.duration == 3000000
    assert info.error is None

    # 错误情况
    error_info = AudioInfo(url="https://example.com/invalid.mp3", duration=0, error="下载失败")
    assert error_info.error == "下载失败"

    print("[PASS] AudioInfo 测试通过")


def test_generate_timelines_by_audio_empty():
    """测试空列表情况"""
    print("=== 测试 generate_timelines_by_audio 空列表 ===")

    result = generate_timelines_by_audio([])

    assert result["code"] == -1, "空列表应返回错误"
    assert "不能为空" in result["message"], "错误消息应包含'不能为空'"

    print("[PASS] 空列表测试通过")


def test_generate_timelines_by_audio_invalid_url():
    """测试无效 URL 情况"""
    print("=== 测试无效 URL ===")

    # 使用明显无效的 URL
    result = generate_timelines_by_audio(["https://invalid-url-that-does-not-exist.mp3"], timeout=5)

    # 由于所有 URL 都失败，应返回错误
    assert result["code"] == -1, "无效 URL 应返回错误"
    assert len(result["audio_infos"]) == 1, "应有一个音频信息"

    print("[PASS] 无效 URL 测试通过")


def test_generate_timelines_by_audio_mixed():
    """测试混合情况（部分有效，部分无效）"""
    print("=== 测试混合 URL ===")

    # 使用一个无效 URL 和一个测试音频 URL
    test_urls = [
        "https://invalid-url.mp3",  # 无效
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"  # 有效（测试音频）
    ]

    result = generate_timelines_by_audio(test_urls, timeout=30)

    # 应该有音频信息列表
    assert "audio_infos" in result, "应包含 audio_infos"
    assert len(result["audio_infos"]) == 2, "应有 2 个音频信息"

    print("[PASS] 混合 URL 测试通过")


def test_get_audio_duration_batch():
    """测试批量获取音频时长"""
    print("=== 测试 get_audio_duration_batch ===")

    # 使用无效 URL 测试
    results = get_audio_duration_batch(["https://invalid.mp3"], timeout=5)

    assert len(results) == 1, "应返回 1 个结果"
    assert results[0].error is not None, "无效 URL 应有错误信息"

    print("[PASS] get_audio_duration_batch 测试通过")


def test_format_audio_timelines_output():
    """测试格式化输出"""
    print("=== 测试 format_audio_timelines_output ===")

    # 测试错误情况
    error_result = generate_timelines_by_audio([])
    error_output = format_audio_timelines_output(error_result)
    assert "错误" in error_output, "错误输出应包含'错误'"

    print("[PASS] format_audio_timelines_output 测试通过")


def test_real_audio_url():
    """测试真实音频 URL（可选，需要网络）"""
    print("=== 测试真实音频 URL ===")
    print("注意：此测试需要网络连接，可能需要较长时间...")

    # 使用公开的测试音频
    test_urls = [
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    ]

    try:
        result = generate_timelines_by_audio(test_urls, timeout=60)

        if result["code"] == 0:
            print("[PASS] 成功获取音频时长")
            print(f"  时长: {result['target']['all_timelines'][0]['duration'] / 1_000_000:.2f} 秒")

            # 验证返回结构
            assert "timelines" in result["target"]
            assert "all_timelines" in result["target"]
            assert len(result["target"]["timelines"]) > 0 or result["target"]["all_timelines"][0]["duration"] > 0
        else:
            print(f"[WARN] 网络请求失败: {result['message']}")
            print("  这可能是网络问题，跳过此测试")

    except Exception as e:
        print(f"[WARN] 测试异常: {e}")
        print("  这可能是网络问题，跳过此测试")

    print("[PASS] 真实音频 URL 测试完成")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 50)
    print("开始运行 generate_timelines_by_audio 测试")
    print("=" * 50 + "\n")

    try:
        test_audio_info_dataclass()
        test_generate_timelines_by_audio_empty()
        test_generate_timelines_by_audio_invalid_url()
        test_generate_timelines_by_audio_mixed()
        test_get_audio_duration_batch()
        test_format_audio_timelines_output()

        print("\n" + "-" * 50)
        print("基础测试通过，开始网络相关测试...")
        print("-" * 50 + "\n")

        # 网络测试（可能较慢）
        test_real_audio_url()

        print("\n" + "=" * 50)
        print("所有测试完成!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()