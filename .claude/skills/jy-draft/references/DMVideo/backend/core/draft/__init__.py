# -*- coding: utf-8 -*-
"""
草稿模块

提供剪映草稿创建、编辑、保存等功能。
"""

from .generate import (
    # Cache
    draft_cache,
    format_draft_key,
    DRAFT_TEMPLATE,
    DRAFT_VIDEOS,
    DRAFT_AUDIOS,
    DRAFT_TEXTS,
    DRAFT_STICKERS,
    DRAFT_EFFECTS,
    DRAFT_FILTERS,
    DRAFT_AUDIO_EFFECTS,
    DRAFT_KEYFRAMES,
    DRAFT_AUDIO_KEYFRAMES,
    DEFAULT_EXPIRE_SECONDS,
    # Create/Delete
    create_draft,
    check_draft_exists,
    get_draft_template,
    delete_draft,
    # Videos
    add_videos,
    get_video_tracks,
    get_all_videos,
    # Audios
    add_audios,
    get_audio_tracks,
    get_all_audios,
    # Texts
    add_texts,
    get_text_tracks,
    get_all_texts,
    # Stickers
    # Generate
    generate_template,
    generate_template_json,
    generate_jianying_draft,
    generate_draft_content_json,
    export_draft_content
)

from .populate import (
    # Timeline
    generate_timelines,
    generate_timelines_by_audio,
    # Audio
    audio_info,
    audio_infos_by_timelines,
    concat_audio_infos,
    swap_audio_segment_position,
    modify_audio_infos,
    # Video
    video_info,
    video_infos_by_timelines,
    concat_video_infos,
    swap_video_segment_position,
    modify_video_infos,
    # Text
    text_info,
    text_infos_by_timelines,
    concat_text_infos,
    swap_text_segment_position,
    modify_text_infos,
)

__all__ = [
    # Cache
    'draft_cache',
    'format_draft_key',
    'DRAFT_TEMPLATE',
    'DRAFT_VIDEOS',
    'DRAFT_AUDIOS',
    'DRAFT_TEXTS',
    'DRAFT_STICKERS',
    'DRAFT_EFFECTS',
    'DRAFT_FILTERS',
    'DRAFT_AUDIO_EFFECTS',
    'DRAFT_KEYFRAMES',
    'DRAFT_AUDIO_KEYFRAMES',
    'DEFAULT_EXPIRE_SECONDS',
    # Create/Delete
    'create_draft',
    'check_draft_exists',
    'get_draft_template',
    'delete_draft',
    # Videos
    'add_videos',
    'get_video_tracks',
    'get_all_videos',
    # Audios
    'add_audios',
    'get_audio_tracks',
    'get_all_audios',
    # Texts
    'add_texts',
    'get_text_tracks',
    'get_all_texts',
    # Generate
    'generate_template',
    'generate_template_json',
    'generate_jianying_draft',
    'generate_draft_content_json',
    'export_draft_content',
    # Timeline
    'generate_timelines',
    'generate_timelines_by_audio',
    # Audio
    'audio_info',
    'audio_infos_by_timelines',
    'concat_audio_infos',
    'swap_audio_segment_position',
    'modify_audio_infos',
    # Video
    'video_info',
    'video_infos_by_timelines',
    'concat_video_infos',
    'swap_video_segment_position',
    'modify_video_infos',
    # Text
    'text_info',
    'text_infos_by_timelines',
    'concat_text_infos',
    'swap_text_segment_position',
    'modify_text_infos',
]
