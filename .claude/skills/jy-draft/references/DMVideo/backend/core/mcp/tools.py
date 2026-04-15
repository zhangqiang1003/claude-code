# -*- coding: utf-8 -*-
"""
MCP Tools 定义

提供所有剪映草稿 API 的 MCP 工具定义。
"""

import json
from typing import Any, Callable, Dict, List, Optional, Type
from dataclasses import dataclass, field


@dataclass
class MCPTool:
    """MCP 工具定义"""
    name: str
    description: str
    input_schema: Dict[str, Any]
    handler: Callable


# ==================== 工具输入 Schema 定义 ====================

# 草稿管理 Schemas
CREATE_DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "width": {
            "type": "integer",
            "description": "视频画面的宽度（像素），如 1920"
        },
        "height": {
            "type": "integer",
            "description": "视频画面的高度（像素），如 1080"
        }
    },
    "required": ["width", "height"]
}

SAVE_DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "draft_id": {
            "type": "string",
            "description": "草稿唯一标识"
        },
        "client_id": {
            "type": "integer",
            "description": "剪映小程序客户端编号，默认 10000",
            "default": 10000
        }
    },
    "required": ["draft_id"]
}

DELETE_DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "draft_id": {
            "type": "string",
            "description": "草稿唯一标识"
        }
    },
    "required": ["draft_id"]
}

GET_DRAFT_INFO_SCHEMA = {
    "type": "object",
    "properties": {
        "draft_id": {
            "type": "string",
            "description": "草稿唯一标识"
        }
    },
    "required": ["draft_id"]
}

# 添加素材 Schemas
ADD_VIDEOS_SCHEMA = {
    "type": "object",
    "properties": {
        "draft_id": {
            "type": "string",
            "description": "草稿唯一标识"
        },
        "video_infos": {
            "type": "string",
            "description": "视频/图片素材信息（JSON 字符串）"
        }
    },
    "required": ["draft_id", "video_infos"]
}

ADD_AUDIOS_SCHEMA = {
    "type": "object",
    "properties": {
        "draft_id": {
            "type": "string",
            "description": "草稿唯一标识"
        },
        "audio_infos": {
            "type": "string",
            "description": "音频素材信息（JSON 字符串）"
        }
    },
    "required": ["draft_id", "audio_infos"]
}

ADD_TEXTS_SCHEMA = {
    "type": "object",
    "properties": {
        "draft_id": {
            "type": "string",
            "description": "草稿唯一标识"
        },
        "text_infos": {
            "type": "string",
            "description": "文本素材信息（JSON 字符串）"
        }
    },
    "required": ["draft_id", "text_infos"]
}

ADD_STICKERS_SCHEMA = {
    "type": "object",
    "properties": {
        "draft_id": {
            "type": "string",
            "description": "草稿唯一标识"
        },
        "sticker_infos": {
            "type": "string",
            "description": "贴纸素材信息（JSON 字符串）"
        }
    },
    "required": ["draft_id", "sticker_infos"]
}

# 时间线 Schemas
GENERATE_TIMELINES_SCHEMA = {
    "type": "object",
    "properties": {
        "timeline_segment": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "时间线分段，每个元素的单位为微秒，如 [3000000, 7000000, 2000000]"
        }
    },
    "required": ["timeline_segment"]
}

GENERATE_TIMELINES_BY_AUDIO_SCHEMA = {
    "type": "object",
    "properties": {
        "audio_urls": {
            "type": "array",
            "items": {"type": "string"},
            "description": "音频文件 URL 列表"
        }
    },
    "required": ["audio_urls"]
}

# 视频/图片片段 Schemas
VIDEO_INFO_SCHEMA = {
    "type": "object",
    "properties": {
        "material_url": {
            "type": "string",
            "description": "视频/图片素材的 URL 地址"
        },
        "target_timerange": {
            "type": "object",
            "description": "片段在轨道上的目标时间范围 (微秒) {'start': int, 'duration': int}",
            "properties": {
                "start": {"type": "integer", "description": "开始时间（微秒）"},
                "duration": {"type": "integer", "description": "持续时长（微秒）"}
            }
        },
        "source_timerange": {
            "type": "object",
            "description": "截取的素材片段时间范围 (微秒) {'start': int, 'duration': int}",
            "properties": {
                "start": {"type": "integer", "description": "开始时间（微秒）"},
                "duration": {"type": "integer", "description": "持续时长（微秒）"}
            }
        },
        "speed": {
            "type": "number",
            "description": "播放速度，取值范围 0.1~42.0"
        },
        "volume": {
            "type": "number",
            "description": "音量，默认 1.0",
            "default": 1.0
        },
        "change_pitch": {
            "type": "boolean",
            "description": "是否跟随变速改变音调，默认 false",
            "default": False
        },
        "material_name": {
            "type": "string",
            "description": "素材名称"
        },
        "material_type": {
            "type": "string",
            "description": "素材类型: video 或 photo"
        },
        "width": {
            "type": "integer",
            "description": "素材宽度（像素）"
        },
        "height": {
            "type": "integer",
            "description": "素材高度（像素）"
        },
        "material_duration": {
            "type": "integer",
            "description": "素材原始时长（微秒）"
        },
        "local_material_id": {
            "type": "string",
            "description": "本地素材 ID"
        },
        "uniform_scale": {
            "type": "boolean",
            "description": "是否锁定 XY 轴缩放比例"
        },
        "crop_settings": {
            "type": "object",
            "description": "裁剪设置",
            "properties": {
                "upper_left_x": {"type": "number", "description": "左上角 X (0-1)"},
                "upper_left_y": {"type": "number", "description": "左上角 Y (0-1)"},
                "upper_right_x": {"type": "number", "description": "右上角 X (0-1)"},
                "upper_right_y": {"type": "number", "description": "右上角 Y (0-1)"},
                "lower_left_x": {"type": "number", "description": "左下角 X (0-1)"},
                "lower_left_y": {"type": "number", "description": "左下角 Y (0-1)"},
                "lower_right_x": {"type": "number", "description": "右下角 X (0-1)"},
                "lower_right_y": {"type": "number", "description": "右下角 Y (0-1)"}
            }
        },
        "clip_settings": {
            "type": "object",
            "description": "位置变换设置",
            "properties": {
                "transform_x": {"type": "number", "description": "水平位移"},
                "transform_y": {"type": "number", "description": "垂直位移"},
                "scale_x": {"type": "number", "description": "水平缩放比例"},
                "scale_y": {"type": "number", "description": "垂直缩放比例"},
                "rotation": {"type": "number", "description": "顺时针旋转角度（度）"},
                "alpha": {"type": "number", "description": "不透明度 0.0~1.0"},
                "flip_horizontal": {"type": "boolean", "description": "是否水平翻转"},
                "flip_vertical": {"type": "boolean", "description": "是否垂直翻转"}
            }
        },
        "fade": {
            "type": "object",
            "description": "音频淡入淡出效果 (微秒)",
            "properties": {
                "in_duration": {"type": "integer", "description": "淡入时长（微秒）"},
                "out_duration": {"type": "integer", "description": "淡出时长（微秒）"}
            }
        },
        "effects": {
            "type": "array",
            "description": "视频特效列表",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "description": "特效类型名称"},
                    "params": {"type": "array", "items": {"type": "integer"}, "description": "特效参数 (0-100)"}
                }
            }
        },
        "filters": {
            "type": "array",
            "description": "视频滤镜列表",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "description": "滤镜名称"},
                    "intensity": {"type": "number", "description": "滤镜强度 (0-100)"}
                }
            }
        },
        "mask": {
            "type": "object",
            "description": "蒙版配置",
            "properties": {
                "type": {"type": "string", "description": "蒙版类型"},
                "center_x": {"type": "number", "description": "中心 X 坐标"},
                "center_y": {"type": "number", "description": "中心 Y 坐标"},
                "size": {"type": "number", "description": "主要尺寸"},
                "rotation": {"type": "number", "description": "旋转角度"},
                "feather": {"type": "number", "description": "羽化值"},
                "invert": {"type": "boolean", "description": "是否反转"},
                "rect_width": {"type": "number", "description": "矩形宽度"},
                "round_corner": {"type": "number", "description": "圆角值"}
            }
        },
        "transition": {
            "type": "object",
            "description": "转场配置",
            "properties": {
                "type": {"type": "string", "description": "转场类型名称"},
                "duration": {"type": "integer", "description": "转场时长（微秒）"}
            }
        },
        "background_filling": {
            "type": "object",
            "description": "背景填充配置",
            "properties": {
                "type": {"type": "string", "description": "填充类型: blur 或 color"},
                "blur": {"type": "number", "description": "模糊程度"},
                "color": {"type": "string", "description": "填充颜色 #RRGGBBAA"}
            }
        },
        "animations": {
            "type": "object",
            "description": "动画配置",
            "properties": {
                "intro": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "description": "入场动画名称"},
                        "duration": {"type": "integer", "description": "动画时长（微秒）"}
                    }
                },
                "outro": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "description": "出场动画名称"},
                        "duration": {"type": "integer", "description": "动画时长（微秒）"}
                    }
                },
                "group": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "description": "组动画名称"},
                        "duration": {"type": "integer", "description": "动画时长（微秒）"}
                    }
                }
            }
        },
        "keyframes": {
            "type": "array",
            "description": "关键帧列表",
            "items": {
                "type": "object",
                "properties": {
                    "property": {"type": "string", "description": "属性名称"},
                    "time_offset": {"type": "integer", "description": "时间偏移量（微秒）"},
                    "value": {"type": "number", "description": "属性值"}
                }
            }
        }
    },
    "required": ["material_url"]
}

VIDEO_INFOS_BY_TIMELINES_SCHEMA = {
    "type": "object",
    "properties": {
        "timelines": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start": {"type": "integer"},
                    "duration": {"type": "integer"}
                }
            },
            "description": "时间线数组"
        },
        "video_urls": {
            "type": "array",
            "items": {"type": "string"},
            "description": "视频素材的 URL 列表"
        }
    },
    "required": ["timelines", "video_urls"]
}

CONCAT_VIDEO_INFOS_SCHEMA = {
    "type": "object",
    "properties": {
        "video_infos1": {
            "type": "string",
            "description": "待拼接的第一个视频素材（JSON 字符串）"
        },
        "video_infos2": {
            "type": "string",
            "description": "待拼接的第二个视频素材（JSON 字符串）"
        }
    },
    "required": ["video_infos1", "video_infos2"]
}

# 音频片段 Schemas
AUDIO_INFO_SCHEMA = {
    "type": "object",
    "properties": {
        "material_url": {
            "type": "string",
            "description": "音频素材文件路径/URL"
        },
        "target_timerange": {
            "type": "object",
            "description": "片段在轨道上的目标时间范围 (微秒) {'start': int, 'duration': int}",
            "properties": {
                "start": {"type": "integer", "description": "开始时间（微秒）"},
                "duration": {"type": "integer", "description": "持续时长（微秒）"}
            }
        },
        "source_timerange": {
            "type": "object",
            "description": "截取的素材片段时间范围 (微秒) {'start': int, 'duration': int}",
            "properties": {
                "start": {"type": "integer", "description": "开始时间（微秒）"},
                "duration": {"type": "integer", "description": "持续时长（微秒）"}
            }
        },
        "speed": {
            "type": "number",
            "description": "播放速度，取值范围 0.1~50.0",
        },
        "volume": {
            "type": "number",
            "description": "音量，默认 1.0",
            "default": 1.0
        },
        "change_pitch": {
            "type": "boolean",
            "description": "是否跟随变速改变音调，默认 false",
            "default": False
        },
        "material_name": {
            "type": "string",
            "description": "素材名称"
        },
        "fade": {
            "type": "object",
            "description": "淡入淡出效果 (微秒) {'in_duration': int, 'out_duration': int}",
            "properties": {
                "in_duration": {"type": "integer", "description": "淡入时长（微秒）"},
                "out_duration": {"type": "integer", "description": "淡出时长（微秒）"}
            }
        },
        "effects": {
            "type": "array",
            "description": "音频特效列表",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "description": "特效类型名称"},
                    "params": {"type": "array", "items": {"type": "integer"}, "description": "特效参数 (0-100)"}
                }
            }
        },
        "keyframes": {
            "type": "array",
            "description": "音量关键帧列表",
            "items": {
                "type": "object",
                "properties": {
                    "time_offset": {"type": "integer", "description": "时间偏移量（微秒）"},
                    "volume": {"type": "number", "description": "音量值"}
                }
            }
        }
    },
    "required": ["material_url"]
}

AUDIO_INFOS_BY_TIMELINES_SCHEMA = {
    "type": "object",
    "properties": {
        "timelines": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start": {"type": "integer"},
                    "duration": {"type": "integer"}
                }
            },
            "description": "时间线数组"
        },
        "audio_urls": {
            "type": "array",
            "items": {"type": "string"},
            "description": "音频素材的 URL 列表"
        }
    },
    "required": ["timelines", "audio_urls"]
}

CONCAT_AUDIO_INFOS_SCHEMA = {
    "type": "object",
    "properties": {
        "audio_infos1": {
            "type": "string",
            "description": "待拼接的第一个音频素材（JSON 字符串）"
        },
        "audio_infos2": {
            "type": "string",
            "description": "待拼接的第二个音频素材（JSON 字符串）"
        }
    },
    "required": ["audio_infos1", "audio_infos2"]
}

# 文本片段 Schemas
TEXT_INFO_SCHEMA = {
    "type": "object",
    "properties": {
        "content": {
            "type": "string",
            "description": "文本内容"
        },
        "target_timerange": {
            "type": "object",
            "description": "片段在轨道上的目标时间范围 (微秒) {'start': int, 'duration': int}",
            "properties": {
                "start": {"type": "integer", "description": "开始时间（微秒）"},
                "duration": {"type": "integer", "description": "持续时长（微秒）"}
            }
        },
        "style": {
            "type": "object",
            "description": "文本样式",
            "properties": {
                "size": {"type": "number", "description": "字体大小，默认 8.0"},
                "bold": {"type": "boolean", "description": "是否加粗"},
                "italic": {"type": "boolean", "description": "是否斜体"},
                "underline": {"type": "boolean", "description": "是否加下划线"},
                "color": {
                    "description": "字体颜色，支持十六进制 '#FFFFFF'、RGB 0-255 [255,255,255]、RGB 0-1 [1.0,1.0,1.0]",
                    "oneOf": [
                        {"type": "string"},
                        {"type": "array", "items": {"type": "number"}}
                    ]
                },
                "alpha": {"type": "number", "description": "字体不透明度 0.0~1.0"},
                "align": {"type": "integer", "description": "对齐方式：0=左对齐，1=居中，2=右对齐"},
                "vertical": {"type": "boolean", "description": "是否竖排文本"},
                "letter_spacing": {"type": "integer", "description": "字符间距"},
                "line_spacing": {"type": "integer", "description": "行间距"},
                "auto_wrapping": {"type": "boolean", "description": "是否自动换行"},
                "max_line_width": {"type": "number", "description": "每行最大宽度占比"},
                "font": {"type": "string", "description": "字体名称"}
            }
        },
        "font": {
            "type": "string",
            "description": "字体名称（也可在 style.font 中指定）"
        },
        "clip_settings": {
            "type": "object",
            "description": "位置变换设置",
            "properties": {
                "transform_x": {"type": "number", "description": "水平位移"},
                "transform_y": {"type": "number", "description": "垂直位移"},
                "scale_x": {"type": "number", "description": "水平缩放比例"},
                "scale_y": {"type": "number", "description": "垂直缩放比例"},
                "rotation": {"type": "number", "description": "顺时针旋转角度（度）"},
                "alpha": {"type": "number", "description": "不透明度 0.0~1.0"},
                "flip_horizontal": {"type": "boolean", "description": "是否水平翻转"},
                "flip_vertical": {"type": "boolean", "description": "是否垂直翻转"}
            }
        },
        "uniform_scale": {
            "type": "boolean",
            "description": "是否锁定 XY 轴缩放比例"
        },
        "border": {
            "type": "object",
            "description": "文本描边",
            "properties": {
                "alpha": {"type": "number", "description": "描边不透明度"},
                "color": {
                    "description": "描边颜色",
                    "oneOf": [
                        {"type": "string"},
                        {"type": "array", "items": {"type": "number"}}
                    ]
                },
                "width": {"type": "number", "description": "描边宽度"}
            }
        },
        "background": {
            "type": "object",
            "description": "文本背景",
            "properties": {
                "color": {"type": "string", "description": "背景颜色 '#RRGGBB'"},
                "style": {"type": "integer", "description": "背景样式"},
                "alpha": {"type": "number", "description": "背景不透明度"},
                "round_radius": {"type": "number", "description": "背景圆角半径"},
                "height": {"type": "number", "description": "背景高度占比"},
                "width": {"type": "number", "description": "背景宽度占比"},
                "horizontal_offset": {"type": "number", "description": "背景水平偏移"},
                "vertical_offset": {"type": "number", "description": "背景垂直偏移"}
            }
        },
        "shadow": {
            "type": "object",
            "description": "文本阴影",
            "properties": {
                "alpha": {"type": "number", "description": "阴影不透明度"},
                "color": {
                    "description": "阴影颜色",
                    "oneOf": [
                        {"type": "string"},
                        {"type": "array", "items": {"type": "number"}}
                    ]
                },
                "diffuse": {"type": "number", "description": "阴影扩散程度"},
                "distance": {"type": "number", "description": "阴影距离"},
                "angle": {"type": "number", "description": "阴影角度"}
            }
        },
        "bubble": {
            "type": "object",
            "description": "文本气泡",
            "properties": {
                "effect_id": {"type": "string", "description": "气泡效果 ID"},
                "resource_id": {"type": "string", "description": "气泡资源 ID"}
            }
        },
        "effect": {
            "type": "object",
            "description": "花字效果",
            "properties": {
                "effect_id": {"type": "string", "description": "花字效果 ID"}
            }
        },
        "animations": {
            "type": "object",
            "description": "动画配置",
            "properties": {
                "intro": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "description": "入场动画名称"},
                        "duration": {"type": "integer", "description": "动画时长（微秒）"}
                    }
                },
                "outro": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "description": "出场动画名称"},
                        "duration": {"type": "integer", "description": "动画时长（微秒）"}
                    }
                },
                "loop": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "description": "循环动画名称"}
                    }
                }
            }
        },
        "keyframes": {
            "type": "array",
            "description": "关键帧列表",
            "items": {
                "type": "object",
                "properties": {
                    "property": {"type": "string", "description": "属性名称"},
                    "time_offset": {"type": "integer", "description": "时间偏移量（微秒）"},
                    "value": {"type": "number", "description": "属性值"}
                }
            }
        }
    },
    "required": ["content"]
}

TEXT_INFOS_BY_TIMELINES_SCHEMA = {
    "type": "object",
    "properties": {
        "timelines": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start": {"type": "integer"},
                    "duration": {"type": "integer"}
                }
            },
            "description": "时间线数组"
        },
        "texts": {
            "type": "array",
            "items": {"type": "string"},
            "description": "文本列表"
        }
    },
    "required": ["timelines", "texts"]
}

CONCAT_TEXT_INFOS_SCHEMA = {
    "type": "object",
    "properties": {
        "text_infos1": {
            "type": "string",
            "description": "待拼接的第一个文本素材（JSON 字符串）"
        },
        "text_infos2": {
            "type": "string",
            "description": "待拼接的第二个文本素材（JSON 字符串）"
        }
    },
    "required": ["text_infos1", "text_infos2"]
}

# 贴纸 Schemas
STICKER_INFO_SCHEMA = {
    "type": "object",
    "properties": {
        "resource_id": {
            "type": "string",
            "description": "贴纸 resource_id"
        },
        "target_time_start": {
            "type": "integer",
            "description": "片段在轨道上的开始时间（微秒），默认 0",
            "default": 0
        },
        "target_time_duration": {
            "type": "integer",
            "description": "片段在轨道上的时长（微秒）"
        },
        "clip_alpha": {
            "type": "number",
            "description": "贴纸透明度，0-1，默认 1.0"
        },
        "clip_scale_x": {
            "type": "number",
            "description": "水平缩放比例，默认 1.0"
        },
        "clip_scale_y": {
            "type": "number",
            "description": "垂直缩放比例，默认 1.0"
        },
        "clip_transform_x": {
            "type": "number",
            "description": "水平位移（百分比）"
        },
        "clip_transform_y": {
            "type": "number",
            "description": "垂直位移（百分比）"
        }
    },
    "required": ["resource_id"]
}

CONCAT_STICKER_INFOS_SCHEMA = {
    "type": "object",
    "properties": {
        "sticker_infos1": {
            "type": "string",
            "description": "待拼接的第一个贴纸素材（JSON 字符串）"
        },
        "sticker_infos2": {
            "type": "string",
            "description": "待拼接的第二个贴纸素材（JSON 字符串）"
        }
    },
    "required": ["sticker_infos1", "sticker_infos2"]
}

# 特效/滤镜 Schemas
GENERATE_VIDEO_EFFECT_SCHEMA = {
    "type": "object",
    "properties": {
        "effect_type_name": {
            "type": "string",
            "description": "特效名称，如：抖动、模糊、故障、鱼眼等"
        },
        "params": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "特效参数列表，取值范围 0~100"
        },
        "segment_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "视频/图片素材唯一标识列表"
        },
        "segment_index": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "素材位置列表（从 1 开始）"
        }
    },
    "required": ["effect_type_name", "segment_ids", "segment_index"]
}

GENERATE_VIDEO_FILTER_SCHEMA = {
    "type": "object",
    "properties": {
        "filter_type_name": {
            "type": "string",
            "description": "滤镜名称，如：黑白、复古、暖色、冷色等"
        },
        "intensity": {
            "type": "integer",
            "description": "滤镜强度，0~100，默认 100",
            "default": 100
        },
        "segment_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "视频/图片素材唯一标识列表"
        },
        "segment_index": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "素材位置列表（从 1 开始）"
        }
    },
    "required": ["filter_type_name", "segment_ids", "segment_index"]
}

GENERATE_AUDIO_EFFECT_SCHEMA = {
    "type": "object",
    "properties": {
        "audio_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "音频唯一标识列表"
        },
        "effect_type": {
            "type": "string",
            "description": "特效类型名称，如：大叔、女生、机器人、回音等"
        },
        "params": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "特效参数列表，取值范围 0~100"
        },
        "segment_index": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "音频位置列表（从 1 开始）"
        }
    },
    "required": ["audio_ids", "effect_type", "segment_index"]
}

# 关键帧 Schemas
GENERATE_KEYFRAME_SCHEMA = {
    "type": "object",
    "properties": {
        "segment_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "素材片段唯一标识列表"
        },
        "property": {
            "type": "string",
            "description": "关键帧属性名称：KFTypePositionX, KFTypePositionY, KFTypeRotation, KFTypeScaleX, KFTypeScaleY, KFTypeAlpha, KFTypeVolume 等"
        },
        "time_offset": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "相对素材开始时间的偏移量列表（微秒）"
        },
        "value": {
            "type": "array",
            "items": {"type": "number"},
            "description": "关键帧的值列表"
        },
        "segment_index": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "素材位置列表（从 1 开始）"
        }
    },
    "required": ["segment_ids", "property", "time_offset", "value", "segment_index"]
}

GENERATE_AUDIO_KEYFRAME_SCHEMA = {
    "type": "object",
    "properties": {
        "audio_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "音频唯一标识列表"
        },
        "time_offset": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "相对音频开始时间的偏移量列表（微秒）"
        },
        "volume": {
            "type": "array",
            "items": {"type": "number"},
            "description": "音量值列表"
        },
        "segment_index": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "音频位置列表（从 1 开始）"
        }
    },
    "required": ["audio_ids", "time_offset", "volume", "segment_index"]
}


# ==================== 工具类定义 ====================

class DraftTools:
    """草稿管理工具集"""

    @staticmethod
    def get_tools() -> List[MCPTool]:
        """获取所有草稿管理工具"""
        return [
            MCPTool(
                name="create_draft",
                description="创建一个新的剪映草稿项目。需要指定视频画面的宽度和高度。",
                input_schema=CREATE_DRAFT_SCHEMA,
                handler=DraftTools._create_draft_handler
            ),
            MCPTool(
                name="save_draft",
                description="保存草稿并获取可访问的草稿链接，可在浏览器或剪映小程序中打开。",
                input_schema=SAVE_DRAFT_SCHEMA,
                handler=DraftTools._save_draft_handler
            ),
            MCPTool(
                name="delete_draft",
                description="删除草稿的所有相关数据，包括素材、特效、滤镜、关键帧等。",
                input_schema=DELETE_DRAFT_SCHEMA,
                handler=DraftTools._delete_draft_handler
            ),
            MCPTool(
                name="get_draft_info",
                description="获取草稿完整信息，包含所有轨道和素材数据。",
                input_schema=GET_DRAFT_INFO_SCHEMA,
                handler=DraftTools._get_draft_info_handler
            )
        ]

    @staticmethod
    def _create_draft_handler(arguments: Dict[str, Any]) -> str:
        """创建草稿处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft import create_draft

        result = create_draft(
            width=arguments["width"],
            height=arguments["height"]
        )
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _save_draft_handler(arguments: Dict[str, Any]) -> str:
        """保存草稿处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft import save_draft

        result = save_draft(
            draft_id=arguments["draft_id"],
            client_id=arguments.get("client_id", 10000)
        )
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _delete_draft_handler(arguments: Dict[str, Any]) -> str:
        """删除草稿处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft import delete_draft

        result = delete_draft(arguments["draft_id"])
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _get_draft_info_handler(arguments: Dict[str, Any]) -> str:
        """获取草稿信息处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft import get_draft_info

        result = get_draft_info(arguments["draft_id"])
        return json.dumps(result, ensure_ascii=False)


class TimelineTools:
    """时间线工具集"""

    @staticmethod
    def get_tools() -> List[MCPTool]:
        """获取所有时间线工具"""
        return [
            MCPTool(
                name="generate_timelines",
                description="根据输入的时长分段，自动计算并生成时间线。每个元素的单位为微秒（1秒=1000000微秒）。",
                input_schema=GENERATE_TIMELINES_SCHEMA,
                handler=TimelineTools._generate_timelines_handler
            ),
            MCPTool(
                name="generate_timelines_by_audio",
                description="根据输入的音频 URL 列表，自动分析每个音频的时长并生成时间线。",
                input_schema=GENERATE_TIMELINES_BY_AUDIO_SCHEMA,
                handler=TimelineTools._generate_timelines_by_audio_handler
            )
        ]

    @staticmethod
    def _generate_timelines_handler(arguments: Dict[str, Any]) -> str:
        """生成时间线处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import generate_timelines

        result = generate_timelines(arguments["timeline_segment"])
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _generate_timelines_by_audio_handler(arguments: Dict[str, Any]) -> str:
        """根据音频生成时间线处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import generate_timelines_by_audio

        result = generate_timelines_by_audio(arguments["audio_urls"])
        return json.dumps(result, ensure_ascii=False)


class VideoTools:
    """视频处理工具集"""

    @staticmethod
    def get_tools() -> List[MCPTool]:
        """获取所有视频处理工具"""
        return [
            MCPTool(
                name="video_info",
                description="根据视频/图片 URL 和参数，自动创建一段视频或图片素材信息。支持动画、转场、蒙版等高级设置。",
                input_schema=VIDEO_INFO_SCHEMA,
                handler=VideoTools._video_info_handler
            ),
            MCPTool(
                name="video_infos_by_timelines",
                description="根据输入的时间线数组和视频 URL 列表，批量创建视频素材信息。",
                input_schema=VIDEO_INFOS_BY_TIMELINES_SCHEMA,
                handler=VideoTools._video_infos_by_timelines_handler
            ),
            MCPTool(
                name="concat_video_infos",
                description="将两个视频信息拼接成一个新的视频信息。",
                input_schema=CONCAT_VIDEO_INFOS_SCHEMA,
                handler=VideoTools._concat_video_infos_handler
            ),
            MCPTool(
                name="add_videos",
                description="将视频素材信息添加到草稿中。",
                input_schema=ADD_VIDEOS_SCHEMA,
                handler=VideoTools._add_videos_handler
            )
        ]

    @staticmethod
    def _video_info_handler(arguments: Dict[str, Any]) -> str:
        """创建视频片段处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import video_info

        result = video_info(**arguments)
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _video_infos_by_timelines_handler(arguments: Dict[str, Any]) -> str:
        """根据时间线创建视频素材处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import video_infos_by_timelines

        result = video_infos_by_timelines(arguments["timelines"], arguments["video_urls"])
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _concat_video_infos_handler(arguments: Dict[str, Any]) -> str:
        """拼接视频信息处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import concat_video_infos

        result = concat_video_infos(arguments["video_infos1"], arguments["video_infos2"])
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _add_videos_handler(arguments: Dict[str, Any]) -> str:
        """添加视频素材处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft import add_videos

        result = add_videos(arguments["draft_id"], arguments["video_infos"])
        return json.dumps(result, ensure_ascii=False)


class AudioTools:
    """音频处理工具集"""

    @staticmethod
    def get_tools() -> List[MCPTool]:
        """获取所有音频处理工具"""
        return [
            MCPTool(
                name="audio_info",
                description="根据音频 URL 和参数，自动创建一段音频素材信息。支持变速、音量调节、淡入淡出等设置。",
                input_schema=AUDIO_INFO_SCHEMA,
                handler=AudioTools._audio_info_handler
            ),
            MCPTool(
                name="audio_infos_by_timelines",
                description="根据输入的时间线数组和音频 URL 列表，批量创建音频素材信息。",
                input_schema=AUDIO_INFOS_BY_TIMELINES_SCHEMA,
                handler=AudioTools._audio_infos_by_timelines_handler
            ),
            MCPTool(
                name="concat_audio_infos",
                description="将两个音频信息拼接成一个新的音频信息。",
                input_schema=CONCAT_AUDIO_INFOS_SCHEMA,
                handler=AudioTools._concat_audio_infos_handler
            ),
            MCPTool(
                name="add_audios",
                description="将音频素材信息添加到草稿中。",
                input_schema=ADD_AUDIOS_SCHEMA,
                handler=AudioTools._add_audios_handler
            )
        ]

    @staticmethod
    def _audio_info_handler(arguments: Dict[str, Any]) -> str:
        """创建音频片段处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import audio_info

        result = audio_info(**arguments)
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _audio_infos_by_timelines_handler(arguments: Dict[str, Any]) -> str:
        """根据时间线创建音频素材处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import audio_infos_by_timelines

        result = audio_infos_by_timelines(arguments["timelines"], arguments["audio_urls"])
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _concat_audio_infos_handler(arguments: Dict[str, Any]) -> str:
        """拼接音频信息处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import concat_audio_infos

        result = concat_audio_infos(arguments["audio_infos1"], arguments["audio_infos2"])
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _add_audios_handler(arguments: Dict[str, Any]) -> str:
        """添加音频素材处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft import add_audios

        result = add_audios(arguments["draft_id"], arguments["audio_infos"])
        return json.dumps(result, ensure_ascii=False)


class TextTools:
    """文本处理工具集"""

    @staticmethod
    def get_tools() -> List[MCPTool]:
        """获取所有文本处理工具"""
        return [
            MCPTool(
                name="text_info",
                description="根据文本内容和样式参数，自动创建一段文本素材信息。支持字体样式、动画、背景等设置。",
                input_schema=TEXT_INFO_SCHEMA,
                handler=TextTools._text_info_handler
            ),
            MCPTool(
                name="text_infos_by_timelines",
                description="根据输入的时间线数组和文本列表，批量创建文本素材信息。",
                input_schema=TEXT_INFOS_BY_TIMELINES_SCHEMA,
                handler=TextTools._text_infos_by_timelines_handler
            ),
            MCPTool(
                name="concat_text_infos",
                description="将两个文本信息拼接成一个新的文本信息。",
                input_schema=CONCAT_TEXT_INFOS_SCHEMA,
                handler=TextTools._concat_text_infos_handler
            ),
            MCPTool(
                name="add_texts",
                description="将文本素材信息添加到草稿中。",
                input_schema=ADD_TEXTS_SCHEMA,
                handler=TextTools._add_texts_handler
            )
        ]

    @staticmethod
    def _text_info_handler(arguments: Dict[str, Any]) -> str:
        """创建文本片段处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import text_info

        result = text_info(**arguments)
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _text_infos_by_timelines_handler(arguments: Dict[str, Any]) -> str:
        """根据时间线创建文本素材处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import text_infos_by_timelines

        result = text_infos_by_timelines(arguments["timelines"], arguments["texts"])
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _concat_text_infos_handler(arguments: Dict[str, Any]) -> str:
        """拼接文本信息处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import concat_text_infos

        result = concat_text_infos(arguments["text_infos1"], arguments["text_infos2"])
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _add_texts_handler(arguments: Dict[str, Any]) -> str:
        """添加文本素材处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft import add_texts

        result = add_texts(arguments["draft_id"], arguments["text_infos"])
        return json.dumps(result, ensure_ascii=False)


class StickerTools:
    """贴纸处理工具集"""

    @staticmethod
    def get_tools() -> List[MCPTool]:
        """获取所有贴纸处理工具"""
        return [
            MCPTool(
                name="sticker_info",
                description="根据贴纸 resource_id 和参数，自动创建一段贴纸素材信息。",
                input_schema=STICKER_INFO_SCHEMA,
                handler=StickerTools._sticker_info_handler
            ),
            MCPTool(
                name="concat_sticker_infos",
                description="将两个贴纸素材信息拼接成一个新的贴纸素材信息。",
                input_schema=CONCAT_STICKER_INFOS_SCHEMA,
                handler=StickerTools._concat_sticker_infos_handler
            ),
            MCPTool(
                name="add_stickers",
                description="将贴纸素材信息添加到草稿中。",
                input_schema=ADD_STICKERS_SCHEMA,
                handler=StickerTools._add_stickers_handler
            )
        ]

    @staticmethod
    def _sticker_info_handler(arguments: Dict[str, Any]) -> str:
        """创建贴纸处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import sticker_info

        result = sticker_info(**arguments)
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _concat_sticker_infos_handler(arguments: Dict[str, Any]) -> str:
        """拼接贴纸信息处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import concat_sticker_infos

        result = concat_sticker_infos(arguments["sticker_infos1"], arguments["sticker_infos2"])
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _add_stickers_handler(arguments: Dict[str, Any]) -> str:
        """添加贴纸素材处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft import add_stickers

        result = add_stickers(arguments["draft_id"], arguments["sticker_infos"])
        return json.dumps(result, ensure_ascii=False)


class EffectTools:
    """特效/滤镜处理工具集"""

    @staticmethod
    def get_tools() -> List[MCPTool]:
        """获取所有特效/滤镜工具"""
        return [
            MCPTool(
                name="generate_video_effect",
                description="为视频/图片素材生成特效（如抖动、模糊、故障、鱼眼等）。",
                input_schema=GENERATE_VIDEO_EFFECT_SCHEMA,
                handler=EffectTools._generate_video_effect_handler
            ),
            MCPTool(
                name="generate_video_filter",
                description="为视频/图片素材生成滤镜（如黑白、复古、暖色、冷色等）。",
                input_schema=GENERATE_VIDEO_FILTER_SCHEMA,
                handler=EffectTools._generate_video_filter_handler
            ),
            MCPTool(
                name="generate_audio_effect",
                description="为音频素材生成特效（如大叔、女生、机器人、回音等）。",
                input_schema=GENERATE_AUDIO_EFFECT_SCHEMA,
                handler=EffectTools._generate_audio_effect_handler
            )
        ]

    @staticmethod
    def _generate_video_effect_handler(arguments: Dict[str, Any]) -> str:
        """生成视频特效处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import generate_video_effect

        result = generate_video_effect(**arguments)
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _generate_video_filter_handler(arguments: Dict[str, Any]) -> str:
        """生成视频滤镜处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import generate_video_filter

        result = generate_video_filter(**arguments)
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _generate_audio_effect_handler(arguments: Dict[str, Any]) -> str:
        """生成音频特效处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import generate_audio_effect

        result = generate_audio_effect(**arguments)
        return json.dumps(result, ensure_ascii=False)


class KeyframeTools:
    """关键帧处理工具集"""

    @staticmethod
    def get_tools() -> List[MCPTool]:
        """获取所有关键帧工具"""
        return [
            MCPTool(
                name="generate_keyframe",
                description="为音频/图片/文本/视频素材生成关键帧动画。支持位置、缩放、旋转、透明度、音量等属性。",
                input_schema=GENERATE_KEYFRAME_SCHEMA,
                handler=KeyframeTools._generate_keyframe_handler
            ),
            MCPTool(
                name="generate_audio_keyframe",
                description="为音频片段生成音量变化的关键帧动画。",
                input_schema=GENERATE_AUDIO_KEYFRAME_SCHEMA,
                handler=KeyframeTools._generate_audio_keyframe_handler
            )
        ]

    @staticmethod
    def _generate_keyframe_handler(arguments: Dict[str, Any]) -> str:
        """生成关键帧处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import generate_keyframe

        result = generate_keyframe(**arguments)
        return json.dumps(result, ensure_ascii=False)

    @staticmethod
    def _generate_audio_keyframe_handler(arguments: Dict[str, Any]) -> str:
        """生成音频关键帧处理函数"""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from draft.populate import generate_keyframe_for_audio

        result = generate_keyframe_for_audio(**arguments)
        return json.dumps(result, ensure_ascii=False)


# ==================== 工具注册 ====================

def get_all_tools() -> List[MCPTool]:
    """获取所有 MCP 工具"""
    tools = []
    tools.extend(DraftTools.get_tools())
    tools.extend(TimelineTools.get_tools())
    tools.extend(VideoTools.get_tools())
    tools.extend(AudioTools.get_tools())
    tools.extend(TextTools.get_tools())
    tools.extend(StickerTools.get_tools())
    tools.extend(EffectTools.get_tools())
    tools.extend(KeyframeTools.get_tools())
    return tools