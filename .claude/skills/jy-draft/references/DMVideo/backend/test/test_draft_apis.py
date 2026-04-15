# -*- coding: utf-8 -*-
"""
草稿管理 API 测试用例

测试 generate 模块下的所有 API
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.draft.generate import (
    create_draft,
    check_draft_exists,
    get_draft_template,
    delete_draft,
    add_videos,
    get_video_tracks,
    add_audios,
    get_audio_tracks,
    add_texts,
    get_text_tracks,
    add_stickers,
    get_sticker_tracks,
    add_video_effects,
    get_video_effects,
    add_video_filters,
    get_video_filters,
    add_audio_effects,
    get_audio_effects,
    add_keyframes,
    get_keyframes,
    add_audio_keyframes,
    get_audio_keyframes,
    save_draft,
    get_draft_info,
    generate_template,
    draft_cache
)


def test_create_draft():
    """测试创建草稿"""
    print("\n=== 测试创建草稿 ===")

    # 正常创建
    result = create_draft(1920, 1080)
    print(f"创建 1920x1080 草稿: {result}")
    assert result["code"] == 0
    assert "draft_id" in result
    assert len(result["draft_id"]) == 32  # UUID hex 长度

    # 创建竖屏草稿
    result2 = create_draft(1080, 1920)
    print(f"创建 1080x1920 草稿: {result2}")
    assert result2["code"] == 0

    # 测试无效参数
    result3 = create_draft(0, 1080)
    print(f"无效宽度: {result3}")
    assert result3["code"] == -1

    result4 = create_draft(1920, -100)
    print(f"无效高度: {result4}")
    assert result4["code"] == -1

    print("[PASS] 创建草稿测试通过")
    return result["draft_id"]


def test_check_and_get_draft(draft_id: str):
    """测试检查草稿存在和获取模板"""
    print("\n=== 测试检查草稿和获取模板 ===")

    # 检查存在
    exists = check_draft_exists(draft_id)
    print(f"草稿存在: {exists}")
    assert exists is True

    # 获取模板
    template = get_draft_template(draft_id)
    print(f"模板信息: {template}")
    assert template["width"] == 1920
    assert template["height"] == 1080

    # 检查不存在的草稿
    exists_fake = check_draft_exists("not_exist_id")
    print(f"不存在草稿检查: {exists_fake}")
    assert exists_fake is False

    print("[PASS] 检查草稿和获取模板测试通过")


def test_add_videos(draft_id: str):
    """测试添加视频"""
    print("\n=== 测试添加视频 ===")

    video_infos = '''[
        {
            "material_id": "video_001",
            "material_url": "https://example.com/video1.mp4",
            "target_timerange": {"start": 0, "duration": 5000000},
            "source_timerange": {"start": 0, "duration": 5000000}
        },
        {
            "material_id": "video_002",
            "material_url": "https://example.com/video2.mp4",
            "target_timerange": {"start": 5000000, "duration": 3000000},
            "source_timerange": {"start": 0, "duration": 3000000}
        }
    ]'''

    result = add_videos(draft_id, video_infos)
    print(f"添加视频结果: {result}")
    assert result["code"] == 0

    # 获取视频轨道
    tracks = get_video_tracks(draft_id)
    print(f"视频轨道数量: {len(tracks)}")
    assert len(tracks) == 1
    assert len(tracks[0]) == 2

    print("[PASS] 添加视频测试通过")


def test_add_audios(draft_id: str):
    """测试添加音频"""
    print("\n=== 测试添加音频 ===")

    audio_infos = '''[
        {
            "material_id": "audio_001",
            "material_url": "https://example.com/audio1.mp3",
            "target_timerange": {"start": 0, "duration": 8000000},
            "source_timerange": {"start": 0, "duration": 8000000}
        }
    ]'''

    result = add_audios(draft_id, audio_infos)
    print(f"添加音频结果: {result}")
    assert result["code"] == 0

    tracks = get_audio_tracks(draft_id)
    print(f"音频轨道数量: {len(tracks)}")
    assert len(tracks) == 1

    print("[PASS] 添加音频测试通过")


def test_add_texts(draft_id: str):
    """测试添加文本"""
    print("\n=== 测试添加文本 ===")

    text_infos = '''[
        {
            "content": "Hello World",
            "target_timerange": {"start": 0, "duration": 5000000}
        }
    ]'''

    result = add_texts(draft_id, text_infos)
    print(f"添加文本结果: {result}")
    assert result["code"] == 0

    tracks = get_text_tracks(draft_id)
    print(f"文本轨道数量: {len(tracks)}")
    assert len(tracks) == 1

    print("[PASS] 添加文本测试通过")


def test_add_stickers(draft_id: str):
    """测试添加贴纸"""
    print("\n=== 测试添加贴纸 ===")

    sticker_infos = '''[
        {
            "material_id": "sticker_001",
            "target_timerange": {"start": 1000000, "duration": 3000000}
        }
    ]'''

    result = add_stickers(draft_id, sticker_infos)
    print(f"添加贴纸结果: {result}")
    assert result["code"] == 0

    tracks = get_sticker_tracks(draft_id)
    print(f"贴纸轨道数量: {len(tracks)}")
    assert len(tracks) == 1

    print("[PASS] 添加贴纸测试通过")


def test_add_effects_and_filters(draft_id: str):
    """测试添加特效和滤镜"""
    print("\n=== 测试添加特效和滤镜 ===")

    # 添加视频特效
    result1 = add_video_effects(draft_id, {"effect_ids01": ["effect_001", "effect_002"]})
    print(f"添加视频特效: {result1}")
    assert result1["code"] == 0

    effects = get_video_effects(draft_id)
    print(f"视频特效: {effects}")
    assert len(effects) == 2

    # 添加视频滤镜
    result2 = add_video_filters(draft_id, {"filter_ids01": ["filter_001"]})
    print(f"添加视频滤镜: {result2}")
    assert result2["code"] == 0

    filters = get_video_filters(draft_id)
    print(f"视频滤镜: {filters}")
    assert len(filters) == 1

    # 添加音频特效
    result3 = add_audio_effects(draft_id, {"effect_ids01": ["audio_effect_001"]})
    print(f"添加音频特效: {result3}")
    assert result3["code"] == 0

    audio_effects = get_audio_effects(draft_id)
    print(f"音频特效: {audio_effects}")
    assert len(audio_effects) == 1

    print("[PASS] 添加特效和滤镜测试通过")


def test_add_keyframes(draft_id: str):
    """测试添加关键帧"""
    print("\n=== 测试添加关键帧 ===")

    keyframe_infos = '''[
        {
            "keyframe_type": "video",
            "material_id": "video_001",
            "keyframes": [
                {"time": 0, "keyframe_info": {"position": [0, 0], "scale": 1.0}},
                {"time": 2500000, "keyframe_info": {"position": [100, 50], "scale": 1.2}}
            ]
        }
    ]'''

    result = add_keyframes(draft_id, keyframe_infos)
    print(f"添加关键帧结果: {result}")
    assert result["code"] == 0

    keyframes = get_keyframes(draft_id)
    print(f"关键帧: {keyframes}")
    assert len(keyframes) == 1

    print("[PASS] 添加关键帧测试通过")


def test_save_draft(draft_id: str):
    """测试保存草稿"""
    print("\n=== 测试保存草稿 ===")

    result = save_draft(draft_id, 10000)
    print(f"保存草稿结果: {result}")
    assert result["code"] == 0
    assert "draft_url" in result
    assert draft_id in result["draft_url"]

    print(f"草稿 URL: {result['draft_url']}")
    print("[PASS] 保存草稿测试通过")


def test_get_draft_info(draft_id: str):
    """测试获取草稿信息"""
    print("\n=== 测试获取草稿信息 ===")

    info = get_draft_info(draft_id)
    print(f"草稿信息键: {info.keys()}")
    assert info["draft_id"] == draft_id
    assert len(info["videos"]) > 0
    assert len(info["audios"]) > 0

    print("[PASS] 获取草稿信息测试通过")


def test_generate_template(draft_id: str):
    """测试生成模板"""
    print("\n=== 测试生成模板 ===")

    result = generate_template(draft_id)
    print(f"生成模板结果: {result['code']}")
    assert result["code"] == 0
    assert "template" in result

    template = result["template"]
    print(f"模板 canvas: {template.get('canvas')}")
    print(f"模板 tracks 类型: {list(template.get('tracks', {}).keys())}")

    print("[PASS] 生成模板测试通过")


def test_delete_draft(draft_id: str):
    """测试删除草稿"""
    print("\n=== 测试删除草稿 ===")

    # 先检查存在
    exists_before = check_draft_exists(draft_id)
    print(f"删除前存在: {exists_before}")
    assert exists_before is True

    # 删除
    result = delete_draft(draft_id)
    print(f"删除结果: {result}")
    assert result["code"] == 0
    assert result["deleted_keys"] > 0

    # 检查不存在
    exists_after = check_draft_exists(draft_id)
    print(f"删除后存在: {exists_after}")
    assert exists_after is False

    print("[PASS] 删除草稿测试通过")


def test_error_handling():
    """测试错误处理"""
    print("\n=== 测试错误处理 ===")

    # 空参数测试
    result1 = create_draft(0, 1080)
    assert result1["code"] == -1

    result2 = add_videos("", "[]")
    assert result2["code"] == -1

    result3 = save_draft("")
    assert result3["code"] == -1

    result4 = delete_draft("")
    assert result4["code"] == -1

    # 不存在的草稿
    result5 = add_videos("not_exist_id", "[]")
    assert result5["code"] == -1
    assert "不存在" in result5["message"]

    print("[PASS] 错误处理测试通过")


def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("开始草稿管理 API 测试")
    print("=" * 60)

    # 创建草稿
    draft_id = test_create_draft()

    # 检查和获取
    test_check_and_get_draft(draft_id)

    # 添加各类素材
    test_add_videos(draft_id)
    test_add_audios(draft_id)
    test_add_texts(draft_id)
    test_add_stickers(draft_id)
    test_add_effects_and_filters(draft_id)
    test_add_keyframes(draft_id)

    # 保存和导出
    test_save_draft(draft_id)
    test_get_draft_info(draft_id)
    test_generate_template(draft_id)

    # 删除
    test_delete_draft(draft_id)

    # 错误处理
    test_error_handling()

    print("\n" + "=" * 60)
    print("[PASS] 所有测试通过!")
    print("=" * 60)

    # 打印缓存统计
    stats = draft_cache.get_stats()
    print(f"\n缓存统计: {stats}")


if __name__ == "__main__":
    run_all_tests()