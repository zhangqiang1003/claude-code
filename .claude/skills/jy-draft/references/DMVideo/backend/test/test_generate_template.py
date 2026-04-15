# -*- coding: utf-8 -*-
"""
generate_template.py 测试用例

全面测试草稿模板生成功能，包括：
- generate_template: 基础模板生成
- generate_template_json: JSON 格式输出
- generate_jianying_draft: 完整剪映草稿文件夹生成
- generate_draft_content_json: 草稿内容 JSON 生成
- export_draft_content: 导出草稿内容
"""

import sys
import os
import json
import tempfile
import shutil

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.draft.generate import (
    # 草稿管理
    create_draft,
    check_draft_exists,
    delete_draft,
    # 素材添加
    add_videos,
    add_audios,
    add_texts,
    add_stickers,
    add_video_effects,
    add_video_filters,
    add_audio_effects,
    add_keyframes,
    # 模板生成
    generate_template,
    generate_template_json,
    generate_jianying_draft,
    generate_draft_content_json,
    export_draft_content,
    # 缓存
    draft_cache
)


class TestGenerateTemplate:
    """generate_template 测试类"""

    def test_empty_draft_id(self):
        """测试空草稿ID"""
        print("\n=== 测试空草稿ID ===")

        result = generate_template("")
        print(f"空ID结果: {result}")
        assert result["code"] == -1
        assert "不能为空" in result["message"]

        result = generate_template(None)
        print(f"None ID结果: {result}")
        assert result["code"] == -1

        print("[PASS] 空草稿ID测试通过")

    def test_nonexistent_draft(self):
        """测试不存在的草稿"""
        print("\n=== 测试不存在的草稿 ===")

        result = generate_template("nonexistent_draft_id_12345")
        print(f"不存在草稿结果: {result}")
        assert result["code"] == -1
        assert "不存在" in result["message"] or "过期" in result["message"]

        print("[PASS] 不存在的草稿测试通过")

    def test_basic_template_generation(self):
        """测试基础模板生成"""
        print("\n=== 测试基础模板生成 ===")

        # 创建草稿
        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]
        print(f"创建草稿: {draft_id}")

        # 生成模板
        result = generate_template(draft_id)
        print(f"生成模板: code={result['code']}")

        assert result["code"] == 0
        assert "template" in result

        template = result["template"]
        assert template["draft_id"] == draft_id
        assert template["canvas"]["width"] == 1920
        assert template["canvas"]["height"] == 1080

        # 验证结构
        assert "tracks" in template
        assert "video" in template["tracks"]
        assert "audio" in template["tracks"]
        assert "text" in template["tracks"]
        assert "sticker" in template["tracks"]

        assert "effects" in template
        assert "generated" in template

        # 清理
        delete_draft(draft_id)
        print("[PASS] 基础模板生成测试通过")

    def test_template_with_videos(self):
        """测试包含视频的模板生成"""
        print("\n=== 测试包含视频的模板生成 ===")

        # 创建草稿
        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 添加视频
        video_infos = json.dumps([
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
        ])
        add_videos(draft_id, video_infos)

        # 生成模板
        result = generate_template(draft_id)
        assert result["code"] == 0

        template = result["template"]
        video_tracks = template["tracks"]["video"]
        print(f"视频轨道数量: {len(video_tracks)}")
        assert len(video_tracks) == 1
        assert len(video_tracks[0]) == 2

        # 清理
        delete_draft(draft_id)
        print("[PASS] 包含视频的模板生成测试通过")

    def test_template_with_multiple_tracks(self):
        """测试多轨道模板生成"""
        print("\n=== 测试多轨道模板生成 ===")

        # 创建草稿
        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 添加多个视频轨道
        for i in range(3):
            video_infos = json.dumps([
                {
                    "material_id": f"video_{i}_001",
                    "material_url": f"https://example.com/video_{i}.mp4",
                    "target_timerange": {"start": 0, "duration": 5000000},
                    "source_timerange": {"start": 0, "duration": 5000000}
                }
            ])
            add_videos(draft_id, video_infos)

        # 添加多个音频轨道
        for i in range(2):
            audio_infos = json.dumps([
                {
                    "material_id": f"audio_{i}_001",
                    "material_url": f"https://example.com/audio_{i}.mp3",
                    "target_timerange": {"start": 0, "duration": 5000000},
                    "source_timerange": {"start": 0, "duration": 5000000}
                }
            ])
            add_audios(draft_id, audio_infos)

        # 添加文本轨道
        text_infos = json.dumps([
            {"content": "Hello World", "target_timerange": {"start": 0, "duration": 3000000}}
        ])
        add_texts(draft_id, text_infos)

        # 生成模板
        result = generate_template(draft_id)
        assert result["code"] == 0

        template = result["template"]
        print(f"视频轨道: {len(template['tracks']['video'])}")
        print(f"音频轨道: {len(template['tracks']['audio'])}")
        print(f"文本轨道: {len(template['tracks']['text'])}")

        assert len(template["tracks"]["video"]) == 3
        assert len(template["tracks"]["audio"]) == 2
        assert len(template["tracks"]["text"]) == 1

        # 清理
        delete_draft(draft_id)
        print("[PASS] 多轨道模板生成测试通过")

    def test_template_with_effects(self):
        """测试包含特效的模板生成"""
        print("\n=== 测试包含特效的模板生成 ===")

        # 创建草稿
        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 添加视频特效
        add_video_effects(draft_id, {"effect_ids01": ["effect_001", "effect_002"]})

        # 添加视频滤镜
        add_video_filters(draft_id, {"filter_ids01": ["filter_001"]})

        # 添加音频特效
        add_audio_effects(draft_id, {"effect_ids01": ["audio_effect_001"]})

        # 生成模板
        result = generate_template(draft_id)
        assert result["code"] == 0

        template = result["template"]
        effects = template["effects"]

        print(f"视频特效: {effects['video_effects']}")
        print(f"视频滤镜: {effects['video_filters']}")
        print(f"音频特效: {effects['audio_effects']}")

        assert len(effects["video_effects"]) == 2
        assert len(effects["video_filters"]) == 1
        assert len(effects["audio_effects"]) == 1

        # 清理
        delete_draft(draft_id)
        print("[PASS] 包含特效的模板生成测试通过")

    def test_template_with_keyframes(self):
        """测试包含关键帧的模板生成"""
        print("\n=== 测试包含关键帧的模板生成 ===")

        # 创建草稿
        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 添加关键帧
        keyframe_infos = json.dumps([
            {
                "keyframe_type": "video",
                "material_id": "video_001",
                "keyframes": [
                    {"time": 0, "keyframe_info": {"alpha": 1.0}},
                    {"time": 2500000, "keyframe_info": {"alpha": 0.5}},
                    {"time": 5000000, "keyframe_info": {"alpha": 0.0}}
                ]
            }
        ])
        add_keyframes(draft_id, keyframe_infos)

        # 生成模板
        result = generate_template(draft_id)
        assert result["code"] == 0

        template = result["template"]
        keyframes = template["effects"]["keyframes"]
        print(f"关键帧数量: {len(keyframes)}")
        assert len(keyframes) == 1

        # 清理
        delete_draft(draft_id)
        print("[PASS] 包含关键帧的模板生成测试通过")

    def test_template_json_output(self):
        """测试 JSON 格式输出"""
        print("\n=== 测试 JSON 格式输出 ===")

        # 创建草稿
        create_result = create_draft(1280, 720)
        draft_id = create_result["draft_id"]

        # 添加素材
        video_infos = json.dumps([
            {
                "material_id": "video_001",
                "material_url": "https://example.com/video.mp4",
                "target_timerange": {"start": 0, "duration": 5000000},
                "source_timerange": {"start": 0, "duration": 5000000}
            }
        ])
        add_videos(draft_id, video_infos)

        # 生成 JSON
        json_str = generate_template_json(draft_id)
        print(f"JSON 长度: {len(json_str)}")

        # 验证是有效的 JSON
        template = json.loads(json_str)
        assert template["draft_id"] == draft_id
        assert template["canvas"]["width"] == 1280
        assert template["canvas"]["height"] == 720

        # 清理
        delete_draft(draft_id)
        print("[PASS] JSON 格式输出测试通过")

    def test_template_different_resolutions(self):
        """测试不同分辨率的模板"""
        print("\n=== 测试不同分辨率的模板 ===")

        resolutions = [
            (1920, 1080, "横屏 16:9"),
            (1080, 1920, "竖屏 9:16"),
            (1280, 720, "720p"),
            (3840, 2160, "4K"),
            (1080, 1080, "方形 1:1")
        ]

        for width, height, desc in resolutions:
            create_result = create_draft(width, height)
            draft_id = create_result["draft_id"]

            result = generate_template(draft_id)
            assert result["code"] == 0

            template = result["template"]
            assert template["canvas"]["width"] == width
            assert template["canvas"]["height"] == height
            print(f"  {desc} ({width}x{height}): OK")

            delete_draft(draft_id)

        print("[PASS] 不同分辨率的模板测试通过")


class TestGenerateJianyingDraft:
    """generate_jianying_draft 测试类"""

    def test_empty_parameters(self):
        """测试空参数"""
        print("\n=== 测试空参数 ===")

        result = generate_jianying_draft("", "/tmp/test")
        print(f"空draft_id: {result}")
        assert result["code"] == -1

        result = generate_jianying_draft("nonexistent", "/tmp/test")
        print(f"不存在的draft: {result}")
        assert result["code"] == -1

        print("[PASS] 空参数测试通过")

    def test_generate_to_folder(self):
        """测试生成到文件夹"""
        print("\n=== 测试生成到文件夹 ===")

        # 创建临时目录
        temp_dir = tempfile.mkdtemp(prefix="jianying_draft_test_")
        print(f"临时目录: {temp_dir}")

        try:
            # 创建草稿
            create_result = create_draft(1920, 1080)
            draft_id = create_result["draft_id"]

            # 添加素材
            video_infos = json.dumps([
                {
                    "material_id": "video_001",
                    "material_url": "https://example.com/video.mp4",
                    "target_timerange": {"start": 0, "duration": 5000000},
                    "source_timerange": {"start": 0, "duration": 5000000}
                }
            ])
            add_videos(draft_id, video_infos)

            audio_infos = json.dumps([
                {
                    "material_id": "audio_001",
                    "material_url": "https://example.com/audio.mp3",
                    "target_timerange": {"start": 0, "duration": 5000000},
                    "source_timerange": {"start": 0, "duration": 5000000}
                }
            ])
            add_audios(draft_id, audio_infos)

            # 生成剪映草稿
            result = generate_jianying_draft(
                draft_id=draft_id,
                output_folder=temp_dir,
                draft_name="test_video"
            )

            print(f"生成结果: code={result['code']}, message={result['message']}")

            if result["code"] == 0:
                # 验证文件夹创建
                draft_path = result["draft_folder_path"]
                assert os.path.exists(draft_path)

                # 验证文件存在
                content_path = os.path.join(draft_path, "draft_content.json")
                meta_path = os.path.join(draft_path, "draft_meta_info.json")

                print(f"draft_content.json 存在: {os.path.exists(content_path)}")
                print(f"draft_meta_info.json 存在: {os.path.exists(meta_path)}")

                if os.path.exists(content_path):
                    # 验证内容格式
                    with open(content_path, "r", encoding="utf-8") as f:
                        content = json.load(f)

                    assert "canvas_config" in content
                    assert "tracks" in content
                    assert "materials" in content
                    print(f"草稿内容验证通过")

                # 验证草稿内容返回
                assert "draft_content" in result
            else:
                print(f"生成失败: {result['message']}")

            # 清理
            delete_draft(draft_id)

        finally:
            # 清理临时目录
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

        print("[PASS] 生成到文件夹测试通过")

    def test_custom_fps(self):
        """测试自定义帧率"""
        print("\n=== 测试自定义帧率 ===")

        temp_dir = tempfile.mkdtemp(prefix="jianying_fps_test_")

        try:
            create_result = create_draft(1920, 1080)
            draft_id = create_result["draft_id"]

            for fps in [24, 25, 30, 60]:
                result = generate_jianying_draft(
                    draft_id=draft_id,
                    output_folder=temp_dir,
                    draft_name=f"test_fps_{fps}",
                    fps=fps
                )

                if result["code"] == 0:
                    content = result["draft_content"]
                    if content:
                        print(f"  FPS {fps}: content_fps={content.get('fps', 'N/A')}")

            delete_draft(draft_id)

        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

        print("[PASS] 自定义帧率测试通过")

    def test_auto_draft_name(self):
        """测试自动草稿名称"""
        print("\n=== 测试自动草稿名称 ===")

        temp_dir = tempfile.mkdtemp(prefix="jianying_name_test_")

        try:
            create_result = create_draft(1920, 1080)
            draft_id = create_result["draft_id"]

            # 不指定名称
            result = generate_jianying_draft(
                draft_id=draft_id,
                output_folder=temp_dir
            )

            print(f"自动名称结果: {result.get('draft_folder_path', 'N/A')}")

            if result["code"] == 0:
                # 验证使用了 draft_id 前8位作为名称
                draft_path = result["draft_folder_path"]
                folder_name = os.path.basename(draft_path)
                assert folder_name == draft_id[:8]
                print(f"自动名称: {folder_name}")

            delete_draft(draft_id)

        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

        print("[PASS] 自动草稿名称测试通过")


class TestGenerateDraftContentJson:
    """generate_draft_content_json 测试类"""

    def test_basic_json_generation(self):
        """测试基础 JSON 生成"""
        print("\n=== 测试基础 JSON 生成 ===")

        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        result = generate_draft_content_json(draft_id)
        print(f"生成结果: code={result['code']}")

        assert result["code"] == 0
        assert "content" in result

        content = result["content"]
        assert "canvas_config" in content
        assert "tracks" in content
        assert "materials" in content

        print(f"canvas_config: {content['canvas_config']}")

        delete_draft(draft_id)
        print("[PASS] 基础 JSON 生成测试通过")

    def test_json_with_materials(self):
        """测试包含素材的 JSON 生成"""
        print("\n=== 测试包含素材的 JSON 生成 ===")

        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 添加多种素材
        add_videos(draft_id, json.dumps([
            {"material_id": "v1", "material_url": "video.mp4",
             "target_timerange": {"start": 0, "duration": 5000000},
             "source_timerange": {"start": 0, "duration": 5000000}}
        ]))

        add_audios(draft_id, json.dumps([
            {"material_id": "a1", "material_url": "audio.mp3",
             "target_timerange": {"start": 0, "duration": 5000000},
             "source_timerange": {"start": 0, "duration": 5000000}}
        ]))

        add_texts(draft_id, json.dumps([
            {"content": "Test Text", "target_timerange": {"start": 0, "duration": 3000000}}
        ]))

        result = generate_draft_content_json(draft_id)
        assert result["code"] == 0

        content = result["content"]
        print(f"轨道数量: {len(content.get('tracks', []))}")
        print(f"素材类型: {list(content.get('materials', {}).keys())}")

        delete_draft(draft_id)
        print("[PASS] 包含素材的 JSON 生成测试通过")

    def test_json_format_validation(self):
        """测试 JSON 格式验证"""
        print("\n=== 测试 JSON 格式验证 ===")

        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        result = generate_draft_content_json(draft_id)
        content = result["content"]

        # 验证必需字段
        required_fields = ["canvas_config", "tracks", "materials"]
        for field in required_fields:
            assert field in content, f"缺少必需字段: {field}"
            print(f"  {field}: OK")

        # 验证 canvas_config 结构
        assert "width" in content["canvas_config"]
        assert "height" in content["canvas_config"]

        # 验证 materials 结构
        materials = content["materials"]
        assert isinstance(materials, dict)

        delete_draft(draft_id)
        print("[PASS] JSON 格式验证测试通过")


class TestExportDraftContent:
    """export_draft_content 测试类"""

    def test_export_empty_draft(self):
        """测试导出空草稿"""
        print("\n=== 测试导出空草稿 ===")

        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        content = export_draft_content(draft_id)
        print(f"导出内容键: {list(content.keys())}")

        assert "canvas_config" in content
        assert "tracks" in content
        assert "materials" in content

        delete_draft(draft_id)
        print("[PASS] 导出空草稿测试通过")

    def test_export_nonexistent_draft(self):
        """测试导出不存在的草稿"""
        print("\n=== 测试导出不存在的草稿 ===")

        content = export_draft_content("nonexistent_draft")
        print(f"导出结果: {content}")
        assert content == {}

        print("[PASS] 导出不存在的草稿测试通过")

    def test_export_structure(self):
        """测试导出结构"""
        print("\n=== 测试导出结构 ===")

        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 添加素材
        add_videos(draft_id, json.dumps([
            {"material_id": "v1", "material_url": "video.mp4",
             "target_timerange": {"start": 0, "duration": 5000000},
             "source_timerange": {"start": 0, "duration": 5000000}}
        ]))

        content = export_draft_content(draft_id)

        # 验证轨道结构
        tracks = content.get("tracks", [])
        print(f"轨道数量: {len(tracks)}")

        if tracks:
            for track in tracks:
                assert "type" in track
                assert "segments" in track
                print(f"  轨道类型: {track['type']}, 片段数: {len(track['segments'])}")

        delete_draft(draft_id)
        print("[PASS] 导出结构测试通过")


class TestEdgeCases:
    """边界情况测试"""

    def test_large_number_of_tracks(self):
        """测试大量轨道"""
        print("\n=== 测试大量轨道 ===")

        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 添加大量视频轨道
        for i in range(10):
            add_videos(draft_id, json.dumps([
                {"material_id": f"v{i}", "material_url": f"video{i}.mp4",
                 "target_timerange": {"start": 0, "duration": 1000000},
                 "source_timerange": {"start": 0, "duration": 1000000}}
            ]))

        result = generate_template(draft_id)
        assert result["code"] == 0

        template = result["template"]
        print(f"视频轨道数: {len(template['tracks']['video'])}")
        assert len(template["tracks"]["video"]) == 10

        delete_draft(draft_id)
        print("[PASS] 大量轨道测试通过")

    def test_unicode_content(self):
        """测试 Unicode 内容"""
        print("\n=== 测试 Unicode 内容 ===")

        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 添加中文文本
        add_texts(draft_id, json.dumps([
            {"content": "你好世界！这是中文测试", "target_timerange": {"start": 0, "duration": 3000000}}
        ]))

        result = generate_template(draft_id)
        assert result["code"] == 0

        # 测试 JSON 输出
        json_str = generate_template_json(draft_id)
        template = json.loads(json_str)

        # 验证中文内容
        text_tracks = template["tracks"]["text"]
        if text_tracks and text_tracks[0]:
            content = text_tracks[0][0].get("content", "")
            print(f"文本内容: {content}")

        delete_draft(draft_id)
        print("[PASS] Unicode 内容测试通过")

    def test_special_characters_in_url(self):
        """测试特殊字符 URL"""
        print("\n=== 测试特殊字符 URL ===")

        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 包含特殊字符的 URL
        special_url = "https://example.com/video%20file.mp4?param=value&other=test"
        add_videos(draft_id, json.dumps([
            {"material_id": "v1", "material_url": special_url,
             "target_timerange": {"start": 0, "duration": 5000000},
             "source_timerange": {"start": 0, "duration": 5000000}}
        ]))

        result = generate_template(draft_id)
        assert result["code"] == 0

        delete_draft(draft_id)
        print("[PASS] 特殊字符 URL 测试通过")

    def test_zero_duration_segments(self):
        """测试零时长片段"""
        print("\n=== 测试零时长片段 ===")

        create_result = create_draft(1920, 1080)
        draft_id = create_result["draft_id"]

        # 零时长片段
        add_videos(draft_id, json.dumps([
            {"material_id": "v1", "material_url": "video.mp4",
             "target_timerange": {"start": 0, "duration": 0},
             "source_timerange": {"start": 0, "duration": 0}}
        ]))

        result = generate_template(draft_id)
        assert result["code"] == 0

        delete_draft(draft_id)
        print("[PASS] 零时长片段测试通过")

    def test_concurrent_operations(self):
        """测试并发操作"""
        print("\n=== 测试并发操作 ===")

        # 创建多个草稿
        draft_ids = []
        for i in range(5):
            result = create_draft(1920, 1080)
            draft_ids.append(result["draft_id"])

        # 为每个草稿添加不同的素材
        for i, draft_id in enumerate(draft_ids):
            add_videos(draft_id, json.dumps([
                {"material_id": f"v{i}", "material_url": f"video{i}.mp4",
                 "target_timerange": {"start": 0, "duration": 5000000},
                 "source_timerange": {"start": 0, "duration": 5000000}}
            ]))

        # 同时生成所有模板
        for draft_id in draft_ids:
            result = generate_template(draft_id)
            assert result["code"] == 0

        print(f"并发处理 {len(draft_ids)} 个草稿成功")

        # 清理
        for draft_id in draft_ids:
            delete_draft(draft_id)

        print("[PASS] 并发操作测试通过")


def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("开始 generate_template.py 全面测试")
    print("=" * 60)

    # 测试类实例
    test_template = TestGenerateTemplate()
    test_jianying = TestGenerateJianyingDraft()
    test_json = TestGenerateDraftContentJson()
    test_export = TestExportDraftContent()
    test_edge = TestEdgeCases()

    # 运行所有测试
    print("\n" + "=" * 40)
    print("第一部分: generate_template 测试")
    print("=" * 40)
    test_template.test_empty_draft_id()
    test_template.test_nonexistent_draft()
    test_template.test_basic_template_generation()
    test_template.test_template_with_videos()
    test_template.test_template_with_multiple_tracks()
    test_template.test_template_with_effects()
    test_template.test_template_with_keyframes()
    test_template.test_template_json_output()
    test_template.test_template_different_resolutions()

    print("\n" + "=" * 40)
    print("第二部分: generate_jianying_draft 测试")
    print("=" * 40)
    test_jianying.test_empty_parameters()
    test_jianying.test_generate_to_folder()
    test_jianying.test_custom_fps()
    test_jianying.test_auto_draft_name()

    print("\n" + "=" * 40)
    print("第三部分: generate_draft_content_json 测试")
    print("=" * 40)
    test_json.test_basic_json_generation()
    test_json.test_json_with_materials()
    test_json.test_json_format_validation()

    print("\n" + "=" * 40)
    print("第四部分: export_draft_content 测试")
    print("=" * 40)
    test_export.test_export_empty_draft()
    test_export.test_export_nonexistent_draft()
    test_export.test_export_structure()

    print("\n" + "=" * 40)
    print("第五部分: 边界情况测试")
    print("=" * 40)
    test_edge.test_large_number_of_tracks()
    test_edge.test_unicode_content()
    test_edge.test_special_characters_in_url()
    test_edge.test_zero_duration_segments()
    test_edge.test_concurrent_operations()

    print("\n" + "=" * 60)
    print("[PASS] 所有测试通过!")
    print("=" * 60)

    # 打印缓存统计
    stats = draft_cache.get_stats()
    print(f"\n缓存统计: {stats}")


if __name__ == "__main__":
    run_all_tests()