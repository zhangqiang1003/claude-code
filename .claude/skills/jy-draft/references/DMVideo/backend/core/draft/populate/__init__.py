"""
草稿素材处理 API 模块

提供时间线生成、音频处理、视频处理、文本处理、贴纸处理、关键帧等相关的函数封装。
所有生成的数据都会缓存到本地内存中。
"""

# 时间线 API
from .generate_timelines import (
    generate_timelines,
    get_total_duration,
    format_timeline_output
)
from .generate_timelines_by_audio import (
    generate_timelines_by_audio,
    get_audio_duration_batch,
    format_audio_timelines_output,
    AudioInfo
)

# 音频处理 API
from .audio_info import (
    audio_info,
    parse_audio_infos,
    format_audio_info_output
)
from .audio_infos_by_timelines import (
    audio_infos_by_timelines,
    audio_infos_by_timelines_simple
)
from .modify_audio_infos import (
    modify_audio_infos,
    modify_audio_info_by_id
)
from .concat_audio_infos import (
    concat_audio_infos,
    concat_audio_infos_list
)
from .swap_audio_segment_position import (
    swap_audio_segment_position,
    move_audio_segment
)


# 视频处理 API
from .video_info import (
    video_info,
    parse_video_infos
)
from .video_infos_by_timelines import (
    video_infos_by_timelines,
    video_infos_by_timelines_simple
)
from .modify_video_infos import modify_video_infos
from .concat_video_infos import (
    concat_video_infos,
    concat_video_infos_list
)
from .swap_video_segment_position import (
    swap_video_segment_position,
    move_video_segment
)


# 文本处理 API
from .text_info import (
    text_info,
    parse_text_infos
)
from .text_infos_by_timelines import text_infos_by_timelines
from .modify_text_infos import modify_text_infos
from .concat_text_infos import concat_text_infos
from .swap_text_segment_position import swap_text_segment_position, move_text_segment


__all__ = [
    # 时间线生成
    "generate_timelines",
    "get_total_duration",
    "format_timeline_output",
    "generate_timelines_by_audio",
    "get_audio_duration_batch",
    "format_audio_timelines_output",
    "AudioInfo",

    # 音频处理
    "audio_info",
    "parse_audio_infos",
    "format_audio_info_output",
    "audio_infos_by_timelines",
    "audio_infos_by_timelines_simple",
    "modify_audio_infos",
    "modify_audio_info_by_id",
    "concat_audio_infos",
    "concat_audio_infos_list",
    "swap_audio_segment_position",
    "move_audio_segment",

    # 视频处理
    "video_info",
    "parse_video_infos",
    "video_infos_by_timelines",
    "video_infos_by_timelines_simple",
    "modify_video_infos",
    "concat_video_infos",
    "concat_video_infos_list",
    "swap_video_segment_position",
    "move_video_segment",

    # 文本处理
    "text_info",
    "parse_text_infos",
    "text_infos_by_timelines",
    "modify_text_infos",
    "concat_text_infos",
    "swap_text_segment_position",
    "move_text_segment",

]