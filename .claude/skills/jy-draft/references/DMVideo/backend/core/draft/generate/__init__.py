# -*- coding: utf-8 -*-
"""
草稿生成模块

提供草稿创建、素材添加、保存等功能。
"""

from .draft_cache import (
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
    DEFAULT_EXPIRE_SECONDS
)

from .create_draft import (
    create_draft,
    check_draft_exists,
    get_draft_template,
    delete_draft
)

from .add_videos import (
    add_videos,
    get_video_tracks,
    get_all_videos
)

from .add_audios import (
    add_audios,
    get_audio_tracks,
    get_all_audios
)

from .add_texts import (
    add_texts,
    get_text_tracks,
    get_all_texts
)

from .generate_template import (
    generate_template,
    generate_template_json,
    generate_jianying_draft,
    generate_draft_content_json,
    export_draft_content
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
    # Stickers
    # Video Effects
    # Video Filters
    # Audio Effects
    # Keyframes
    # Save
    # Generate
    'generate_template',
    'generate_template_json',
    'generate_jianying_draft',
    'generate_draft_content_json',
    'export_draft_content'
]