# -*- coding: utf-8 -*-
"""
API 路由模块

本模块提供基于 FastAPI 的 HTTP 路由实现，封装剪映草稿的完整 API 接口。

主要功能:
    - 草稿管理: 创建、保存、删除、获取草稿信息
    - 素材管理: 添加视频、音频、文本、贴纸等素材
    - 特效处理: 添加视频特效、滤镜、关键帧动画
    - 时间线操作: 生成时间线、素材片段拼接与交换

API 路径前缀: /api/draft

使用示例:
    启动服务后访问 http://localhost:26312/docs 查看 API 文档
"""

from fastapi import APIRouter, FastAPI, HTTPException

from .schemas import (
    CreateDraftRequest, CreateDraftResponse,
    DeleteDraftRequest,
    AddVideosRequest, AddAudiosRequest, AddTextsRequest, 
    VideoInfoRequest, VideoInfoResponse,
    AudioInfoRequest, AudioInfoResponse,
    TextInfoRequest, TextInfoResponse,
    TimelineRequest, TimelineResponse, TimelineByAudioRequest,
    VideoInfosByTimelinesRequest, AudioInfosByTimelinesRequest, TextInfosByTimelinesRequest,
    ConcatVideoInfosRequest, ConcatAudioInfosRequest, ConcatTextInfosRequest,
    SwapVideoSegmentRequest, SwapAudioSegmentRequest, SwapTextSegmentRequest,
    ModifyVideoInfosRequest, ModifyAudioInfosRequest, ModifyTextInfosRequest, 
    ApiResponse, 
    GenerateJianyingDraftRequest, GenerateJianyingDraftResponse
)

# 导入 draft 模块的功能
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.draft import (
    create_draft, check_draft_exists, delete_draft,
    add_videos,
    add_audios,
    add_texts,
    generate_template, generate_jianying_draft
)

# 导入 populate 模块
from core.draft.populate import (
    video_info, audio_info, text_info,
    video_infos_by_timelines, audio_infos_by_timelines, text_infos_by_timelines,
    concat_video_infos, concat_audio_infos, concat_text_infos,
    swap_video_segment_position, swap_audio_segment_position, swap_text_segment_position,
    modify_video_infos, modify_audio_infos, modify_text_infos,
    generate_timelines, generate_timelines_by_audio
)


# ============================================================================
# 内部辅助函数
# ============================================================================

def _collect_numbered_fields(request, field_prefix: str, count: int = 10) -> list:
    """收集请求对象中带编号的字段（如 effect_ids01~10），合并为单个列表"""
    result = []
    for i in range(1, count + 1):
        value = getattr(request, f"{field_prefix}{i:02d}", None)
        if value:
            result.extend(value)
    return result


def _build_modify_params(request, *exclude_fields: str) -> dict:
    """从请求对象构建修改参数字典，排除指定字段且跳过 None 值"""
    return {k: v for k, v in request.model_dump().items()
            if v is not None and k not in exclude_fields}


def _convert_swap_positions(request) -> list:
    """将请求中的 swap_position Pydantic 列表转换为字典列表"""
    return [s.model_dump() for s in request.swap_position]


# ============================================================================
# FastAPI 应用配置
# ============================================================================

app = FastAPI(
    title="DMVideo 剪映草稿 API",
    description="""
## 简介
本 API 提供剪映草稿的完整管理功能，支持创建、编辑、保存草稿，以及添加各类素材和特效。

## 功能模块
- **草稿管理**: 创建、保存、删除、查询草稿
- **素材管理**: 视频、音频、文本、贴纸素材的添加与编辑
- **特效滤镜**: 视频特效、滤镜、关键帧动画
- **时间线操作**: 时间线生成、素材拼接与位置交换

## 快速开始
1. 调用 `/api/draft/create` 创建草稿
2. 使用返回的 `draft_id` 添加素材
3. 调用 `/api/draft/save` 保存草稿并获取访问链接
""",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# 草稿路由器，所有草稿相关接口的前缀为 /api/draft
router = APIRouter(prefix="/api/draft", tags=["Draft"])


# ============================================================================
# 草稿管理接口
# ============================================================================

@router.post(
    "/create",
    response_model=CreateDraftResponse,
    summary="创建草稿",
    description="创建一个新的剪映草稿项目，返回草稿唯一标识"
)
async def api_create_draft(request: CreateDraftRequest):
    """创建草稿，初始化基础信息及空的视/音/文/贴纸轨道"""
    result = create_draft(request.width, request.height)
    return CreateDraftResponse(**result)


@router.post(
    "/delete",
    response_model=ApiResponse,
    summary="删除草稿",
    description="删除指定草稿的所有相关数据，此操作不可恢复"
)
async def api_delete_draft(request: DeleteDraftRequest):
    """删除草稿所有数据，此操作不可恢复"""
    result = delete_draft(request.draft_id)
    return ApiResponse(**result)


@router.get(
    "/template/{draft_id}",
    summary="获取草稿模板",
    description="获取草稿的模板数据，用于导出或进一步处理"
)
async def api_get_template(draft_id: str):
    """获取草稿模板数据，标准 JSON 格式，可导出到剪映客户端"""
    result = generate_template(draft_id)
    return result


# ============================================================================
# 素材添加接口
# ============================================================================

@router.post(
    "/add_videos",
    response_model=ApiResponse,
    summary="添加视频素材",
    description="将视频或图片素材添加到草稿的视频轨道"
)
async def api_add_videos(request: AddVideosRequest):
    """添加视频/图片素材到草稿视频轨道"""
    result = add_videos(request.draft_id, request.video_infos, request.mute, request.track_name)
    return ApiResponse(**result)


@router.post(
    "/add_audios",
    response_model=ApiResponse,
    summary="添加音频素材",
    description="将音频素材添加到草稿的音频轨道"
)
async def api_add_audios(request: AddAudiosRequest):
    """添加音频素材到草稿音频轨道"""
    result = add_audios(request.draft_id, request.audio_infos, request.mute, request.track_name)
    return ApiResponse(**result)


@router.post(
    "/add_texts",
    response_model=ApiResponse,
    summary="添加文本素材",
    description="将文本字幕添加到草稿的文本轨道"
)
async def api_add_texts(request: AddTextsRequest):
    """添加文本素材到草稿文本轨道"""
    result = add_texts(request.draft_id, request.text_infos, request.track_name)
    return ApiResponse(**result)



# ============================================================================
# 时间线接口
# ============================================================================

@router.post(
    "/timelines/generate",
    response_model=TimelineResponse,
    summary="生成时间线",
    description="根据输入的时长分段，自动计算并生成时间线"
)
async def api_generate_timelines(request: TimelineRequest):
    """根据时长分段生成时间线。模式1: [3000000,5000000,4000000]；模式2: [{'begin_time':2300000,'end_time':4600000}]"""
    # 将 Pydantic 对象转换为原始类型，保持与 generate_timelines 的兼容性
    raw_segment = [
        item if isinstance(item, int) else item.model_dump()
        for item in request.timeline_segment
    ]
    result = generate_timelines(raw_segment)
    return TimelineResponse(**result)


@router.post(
    "/timelines/generate_by_audio",
    response_model=TimelineResponse,
    summary="根据音频生成时间线",
    description="根据输入的音频 URL 列表，自动分析每个音频的时长并生成时间线"
)
async def api_generate_timelines_by_audio(request: TimelineByAudioRequest):
    """根据音频 URL 列表自动分析时长并生成时间线"""
    result = generate_timelines_by_audio(request.audio_urls)
    return TimelineResponse(**result)


# ============================================================================
# 视频/图片片段接口
# ============================================================================

@router.post(
    "/video/info",
    response_model=VideoInfoResponse,
    summary="创建视频片段",
    description="根据视频/图片 URL 和参数，创建一段视频或图片素材信息"
)
async def api_video_info(request: VideoInfoRequest):
    """创建视频/图片素材信息，支持时间控制、变换、动画、转场、遮罩等参数"""
    result = video_info(
        material_url=request.material_url,
        target_timerange=request.target_timerange,
        source_timerange=request.source_timerange,
        speed=request.speed,
        volume=request.volume,
        change_pitch=request.change_pitch,
        material_name=request.material_name,
        material_type=request.material_type,
        width=request.width,
        height=request.height,
        material_duration=request.material_duration,
        local_material_id=request.local_material_id,
        uniform_scale=request.uniform_scale,
        crop_settings=request.crop_settings,
        clip_settings=request.clip_settings,
        fade=request.fade,
        effects=request.effects,
        filters=request.filters,
        mask=request.mask,
        transition=request.transition,
        background_filling=request.background_filling,
        animations=request.animations,
        keyframes=request.keyframes
    )
    return VideoInfoResponse(**result)


@router.post(
    "/video/by_timelines",
    response_model=VideoInfoResponse,
    summary="根据时间线创建视频素材",
    description="根据输入的时间线数组和视频 URL 列表，批量创建视频素材信息"
)
async def api_video_infos_by_timelines(request: VideoInfosByTimelinesRequest):
    """根据时间线数组和视频 URL 列表批量创建视频素材信息"""
    timelines = [t.model_dump() for t in request.timelines]
    result = video_infos_by_timelines(timelines, request.video_urls)
    return VideoInfoResponse(**result)


@router.post(
    "/video/concat",
    response_model=VideoInfoResponse,
    summary="拼接视频信息",
    description="将两个视频信息数组拼接成一个新的视频信息数组"
)
async def api_concat_video_infos(request: ConcatVideoInfosRequest):
    """拼接两个视频信息数组"""
    result = concat_video_infos(request.video_infos1, request.video_infos2)
    return VideoInfoResponse(**result)


@router.post(
    "/video/swap",
    response_model=VideoInfoResponse,
    summary="交换视频片段位置",
    description="交换视频信息中两个素材片段的位置"
)
async def api_swap_video_segment(request: SwapVideoSegmentRequest):
    """交换视频素材片段位置"""
    swap_positions = _convert_swap_positions(request)
    result = swap_video_segment_position(
        request.video_infos,
        swap_positions,
        request.target_timerange_start
    )
    return VideoInfoResponse(**result)


@router.post(
    "/video/modify",
    response_model=VideoInfoResponse,
    summary="修改视频信息",
    description="修改视频素材信息中的特定片段属性"
)
async def api_modify_video_infos(request: ModifyVideoInfosRequest):
    """修改视频素材信息，支持时间、播放、变换、动画等属性的部分更新"""
    # 构建修改参数
    params = _build_modify_params(request, 'video_infos', 'segment_index')
    result = modify_video_infos(
        request.video_infos,
        request.segment_index,
        **params
    )
    return VideoInfoResponse(**result)


# ============================================================================
# 音频片段接口
# ============================================================================

@router.post(
    "/audio/info",
    response_model=AudioInfoResponse,
    summary="创建音频片段",
    description="根据音频 URL 和参数，创建一段音频素材信息"
)
async def api_audio_info(request: AudioInfoRequest):
    """创建音频素材信息，支持时间控制、播放、音频渐变等参数"""
    result = audio_info(
        material_url=request.material_url,
        target_timerange=request.target_timerange,
        source_timerange=request.source_timerange,
        speed=request.speed,
        volume=request.volume,
        change_pitch=request.change_pitch,
        material_name=request.material_name,
        fade=request.fade,
        effects=request.effects,
        keyframes=request.keyframes
    )
    return AudioInfoResponse(**result)


@router.post(
    "/audio/by_timelines",
    response_model=AudioInfoResponse,
    summary="根据时间线创建音频素材",
    description="根据输入的时间线数组和音频 URL 列表，批量创建音频素材信息"
)
async def api_audio_infos_by_timelines(request: AudioInfosByTimelinesRequest):
    """根据时间线数组和音频 URL 列表批量创建音频素材信息"""
    timelines = [t.model_dump() for t in request.timelines]
    result = audio_infos_by_timelines(timelines, request.audio_urls)
    return AudioInfoResponse(**result)


@router.post(
    "/audio/concat",
    response_model=AudioInfoResponse,
    summary="拼接音频信息",
    description="将两个音频信息数组拼接成一个新的音频信息数组"
)
async def api_concat_audio_infos(request: ConcatAudioInfosRequest):
    """拼接两个音频信息数组"""
    result = concat_audio_infos(request.audio_infos1, request.audio_infos2)
    return AudioInfoResponse(**result)


@router.post(
    "/audio/swap",
    response_model=AudioInfoResponse,
    summary="交换音频片段位置",
    description="交换音频信息中两个素材片段的位置"
)
async def api_swap_audio_segment(request: SwapAudioSegmentRequest):
    """交换音频素材片段位置"""
    swap_positions = _convert_swap_positions(request)
    result = swap_audio_segment_position(
        request.audio_infos,
        swap_positions,
        request.target_timerange_start
    )
    return AudioInfoResponse(**result)


@router.post(
    "/audio/modify",
    response_model=AudioInfoResponse,
    summary="修改音频信息",
    description="修改音频素材信息中的特定片段属性"
)
async def api_modify_audio_infos(request: ModifyAudioInfosRequest):
    """修改音频素材信息，支持播放、时间、源素材、音频效果等属性的部分更新"""
    params = _build_modify_params(request, 'audio_infos', 'segment_index')
    result = modify_audio_infos(
        request.audio_infos,
        request.segment_index,
        **params
    )
    return AudioInfoResponse(**result)


# ============================================================================
# 文本片段接口
# ============================================================================

@router.post(
    "/text/info",
    response_model=TextInfoResponse,
    summary="创建文本片段",
    description="根据文本内容和样式参数，创建一段文本素材信息"
)
async def api_text_info(request: TextInfoRequest):
    """创建文本素材信息，支持文本内容、样式、布局、动画等参数"""
    params = _build_modify_params(request)
    result = text_info(**params)
    return TextInfoResponse(**result)


@router.post(
    "/text/by_timelines",
    response_model=TextInfoResponse,
    summary="根据时间线创建文本素材",
    description="根据输入的时间线数组和文本列表，批量创建文本素材信息"
)
async def api_text_infos_by_timelines(request: TextInfosByTimelinesRequest):
    """根据时间线数组和文本列表批量创建文本素材信息"""
    timelines = [t.model_dump() for t in request.timelines]
    result = text_infos_by_timelines(timelines, request.texts)
    return TextInfoResponse(**result)


@router.post(
    "/text/concat",
    response_model=TextInfoResponse,
    summary="拼接文本信息",
    description="将两个文本信息数组拼接成一个新的文本信息数组"
)
async def api_concat_text_infos(request: ConcatTextInfosRequest):
    """拼接两个文本信息数组"""
    result = concat_text_infos(request.text_infos1, request.text_infos2)
    return TextInfoResponse(**result)


@router.post(
    "/text/swap",
    response_model=TextInfoResponse,
    summary="交换文本片段位置",
    description="交换文本信息中两个素材片段的位置"
)
async def api_swap_text_segment(request: SwapTextSegmentRequest):
    """交换文本素材片段位置"""
    swap_positions = _convert_swap_positions(request)
    result = swap_text_segment_position(
        request.text_infos,
        swap_positions,
        request.target_timerange_start
    )
    return TextInfoResponse(**result)


@router.post(
    "/text/modify",
    response_model=TextInfoResponse,
    summary="修改文本信息",
    description="修改文本素材信息中的特定片段属性"
)
async def api_modify_text_infos(request: ModifyTextInfosRequest):
    """修改文本素材信息，支持内容、样式、布局、动画等属性的部分更新"""
    params = _build_modify_params(request, 'text_infos', 'segment_index')
    result = modify_text_infos(
        request.text_infos,
        request.segment_index,
        **params
    )
    return TextInfoResponse(**result)


# ============================================================================
# 剪映草稿生成接口
# ============================================================================

@router.post(
    "/jianying/generate",
    response_model=GenerateJianyingDraftResponse,
    summary="生成剪映草稿文件夹",
    description="生成完整的剪映草稿文件夹，可在剪映客户端中直接打开"
)
async def api_generate_jianying_draft(request: GenerateJianyingDraftRequest):
    """生成完整剪映草稿文件夹，包含 draft_content.json 和 draft_meta_info.json"""
    result = generate_jianying_draft(
        draft_id=request.draft_id,
        output_folder=request.output_folder,
        draft_name=request.draft_name,
        fps=request.fps
    )
    return GenerateJianyingDraftResponse(**result)


# ============================================================================
# 路由注册与健康检查
# ============================================================================

# 将路由注册到应用
app.include_router(router)


@app.get(
    "/health",
    tags=["Health"],
    summary="健康检查",
    description="检查服务是否正常运行"
)
async def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "service": "DMVideo Backend",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=26312)
