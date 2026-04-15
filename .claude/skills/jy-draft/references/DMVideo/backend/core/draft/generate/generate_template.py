# -*- coding: utf-8 -*-
"""
生成草稿模板 API

根据草稿缓存数据生成剪映草稿模板文件。
整合 pjy 库实现完整的剪映草稿模板生成。
"""

import os
import json
import uuid
import time
import shutil
import logging
from typing import Dict, Any, List, Optional, Union
from copy import deepcopy
from datetime import datetime

from core.draft.generate.track_types import TrackData

# ============================================================================
# 日志配置
# ============================================================================

# 创建日志目录
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "logs")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR, exist_ok=True)

# 配置日志格式
LOG_FORMAT = "%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# 创建专用日志记录器
logger = logging.getLogger("generate_draft")
logger.setLevel(logging.DEBUG)

# 文件处理器 - 记录所有日志
log_file = os.path.join(LOG_DIR, f"draft_{datetime.now().strftime('%Y%m%d')}.log")
file_handler = logging.FileHandler(log_file, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))

# 控制台处理器 - 级别跟随 LOG_LEVEL 环境变量，默认 INFO
def _get_log_level() -> int:
    level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    level_map = {
        "DEBUG": logging.DEBUG, "INFO": logging.INFO,
        "WARNING": logging.WARNING, "WARN": logging.WARNING,
        "ERROR": logging.ERROR, "CRITICAL": logging.CRITICAL,
    }
    return level_map.get(level_str, logging.INFO)

console_handler = logging.StreamHandler()
console_handler.setLevel(_get_log_level())
console_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))

# 添加处理器（避免重复添加）
if not logger.handlers:
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

from .draft_cache import (
    draft_cache, format_draft_key, DEFAULT_EXPIRE_SECONDS,
    DRAFT_VIDEOS, DRAFT_AUDIOS, DRAFT_TEXTS, DRAFT_STICKERS,
    DRAFT_EFFECTS, DRAFT_FILTERS, DRAFT_AUDIO_EFFECTS,
    DRAFT_KEYFRAMES, DRAFT_AUDIO_KEYFRAMES,
    GEN_KEYFRAMES, GEN_AUDIO_KEYFRAMES
)
from .create_draft import check_draft_exists, get_draft_template

# 导入 pjy 库
try:
    from pjy import (
        ScriptFile, DraftFolder,
        VideoSegment, AudioSegment, TextSegment, StickerSegment,
        VideoMaterial, AudioMaterial,
        TrackType, Timerange,
        ClipSettings, TextStyle, TextIntro, TextOutro, TextLoopAnim
)
    # 从子模块导入
    from pjy.video_segment import VideoEffect, Filter
    from pjy.audio_segment import AudioEffect, AudioFade
    from pjy.keyframe import KeyframeProperty
    from pjy.time_util import tim
    from pjy.local_materials import CropSettings
    from pjy.metadata import (
        VideoSceneEffectType, VideoCharacterEffectType,
        FilterType, AudioSceneEffectType, ToneEffectType,
        SpeechToSongType, FontType, MaskType, TransitionType,
        IntroType, OutroType, GroupAnimationType
    )
    # 导入文本相关类
    from pjy.text_segment import (
        TextBorder, TextBackground, TextShadow,
        TextBubble, TextEffect as TextEffectStyle
    )
    HAS_JIANYING_LIB = True
except ImportError as e:
    print(f"pjy import error: {e}")
    HAS_JIANYING_LIB = False


# 缓存键常量
DRAFT_VIDEOS = "videos"
DRAFT_AUDIOS = "audios"
DRAFT_TEXTS = "texts"
DRAFT_STICKERS = "stickers"
DRAFT_EFFECTS = "effects"
DRAFT_FILTERS = "filters"
DRAFT_AUDIO_EFFECTS = "audio_effects"
DRAFT_KEYFRAMES = "keyframes"
DRAFT_AUDIO_KEYFRAMES = "audio_keyframes"

# populate 模块生成的数据键
GEN_EFFECTS = "gen:effects"
GEN_FILTERS = "gen:filters"
GEN_AUDIO_EFFECTS = "gen:audio_effects"
GEN_KEYFRAMES = "gen:keyframes"
GEN_AUDIO_KEYFRAMES = "gen:audio_keyframes"


def generate_template(draft_id: str) -> Dict[str, Any]:
    """
    生成草稿模板

    Args:
        draft_id: 草稿ID

    Returns:
        包含模板数据的字典:
        - code: 状态码
        - message: 响应消息
        - template: 模板数据

    Example:
        >>> result = generate_template("xxx")
        >>> template = result['template']
    """
    if not draft_id:
        return {"code": -1, "message": "草稿 ID 不能为空", "template": {}}

    if not check_draft_exists(draft_id):
        return {"code": -1, "message": "草稿不存在或已过期", "template": {}}

    # 获取画布配置
    canvas_config = get_draft_template(draft_id)

    # 获取所有素材数据
    template_data = {
        "draft_id": draft_id,
        "canvas": canvas_config,
        "tracks": {
            "video": get_video_tracks(draft_id),
            "audio": get_audio_tracks(draft_id),
            "text": get_text_tracks(draft_id),
            "sticker": get_sticker_tracks(draft_id)
        },
        "effects": {
            "video_effects": get_video_effects(draft_id),
            "video_filters": get_video_filters(draft_id),
            "audio_effects": get_audio_effects(draft_id),
            "keyframes": get_keyframes(draft_id),
            "audio_keyframes": get_audio_keyframes(draft_id)
        },
        "generated": {
            "video_effects": _get_cached_data(draft_id, GEN_EFFECTS),
            "video_filters": _get_cached_data(draft_id, GEN_FILTERS),
            "audio_effects": _get_cached_data(draft_id, GEN_AUDIO_EFFECTS),
            "keyframes": _get_cached_data(draft_id, GEN_KEYFRAMES),
            "audio_keyframes": _get_cached_data(draft_id, GEN_AUDIO_KEYFRAMES)
        }
    }

    return {
        "code": 0,
        "message": "success",
        "template": template_data
    }


def generate_template_json(draft_id: str) -> str:
    """
    生成草稿模板 JSON 字符串

    Args:
        draft_id: 草稿ID

    Returns:
        JSON 字符串
    """
    result = generate_template(draft_id)
    return json.dumps(result.get("template", {}), ensure_ascii=False)


def generate_jianying_draft(
    draft_id: str,
    output_folder: str,
    draft_name: str = "",
    fps: int = 30
) -> Dict[str, Any]:
    """
    生成完整的剪映草稿文件夹

    使用 pjy 库生成可以在剪映中直接打开的草稿。

    Args:
        draft_id: 草稿ID
        output_folder: 输出文件夹路径（剪映草稿根目录）
        draft_name: 草稿名称，默认使用 draft_id
        fps: 帧率，默认 30

    Returns:
        包含结果的字典:
        - code: 状态码
        - message: 响应消息
        - draft_folder_path: 草稿文件夹路径
        - draft_content: 草稿内容

    Example:
        >>> result = generate_jianying_draft(
        ...     draft_id="xxx",
        ...     output_folder="C:/JianyingPro Drafts",
        ...     draft_name="我的视频"
        ... )
    """
    logger.info(f"[generate_jianying_draft] 开始生成草稿, draft_id={draft_id}, output_folder={output_folder}, draft_name={draft_name}, fps={fps}")

    if not HAS_JIANYING_LIB:
        logger.error("[generate_jianying_draft] pjy 库未安装")
        return {
            "code": -1,
            "message": "pjy 库未安装",
            "draft_folder_path": "",
            "draft_content": {}
        }

    if not draft_id:
        logger.error("[generate_jianying_draft] 草稿 ID 不能为空")
        return {"code": -1, "message": "草稿 ID 不能为空"}

    if not check_draft_exists(draft_id):
        logger.error(f"[generate_jianying_draft] 草稿不存在或已过期, draft_id={draft_id}")
        return {"code": -1, "message": "草稿不存在或已过期"}

    if not draft_name:
        draft_name = draft_id[:8]
        logger.debug(f"[generate_jianying_draft] 使用默认草稿名称: draft_name={draft_name}")

    try:
        logger.info(f"[generate_jianying_draft] 开始处理草稿, draft_id={draft_id}")
        # 获取画布配置
        canvas_config = get_draft_template(draft_id)
        width = canvas_config.get("width", 1920)
        height = canvas_config.get("height", 1080)
        logger.debug(f"[generate_jianying_draft] 画布配置: width={width}, height={height}, canvas_config={json.dumps(canvas_config, ensure_ascii=False)}")
        # 创建 DraftFolder
        if not os.path.exists(output_folder):
            logger.debug(f"[generate_jianying_draft] 创建输出文件夹: {output_folder}")
            os.makedirs(output_folder, exist_ok=True)
        logger.debug(f"[generate_jianying_draft] 创建 DraftFolder, output_folder={output_folder}")
        draft_folder = DraftFolder(output_folder)
        # 创建草稿
        logger.debug(f"[generate_jianying_draft] 创建草稿, draft_name={draft_name}, width={width}, height={height}, fps={fps}")
        script_file = draft_folder.create_draft(
            draft_name=draft_name,
            width=width,
            height=height,
            fps=fps,
            allow_replace=True
        )
        logger.info(f"[generate_jianying_draft] 草稿创建成功")
        # 获取所有缓存的素材数据
        logger.debug(f"[generate_jianying_draft] 获取缓存的素材数据...")
        video_tracks = get_video_tracks(draft_id)
        audio_tracks = get_audio_tracks(draft_id)
        text_tracks = get_text_tracks(draft_id)

        logger.info(f"[generate_jianying_draft] 素材数据统计:")
        logger.info(f"  - video_tracks: {len(video_tracks)} 轨道, {sum(len(t.segments) for t in video_tracks)} 个片段")
        logger.info(f"  - audio_tracks: {len(audio_tracks)} 轨道, {sum(len(t.segments) for t in audio_tracks)} 个片段")
        logger.info(f"  - text_tracks: {len(text_tracks)} 轨道, {sum(len(t.segments) for t in text_tracks)} 个片段")

        # 添加视频轨道
        if video_tracks:
            logger.info(f"[generate_jianying_draft] 开始添加 {len(video_tracks)} 个视频轨道...")
            _add_video_tracks(script_file, video_tracks)
            logger.info(f"[generate_jianying_draft] 视频轨道添加完成")
        else:
            logger.debug(f"[generate_jianying_draft] 无视频轨道需要添加")
        # 添加音频轨道
        if audio_tracks:
            logger.info(f"[generate_jianying_draft] 开始添加 {len(audio_tracks)} 个音频轨道...")
            _add_audio_tracks(script_file, audio_tracks)
            logger.info(f"[generate_jianying_draft] 音频轨道添加完成")
        else:
            logger.debug(f"[generate_jianying_draft] 无音频轨道需要添加")
        # 添加文本轨道
        if text_tracks:
            logger.info(f"[generate_jianying_draft] 开始添加 {len(text_tracks)} 个文本轨道...")
            _add_text_tracks(script_file, text_tracks)
            logger.info(f"[generate_jianying_draft] 文本轨道添加完成")
        else:
            logger.debug(f"[generate_jianying_draft] 无文本轨道需要添加")

        # 添加特效和滤镜
        logger.debug(f"[generate_jianying_draft] 获取特效和滤镜数据...")
        video_effects = get_video_effects(draft_id)
        video_filters = get_video_filters(draft_id)
        audio_effects = get_audio_effects(draft_id)
        logger.info(f"[generate_jianying_draft] 特效滤镜统计:")
        logger.info(f"  - video_effects: {len(video_effects)} 个")
        logger.info(f"  - video_filters: {len(video_filters)} 个")
        logger.info(f"  - audio_effects: {len(audio_effects)} 个")

        logger.debug(f"[generate_jianying_draft] video_effects: {video_effects}")
        logger.debug(f"[generate_jianying_draft] video_filters: {video_filters}")
        logger.debug(f"[generate_jianying_draft] audio_effects: {audio_effects}")
        if video_effects:
            logger.debug(f"[generate_jianying_draft] 添加视频特效...")
            _add_video_effects_to_draft(script_file, video_effects)
        if video_filters:
            logger.debug(f"[generate_jianying_draft] 添加视频滤镜...")
            _add_video_filters_to_draft(script_file, video_filters)
        if audio_effects:
            logger.debug(f"[generate_jianying_draft] 添加音频特效...")
            _add_audio_effects_to_draft(script_file, audio_effects)
        # 添加关键帧
        logger.debug(f"[generate_jianying_draft] 获取关键帧数据...")
        keyframes = get_keyframes(draft_id)
        audio_keyframes = get_audio_keyframes(draft_id)
        logger.info(f"[generate_jianying_draft] 关键帧统计:")
        logger.info(f"  - keyframes: {len(keyframes)} 个")
        logger.info(f"  - audio_keyframes: {len(audio_keyframes)} 个")

        logger.debug(f"[generate_jianying_draft] keyframes 详细数据:\n{json.dumps(keyframes, ensure_ascii=False, indent=2)}")
        logger.debug(f"[generate_jianying_draft] audio_keyframes 详细数据:\n{json.dumps(audio_keyframes, ensure_ascii=False, indent=2)}")
        if keyframes:
            logger.debug(f"[generate_jianying_draft] 添加关键帧...")
            _add_keyframes_to_draft(script_file, keyframes)
        if audio_keyframes:
            logger.debug(f"[generate_jianying_draft] 添加音频关键帧...")
            _add_audio_keyframes_to_draft(script_file, audio_keyframes)
        # 保存草稿
        logger.info(f"[generate_jianying_draft] 保存草稿到文件...")
        script_file.save()
        logger.info(f"[generate_jianying_draft] 草稿保存成功")
        # 获取草稿路径
        draft_folder_path = os.path.join(output_folder, draft_name)
        logger.debug(f"[generate_jianying_draft] 草稿文件夹路径: {draft_folder_path}")
        # 读取生成的草稿内容
        draft_content_path = os.path.join(draft_folder_path, "draft_content.json")
        draft_content = {}
        if os.path.exists(draft_content_path):
            logger.debug(f"[generate_jianying_draft] 读取草稿内容文件: {draft_content_path}")
            with open(draft_content_path, "r", encoding="utf-8") as f:
                draft_content = json.load(f)
            logger.debug(f"[generate_jianying_draft] 草稿内容读取成功, 大小: {len(json.dumps(draft_content))} 字符")
        else:
            logger.warning(f"[generate_jianying_draft] 草稿内容文件不存在: {draft_content_path}")
        logger.info(f"[generate_jianying_draft] 草稿生成完成, draft_id={draft_id}, draft_folder_path={draft_folder_path}")
        return {
            "code": 0,
            "message": "success",
            "draft_folder_path": draft_folder_path,
            "draft_content": draft_content
        }
    except Exception as e:
        logger.error(f"[generate_jianying_draft] 生成草稿失败, draft_id={draft_id}, error={str(e)}", exc_info=True)
        import traceback
        logger.error(f"[generate_jianying_draft] 异常堆栈:\n{traceback.format_exc()}")
        return {
            "code": -1,
            "message": f"生成草稿失败: {str(e)}",
            "draft_folder_path": "",
            "draft_content": {}
        }


def generate_draft_content_json(draft_id: str, fps: int = 30) -> Dict[str, Any]:
    """
    生成剪映草稿内容 JSON（draft_content.json 格式）

    不创建文件夹，仅生成 JSON 内容，用于下载或传输。

    Args:
        draft_id: 草稿ID
        fps: 帧率，默认 30

    Returns:
        包含结果的字典:
        - code: 状态码
        - message: 响应消息
        - content: draft_content.json 内容

    Example:
        >>> result = generate_draft_content_json("xxx")
        >>> content = result['content']
    """
    if not HAS_JIANYING_LIB:
        return {
            "code": -1,
            "message": "pjy 库未安装",
            "content": {}
        }

    if not draft_id:
        return {"code": -1, "message": "草稿 ID 不能为空"}

    if not check_draft_exists(draft_id):
        return {"code": -1, "message": "草稿不存在或已过期"}

    try:
        # 获取画布配置
        canvas_config = get_draft_template(draft_id)
        width = canvas_config.get("width", 1920)
        height = canvas_config.get("height", 1080)

        # 创建临时的 ScriptFile
        script_file = ScriptFile(width, height, fps, True)

        # 获取所有缓存的素材数据并添加到 script_file
        video_tracks = get_video_tracks(draft_id)
        audio_tracks = get_audio_tracks(draft_id)
        text_tracks = get_text_tracks(draft_id)
        sticker_tracks = get_sticker_tracks(draft_id)

        if video_tracks:
            _add_video_tracks(script_file, video_tracks)
        if audio_tracks:
            _add_audio_tracks(script_file, audio_tracks)
        if text_tracks:
            _add_text_tracks(script_file, text_tracks)
        if sticker_tracks:
            _add_sticker_tracks(script_file, sticker_tracks)

        # 获取草稿内容 JSON
        content_json = json.loads(script_file.dumps())

        return {
            "code": 0,
            "message": "success",
            "content": content_json
        }

    except Exception as e:
        return {
            "code": -1,
            "message": f"生成草稿内容失败: {str(e)}",
            "content": {}
        }


def export_draft_content(draft_id: str) -> Dict[str, Any]:
    """
    导出草稿内容（用于剪映导入）

    Args:
        draft_id: 草稿ID

    Returns:
        剪映草稿格式的内容
    """
    if not check_draft_exists(draft_id):
        return {}

    template = get_draft_template(draft_id)
    width = template.get("width", 1920)
    height = template.get("height", 1080)

    # 构建剪映草稿格式
    draft_content = {
        "canvas_config": {
            "width": width,
            "height": height,
            "ratio": "original"
        },
        "fps": 30.0,
        "duration": 0,
        "config": {
            "maintrack_adsorb": True
        },
        "tracks": [],
        "materials": {
            "videos": [],
            "audios": [],
            "texts": [],
            "stickers": [],
            "video_effects": [],
            "audio_effects": [],
            "effects": []
        },
        "keyframes": {
            "videos": [],
            "audios": [],
            "texts": []
        }
    }

    # 添加视频轨道
    video_tracks: List[TrackData] = get_video_tracks(draft_id)
    for i, track in enumerate(video_tracks):
        track_data = {
            "attribute": int(track.mute is True),
            "type": "video",
            "index": i,
            "segments": track.segments
        }
        draft_content["tracks"].append(track_data)

    # 添加音频轨道
    audio_tracks: List[TrackData] = get_audio_tracks(draft_id)
    for i, track in enumerate(audio_tracks):
        track_data = {
            "attribute": int(track.mute is True),
            "type": "audio",
            "index": i,
            "segments": track.segments
        }
        draft_content["tracks"].append(track_data)

    # 添加文本轨道
    text_tracks: List[TrackData] = get_text_tracks(draft_id)
    for i, track in enumerate(text_tracks):
        track_data = {
            "type": "text",
            "index": i,
            "segments": track.segments
        }
        draft_content["tracks"].append(track_data)

    # TODO 添加贴纸轨道
    # sticker_tracks = get_sticker_tracks(draft_id)
    # for i, track in enumerate(sticker_tracks):
    #     track_data = {
    #         "type": "sticker",
    #         "index": i,
    #         "segments": track
    #     }
    #     draft_content["tracks"].append(track_data)

    return draft_content


# ==================== 内部辅助函数 ====================

def _get_cached_data(draft_id: str, data_type: str) -> Any:
    """从缓存获取数据"""
    key = format_draft_key(draft_id, data_type)
    return draft_cache.get(key) or []


def _add_video_tracks(script_file: "ScriptFile", video_tracks: List[TrackData]) -> None:
    """添加视频轨道到草稿"""
    for track_index, track in enumerate(video_tracks):
        track_name = f"video_track_{track_index}" if track_index > 0 else "video"

        # 添加视频轨道
        if track_index == 0:
            script_file.add_track(TrackType.video, track_name, mute=track.mute)
        else:
            script_file.add_track(TrackType.video, track_name, mute=track.mute, relative_index=track_index)

        for seg_idx, segment_data in enumerate(track.segments):
            try:
                _add_video_segment(script_file, segment_data, track_name)
            except Exception as e:
                # 记录错误但继续处理
                print(f"添加视频片段失败: {e}")
                logger.error(f"[_add_video_tracks] 轨道 {track_name} 片段 {seg_idx} 添加失败: {e}")
                logger.error(
                    f"[_add_video_tracks] 失败片段数据: {json.dumps(segment_data, ensure_ascii=False, indent=2)}")
                import traceback
                logger.error(f"[_add_video_tracks] 异常堆栈: {traceback.format_exc()}")


def _add_video_segment(script_file: "ScriptFile", segment_data: Dict, track_name: str) -> None:
    """
    添加单个视频片段

    根据segment_data中的配置创建VideoSegment，支持完整的VideoSegment参数:
    - volume: 音量 (默认 1.0)
    - speed: 播放速度 (可选)
    - change_pitch: 是否跟随变速改变音调 (默认 False)
    - clip_settings: 位置变换设置
    - uniform_scale: 是否锁定XY轴缩放比例 (默认 True)

    VideoMaterial 素材配置:
    - material_name: 素材名称
    - material_type: 素材类型 ("video" 或 "photo")
    - width: 素材宽度
    - height: 素材高度
    - material_duration: 素材原始时长 (微秒)
    - local_material_id: 本地素材ID
    - crop_settings: 裁剪设置
        - upper_left_x/y, upper_right_x/y, lower_left_x/y, lower_right_x/y: 四角坐标 (0-1)

    同时支持:
    - fade: 音频淡入淡出效果
        - in_duration: 淡入时长 (微秒)
        - out_duration: 淡出时长 (微秒)
    - effects: 视频特效列表
        - type: 特效类型 (VideoSceneEffectType / VideoCharacterEffectType)
        - params: 特效参数列表 (0-100)
    - filters: 滤镜列表
        - type: 滤镜类型 (FilterType)
        - intensity: 滤镜强度 (0-100)
    - mask: 蒙版配置
        - type: 蒙版类型 (MaskType)
        - center_x/y: 中心坐标
        - size: 主要尺寸
        - rotation: 旋转角度
        - feather: 羽化程度 (0-100)
        - invert: 是否反转
        - rect_width: 矩形宽度 (仅矩形蒙版)
        - round_corner: 圆角 (仅矩形蒙版, 0-100)
    - transition: 转场配置
        - type: 转场类型 (TransitionType)
        - duration: 转场持续时间 (微秒)
    - background_filling: 背景填充配置
        - type: 填充类型 ("blur" 或 "color")
        - blur: 模糊程度 (0-1)
        - color: 填充颜色 (#RRGGBBAA)
    - animations: 动画配置
        - intro: 入场动画
            - type: 动画类型 (IntroType)
            - duration: 持续时间 (微秒)
        - outro: 出场动画
            - type: 动画类型 (OutroType)
            - duration: 持续时间 (微秒)
        - group: 组合动画
            - type: 动画类型 (GroupAnimationType)
            - duration: 持续时间 (微秒)
    - keyframes: 关键帧列表
        - property: 属性名称 (position_x, position_y, rotation, scale_x, scale_y, uniform_scale, alpha, saturation, contrast, brightness, volume)
        - time_offset: 时间偏移量 (微秒)
        - value: 属性值
    """
    if not HAS_JIANYING_LIB:
        return

    # 获取素材信息
    material_url = segment_data.get("material_url", segment_data.get("path", ""))
    material_name = segment_data.get("material_name")

    # 获取时间范围
    target_range = segment_data.get("target_timerange", {})
    source_range = segment_data.get("source_timerange", {})

    target_start = target_range.get("start", 0)
    target_duration = target_range.get("duration", 5000000)
    source_start = source_range.get("start", 0)
    source_duration = source_range.get("duration")

    # 获取视频参数
    volume = segment_data.get("volume", 1.0)
    speed = segment_data.get("speed")
    change_pitch = segment_data.get("change_pitch", False)

    # 创建裁剪设置
    crop_config = segment_data.get("crop_settings")
    crop_settings = CropSettings()
    if crop_config:
        crop_settings = CropSettings(
            upper_left_x=crop_config.get("upper_left_x", 0.0),
            upper_left_y=crop_config.get("upper_left_y", 0.0),
            upper_right_x=crop_config.get("upper_right_x", 1.0),
            upper_right_y=crop_config.get("upper_right_y", 0.0),
            lower_left_x=crop_config.get("lower_left_x", 0.0),
            lower_left_y=crop_config.get("lower_left_y", 1.0),
            lower_right_x=crop_config.get("lower_right_x", 1.0),
            lower_right_y=crop_config.get("lower_right_y", 1.0)
        )

    # 创建素材
    material_kwargs = {"path": material_url, "crop_settings": crop_settings}
    if material_name:
        material_kwargs["material_name"] = material_name
    material = VideoMaterial(**material_kwargs)

    # 补充素材元数据字段（如果提供了的话，覆盖自动检测的值）
    # 这些字段来自 VideoMaterial: material_type, width, height, duration, local_material_id
    material_type = segment_data.get("material_type")
    if material_type:
        material.material_type = material_type  # "video" 或 "photo"

    material_width = segment_data.get("width")
    if material_width is not None:
        material.width = material_width

    material_height = segment_data.get("height")
    if material_height is not None:
        material.height = material_height

    material_duration = segment_data.get("material_duration")
    if material_duration is not None:
        material.duration = material_duration

    local_material_id = segment_data.get("local_material_id")
    if local_material_id:
        material.local_material_id = local_material_id

    # 构建片段构造函数参数
    segment_kwargs = {
        "volume": volume,
        "change_pitch": change_pitch
    }

    # 设置 source_timerange
    if source_duration is not None:
        segment_kwargs["source_timerange"] = Timerange(source_start, source_duration)
    elif speed is not None:
        segment_kwargs["speed"] = speed

    # 设置 clip_settings
    clip_config = segment_data.get("clip_settings")
    if clip_config:
        segment_kwargs["clip_settings"] = ClipSettings(
            transform_x=clip_config.get("transform_x", 0.0),
            transform_y=clip_config.get("transform_y", 0.0),
            scale_x=clip_config.get("scale_x", 1.0),
            scale_y=clip_config.get("scale_y", 1.0),
            rotation=clip_config.get("rotation", 0.0),
            alpha=clip_config.get("alpha", 1.0),
            flip_horizontal=clip_config.get("flip_horizontal", False),
            flip_vertical=clip_config.get("flip_vertical", False)
        )

    # 创建视频片段
    segment = VideoSegment(
        material=material,
        target_timerange=Timerange(target_start, target_duration),
        **segment_kwargs
    )

    # 设置 uniform_scale (是否锁定XY轴缩放比例)
    uniform_scale = segment_data.get("uniform_scale")
    if uniform_scale is not None:
        segment.uniform_scale = uniform_scale

    # 添加音频淡入淡出效果
    fade_config = segment_data.get("fade")
    if fade_config:
        in_duration = fade_config.get("in_duration", 0)
        out_duration = fade_config.get("out_duration", 0)

        if in_duration or out_duration:
            segment.add_fade(in_duration, out_duration)

    # 添加视频特效
    effects_config = segment_data.get("effects", [])
    for effect in effects_config:
        effect_type_name = effect.get("type")
        effect_params = effect.get("params")

        if effect_type_name:
            effect_type = None

            # 尝试在 VideoSceneEffectType 中查找
            if hasattr(VideoSceneEffectType, effect_type_name):
                effect_type = getattr(VideoSceneEffectType, effect_type_name)
            # 尝试在 VideoCharacterEffectType 中查找
            elif hasattr(VideoCharacterEffectType, effect_type_name):
                effect_type = getattr(VideoCharacterEffectType, effect_type_name)

            if effect_type:
                try:
                    segment.add_effect(effect_type, effect_params)
                except ValueError as e:
                    print(f"添加视频特效失败: {e}")

    # 添加滤镜
    filters_config = segment_data.get("filters", [])
    for filter_item in filters_config:
        filter_type_name = filter_item.get("type")
        filter_intensity = filter_item.get("intensity", 100.0)

        if filter_type_name and hasattr(FilterType, filter_type_name):
            filter_type = getattr(FilterType, filter_type_name)
            try:
                segment.add_filter(filter_type, filter_intensity)
            except ValueError as e:
                print(f"添加滤镜失败: {e}")

    # 添加蒙版
    mask_config = segment_data.get("mask")
    if mask_config:
        mask_type_name = mask_config.get("type")
        if mask_type_name and hasattr(MaskType, mask_type_name):
            mask_type = getattr(MaskType, mask_type_name)
            try:
                segment.add_mask(
                    mask_type,
                    center_x=mask_config.get("center_x", 0.0),
                    center_y=mask_config.get("center_y", 0.0),
                    size=mask_config.get("size", 0.5),
                    rotation=mask_config.get("rotation", 0.0),
                    feather=mask_config.get("feather", 0.0),
                    invert=mask_config.get("invert", False),
                    rect_width=mask_config.get("rect_width"),
                    round_corner=mask_config.get("round_corner")
                )
            except ValueError as e:
                print(f"添加蒙版失败: {e}")

    # 添加转场
    transition_config = segment_data.get("transition")
    if transition_config:
        transition_type_name = transition_config.get("type")
        transition_duration = transition_config.get("duration")

        if transition_type_name and hasattr(TransitionType, transition_type_name):
            transition_type = getattr(TransitionType, transition_type_name)
            try:
                segment.add_transition(transition_type, duration=transition_duration)
            except ValueError as e:
                print(f"添加转场失败: {e}")

    # 添加背景填充
    bg_config = segment_data.get("background_filling")
    if bg_config:
        fill_type = bg_config.get("type")
        blur = bg_config.get("blur", 0.0625)
        color = bg_config.get("color", "#00000000")

        if fill_type:
            try:
                segment.add_background_filling(fill_type, blur, color)
            except ValueError as e:
                print(f"添加背景填充失败: {e}")

    # 添加动画效果
    animations_config = segment_data.get("animations", {})
    if animations_config:
        # 入场动画
        intro_config = animations_config.get("intro")
        if intro_config:
            intro_type = intro_config.get("type")
            intro_duration = intro_config.get("duration")
            if intro_type and hasattr(IntroType, intro_type):
                segment.add_animation(
                    getattr(IntroType, intro_type),
                    duration=intro_duration
                )

        # 出场动画
        outro_config = animations_config.get("outro")
        if outro_config:
            outro_type = outro_config.get("type")
            outro_duration = outro_config.get("duration")
            if outro_type and hasattr(OutroType, outro_type):
                segment.add_animation(
                    getattr(OutroType, outro_type),
                    duration=outro_duration
                )

        # 组合动画
        group_config = animations_config.get("group")
        if group_config:
            group_type = group_config.get("type")
            group_duration = group_config.get("duration")
            if group_type and hasattr(GroupAnimationType, group_type):
                segment.add_animation(
                    getattr(GroupAnimationType, group_type),
                    duration=group_duration
                )

    # ==================== 添加关键帧 ====================
    # 关键帧用于在视频片段的时间轴上动态改变属性值，实现动画效果。
    #
    # 关键帧数据格式 (来自 generate_keyframe.py 或直接传入):
    # {
    #     "keyframe_id": "唯一标识",
    #     "property": "属性名称",        # 对应 KeyframeProperty 枚举
    #     "time_offset": 0,              # 相对于片段开始的时间偏移量 (微秒)
    #     "value": 1.0                   # 该时间点的属性值
    # }
    #
    # 支持的关键帧属性 (对应 KeyframeProperty 枚举):
    # - position_x: 水平位置 (单位: 半个画布宽)
    # - position_y: 垂直位置 (单位: 半个画布高，上移为正)
    # - rotation: 旋转角度 (顺时针，单位: 度)
    # - scale_x: X轴缩放比例 (1.0 为原始大小)
    # - scale_y: Y轴缩放比例 (1.0 为原始大小)
    # - uniform_scale: 统一缩放比例 (与 scale_x/scale_y 互斥)
    # - alpha: 不透明度 (0.0~1.0，1.0 为完全不透明)
    # - saturation: 饱和度 (-1.0~1.0，0.0 为原始)
    # - contrast: 对比度 (-1.0~1.0，0.0 为原始)
    # - brightness: 亮度 (-1.0~1.0，0.0 为原始)
    # - volume: 音量 (1.0 为原始音量)
    #
    # 示例: 实现淡出效果 (透明度从 1.0 渐变到 0.0)
    # keyframes: [
    #     {"property": "alpha", "time_offset": 0, "value": 1.0},
    #     {"property": "alpha", "time_offset": 5000000, "value": 0.0}  # 5秒后完全透明
    # ]
    #
    # 参考:
    # - pjy/keyframe.py 中的 KeyframeProperty 枚举
    # - pjy/segment.py 中 VisualSegment.add_keyframe() 方法
    # - core/draft/populate/generate_keyframe.py 中的关键帧生成逻辑
    keyframes_config = segment_data.get("keyframes", [])
    for kf in keyframes_config:
        kf_property_name = kf.get("property")  # 属性名称 (如 "alpha", "rotation")
        time_offset = kf.get("time_offset")    # 时间偏移量 (微秒，相对于片段开始)
        kf_value = kf.get("value")             # 属性值 (具体含义取决于属性类型)

        if kf_property_name and time_offset is not None and kf_value is not None:
            # 将属性名称字符串映射到 KeyframeProperty 枚举值
            # 例如: "alpha" -> KeyframeProperty.alpha -> "KFTypeAlpha"
            if hasattr(KeyframeProperty, kf_property_name):
                kf_property = getattr(KeyframeProperty, kf_property_name)
                try:
                    # 调用 VisualSegment.add_keyframe() 添加关键帧
                    # 内部会将关键帧添加到 common_keyframes 列表中
                    segment.add_keyframe(kf_property, time_offset, kf_value)
                except (ValueError, TypeError) as e:
                    # 捕获可能的错误:
                    # - ValueError: 如同时设置 uniform_scale 和 scale_x/scale_y
                    # - TypeError: 参数类型错误
                    print(f"添加视频关键帧失败: {e}")

    script_file.add_segment(segment, track_name)


def _add_audio_tracks(script_file: "ScriptFile", audio_tracks: List[TrackData]) -> None:
    """添加音频轨道到草稿"""
    logger.debug(f"[_add_audio_tracks] 开始添加音频轨道, 轨道数: {len(audio_tracks)}")

    total_segments = sum(len(track.segments) for track in audio_tracks)
    logger.info(f"[_add_audio_tracks] 总轨道数: {len(audio_tracks)}, 总片段数: {total_segments}")

    for track_index, track in enumerate(audio_tracks):
        track_name = f"audio_track_{track_index}" if track_index > 0 else "audio"
        logger.debug(f"[_add_audio_tracks] 处理轨道 {track_index}, 轨道名称: {track_name}, 片段数: {len(track.segments)}")

        # 添加音频轨道
        if track_index == 0:
            logger.debug(f"[_add_audio_tracks] 添加主音频轨道: {track_name}")
            script_file.add_track(TrackType.audio, track_name, mute=track.mute)
        else:
            logger.debug(f"[_add_audio_tracks] 添加额外音频轨道: {track_name}, relative_index={track_index}")
            script_file.add_track(TrackType.audio, track_name, mute=track.mute, relative_index=track_index)

        for seg_idx, segment_data in enumerate(track.segments):
            material_url = segment_data.get("material_url", segment_data.get("path", ""))
            target_range = segment_data.get("target_timerange", {})
            logger.debug(f"[_add_audio_tracks] 轨道 {track_name} 片段 {seg_idx}: "
                        f"material_url={material_url}, "
                        f"target_start={target_range.get('start', 0)}, "
                        f"target_duration={target_range.get('duration', 0)}")

            try:
                _add_audio_segment(script_file, segment_data, track_name)
                logger.debug(f"[_add_audio_tracks] 轨道 {track_name} 片段 {seg_idx} 添加成功")
            except Exception as e:
                logger.error(f"[_add_audio_tracks] 轨道 {track_name} 片段 {seg_idx} 添加失败: {e}")
                logger.error(f"[_add_audio_tracks] 失败片段数据: {json.dumps(segment_data, ensure_ascii=False, indent=2)}")
                import traceback
                logger.error(f"[_add_audio_tracks] 异常堆栈: {traceback.format_exc()}")

    logger.info(f"[_add_audio_tracks] 完成, 共添加 {len(audio_tracks)} 个轨道, {total_segments} 个片段")


def _add_audio_segment(script_file: "ScriptFile", segment_data: Dict, track_name: str) -> None:
    """
    添加单个音频片段

    根据segment_data中的配置创建AudioSegment，支持完整的AudioSegment参数:

    素材元数据字段 (AudioMaterial):
    - material_url / path: 素材文件路径
    - material_name: 素材名称 (可选, 默认使用文件名)

    播放参数 (MediaSegment):
    - volume: 音量 (默认 1.0)
    - speed: 播放速度 (可选)
    - change_pitch: 是否跟随变速改变音调 (默认 False)

    时间范围 (BaseSegment):
    - target_timerange: {start, duration} - 片段在轨道上的目标时间范围 (微秒)
    - source_timerange: {start, duration} - 截取的素材片段时间范围 (微秒)

    音频效果:
    - fade: 淡入淡出效果
        - in_duration: 淡入时长 (微秒)
        - out_duration: 淡出时长 (微秒)
    - effects: 音频特效列表
        - type: 特效类型 (AudioSceneEffectType / ToneEffectType / SpeechToSongType)
        - params: 特效参数列表 (0-100)
    - keyframes: 音量关键帧列表
        - time_offset: 时间偏移量 (微秒)
        - volume: 音量值
    """
    if not HAS_JIANYING_LIB:
        return

    logger.debug(f"[_add_audio_segment] 开始处理音频片段, track_name={track_name}")

    material_url = segment_data.get("material_url", segment_data.get("path", ""))
    material_name = segment_data.get("material_name")

    # 获取时间范围
    target_range = segment_data.get("target_timerange", {})
    source_range = segment_data.get("source_timerange", {})

    target_start = target_range.get("start", 0)
    target_duration = target_range.get("duration", 5000000)
    source_start = source_range.get("start", 0)
    source_duration = source_range.get("duration")

    logger.debug(f"[_add_audio_segment] 时间范围 - target: start={target_start}, duration={target_duration}")
    logger.debug(f"[_add_audio_segment] 时间范围 - source: start={source_start}, duration={source_duration}")

    # 获取音频参数
    volume = segment_data.get("volume", 1.0)
    speed = segment_data.get("speed")
    change_pitch = segment_data.get("change_pitch", False)

    logger.debug(f"[_add_audio_segment] 音频参数 - volume={volume}, speed={speed}, change_pitch={change_pitch}")

    # 创建素材
    logger.debug(f"[_add_audio_segment] 创建音频素材: {material_url}")
    # AudioMaterial 构造函数参数: path, material_name (可选)
    material_kwargs = {"path": material_url}
    if material_name:
        material_kwargs["material_name"] = material_name
    material = AudioMaterial(**material_kwargs)

    # 检查并修正 source_duration，防止超出素材时长
    if source_duration is not None and source_duration > material.duration:
        logger.warning(f"[_add_audio_segment] source_duration ({source_duration}) 超出素材时长 ({material.duration})，自动裁剪")
        source_duration = material.duration

    # 构建构造函数参数
    segment_kwargs = {
        "volume": volume,
        "change_pitch": change_pitch
    }

    # 设置 source_timerange
    if source_duration is not None:
        logger.debug(f"[_add_audio_segment] 设置 source_timerange: start={source_start}, duration={source_duration}")
        segment_kwargs["source_timerange"] = Timerange(source_start, source_duration)
    elif speed is not None:
        # 如果指定了 speed 但没有 source_timerange，则不传递 source_timerange
        # AudioSegment 会自动根据 speed 计算
        logger.debug(f"[_add_audio_segment] 设置 speed: {speed}")
        segment_kwargs["speed"] = speed

    # 创建音频片段
    logger.debug(f"[_add_audio_segment] 创建 AudioSegment, kwargs={segment_kwargs}")
    segment = AudioSegment(
        material=material,
        target_timerange=Timerange(target_start, target_duration),
        **segment_kwargs
    )
    logger.debug(f"[_add_audio_segment] AudioSegment 创建成功")

    # 添加淡入淡出效果
    fade_config = segment_data.get("fade")
    if fade_config:
        in_duration = fade_config.get("in_duration", 0)
        out_duration = fade_config.get("out_duration", 0)
        logger.debug(f"[_add_audio_segment] 淡入淡出配置: in_duration={in_duration}, out_duration={out_duration}")

        # 支持字符串格式的时间 (如 "500ms", "1s")
        if in_duration or out_duration:
            segment.add_fade(in_duration, out_duration)
            logger.debug(f"[_add_audio_segment] 淡入淡出效果添加成功")

    # 添加音频特效
    effects_config = segment_data.get("effects", [])
    if effects_config:
        logger.debug(f"[_add_audio_segment] 处理音频特效, 数量: {len(effects_config)}")
    for effect_idx, effect in enumerate(effects_config):
        effect_type_name = effect.get("type")
        effect_params = effect.get("params")

        logger.debug(f"[_add_audio_segment] 特效 {effect_idx}: type={effect_type_name}, params={effect_params}")

        if effect_type_name:
            # 根据特效类型名称查找对应的枚举
            effect_type = None

            # 尝试在 AudioSceneEffectType 中查找
            if hasattr(AudioSceneEffectType, effect_type_name):
                effect_type = getattr(AudioSceneEffectType, effect_type_name)
                logger.debug(f"[_add_audio_segment] 特效类型在 AudioSceneEffectType 中找到")
            # 尝试在 ToneEffectType 中查找
            elif hasattr(ToneEffectType, effect_type_name):
                effect_type = getattr(ToneEffectType, effect_type_name)
                logger.debug(f"[_add_audio_segment] 特效类型在 ToneEffectType 中找到")
            # 尝试在 SpeechToSongType 中查找
            elif hasattr(SpeechToSongType, effect_type_name):
                effect_type = getattr(SpeechToSongType, effect_type_name)
                logger.debug(f"[_add_audio_segment] 特效类型在 SpeechToSongType 中找到")

            if effect_type:
                try:
                    segment.add_effect(effect_type, effect_params)
                    logger.debug(f"[_add_audio_segment] 特效 {effect_type_name} 添加成功")
                except ValueError as e:
                    logger.error(f"[_add_audio_segment] 添加音频特效失败: {e}, effect_type={effect_type_name}")
            else:
                logger.warning(f"[_add_audio_segment] 未找到特效类型: {effect_type_name}")

    # 添加音量关键帧
    keyframes_config = segment_data.get("keyframes", [])
    if keyframes_config:
        logger.debug(f"[_add_audio_segment] 处理音量关键帧, 数量: {len(keyframes_config)}")
    for kf_idx, kf in enumerate(keyframes_config):
        time_offset = kf.get("time_offset")
        kf_volume = kf.get("volume")

        if time_offset is not None and kf_volume is not None:
            segment.add_keyframe(time_offset, kf_volume)
            logger.debug(f"[_add_audio_segment] 关键帧 {kf_idx}: time_offset={time_offset}, volume={kf_volume}")

    logger.debug(f"[_add_audio_segment] 添加片段到轨道: {track_name}")
    script_file.add_segment(segment, track_name)
    logger.info(f"[_add_audio_segment] 完成, material_url={material_url}, track_name={track_name}")


def _add_text_tracks(script_file: "ScriptFile", text_tracks: List[TrackData]) -> None:
    """添加文本轨道到草稿"""
    for track_index, track in enumerate(text_tracks):
        track_name = f"text_track_{track_index}" if track_index > 0 else "text"

        if track_index == 0:
            script_file.add_track(TrackType.text, track_name)
        else:
            script_file.add_track(TrackType.text, track_name, relative_index=track_index)

        for segment_data in track.segments:
            try:
                _add_text_segment(script_file, segment_data, track_name)
            except Exception as e:
                print(f"添加文本片段失败: {e}")
                logger.error(f"[_add_text_tracks] 轨道 {track_name} 片段 {segment_data.get('text')} 添加失败: {e}")
                logger.error(
                    f"[_add_text_tracks] 失败片段数据: {json.dumps(segment_data, ensure_ascii=False, indent=2)}")
                import traceback
                logger.error(f"[_add_text_tracks] 异常堆栈: {traceback.format_exc()}")


def _hex_to_rgb(hex_color: str) -> tuple:
    """
    将十六进制颜色转换为 RGB 元组

    Args:
        hex_color: 十六进制颜色字符串，如 "#FFFFFF" 或 "FFFFFF"

    Returns:
        RGB 元组，取值范围为 [0, 1]
    """
    # 移除 # 前缀
    hex_color = hex_color.lstrip("#")

    # 解析十六进制值
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0

    return (r, g, b)


def _add_text_segment(script_file: "ScriptFile", segment_data: Dict, track_name: str) -> None:
    """
    添加单个文本片段

    根据segment_data中的配置创建TextSegment，支持完整的TextSegment参数。

    TextSegment 继承自 VisualSegment，因此也支持:
    - clip_settings: 位置变换设置
    - uniform_scale: 是否锁定XY轴缩放比例 (默认 True)

    TextStyle 字体样式参数:
    - size: 字体大小 (默认 8.0)
    - bold: 是否加粗 (默认 False)
    - italic: 是否斜体 (默认 False)
    - underline: 是否加下划线 (默认 False)
    - color: 字体颜色, RGB三元组, 取值范围 [0, 1] (默认 白色)
    - alpha: 字体不透明度, 取值范围 [0, 1] (默认 1.0)
    - align: 对齐方式 (0: 左对齐, 1: 居中, 2: 右对齐)
    - vertical: 是否为竖排文本 (默认 False)
    - letter_spacing: 字符间距 (默认 0)
    - line_spacing: 行间距 (默认 0)
    - auto_wrapping: 是否自动换行 (默认 False)
    - max_line_width: 最大行宽, 取值范围 [0, 1] (默认 0.82)
    - font: 字体类型 (FontType 枚举)

    TextBorder 文本描边参数:
    - alpha: 描边不透明度, 取值范围 [0, 1] (默认 1.0)
    - color: 描边颜色, RGB三元组, 取值范围 [0, 1] (默认 黑色)
    - width: 描边宽度, 取值范围 [0, 100] (默认 40.0)

    TextBackground 文本背景参数:
    - color: 背景颜色, 格式为 '#RRGGBB' (必填)
    - style: 背景样式, 1 或 2 (默认 1)
    - alpha: 背景不透明度, 取值范围 [0, 1] (默认 1.0)
    - round_radius: 背景圆角半径, 取值范围 [0, 1] (默认 0.0)
    - height: 背景高度, 取值范围 [0, 1] (默认 0.14)
    - width: 背景宽度, 取值范围 [0, 1] (默认 0.14)
    - horizontal_offset: 背景水平偏移, 取值范围 [0, 1] (默认 0.5)
    - vertical_offset: 背景竖直偏移, 取值范围 [0, 1] (默认 0.5)

    TextShadow 文本阴影参数:
    - alpha: 阴影不透明度, 取值范围 [0, 1] (默认 1.0)
    - color: 阴影颜色, RGB三元组, 取值范围 [0, 1] (默认 黑色)
    - diffuse: 阴影扩散程度, 取值范围 [0, 100] (默认 15.0)
    - distance: 阴影距离, 取值范围 [0, 100] (默认 5.0)
    - angle: 阴影角度, 取值范围 [-180, 180] (默认 -45.0)

    TextBubble 文本气泡参数:
    - effect_id: 气泡效果的 effect_id
    - resource_id: 气泡效果的 resource_id

    TextEffect 花字效果参数:
    - effect_id: 花字效果的 effect_id (也作为 resource_id)

    ClipSettings 位置变换设置:
    - transform_x: 水平位移, 单位为半个画布宽 (默认 0.0)
    - transform_y: 垂直位移, 单位为半个画布高 (默认 0.0)
    - scale_x: 水平缩放比例 (默认 1.0)
    - scale_y: 垂直缩放比例 (默认 1.0)
    - rotation: 顺时针旋转的角度 (默认 0.0)
    - alpha: 图像不透明度, 取值范围 [0, 1] (默认 1.0)
    - flip_horizontal: 是否水平翻转 (默认 False)
    - flip_vertical: 是否垂直翻转 (默认 False)

    动画效果 (animations):
    - intro: 入场动画
        - type: 动画类型 (TextIntro 枚举)
        - duration: 持续时间 (微秒)
    - outro: 出场动画
        - type: 动画类型 (TextOutro 枚举)
        - duration: 持续时间 (微秒)
    - loop: 循环动画
        - type: 动画类型 (TextLoopAnim 枚举)

    关键帧 (keyframes):
    - property: 属性名称 (position_x, position_y, rotation, scale_x, scale_y, uniform_scale, alpha)
    - time_offset: 时间偏移量 (微秒)
    - value: 属性值
    """
    if not HAS_JIANYING_LIB:
        return

    content = segment_data.get("content", "")
    target_range = segment_data.get("target_timerange", {})

    target_start = target_range.get("start", 0)
    target_duration = target_range.get("duration", 5000000)

    # 获取样式配置
    style_config = segment_data.get("style", {})

    # 处理颜色转换（支持十六进制和RGB元组两种格式）
    color_value = style_config.get("color", "#FFFFFF")
    if isinstance(color_value, str):
        color = _hex_to_rgb(color_value)
    elif isinstance(color_value, (list, tuple)) and len(color_value) == 3:
        # 如果是 [0-255] 范围的整数值，转换为 [0, 1] 范围
        if all(isinstance(c, int) for c in color_value):
            color = tuple(c / 255.0 for c in color_value)
        else:
            color = tuple(color_value)
    else:
        color = (1.0, 1.0, 1.0)  # 默认白色

    # 创建文本样式 (完全对齐 pjy.text_segment.TextStyle)
    text_style = TextStyle(
        size=style_config.get("size", 8.0),
        bold=style_config.get("bold", False),
        italic=style_config.get("italic", False),
        underline=style_config.get("underline", False),
        color=color,
        alpha=style_config.get("alpha", 1.0),
        align=style_config.get("align", 0),
        vertical=style_config.get("vertical", False),
        letter_spacing=style_config.get("letter_spacing", 0),
        line_spacing=style_config.get("line_spacing", 0),
        auto_wrapping=style_config.get("auto_wrapping", False),
        max_line_width=style_config.get("max_line_width", 0.82)
    )

    # 创建文本片段
    segment = TextSegment(
        text=content,
        timerange=Timerange(target_start, target_duration),
        style=text_style
    )

    # 设置字体 (如果指定了 FontType)
    font_value = style_config.get("font")
    if font_value and hasattr(FontType, font_value):
        segment.font = getattr(FontType, font_value).value

    # 添加文本描边
    border_config = segment_data.get("border")
    if border_config:
        border_color = border_config.get("color", "#000000")
        if isinstance(border_color, str):
            border_color = _hex_to_rgb(border_color)
        segment.border = TextBorder(
            alpha=border_config.get("alpha", 1.0),
            color=border_color,
            width=border_config.get("width", 40.0)
        )

    # 添加文本背景
    background_config = segment_data.get("background")
    if background_config:
        segment.background = TextBackground(
            color=background_config.get("color", "#000000"),
            style=background_config.get("style", 1),
            alpha=background_config.get("alpha", 1.0),
            round_radius=background_config.get("round_radius", 0.0),
            height=background_config.get("height", 0.14),
            width=background_config.get("width", 0.14),
            horizontal_offset=background_config.get("horizontal_offset", 0.5),
            vertical_offset=background_config.get("vertical_offset", 0.5)
        )

    # 添加文本阴影
    shadow_config = segment_data.get("shadow")
    if shadow_config:
        shadow_color = shadow_config.get("color", "#000000")
        if isinstance(shadow_color, str):
            shadow_color = _hex_to_rgb(shadow_color)
        segment.shadow = TextShadow(
            alpha=shadow_config.get("alpha", 1.0),
            color=shadow_color,
            diffuse=shadow_config.get("diffuse", 15.0),
            distance=shadow_config.get("distance", 5.0),
            angle=shadow_config.get("angle", -45.0)
        )

    # 添加气泡效果
    bubble_config = segment_data.get("bubble")
    if bubble_config:
        segment.add_bubble(
            effect_id=bubble_config.get("effect_id", ""),
            resource_id=bubble_config.get("resource_id", "")
        )

    # 添加花字效果
    effect_config = segment_data.get("effect")
    if effect_config:
        segment.add_effect(
            effect_id=effect_config.get("effect_id", "")
        )

    # 设置位置变换
    clip_config = segment_data.get("clip_settings")
    if clip_config:
        segment.clip_settings = ClipSettings(
            transform_x=clip_config.get("transform_x", 0.0),
            transform_y=clip_config.get("transform_y", 0.0),
            scale_x=clip_config.get("scale_x", 1.0),
            scale_y=clip_config.get("scale_y", 1.0),
            rotation=clip_config.get("rotation", 0.0),
            alpha=clip_config.get("alpha", 1.0),
            flip_horizontal=clip_config.get("flip_horizontal", False),
            flip_vertical=clip_config.get("flip_vertical", False)
        )

    # 设置 uniform_scale (是否锁定XY轴缩放比例)
    uniform_scale = segment_data.get("uniform_scale")
    if uniform_scale is not None:
        segment.uniform_scale = uniform_scale

    # 添加动画效果
    animations_config = segment_data.get("animations", {})
    if animations_config:
        # 入场动画
        intro_config = animations_config.get("intro")
        if intro_config:
            intro_type = intro_config.get("type")
            intro_duration = intro_config.get("duration")
            if intro_type and hasattr(TextIntro, intro_type):
                segment.add_animation(
                    getattr(TextIntro, intro_type),
                    duration=intro_duration
                )

        # 出场动画
        outro_config = animations_config.get("outro")
        if outro_config:
            outro_type = outro_config.get("type")
            outro_duration = outro_config.get("duration")
            if outro_type and hasattr(TextOutro, outro_type):
                segment.add_animation(
                    getattr(TextOutro, outro_type),
                    duration=outro_duration
                )

        # 循环动画
        loop_config = animations_config.get("loop")
        if loop_config:
            loop_type = loop_config.get("type")
            if loop_type and hasattr(TextLoopAnim, loop_type):
                segment.add_animation(getattr(TextLoopAnim, loop_type))

    # ==================== 添加关键帧 ====================
    # 关键帧用于在文本片段的时间轴上动态改变属性值，实现动画效果。
    #
    # 关键帧数据格式:
    # {
    #     "keyframe_id": "唯一标识",
    #     "property": "属性名称",        # 对应 KeyframeProperty 枚举
    #     "time_offset": 0,              # 相对于片段开始的时间偏移量 (微秒)
    #     "value": 1.0                   # 该时间点的属性值
    # }
    #
    # 文本片段支持的关键帧属性 (对应 KeyframeProperty 枚举):
    # - position_x: 水平位置 (单位: 半个画布宽)
    # - position_y: 垂直位置 (单位: 半个画布高，上移为正)
    # - rotation: 旋转角度 (顺时针，单位: 度)
    # - scale_x: X轴缩放比例 (1.0 为原始大小)
    # - scale_y: Y轴缩放比例 (1.0 为原始大小)
    # - uniform_scale: 统一缩放比例 (与 scale_x/scale_y 互斥)
    # - alpha: 不透明度 (0.0~1.0，1.0 为完全不透明)
    #
    # 示例: 实现文本淡出效果 (透明度从 1.0 渐变到 0.0)
    # keyframes: [
    #     {"property": "alpha", "time_offset": 0, "value": 1.0},
    #     {"property": "alpha", "time_offset": 5000000, "value": 0.0}  # 5秒后完全透明
    # ]
    keyframes_config = segment_data.get("keyframes", [])
    for kf in keyframes_config:
        kf_property_name = kf.get("property")  # 属性名称 (如 "alpha", "rotation")
        time_offset = kf.get("time_offset")    # 时间偏移量 (微秒，相对于片段开始)
        kf_value = kf.get("value")             # 属性值 (具体含义取决于属性类型)

        if kf_property_name and time_offset is not None and kf_value is not None:
            # 将属性名称字符串映射到 KeyframeProperty 枚举值
            # 例如: "alpha" -> KeyframeProperty.alpha
            if hasattr(KeyframeProperty, kf_property_name):
                kf_property = getattr(KeyframeProperty, kf_property_name)
                try:
                    # 调用 VisualSegment.add_keyframe() 添加关键帧
                    # 内部会将关键帧添加到 common_keyframes 列表中
                    segment.add_keyframe(kf_property, time_offset, kf_value)
                except (ValueError, TypeError) as e:
                    # 捕获可能的错误:
                    # - ValueError: 如同时设置 uniform_scale 和 scale_x/scale_y
                    # - TypeError: 参数类型错误
                    print(f"添加文本关键帧失败: {e}")

    script_file.add_segment(segment, track_name)


def _add_sticker_tracks(script_file: "ScriptFile", sticker_tracks: List[List[Dict]]) -> None:
    """添加贴纸轨道到草稿"""
    # 贴纸处理比较复杂，这里简化处理
    pass


def _add_video_effects_to_draft(script_file: "ScriptFile", effect_ids: List[str]) -> None:
    """添加视频特效到草稿"""
    # 特效需要在视频片段上应用
    pass


def _add_video_filters_to_draft(script_file: "ScriptFile", filter_ids: List[str]) -> None:
    """添加视频滤镜到草稿"""
    pass


def _add_audio_effects_to_draft(script_file: "ScriptFile", effect_ids: List[str]) -> None:
    """添加音频特效到草稿"""
    pass


def _add_keyframes_to_draft(script_file: "ScriptFile", keyframes: List[Dict]) -> None:
    """添加关键帧到草稿"""
    pass


def _add_audio_keyframes_to_draft(script_file: "ScriptFile", keyframes: List[Dict]) -> None:
    """添加音频关键帧到草稿"""
    pass


# ==================== 数据获取函数 ====================

def get_video_tracks(draft_id: str) -> List[TrackData]:
    """
    获取草稿的所有视频轨道

    将缓存中的原始视频数据转换为标准的视频轨道格式，包含完整的视频片段参数:
    - track_type: 素材轨类型（这里是video）
    - mute: 轨道是否静音
    - track_name: 轨道名称
    - segments： 视频片段列表
        每个视频片段包含以下字段:
        - id: 片段唯一标识
        - material_url / path: 素材路径
        - material_name: 素材名称
        - target_timerange: {start, duration} - 目标时间范围 (微秒)
        - source_timerange: {start, duration} - 素材时间范围 (微秒)
        - volume: 音量 (默认 1.0)
        - speed: 播放速度
        - change_pitch: 变速是否变调
        - crop_settings: 裁剪设置 {upper_left_x/y, upper_right_x/y, lower_left_x/y, lower_right_x/y}
        - clip_settings: 位置变换设置 {transform_x, transform_y, scale_x, scale_y, rotation, alpha, flip_horizontal, flip_vertical}
        - fade: 淡入淡出 {in_duration, out_duration}
        - effects: 视频特效列表 [{type, params}]
        - filters: 滤镜列表 [{type, intensity}]
        - mask: 蒙版配置 {type, center_x, center_y, size, rotation, feather, invert, rect_width, round_corner}
        - transition: 转场配置 {type, duration}
        - background_filling: 背景填充 {type, blur, color}
        - animations: 动画配置 {intro, outro, group}
        - keyframes: 关键帧列表 [{property, time_offset, value}]

    Args:
        draft_id: 草稿ID

    Returns:
        视频轨道列表，每个轨道包含多个视频片段配置
    """
    raw_tracks = _get_cached_data(draft_id, DRAFT_VIDEOS)

    if not raw_tracks:
        return []

    # 获取独立存储的 effects/filters
    cached_effects = _get_cached_data(draft_id, DRAFT_EFFECTS)
    cached_filters = _get_cached_data(draft_id, DRAFT_FILTERS)

    # 获取独立存储的关键帧详情
    # 关键帧详情格式: {keyframe_id, segment_id, segment_type, segment_index, property, time_offset, value}
    cached_keyframes_key = format_draft_key(draft_id, GEN_KEYFRAMES)
    cached_keyframe_details = draft_cache.get(f"{cached_keyframes_key}:details") or []

    # 按 segment_id 分组关键帧
    keyframes_by_segment: Dict[str, List[Dict]] = {}
    for kf in cached_keyframe_details:
        seg_id = kf.get("segment_id")
        if seg_id:
            if seg_id not in keyframes_by_segment:
                keyframes_by_segment[seg_id] = []
            keyframes_by_segment[seg_id].append({
                "keyframe_id": kf.get("keyframe_id"),
                "property": kf.get("property"),
                "time_offset": kf.get("time_offset"),
                "value": kf.get("value")
            })

    normalized_tracks = []

    for track in raw_tracks:
        normalized_segments = []

        for segment in track.get("segments", []) if isinstance(track, dict) else track:
            # 构建标准化的视频片段数据
            normalized_segment = _normalize_video_segment(segment)

            # 合并独立存储的 effects/filters
            # 仅当 segment 自身没有 effects/filters 时，才从独立缓存补充
            if cached_effects and not normalized_segment.get("effects"):
                normalized_segment["effects"] = [
                    {"type": effect_id, "params": []}
                    for effect_id in cached_effects
                ]
            if cached_filters and not normalized_segment.get("filters"):
                normalized_segment["filters"] = [
                    {"type": filter_id, "intensity": 100.0}
                    for filter_id in cached_filters
                ]

            # 合并独立存储的关键帧
            segment_id = normalized_segment.get("id", "")
            if segment_id and segment_id in keyframes_by_segment:
                # 如果 segment 自身没有 keyframes，则从独立缓存补充
                if not normalized_segment.get("keyframes"):
                    normalized_segment["keyframes"] = keyframes_by_segment[segment_id]

            normalized_segments.append(normalized_segment)

        # normalized_tracks.append(normalized_segments)
        normalized_tracks.append(TrackData(
            track_type=track.get("track_type"),
            segments=normalized_segments,
            track_name=track.get("track_name"),
            mute=track.get("mute")
        ))

    return normalized_tracks


def _normalize_video_segment(segment: Dict) -> Dict:
    """
    标准化视频片段数据

    将各种格式的视频数据统一转换为 _add_video_segment 所需的标准格式

    Args:
        segment: 原始视频片段数据

    Returns:
        标准化的视频片段数据
    """
    # 基础信息
    normalized = {
        "id": segment.get("id", ""),
        "material_url": segment.get("material_url") or segment.get("video_url") or segment.get("path", ""),
        "material_name": segment.get("material_name") or segment.get("name", ""),
        # 素材元数据字段 (VideoMaterial)
        "material_type": segment.get("material_type", "video"),  # 素材类型: "video" 或 "photo"
        "width": segment.get("width"),  # 素材宽度
        "height": segment.get("height"),  # 素材高度
        "material_duration": segment.get("material_duration") or segment.get("duration"),  # 素材原始时长 (微秒)
        "local_material_id": segment.get("local_material_id", ""),  # 本地素材ID
    }

    # 目标时间范围
    target_range = segment.get("target_timerange", {})
    normalized["target_timerange"] = {
        "start": target_range.get("start", 0),
        "duration": target_range.get("duration", 5000000)
    }

    # 素材时间范围
    source_range = segment.get("source_timerange", {})
    source_duration = source_range.get("duration")
    normalized["source_timerange"] = {
        "start": source_range.get("start", 0),
        "duration": source_duration if source_duration is not None else normalized["target_timerange"]["duration"]
    }

    # 播放参数
    if segment.get("speed") is not None:
        normalized["speed"] = segment["speed"]
    if segment.get("volume") is not None:
        normalized["volume"] = segment["volume"]
    if segment.get("change_pitch") is not None:
        normalized["change_pitch"] = segment["change_pitch"]

    # 裁剪设置 (crop_settings)
    crop_settings = segment.get("crop_settings", {})
    if crop_settings:
        normalized["crop_settings"] = {
            "upper_left_x": crop_settings.get("upper_left_x", 0.0),
            "upper_left_y": crop_settings.get("upper_left_y", 0.0),
            "upper_right_x": crop_settings.get("upper_right_x", 1.0),
            "upper_right_y": crop_settings.get("upper_right_y", 0.0),
            "lower_left_x": crop_settings.get("lower_left_x", 0.0),
            "lower_left_y": crop_settings.get("lower_left_y", 1.0),
            "lower_right_x": crop_settings.get("lower_right_x", 1.0),
            "lower_right_y": crop_settings.get("lower_right_y", 1.0)
        }

    # 位置变换设置 (clip_settings)
    # 支持多种字段名称的兼容
    clip_settings = segment.get("clip_settings", {})
    if clip_settings or any(k in segment for k in ["alpha", "flip_horizontal", "flip_vertical", "rotation", "scale_x", "scale_y", "transform_x", "transform_y"]):
        normalized["clip_settings"] = {
            "transform_x": clip_settings.get("transform_x", segment.get("transform_x", 0.0)),
            "transform_y": clip_settings.get("transform_y", segment.get("transform_y", 0.0)),
            "scale_x": clip_settings.get("scale_x", segment.get("scale_x", 1.0)),
            "scale_y": clip_settings.get("scale_y", segment.get("scale_y", 1.0)),
            "rotation": clip_settings.get("rotation", segment.get("rotation", 0.0)),
            "alpha": clip_settings.get("alpha", segment.get("alpha", 1.0)),
            "flip_horizontal": clip_settings.get("flip_horizontal", segment.get("flip_horizontal", False)),
            "flip_vertical": clip_settings.get("flip_vertical", segment.get("flip_vertical", False))
        }

    # 是否锁定XY轴缩放比例 (uniform_scale)
    if segment.get("uniform_scale") is not None:
        normalized["uniform_scale"] = segment["uniform_scale"]

    # 淡入淡出 (fade)
    fade_config = segment.get("fade", {})
    if fade_config:
        normalized["fade"] = {
            "in_duration": fade_config.get("in_duration", 0),
            "out_duration": fade_config.get("out_duration", 0)
        }

    # 视频特效 (effects)
    effects = segment.get("effects", [])
    if effects:
        normalized["effects"] = []
        for effect in effects:
            normalized["effects"].append({
                "type": effect.get("type", ""),  # 特效名称
                "params": effect.get("params", [])  # 特效参数，不同特效，参数不一样
            })

    # 滤镜 (filters)
    filters = segment.get("filters", [])
    if filters:
        normalized["filters"] = []
        for f in filters:
            normalized["filters"].append({
                "type": f.get("type", ""),  # 滤镜名称
                "intensity": f.get("intensity", 100.0)  # 滤镜强度，取值范围：0-100
            })

    # 蒙版 (mask)
    mask_config = segment.get("mask", {})
    if mask_config:
        normalized["mask"] = {
            "type": mask_config.get("type", ""),
            "center_x": mask_config.get("center_x", 0.0),
            "center_y": mask_config.get("center_y", 0.0),
            "size": mask_config.get("size", 0.5),
            "rotation": mask_config.get("rotation", 0.0),
            "feather": mask_config.get("feather", 0.0),
            "invert": mask_config.get("invert", False),
            "rect_width": mask_config.get("rect_width"),
            "round_corner": mask_config.get("round_corner")
        }

    # 转场 (transition)
    transition_config = segment.get("transition", {})
    if transition_config:
        normalized["transition"] = {
            "type": transition_config.get("type") or transition_config.get("name", ""),
            "duration": transition_config.get("duration")
        }

    # 背景填充 (background_filling)
    bg_config = segment.get("background_filling", {})
    if bg_config:
        normalized["background_filling"] = {
            "type": bg_config.get("type", "blur"),
            "blur": bg_config.get("blur", 0.0625),
            "color": bg_config.get("color", "#00000000")
        }

    # 动画 (animations)
    animations = segment.get("animation", {})
    if animations:
        normalized["animations"] = {}

        # 入场动画
        intro = animations.get("intro", {})
        if intro:
            normalized["animations"]["intro"] = {
                "type": intro.get("type", ""),
                "duration": intro.get("duration")
            }

        # 出场动画
        outro = animations.get("outro", {})
        if outro:
            normalized["animations"]["outro"] = {
                "type": outro.get("type", ""),
                "duration": outro.get("duration")
            }

        # 组合动画
        group = animations.get("group", {})
        if group:
            normalized["animations"]["group"] = {
                "type": group.get("type", ""),
                "duration": group.get("duration")
            }

    # 关键帧 (keyframes)
    # 支持多种关键帧属性: position_x, position_y, rotation, scale_x, scale_y, uniform_scale,
    #                   alpha, saturation, contrast, brightness, volume
    keyframes = segment.get("keyframes", [])
    if keyframes:
        normalized["keyframes"] = []
        for kf in keyframes:
            normalized["keyframes"].append({
                "keyframe_id": kf.get("keyframe_id", ""),
                "property": kf.get("property", ""),  # 关键帧属性名称
                "time_offset": kf.get("time_offset", 0),  # 时间偏移量 (微秒)
                "value": kf.get("value", 0.0)  # 属性值
            })

    return normalized


def _normalize_audio_segment(segment: Dict) -> Dict:
    """
    标准化音频片段数据

    将各种格式的音频数据统一转换为 _add_audio_segment 所需的标准格式

    Args:
        segment: 原始音频片段数据

    Returns:
        标准化的音频片段数据
    """
    # 基础信息
    normalized = {
        "id": segment.get("id", ""),
        "material_url": segment.get("material_url") or segment.get("audio_url") or segment.get("path", ""),
        "material_name": segment.get("material_name") or segment.get("name", ""),
    }

    # 目标时间范围
    target_range = segment.get("target_timerange", {})
    normalized["target_timerange"] = {
        "start": target_range.get("start", 0),
        "duration": target_range.get("duration", 5000000)
    }

    # 素材时间范围
    source_range = segment.get("source_timerange", {})
    source_duration = source_range.get("duration")
    normalized["source_timerange"] = {
        "start": source_range.get("start", 0),
        "duration": source_duration if source_duration is not None else normalized["target_timerange"]["duration"]
    }

    # 播放参数
    if segment.get("speed") is not None:
        normalized["speed"] = segment["speed"]
    if segment.get("volume") is not None:
        normalized["volume"] = segment["volume"]
    if segment.get("change_pitch") is not None:
        normalized["change_pitch"] = segment["change_pitch"]

    # 淡入淡出 (fade)
    fade_config = segment.get("fade", {})
    if fade_config:
        normalized["fade"] = {
            "in_duration": fade_config.get("in_duration", 0),
            "out_duration": fade_config.get("out_duration", 0)
        }

    # 音频特效 (effects)
    effects = segment.get("effects", [])
    if effects:
        normalized["effects"] = []
        for effect in effects:
            normalized["effects"].append({
                "type": effect.get("type", ""),
                "params": effect.get("params", [])
            })

    # 关键帧 (keyframes) - 音频关键帧主要用于音量变化
    # 支持两种格式:
    # 1. {time_offset, volume} - 来自 audio_info.py
    # 2. {time_offset, value} - 通用格式
    keyframes = segment.get("keyframes", [])
    if keyframes:
        normalized["keyframes"] = []
        for kf in keyframes:
            # 音频关键帧可能使用 volume 或 value
            kf_volume = kf.get("volume", kf.get("value", 1.0))
            normalized["keyframes"].append({
                "keyframe_id": kf.get("keyframe_id", ""),
                "time_offset": kf.get("time_offset", 0),
                "volume": kf_volume
            })

    return normalized


def get_audio_tracks(draft_id: str) -> List[TrackData]:
    """
    获取草稿的所有音频轨道

    将缓存中的原始音频数据转换为标准的音频轨道格式，包含完整的音频片段参数:
    - track_type: 素材轨类型（这里是audio）
    - mute: 轨道是否静音
    - track_name: 轨道名称
    - segments： 音频片段列表
        每个音频片段包含以下字段:

        素材元数据字段 (AudioMaterial):
        - id: 片段唯一标识
        - material_url / audio_url / path: 素材路径
        - material_name: 素材名称

        时间范围 (BaseSegment):
        - target_timerange: {start, duration} - 目标时间范围 (微秒)
        - source_timerange: {start, duration} - 素材时间范围 (微秒)

        播放参数 (MediaSegment):
        - volume: 音量 (默认 1.0)
        - speed: 播放速度
        - change_pitch: 变速是否变调

        音频效果 (AudioSegment):
        - fade: 淡入淡出 {in_duration, out_duration}
        - effects: 音频特效列表 [{type, params}]
        - keyframes: 音量关键帧列表 [{time_offset, volume}]

    Args:
        draft_id: 草稿ID

    Returns:
        音频轨道列表，每个轨道包含多个音频片段配置
    """
    logger.debug(f"[get_audio_tracks] 开始获取音频轨道, draft_id={draft_id}")

    raw_tracks = _get_cached_data(draft_id, DRAFT_AUDIOS)
    logger.debug(f"[get_audio_tracks] 原始音频轨道数据: {len(raw_tracks) if raw_tracks else 0} 轨道")

    if not raw_tracks:
        logger.debug(f"[get_audio_tracks] 无音频轨道数据, draft_id={draft_id}")
        return []

    # 获取独立存储的音频关键帧详情
    # 音频关键帧详情格式: {keyframe_id, audio_id, segment_index, time_offset, volume}
    cached_audio_keyframes_key = format_draft_key(draft_id, GEN_AUDIO_KEYFRAMES)
    cached_audio_keyframe_details = draft_cache.get(f"{cached_audio_keyframes_key}:details") or []
    logger.debug(f"[get_audio_tracks] 音频关键帧详情数量: {len(cached_audio_keyframe_details)}")
    logger.debug(f"[get_audio_tracks] 音频关键帧详情数据: {json.dumps(cached_audio_keyframe_details, ensure_ascii=False, indent=2)}")

    # 按 audio_id 分组关键帧
    keyframes_by_audio: Dict[str, List[Dict]] = {}
    for kf in cached_audio_keyframe_details:
        audio_id = kf.get("audio_id")
        if audio_id:
            if audio_id not in keyframes_by_audio:
                keyframes_by_audio[audio_id] = []
            keyframes_by_audio[audio_id].append({
                "keyframe_id": kf.get("keyframe_id"),
                "time_offset": kf.get("time_offset"),
                "volume": kf.get("volume")
            })

    logger.debug(f"[get_audio_tracks] 按 audio_id 分组后的关键帧数量: {len(keyframes_by_audio)} 个音频有关键帧")
    for audio_id, kfs in keyframes_by_audio.items():
        logger.debug(f"[get_audio_tracks] audio_id={audio_id} 的关键帧: {len(kfs)} 个")

    normalized_tracks = []

    for track_index, track in enumerate(raw_tracks):
        track_segments = track.get("segments", []) if isinstance(track, dict) else track
        logger.debug(f"[get_audio_tracks] 处理轨道 {track_index}, 片段数: {len(track_segments)}")
        normalized_segments = []

        for segment_index, segment in enumerate(track_segments):
            # 构建标准化的音频片段数据
            normalized_segment = _normalize_audio_segment(segment)
            logger.debug(f"[get_audio_tracks] 轨道 {track_index} 片段 {segment_index}: id={normalized_segment.get('id')}, "
                        f"material_url={normalized_segment.get('material_url', '')[:50]}...")

            # 合并独立存储的音频关键帧
            audio_id = normalized_segment.get("id", "")
            if audio_id and audio_id in keyframes_by_audio:
                # 如果 segment 自身没有 keyframes，则从独立缓存补充
                if not normalized_segment.get("keyframes"):
                    normalized_segment["keyframes"] = keyframes_by_audio[audio_id]
                    logger.debug(f"[get_audio_tracks] 为 audio_id={audio_id} 补充 {len(keyframes_by_audio[audio_id])} 个关键帧")
                else:
                    logger.debug(f"[get_audio_tracks] audio_id={audio_id} 已有关键帧, 跳过补充")

            normalized_segments.append(normalized_segment)

        # normalized_tracks.append(normalized_segments)
        normalized_tracks.append(TrackData(
            track_type=track.get("track_type"),
            segments=normalized_segments,
            track_name=track.get("track_name"),
            mute=track.get("mute")
        ))

    return normalized_tracks


def get_text_tracks(draft_id: str) -> List[TrackData]:
    """
    获取草稿的所有文本轨道

    将缓存中的原始文本数据转换为标准的文本轨道格式，包含完整的文本片段参数:
    - track_type: 素材轨类型（这里是text）
    - track_name: 轨道名称
    - segments： 视频片段列表

        每个文本片段包含以下字段:
        - id: 片段唯一标识
        - content: 文本内容
        - target_timerange: {start, duration} - 目标时间范围 (微秒)
        - style: 文本样式 {size, bold, italic, underline, color, alpha, align, vertical, letter_spacing, line_spacing, auto_wrapping, max_line_width, font}
        - clip_settings: 位置变换设置 {transform_x, transform_y, scale_x, scale_y, rotation, alpha, flip_horizontal, flip_vertical}
        - uniform_scale: 是否锁定XY轴缩放比例 (默认 True)
        - border: 文本描边 {alpha, color, width}
        - background: 文本背景 {color, style, alpha, round_radius, height, width, horizontal_offset, vertical_offset}
        - shadow: 文本阴影 {alpha, color, diffuse, distance, angle}
        - bubble: 文本气泡 {effect_id, resource_id}
        - effect: 花字效果 {effect_id}
        - animations: 动画配置 {intro, outro, loop}
        - keyframes: 关键帧列表 [{property, time_offset, value}]
            - property: 属性名称 (position_x, position_y, rotation, scale_x, scale_y, uniform_scale, alpha)
            - time_offset: 时间偏移量 (微秒)
            - value: 属性值

    Args:
        draft_id: 草稿ID

    Returns:
        文本轨道列表，每个轨道包含多个文本片段配置
    """
    raw_tracks = _get_cached_data(draft_id, DRAFT_TEXTS)

    if not raw_tracks:
        return []

    normalized_tracks = []

    for track in raw_tracks:
        normalized_segments = []

        for segment in track.get("segments", []) if isinstance(track, dict) else track:
            # 构建标准化的文本片段数据
            normalized_segment = _normalize_text_segment(segment)
            normalized_segments.append(normalized_segment)

        # normalized_tracks.append(normalized_segments)
        normalized_tracks.append(TrackData(
            track_type=track.get("track_type"),
            segments=normalized_segments,
            track_name=track.get("track_name")
        ))

    return normalized_tracks


def _normalize_text_segment(segment: Dict) -> Dict:
    """
    标准化文本片段数据

    将各种格式的文本数据统一转换为 _add_text_segment 所需的标准格式

    支持的字段映射:
    - text -> content (文本内容)
    - timerange -> target_timerange (时间范围)
    - intro_animation -> animations.intro (入场动画)
    - outro_animation -> animations.outro (出场动画)
    - loop_animation_type -> animations.loop (循环动画)

    Args:
        segment: 原始文本片段数据

    Returns:
        标准化的文本片段数据
    """
    # 基础信息
    # 支持 text 或 content 字段
    normalized = {
        "id": segment.get("id", ""),
        "content": segment.get("content") or segment.get("text", ""),
    }

    # 目标时间范围
    # 支持 timerange 或 target_timerange 字段
    target_range = segment.get("target_timerange") or segment.get("timerange", {})
    normalized["target_timerange"] = {
        "start": target_range.get("start", 0),
        "duration": target_range.get("duration", 5000000)
    }

    # 文本样式 (style)
    # 支持 color 为 RGB 元组 (0-1 范围) 或十六进制字符串
    style = segment.get("style", {})
    if style:
        normalized["style"] = {
            "size": style.get("size", 8.0),
            "bold": style.get("bold", False),
            "italic": style.get("italic", False),
            "underline": style.get("underline", False),
            "color": style.get("color", [1.0, 1.0, 1.0]),  # RGB 元组 (0-1 范围)
            "alpha": style.get("alpha", 1.0),
            "align": style.get("align", 0),  # 0: 左对齐, 1: 居中, 2: 右对齐
            "vertical": style.get("vertical", False),  # 竖排文本
            "letter_spacing": style.get("letter_spacing", 0),
            "line_spacing": style.get("line_spacing", 0),
            "auto_wrapping": style.get("auto_wrapping", False),
            "max_line_width": style.get("max_line_width", 0.82)
        }
        # 字体 (可在 style 中或顶层)
        if style.get("font"):
            normalized["style"]["font"] = style["font"]

    # 顶层字体设置
    if segment.get("font"):
        if "style" not in normalized:
            normalized["style"] = {}
        normalized["style"]["font"] = segment["font"]

    # 位置变换设置 (clip_settings)
    clip_settings = segment.get("clip_settings", {})
    if clip_settings:
        normalized["clip_settings"] = {
            "transform_x": clip_settings.get("transform_x", 0.0),
            "transform_y": clip_settings.get("transform_y", 0.0),
            "scale_x": clip_settings.get("scale_x", 1.0),
            "scale_y": clip_settings.get("scale_y", 1.0),
            "rotation": clip_settings.get("rotation", 0.0),
            "alpha": clip_settings.get("alpha", 1.0),
            "flip_horizontal": clip_settings.get("flip_horizontal", False),
            "flip_vertical": clip_settings.get("flip_vertical", False)
        }

    # 是否锁定XY轴缩放比例 (uniform_scale)
    if segment.get("uniform_scale") is not None:
        normalized["uniform_scale"] = segment["uniform_scale"]

    # 文本描边 (border)
    border = segment.get("border", {})
    if border:
        normalized["border"] = {
            "alpha": border.get("alpha", 1.0),
            "color": border.get("color", [0.0, 0.0, 0.0]),  # RGB 元组 (0-1 范围)
            "width": border.get("width", 40.0)
        }

    # 文本背景 (background)
    background = segment.get("background", {})
    if background:
        normalized["background"] = {
            "color": background.get("color", "#000000"),
            "style": background.get("style", 1),
            "alpha": background.get("alpha", 1.0),
            "round_radius": background.get("round_radius", 0.0),
            "height": background.get("height", 0.14),
            "width": background.get("width", 0.14),
            "horizontal_offset": background.get("horizontal_offset", 0.5),
            "vertical_offset": background.get("vertical_offset", 0.5)
        }

    # 文本阴影 (shadow)
    shadow = segment.get("shadow", {})
    if shadow:
        normalized["shadow"] = {
            "alpha": shadow.get("alpha", 1.0),
            "color": shadow.get("color", [0.0, 0.0, 0.0]),
            "diffuse": shadow.get("diffuse", 15.0),
            "distance": shadow.get("distance", 5.0),
            "angle": shadow.get("angle", -45.0)
        }

    # 文本气泡 (bubble)
    bubble = segment.get("bubble", {})
    if bubble:
        normalized["bubble"] = {
            "effect_id": bubble.get("effect_id", ""),
            "resource_id": bubble.get("resource_id", "")
        }

    # 花字效果 (effect)
    effect = segment.get("effect", {})
    if effect:
        normalized["effect"] = {
            "effect_id": effect.get("effect_id", "")
        }

    # 动画效果 (animations)
    # 支持两种格式:
    # 1. intro_animation/outro_animation/loop_animation_type (来自 text_info.py)
    # 2. animations 对象 (标准格式)
    animations = segment.get("animations", {})

    # 入场动画
    intro_anim = segment.get("intro_animation") or animations.get("intro", {})
    if intro_anim:
        if "animations" not in normalized:
            normalized["animations"] = {}
        normalized["animations"]["intro"] = {
            "type": intro_anim.get("type") or intro_anim.get("animation_type", ""),
            "duration": intro_anim.get("duration", 500000)
        }

    # 出场动画
    outro_anim = segment.get("outro_animation") or animations.get("outro", {})
    if outro_anim:
        if "animations" not in normalized:
            normalized["animations"] = {}
        normalized["animations"]["outro"] = {
            "type": outro_anim.get("type") or outro_anim.get("animation_type", ""),
            "duration": outro_anim.get("duration", 500000)
        }

    # 循环动画
    loop_anim = segment.get("loop_animation_type") or animations.get("loop", {})
    if loop_anim:
        if "animations" not in normalized:
            normalized["animations"] = {}
        # loop_animation_type 可能是字符串或对象
        if isinstance(loop_anim, str):
            normalized["animations"]["loop"] = {
                "type": loop_anim
            }
        else:
            normalized["animations"]["loop"] = {
                "type": loop_anim.get("type", "")
            }

    # 关键帧 (keyframes)
    # 支持多种关键帧属性: position_x, position_y, rotation, scale_x, scale_y, uniform_scale, alpha
    # 用于在文本片段的时间轴上动态改变属性值，实现动画效果
    keyframes = segment.get("keyframes", [])
    if keyframes:
        normalized["keyframes"] = []
        for kf in keyframes:
            normalized["keyframes"].append({
                "keyframe_id": kf.get("keyframe_id", ""),
                "property": kf.get("property", ""),  # 关键帧属性名称
                "time_offset": kf.get("time_offset", 0),  # 时间偏移量 (微秒)
                "value": kf.get("value", 0.0)  # 属性值
            })

    return normalized


def get_sticker_tracks(draft_id: str) -> List[List[Dict]]:
    """获取草稿的所有贴纸轨道"""
    return _get_cached_data(draft_id, DRAFT_STICKERS)


def get_video_effects(draft_id: str) -> List[str]:
    """获取草稿的所有视频特效ID"""
    return _get_cached_data(draft_id, DRAFT_EFFECTS)


def get_video_filters(draft_id: str) -> List[str]:
    """获取草稿的所有视频滤镜ID"""
    return _get_cached_data(draft_id, DRAFT_FILTERS)


def get_audio_effects(draft_id: str) -> List[str]:
    """获取草稿的所有音频特效ID"""
    return _get_cached_data(draft_id, DRAFT_AUDIO_EFFECTS)


def get_keyframes(draft_id: str) -> List[Dict]:
    """获取草稿的所有关键帧"""
    return _get_cached_data(draft_id, DRAFT_KEYFRAMES)


def get_audio_keyframes(draft_id: str) -> List[Dict]:
    """获取草稿的所有音频关键帧"""
    return _get_cached_data(draft_id, DRAFT_AUDIO_KEYFRAMES)


if __name__ == "__main__":
    # 测试示例
    print("=== 测试生成草稿模板 ===")
    print(f"pjy 库状态: {'已安装' if HAS_JIANYING_LIB else '未安装'}")

    # 模拟测试
    test_draft_id = "test_draft_123"

    result = generate_template(test_draft_id)
    print(f"生成模板结果: {result}")

    result = generate_draft_content_json(test_draft_id)
    print(f"生成草稿内容: code={result['code']}, message={result['message']}")