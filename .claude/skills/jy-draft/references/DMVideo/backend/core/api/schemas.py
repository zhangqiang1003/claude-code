# -*- coding: utf-8 -*-
"""
HTTP 接口数据模型

定义所有 API 请求和响应的 Pydantic 模型。
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field
from typing import Annotated
from annotated_doc import Doc


# ==================== 通用响应模型 ====================

class ApiResponse(BaseModel):
    """通用 API 响应"""
    code: Annotated[int, Doc("状态码，0=成功，-1=失败")]
    message: Annotated[str, Doc("响应消息")]


# ==================== 草稿管理模型 ====================

class CreateDraftRequest(BaseModel):
    """创建草稿请求"""
    width: Annotated[int, Doc("视频画面的宽度（像素）")]
    height: Annotated[int, Doc("视频画面的高度（像素）")]


class CreateDraftResponse(BaseModel):
    """创建草稿响应"""
    code: Annotated[int, Doc("状态码，0=成功，-1=失败")]
    message: Annotated[str, Doc("响应消息")]
    draft_id: Annotated[str, Doc("草稿唯一标识")]


class SaveDraftRequest(BaseModel):
    """保存草稿请求"""
    draft_id: Annotated[str, Doc("草稿唯一标识")]
    client_id: Annotated[int, Doc("剪映小程序客户端编号，默认值：10000")] = 10000


class SaveDraftResponse(BaseModel):
    """保存草稿响应"""
    code: Annotated[int, Doc("状态码，0=成功，-1=失败")]
    message: Annotated[str, Doc("响应消息")]
    draft_id: Annotated[str, Doc("草稿唯一标识")]
    draft_url: Annotated[str, Doc("草稿访问地址")]
    expire_time: Annotated[Optional[int], Doc("过期时间戳")] = None
    tip: Annotated[Optional[str], Doc("提示信息")] = None


class DeleteDraftRequest(BaseModel):
    """删除草稿请求"""
    draft_id: Annotated[str, Doc("草稿唯一标识")]


# ==================== 添加素材请求模型 ====================

class AddVideosRequest(BaseModel):
    """添加视频素材请求"""
    draft_id: Annotated[str, Doc("草稿唯一标识")]
    video_infos: Annotated[str, Doc("视频/图片素材信息（JSON 字符串）")]
    mute: Annotated[Optional[bool], Doc("是否静音")] = None
    track_name: Annotated[Optional[str], Doc("轨道名称")] = None


class AddAudiosRequest(BaseModel):
    """添加音频素材请求"""
    draft_id: Annotated[str, Doc("草稿唯一标识")]
    audio_infos: Annotated[str, Doc("音频素材信息（JSON 字符串）")]
    mute: Annotated[Optional[bool], Doc("是否静音")] = None
    track_name: Annotated[Optional[str], Doc("轨道名称")] = None


class AddTextsRequest(BaseModel):
    """添加文本素材请求"""
    draft_id: Annotated[str, Doc("草稿唯一标识")]
    text_infos: Annotated[str, Doc("文本素材信息（JSON 字符串）")]
    track_name: Annotated[Optional[str], Doc("轨道名称")] = None


# ==================== 添加特效/滤镜/关键帧请求模型 ====================

class AddEffectsRequest(BaseModel):
    """添加视频特效请求"""
    draft_id: Annotated[str, Doc("草稿标识")]
    effect_ids01: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None
    effect_ids02: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None
    effect_ids03: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None
    effect_ids04: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None
    effect_ids05: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None
    effect_ids06: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None
    effect_ids07: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None
    effect_ids08: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None
    effect_ids09: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None
    effect_ids10: Annotated[Optional[List[str]], Doc("视频/图片素材特效唯一标识列表")] = None


class AddFiltersRequest(BaseModel):
    """添加视频滤镜请求"""
    draft_id: Annotated[str, Doc("草稿 ID")]
    filter_ids01: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None
    filter_ids02: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None
    filter_ids03: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None
    filter_ids04: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None
    filter_ids05: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None
    filter_ids06: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None
    filter_ids07: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None
    filter_ids08: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None
    filter_ids09: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None
    filter_ids10: Annotated[Optional[List[str]], Doc("视频/图片素材滤镜唯一标识列表")] = None


class AddKeyframesRequest(BaseModel):
    """添加关键帧请求"""
    draft_id: Annotated[str, Doc("草稿 ID")]
    keyframe_ids01: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None
    keyframe_ids02: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None
    keyframe_ids03: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None
    keyframe_ids04: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None
    keyframe_ids05: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None
    keyframe_ids06: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None
    keyframe_ids07: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None
    keyframe_ids08: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None
    keyframe_ids09: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None
    keyframe_ids10: Annotated[Optional[List[str]], Doc("素材关键帧唯一标识列表")] = None


class AddAudioEffectsRequest(BaseModel):
    """添加音频特效请求"""
    draft_id: Annotated[str, Doc("草稿 ID")]
    effect_ids01: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None
    effect_ids02: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None
    effect_ids03: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None
    effect_ids04: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None
    effect_ids05: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None
    effect_ids06: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None
    effect_ids07: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None
    effect_ids08: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None
    effect_ids09: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None
    effect_ids10: Annotated[Optional[List[str]], Doc("音频素材特效唯一标识列表")] = None


class AddAudioKeyframesRequest(BaseModel):
    """添加音频关键帧请求"""
    draft_id: Annotated[str, Doc("草稿 ID")]
    keyframe_ids01: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None
    keyframe_ids02: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None
    keyframe_ids03: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None
    keyframe_ids04: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None
    keyframe_ids05: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None
    keyframe_ids06: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None
    keyframe_ids07: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None
    keyframe_ids08: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None
    keyframe_ids09: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None
    keyframe_ids10: Annotated[Optional[List[str]], Doc("音频素材关键帧列表")] = None


# ==================== 时间线模型 ====================

class TimelineItem(BaseModel):
    """时间线分段项"""
    start: Annotated[int, Doc("开始时间（微秒）")]
    duration: Annotated[int, Doc("时长（微秒）")]


class TimelineSegmentItem(BaseModel):
    """时间线分段项（begin_time/end_time 模式）"""
    begin_time: Annotated[int, Doc("开始时间（微秒）")]
    end_time: Annotated[int, Doc("结束时间（微秒）")]


class TimelineRequest(BaseModel):
    """生成时间线请求"""
    timeline_segment: Annotated[
        List[Union[int, TimelineSegmentItem]],
        Doc("时间线分段列表。模式1: 整数数组，每个元素为时长（微秒），如 [3000000, 7000000]；模式2: 字典数组，每个元素含 begin_time 和 end_time（微秒），如 [{'begin_time': 2300000, 'end_time': 4600000}]")
    ]


class TimelineResponse(BaseModel):
    """生成时间线响应"""
    code: Annotated[int, Doc("状态码，0=成功")]
    message: Annotated[str, Doc("响应消息")]
    target: Annotated[Dict[str, Any], Doc("响应数据")]


class TimelineByAudioRequest(BaseModel):
    """根据音频列表生成时间线请求"""
    audio_urls: Annotated[List[str], Doc("音频文件 URL 列表")]


# ==================== 视频/图片片段模型 ====================

class VideoInfoRequest(BaseModel):
    """创建视频/图片片段请求"""
    material_url: Annotated[str, Doc("视频/图片素材的 URL 地址")]
    target_timerange: Annotated[Optional[Dict[str, int]], Doc("片段在轨道上的目标时间范围 (微秒) {'start': int, 'duration': int}")] = None
    source_timerange: Annotated[Optional[Dict[str, int]], Doc("截取的素材片段时间范围 (微秒) {'start': int, 'duration': int}")] = None
    speed: Annotated[Optional[float], Doc("播放速度，取值范围 0.1~42.0")] = None
    volume: Annotated[float, Doc("音量，默认 1.0")] = 1.0
    change_pitch: Annotated[bool, Doc("是否跟随变速改变音调")] = False
    material_name: Annotated[Optional[str], Doc("素材名称")] = None
    material_type: Annotated[Optional[str], Doc("素材类型: video 或 photo")] = None
    width: Annotated[Optional[int], Doc("素材宽度（像素）")] = None
    height: Annotated[Optional[int], Doc("素材高度（像素）")] = None
    material_duration: Annotated[Optional[int], Doc("素材原始时长（微秒）")] = None
    local_material_id: Annotated[Optional[str], Doc("本地素材 ID")] = None
    uniform_scale: Annotated[Optional[bool], Doc("是否锁定 XY 轴缩放比例")] = None
    crop_settings: Annotated[Optional[Dict[str, float]], Doc("裁剪设置 {'upper_left_x/y', 'upper_right_x/y', 'lower_left_x/y', 'lower_right_x/y'}")] = None
    clip_settings: Annotated[Optional[Dict[str, Any]], Doc("位置变换设置 {'transform_x/y', 'scale_x/y', 'rotation', 'alpha', 'flip_horizontal', 'flip_vertical'}")] = None
    fade: Annotated[Optional[Dict[str, int]], Doc("音频淡入淡出效果 (微秒) {'in_duration': int, 'out_duration': int}")] = None
    effects: Annotated[Optional[List[Dict[str, Any]]], Doc("视频特效列表 [{'type': '特效名', 'params': [0-100]}]")] = None
    filters: Annotated[Optional[List[Dict[str, Any]]], Doc("视频滤镜列表 [{'type': '滤镜名', 'intensity': 0-100}]")] = None
    mask: Annotated[Optional[Dict[str, Any]], Doc("蒙版配置 {'type', 'center_x/y', 'size', 'rotation', 'feather', 'invert', 'rect_width', 'round_corner'}")] = None
    transition: Annotated[Optional[Dict[str, Any]], Doc("转场配置 {'type': str, 'duration': int}")] = None
    background_filling: Annotated[Optional[Dict[str, Any]], Doc("背景填充配置 {'type': str, 'blur': float, 'color': str}")] = None
    animations: Annotated[Optional[Dict[str, Any]], Doc("动画配置 {'intro': {type, duration}, 'outro': {type, duration}, 'group': {type, duration}}")] = None
    keyframes: Annotated[Optional[List[Dict[str, Any]]], Doc("关键帧列表 [{'property': '属性名', 'time_offset': 微秒, 'value': 值}]")] = None


class VideoInfoResponse(BaseModel):
    """创建视频/图片片段响应"""
    code: Annotated[int, Doc("状态码")]
    message: Annotated[str, Doc("响应消息")]
    video_infos: Annotated[str, Doc("视频/图片素材信息（JSON 字符串）")]
    segment_ids: Annotated[List[str], Doc("素材片段 ID 列表")]


class VideoInfosByTimelinesRequest(BaseModel):
    """根据时间线创建视频素材请求"""
    timelines: Annotated[List[TimelineItem], Doc("时间线数组")]
    video_urls: Annotated[List[str], Doc("视频素材的 URL 列表")]


class ConcatVideoInfosRequest(BaseModel):
    """拼接视频信息请求"""
    video_infos1: Annotated[str, Doc("待拼接的第一个视频素材")]
    video_infos2: Annotated[str, Doc("待拼接的第二个视频素材")]


class SwapPositionItem(BaseModel):
    """交换位置项"""
    source_index: Annotated[int, Doc("源位置（从 1 开始）")]
    swap_index: Annotated[int, Doc("交换位置")]


class SwapVideoSegmentRequest(BaseModel):
    """交换视频片段位置请求"""
    video_infos: Annotated[str, Doc("视频素材信息")]
    swap_position: Annotated[List[SwapPositionItem], Doc("交换位置配置数组")]
    target_timerange_start: Annotated[Optional[int], Doc("新素材在轨道上的开始时间（微秒）")] = 0


class ModifyVideoInfosRequest(BaseModel):
    """修改视频信息请求"""
    video_infos: Annotated[str, Doc("视频素材信息（JSON 字符串）")]
    segment_index: Annotated[List[int], Doc("要修改的素材片段索引数组（从 1 开始）")]
    target_timerange: Annotated[Optional[Dict[str, int]], Doc("片段在轨道上的目标时间范围 (微秒) {'start': int, 'duration': int}")] = None
    source_timerange: Annotated[Optional[Dict[str, int]], Doc("截取的素材片段时间范围 (微秒) {'start': int, 'duration': int}")] = None
    speed: Annotated[Optional[float], Doc("播放速度，取值范围 0.1~42.0")] = None
    volume: Annotated[Optional[float], Doc("音量")] = None
    change_pitch: Annotated[Optional[bool], Doc("是否跟随变速改变音调")] = None
    material_url: Annotated[Optional[str], Doc("视频/图片素材文件路径/URL")] = None
    material_name: Annotated[Optional[str], Doc("素材名称")] = None
    material_type: Annotated[Optional[str], Doc("素材类型: video 或 photo")] = None
    width: Annotated[Optional[int], Doc("素材宽度（像素）")] = None
    height: Annotated[Optional[int], Doc("素材高度（像素）")] = None
    material_duration: Annotated[Optional[int], Doc("素材原始时长（微秒）")] = None
    local_material_id: Annotated[Optional[str], Doc("本地素材 ID")] = None
    uniform_scale: Annotated[Optional[bool], Doc("是否锁定 XY 轴缩放比例")] = None
    crop_settings: Annotated[Optional[Dict[str, float]], Doc("裁剪设置")] = None
    clip_settings: Annotated[Optional[Dict[str, Any]], Doc("位置变换设置")] = None
    fade: Annotated[Optional[Dict[str, int]], Doc("淡入淡出效果 (微秒) {'in_duration': int, 'out_duration': int}")] = None
    effects: Annotated[Optional[List[Dict[str, Any]]], Doc("视频特效列表")] = None
    filters: Annotated[Optional[List[Dict[str, Any]]], Doc("视频滤镜列表")] = None
    mask: Annotated[Optional[Dict[str, Any]], Doc("蒙版配置")] = None
    transition: Annotated[Optional[Dict[str, Any]], Doc("转场配置 {'type': str, 'duration': int}")] = None
    background_filling: Annotated[Optional[Dict[str, Any]], Doc("背景填充配置")] = None
    animations: Annotated[Optional[Dict[str, Any]], Doc("动画配置")] = None
    keyframes: Annotated[Optional[List[Dict[str, Any]]], Doc("关键帧列表")] = None


# ==================== 音频片段模型 ====================

class AudioInfoRequest(BaseModel):
    """创建音频片段请求"""
    material_url: Annotated[str, Doc("音频素材文件路径/URL")]
    target_timerange: Annotated[Optional[Dict[str, int]], Doc("片段在轨道上的目标时间范围 (微秒) {'start': int, 'duration': int}")] = None
    source_timerange: Annotated[Optional[Dict[str, int]], Doc("截取的素材片段时间范围 (微秒) {'start': int, 'duration': int}")] = None
    speed: Annotated[Optional[float], Doc("播放速度，取值范围 0.1~50.0")] = None
    volume: Annotated[float, Doc("音量，默认 1.0")] = 1.0
    change_pitch: Annotated[bool, Doc("是否跟随变速改变音调")] = False
    material_name: Annotated[Optional[str], Doc("素材名称")] = None
    fade: Annotated[Optional[Dict[str, int]], Doc("淡入淡出效果 (微秒) {'in_duration': int, 'out_duration': int}")] = None
    effects: Annotated[Optional[List[Dict[str, Any]]], Doc("音频特效列表 [{'type': str, 'params': [int]}]")] = None
    keyframes: Annotated[Optional[List[Dict[str, Any]]], Doc("音量关键帧列表 [{'time_offset': int, 'volume': float}]")] = None


class AudioInfoResponse(BaseModel):
    """创建音频片段响应"""
    code: Annotated[int, Doc("状态码")]
    message: Annotated[str, Doc("响应消息")]
    audio_infos: Annotated[str, Doc("音频素材信息（JSON 字符串）")]
    segment_ids: Annotated[List[str], Doc("素材片段 ID 列表")]


class AudioInfosByTimelinesRequest(BaseModel):
    """根据时间线创建音频素材请求"""
    timelines: Annotated[List[TimelineItem], Doc("时间线数组")]
    audio_urls: Annotated[List[str], Doc("音频素材的 URL 列表")]


class ConcatAudioInfosRequest(BaseModel):
    """拼接音频信息请求"""
    audio_infos1: Annotated[str, Doc("待拼接的第一个音频素材")]
    audio_infos2: Annotated[str, Doc("待拼接的第二个音频素材")]


class SwapAudioSegmentRequest(BaseModel):
    """交换音频片段位置请求"""
    audio_infos: Annotated[str, Doc("音频素材信息")]
    swap_position: Annotated[List[SwapPositionItem], Doc("交换位置配置数组")]
    target_timerange_start: Annotated[Optional[int], Doc("新素材在轨道上的开始时间（微秒）")] = 0


class ModifyAudioInfosRequest(BaseModel):
    """修改音频信息请求"""
    audio_infos: Annotated[str, Doc("音频素材信息（JSON 字符串）")]
    segment_index: Annotated[List[int], Doc("要修改的素材片段的索引，从 1 开始")]
    target_timerange: Annotated[Optional[Dict[str, int]], Doc("片段在轨道上的目标时间范围 (微秒) {'start': int, 'duration': int}")] = None
    source_timerange: Annotated[Optional[Dict[str, int]], Doc("截取的素材片段时间范围 (微秒) {'start': int, 'duration': int}")] = None
    speed: Annotated[Optional[float], Doc("播放速度，取值范围 0.1~50.0")] = None
    volume: Annotated[Optional[float], Doc("音量")] = None
    change_pitch: Annotated[Optional[bool], Doc("是否跟随变速改变音调")] = None
    material_url: Annotated[Optional[str], Doc("音频素材文件路径/URL")] = None
    material_name: Annotated[Optional[str], Doc("素材名称")] = None
    fade: Annotated[Optional[Dict[str, int]], Doc("淡入淡出效果 (微秒) {'in_duration': int, 'out_duration': int}")] = None
    effects: Annotated[Optional[List[Dict[str, Any]]], Doc("音频特效列表 [{'type': str, 'params': [int]}]")] = None
    keyframes: Annotated[Optional[List[Dict[str, Any]]], Doc("音量关键帧列表 [{'time_offset': int, 'volume': float}]")] = None


# ==================== 文本片段模型 ====================

class TextInfoRequest(BaseModel):
    """创建文本片段请求"""
    content: Annotated[str, Doc("文本内容")]
    target_timerange: Annotated[Optional[Dict[str, int]], Doc("片段在轨道上的目标时间范围 (微秒) {'start': int, 'duration': int}")] = None
    style: Annotated[Optional[Dict[str, Any]], Doc("文本样式 {'size', 'bold', 'italic', 'underline', 'color', 'alpha', 'align', 'vertical', 'letter_spacing', 'line_spacing', 'auto_wrapping', 'max_line_width', 'font'}")] = None
    font: Annotated[Optional[str], Doc("字体名称")] = None
    clip_settings: Annotated[Optional[Dict[str, Any]], Doc("位置变换设置 {'transform_x/y', 'scale_x/y', 'rotation', 'alpha', 'flip_horizontal', 'flip_vertical'}")] = None
    uniform_scale: Annotated[Optional[bool], Doc("是否锁定 XY 轴缩放比例")] = None
    border: Annotated[Optional[Dict[str, Any]], Doc("文本描边 {'alpha', 'color', 'width'}")] = None
    background: Annotated[Optional[Dict[str, Any]], Doc("文本背景 {'color', 'style', 'alpha', 'round_radius', 'height', 'width', 'horizontal_offset', 'vertical_offset'}")] = None
    shadow: Annotated[Optional[Dict[str, Any]], Doc("文本阴影 {'alpha', 'color', 'diffuse', 'distance', 'angle'}")] = None
    bubble: Annotated[Optional[Dict[str, Any]], Doc("文本气泡 {'effect_id', 'resource_id'}")] = None
    effect: Annotated[Optional[Dict[str, Any]], Doc("花字效果 {'effect_id'}")] = None
    animations: Annotated[Optional[Dict[str, Any]], Doc("动画配置 {'intro': {type, duration}, 'outro': {type, duration}, 'loop': {type}}")] = None
    keyframes: Annotated[Optional[List[Dict[str, Any]]], Doc("关键帧列表 [{'property', 'time_offset', 'value'}]")] = None


class TextInfoResponse(BaseModel):
    """创建文本片段响应"""
    code: Annotated[int, Doc("状态码")]
    message: Annotated[str, Doc("响应消息")]
    text_infos: Annotated[str, Doc("文本素材信息（JSON 字符串）")]
    segment_ids: Annotated[List[str], Doc("素材片段 ID 列表")]


class TextInfosByTimelinesRequest(BaseModel):
    """根据时间线创建文本素材请求"""
    timelines: Annotated[List[TimelineItem], Doc("时间线数组")]
    texts: Annotated[List[str], Doc("文本列表")]


class ConcatTextInfosRequest(BaseModel):
    """拼接文本信息请求"""
    text_infos1: Annotated[str, Doc("待拼接的第一个文本素材")]
    text_infos2: Annotated[str, Doc("待拼接的第二个文本素材")]


class SwapTextSegmentRequest(BaseModel):
    """交换文本片段位置请求"""
    text_infos: Annotated[str, Doc("文本素材信息")]
    swap_position: Annotated[List[SwapPositionItem], Doc("交换位置配置数组")]
    target_timerange_start: Annotated[Optional[int], Doc("新素材在轨道上的开始时间（微秒）")] = 0


class ModifyTextInfosRequest(BaseModel):
    """修改文本信息请求"""
    text_infos: Annotated[str, Doc("文本素材信息（JSON 字符串）")]
    segment_index: Annotated[List[int], Doc("要修改的素材片段索引")]
    content: Annotated[Optional[str], Doc("文本内容")] = None
    target_timerange: Annotated[Optional[Dict[str, int]], Doc("片段在轨道上的目标时间范围 (微秒) {'start': int, 'duration': int}")] = None
    style: Annotated[Optional[Dict[str, Any]], Doc("文本样式（部分更新） {'size', 'bold', 'italic', 'underline', 'color', 'alpha', 'align', 'vertical', 'letter_spacing', 'line_spacing', 'auto_wrapping', 'max_line_width', 'font'}")] = None
    font: Annotated[Optional[str], Doc("字体名称")] = None
    clip_settings: Annotated[Optional[Dict[str, Any]], Doc("位置变换设置（部分更新） {'transform_x/y', 'scale_x/y', 'rotation', 'alpha', 'flip_horizontal', 'flip_vertical'}")] = None
    uniform_scale: Annotated[Optional[bool], Doc("是否锁定 XY 轴缩放比例")] = None
    border: Annotated[Optional[Dict[str, Any]], Doc("文本描边（部分更新） {'alpha', 'color', 'width'}")] = None
    background: Annotated[Optional[Dict[str, Any]], Doc("文本背景（部分更新） {'color', 'style', 'alpha', 'round_radius', 'height', 'width', 'horizontal_offset', 'vertical_offset'}")] = None
    shadow: Annotated[Optional[Dict[str, Any]], Doc("文本阴影（部分更新） {'alpha', 'color', 'diffuse', 'distance', 'angle'}")] = None
    bubble: Annotated[Optional[Dict[str, Any]], Doc("文本气泡（部分更新） {'effect_id', 'resource_id'}")] = None
    effect: Annotated[Optional[Dict[str, Any]], Doc("花字效果（部分更新） {'effect_id'}")] = None
    animations: Annotated[Optional[Dict[str, Any]], Doc("动画配置（部分更新） {'intro': {type, duration}, 'outro': {type, duration}, 'loop': {type}}")] = None
    keyframes: Annotated[Optional[List[Dict[str, Any]]], Doc("关键帧列表 [{'property', 'time_offset', 'value'}]")] = None


# ==================== 贴纸模型 ====================

class StickerInfoRequest(BaseModel):
    """创建贴纸请求"""
    resource_id: Annotated[str, Doc("贴纸 resource_id")]
    target_time_start: Annotated[Optional[int], Doc("片段在轨道上的开始时间（微秒）")] = 0
    target_time_duration: Annotated[Optional[int], Doc("片段在轨道上的时长（微秒）")] = None
    clip_alpha: Annotated[Optional[float], Doc("贴纸透明度")] = 1.0
    clip_flip_horizontal: Annotated[Optional[bool], Doc("是否水平翻转")] = False
    clip_flip_vertical: Annotated[Optional[bool], Doc("是否垂直翻转")] = False
    clip_rotation: Annotated[Optional[float], Doc("顺时针旋转角度")] = 0
    clip_scale_x: Annotated[Optional[float], Doc("水平缩放比例")] = 1.0
    clip_scale_y: Annotated[Optional[float], Doc("垂直缩放比例")] = 1.0
    clip_transform_x: Annotated[Optional[float], Doc("水平位移")] = 0
    clip_transform_y: Annotated[Optional[float], Doc("垂直位移")] = -0.8


class StickerInfoResponse(BaseModel):
    """创建贴纸响应"""
    code: Annotated[int, Doc("状态码")]
    message: Annotated[str, Doc("响应消息")]
    sticker_infos: Annotated[str, Doc("贴纸素材信息（JSON 字符串）")]
    segment_ids: Annotated[List[str], Doc("素材片段 ID 列表")]


class ConcatStickerInfosRequest(BaseModel):
    """拼接贴纸信息请求"""
    sticker_infos1: Annotated[str, Doc("待拼接的第一个贴纸素材")]
    sticker_infos2: Annotated[str, Doc("待拼接的第二个贴纸素材")]


class ModifyStickerInfosRequest(BaseModel):
    """修改贴纸信息请求"""
    sticker_infos: Annotated[str, Doc("贴纸素材信息（JSON 字符串）")]
    segment_index: Annotated[List[int], Doc("要修改的素材片段索引")]
    target_time_start: Annotated[Optional[int], Doc("片段在轨道上的开始时间（微秒）")] = None
    target_time_duration: Annotated[Optional[int], Doc("片段在轨道上的时长（微秒）")] = None
    clip_alpha: Annotated[Optional[float], Doc("贴纸透明度")] = None
    clip_flip_horizontal: Annotated[Optional[bool], Doc("是否水平翻转")] = None
    clip_flip_vertical: Annotated[Optional[bool], Doc("是否垂直翻转")] = None
    clip_rotation: Annotated[Optional[float], Doc("旋转角度")] = None
    clip_scale_x: Annotated[Optional[float], Doc("水平缩放比例")] = None
    clip_scale_y: Annotated[Optional[float], Doc("垂直缩放比例")] = None
    clip_transform_x: Annotated[Optional[float], Doc("水平位移")] = None
    clip_transform_y: Annotated[Optional[float], Doc("垂直位移")] = None


# ==================== 特效/滤镜/关键帧生成模型 ====================

class GenerateEffectRequest(BaseModel):
    """生成视频特效请求"""
    effect_type_name: Annotated[str, Doc("特效名称")]
    params: Annotated[Optional[List[int]], Doc("特效参数列表")] = None
    segment_ids: Annotated[List[str], Doc("视频/图片素材唯一标识列表")]
    segment_index: Annotated[List[int], Doc("素材位置列表（从 1 开始）")]


class GenerateEffectResponse(BaseModel):
    """生成特效响应"""
    code: Annotated[int, Doc("状态码")]
    message: Annotated[str, Doc("响应消息")]
    effect_ids: Annotated[List[str], Doc("特效 ID 列表")]


class GenerateFilterRequest(BaseModel):
    """生成视频滤镜请求"""
    filter_type_name: Annotated[str, Doc("滤镜名称")]
    intensity: Annotated[Optional[int], Doc("滤镜强度")] = 100
    segment_ids: Annotated[List[str], Doc("视频/图片素材唯一标识列表")]
    segment_index: Annotated[List[int], Doc("素材位置列表（从 1 开始）")]


class GenerateFilterResponse(BaseModel):
    """生成滤镜响应"""
    code: Annotated[int, Doc("状态码")]
    message: Annotated[str, Doc("响应消息")]
    filter_ids: Annotated[List[str], Doc("滤镜 ID 列表")]


class GenerateKeyframeRequest(BaseModel):
    """生成关键帧请求"""
    segment_ids: Annotated[List[str], Doc("素材片段唯一标识列表")]
    property: Annotated[str, Doc("关键帧属性名称")]
    time_offset: Annotated[List[int], Doc("相对素材开始时间的偏移量列表（微秒）")]
    value: Annotated[List[float], Doc("关键帧的值列表")]
    segment_index: Annotated[List[int], Doc("素材唯一标识位置列表（从 1 开始）")]


class GenerateKeyframeResponse(BaseModel):
    """生成关键帧响应"""
    code: Annotated[int, Doc("状态码")]
    message: Annotated[str, Doc("响应消息")]
    keyframe_ids: Annotated[List[str], Doc("关键帧 ID 列表")]


class GenerateAudioEffectRequest(BaseModel):
    """生成音频特效请求"""
    audio_ids: Annotated[List[str], Doc("音频唯一标识列表")]
    effect_type: Annotated[str, Doc("特效类型名称")]
    params: Annotated[Optional[List[int]], Doc("特效参数列表")] = None
    segment_index: Annotated[List[int], Doc("音频唯一标识位置列表（从 1 开始）")]


class GenerateAudioKeyframeRequest(BaseModel):
    """生成音频关键帧请求"""
    audio_ids: Annotated[List[str], Doc("音频唯一标识列表")]
    time_offset: Annotated[List[int], Doc("相对音频开始时间的偏移量列表（微秒）")]
    volume: Annotated[List[float], Doc("音量值列表")]
    segment_index: Annotated[List[int], Doc("音频位置列表（从 1 开始）")]


class GenerateAudioKeyframeResponse(BaseModel):
    """生成音频关键帧响应"""
    code: Annotated[int, Doc("状态码")]
    message: Annotated[str, Doc("响应消息")]
    audio_keyframe_ids: Annotated[List[str], Doc("音频关键帧 ID 列表")]


# ==================== 剪映草稿生成模型 ====================

class GenerateJianyingDraftRequest(BaseModel):
    """生成剪映草稿文件夹请求"""
    draft_id: Annotated[str, Doc("草稿唯一标识")]
    output_folder: Annotated[str, Doc("输出文件夹路径（剪映草稿根目录）")]
    draft_name: Annotated[Optional[str], Doc("草稿名称，默认使用 draft_id 前8位")] = None
    fps: Annotated[int, Doc("帧率，默认 30")] = 30


class GenerateJianyingDraftResponse(BaseModel):
    """生成剪映草稿文件夹响应"""
    code: Annotated[int, Doc("状态码")]
    message: Annotated[str, Doc("响应消息")]
    draft_folder_path: Annotated[str, Doc("草稿文件夹路径")]
    draft_content: Annotated[Dict[str, Any], Doc("草稿内容 JSON")]