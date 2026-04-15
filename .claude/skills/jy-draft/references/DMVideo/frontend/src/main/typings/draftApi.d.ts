/**
 * 剪映草稿 API 类型定义
 * 对应后端 backend/core/api/schemas.py 中的 Pydantic 模型
 */

// ==================== 通用类型 ====================

/** 通用 API 响应 */
export interface ApiResponse {
  /** 状态码，0=成功，-1=失败 */
  code: number;
  /** 响应消息 */
  message: string;
}

/** 时间范围（微秒） */
export interface TimeRange {
  /** 开始时间（微秒） */
  start: number;
  /** 时长（微秒） */
  duration: number;
}

// ==================== 嵌套对象类型 ====================

/** 裁剪设置 */
export interface CropSettings {
  upper_left_x?: number;
  upper_left_y?: number;
  upper_right_x?: number;
  upper_right_y?: number;
  lower_left_x?: number;
  lower_left_y?: number;
  lower_right_x?: number;
  lower_right_y?: number;
}

/** 位置变换设置 */
export interface ClipSettings {
  transform_x?: number;
  transform_y?: number;
  scale_x?: number;
  scale_y?: number;
  rotation?: number;
  alpha?: number;
  flip_horizontal?: boolean;
  flip_vertical?: boolean;
}

/** 音频淡入淡出 */
export interface FadeSettings {
  /** 淡入时长（微秒） */
  in_duration?: number;
  /** 淡出时长（微秒） */
  out_duration?: number;
}

/** 视频特效 */
export interface VideoEffect {
  /** 特效名称 */
  type: string;
  /** 特效参数列表，取值范围 0-100 */
  params?: number[];
}

/** 视频滤镜 */
export interface VideoFilter {
  /** 滤镜名称 */
  type: string;
  /** 滤镜强度，取值范围 0-100 */
  intensity?: number;
}

/** 蒙版配置 */
export interface MaskSettings {
  type?: string;
  center_x?: number;
  center_y?: number;
  size?: number;
  rotation?: number;
  feather?: number;
  invert?: boolean;
  rect_width?: number;
  round_corner?: number;
}

/** 转场配置 */
export interface Transition {
  /** 转场类型名称 */
  type: string;
  /** 转场时长（微秒） */
  duration?: number;
}

/** 背景填充配置 */
export interface BackgroundFilling {
  type?: string;
  blur?: number;
  color?: string;
}

/** 动画配置（视频/图片） */
export interface AnimationConfig {
  intro?: { type: string; duration?: number };
  outro?: { type: string; duration?: number };
  group?: { type: string; duration?: number };
}

/** 关键帧 */
export interface KeyframeItem {
  /** 属性名称 */
  property: string;
  /** 时间偏移（微秒） */
  time_offset: number;
  /** 属性值 */
  value: number;
}

/** 音频特效 */
export interface AudioEffect {
  type: string;
  params?: number[];
}

/** 音频关键帧 */
export interface AudioKeyframe {
  /** 时间偏移（微秒） */
  time_offset: number;
  /** 音量值 */
  volume: number;
}

/** 文本样式 */
export interface TextStyle {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: number[];
  alpha?: number;
  align?: number;
  vertical?: boolean;
  letter_spacing?: number;
  line_spacing?: number;
  auto_wrapping?: boolean;
  max_line_width?: number;
  font?: string;
}

/** 文本描边 */
export interface TextBorder {
  alpha?: number;
  color?: number[];
  width?: number;
}

/** 文本背景 */
export interface TextBackground {
  color?: string;
  style?: number;
  alpha?: number;
  round_radius?: number;
  height?: number;
  width?: number;
  horizontal_offset?: number;
  vertical_offset?: number;
}

/** 文本阴影 */
export interface TextShadow {
  alpha?: number;
  color?: number[];
  diffuse?: number;
  distance?: number;
  angle?: number;
}

/** 文本气泡 */
export interface TextBubble {
  effect_id?: string;
  resource_id?: string;
}

/** 花字效果 */
export interface TextEffect {
  effect_id?: string;
}

/** 文本动画配置 */
export interface TextAnimationConfig {
  intro?: { type: string; duration?: number };
  outro?: { type: string; duration?: number };
  loop?: { type: string };
}

// ==================== 时间线 ====================

/** 时间线分段项 */
export interface TimelineItem {
  /** 开始时间（微秒） */
  start: number;
  /** 时长（微秒） */
  duration: number;
}

/** 时间线响应 */
export interface TimelineResponse extends ApiResponse {
  target: {
    all_timelines: TimelineItem[];
    timelines: TimelineItem[];
  };
}

// ==================== 草稿管理 ====================

/** 创建草稿请求 */
export interface CreateDraftRequest {
  /** 视频画面的宽度（像素） */
  width: number;
  /** 视频画面的高度（像素） */
  height: number;
}

/** 创建草稿响应 */
export interface CreateDraftResponse extends ApiResponse {
  /** 草稿唯一标识 */
  draft_id: string;
}

/** 保存草稿请求 */
export interface SaveDraftRequest {
  /** 草稿唯一标识 */
  draft_id: string;
  /** 剪映小程序客户端编号，默认值：10000 */
  client_id?: number;
}

/** 保存草稿响应 */
export interface SaveDraftResponse extends ApiResponse {
  draft_id: string;
  draft_url: string;
  expire_time?: number;
  tip?: string;
}

/** 删除草稿请求 */
export interface DeleteDraftRequest {
  /** 草稿唯一标识 */
  draft_id: string;
}

/** 草稿信息 */
export interface DraftInfo {
  draft_id: string;
  template: {
    width: number;
    height: number;
  };
  videos: any[][];
  audios: any[][];
  texts: any[][];
  stickers: any[][];
  video_effects: any[];
  video_filters: any[];
  audio_effects: any[];
  keyframes: any[];
  audio_keyframes: any[];
}

// ==================== 素材添加 ====================

/** 添加视频素材请求 */
export interface AddVideosRequest {
  draft_id: string;
  /** 视频/图片素材信息（JSON 字符串） */
  video_infos: string;
  /** 是否静音 */
  mute?: boolean;
  /** 轨道名称 */
  track_name?: string;
}

/** 添加音频素材请求 */
export interface AddAudiosRequest {
  draft_id: string;
  /** 音频素材信息（JSON 字符串） */
  audio_infos: string;
  /** 是否静音 */
  mute?: boolean;
  /** 轨道名称 */
  track_name?: string;
}

/** 添加文本素材请求 */
export interface AddTextsRequest {
  draft_id: string;
  /** 文本素材信息（JSON 字符串） */
  text_infos: string;
  /** 轨道名称 */
  track_name?: string;
}

// ==================== 视频/图片片段 ====================

/** 创建视频/图片片段请求 */
export interface VideoInfoRequest {
  /** 视频/图片素材的 URL 地址 */
  material_url: string;
  /** 片段在轨道上的目标时间范围（微秒） */
  target_timerange?: TimeRange;
  /** 截取的素材片段时间范围（微秒） */
  source_timerange?: TimeRange;
  /** 播放速度，取值范围 0.1~42.0 */
  speed?: number;
  /** 音量，默认 1.0 */
  volume?: number;
  /** 是否跟随变速改变音调，默认 false */
  change_pitch?: boolean;
  /** 素材名称 */
  material_name?: string;
  /** 素材类型: video 或 photo */
  material_type?: string;
  /** 素材宽度（像素） */
  width?: number;
  /** 素材高度（像素） */
  height?: number;
  /** 素材原始时长（微秒） */
  material_duration?: number;
  /** 本地素材 ID */
  local_material_id?: string;
  /** 是否锁定 XY 轴缩放比例 */
  uniform_scale?: boolean;
  /** 裁剪设置 */
  crop_settings?: CropSettings;
  /** 位置变换设置 */
  clip_settings?: ClipSettings;
  /** 音频淡入淡出效果（微秒） */
  fade?: FadeSettings;
  /** 视频特效列表 */
  effects?: VideoEffect[];
  /** 视频滤镜列表 */
  filters?: VideoFilter[];
  /** 蒙版配置 */
  mask?: MaskSettings;
  /** 转场配置 */
  transition?: Transition;
  /** 背景填充配置 */
  background_filling?: BackgroundFilling;
  /** 动画配置 */
  animations?: AnimationConfig;
  /** 关键帧列表 */
  keyframes?: KeyframeItem[];
}

/** 视频/图片信息响应 */
export interface VideoInfoResponse extends ApiResponse {
  /** 视频/图片素材信息（JSON 字符串） */
  video_infos: string;
  /** 素材片段 ID 列表 */
  segment_ids: string[];
}

/** 根据时间线创建视频素材请求 */
export interface VideoInfosByTimelinesRequest {
  /** 时间线数组 */
  timelines: TimelineItem[];
  /** 视频素材的 URL 列表 */
  video_urls: string[];
}

/** 拼接视频信息请求 */
export interface ConcatVideoInfosRequest {
  video_infos1: string;
  video_infos2: string;
}

/** 交换位置项 */
export interface SwapPositionItem {
  /** 源位置（从 1 开始） */
  source_index: number;
  /** 交换位置 */
  swap_index: number;
}

/** 交换视频片段位置请求 */
export interface SwapVideoSegmentRequest {
  video_infos: string;
  swap_position: SwapPositionItem[];
  /** 新素材在轨道上的开始时间（微秒） */
  target_timerange_start?: number;
}

/** 修改视频信息请求 */
export interface ModifyVideoInfosRequest {
  /** 视频素材信息（JSON 字符串） */
  video_infos: string;
  /** 要修改的素材片段索引数组（从 1 开始） */
  segment_index: number[];
  target_timerange?: TimeRange;
  source_timerange?: TimeRange;
  speed?: number;
  volume?: number;
  change_pitch?: boolean;
  material_url?: string;
  material_name?: string;
  material_type?: string;
  width?: number;
  height?: number;
  material_duration?: number;
  local_material_id?: string;
  uniform_scale?: boolean;
  crop_settings?: CropSettings;
  clip_settings?: ClipSettings;
  fade?: FadeSettings;
  effects?: VideoEffect[];
  filters?: VideoFilter[];
  mask?: MaskSettings;
  transition?: Transition;
  background_filling?: BackgroundFilling;
  animations?: AnimationConfig;
  keyframes?: KeyframeItem[];
}

// ==================== 音频片段 ====================

/** 创建音频片段请求 */
export interface AudioInfoRequest {
  /** 音频素材文件路径/URL */
  material_url: string;
  /** 片段在轨道上的目标时间范围（微秒） */
  target_timerange?: TimeRange;
  /** 截取的素材片段时间范围（微秒） */
  source_timerange?: TimeRange;
  /** 播放速度，取值范围 0.1~50.0 */
  speed?: number;
  /** 音量，默认 1.0 */
  volume?: number;
  /** 是否跟随变速改变音调，默认 false */
  change_pitch?: boolean;
  /** 素材名称 */
  material_name?: string;
  /** 淡入淡出效果（微秒） */
  fade?: FadeSettings;
  /** 音频特效列表 */
  effects?: AudioEffect[];
  /** 音量关键帧列表 */
  keyframes?: AudioKeyframe[];
}

/** 音频信息响应 */
export interface AudioInfoResponse extends ApiResponse {
  /** 音频素材信息（JSON 字符串） */
  audio_infos: string;
  /** 素材片段 ID 列表 */
  segment_ids: string[];
}

/** 根据时间线创建音频素材请求 */
export interface AudioInfosByTimelinesRequest {
  timelines: TimelineItem[];
  audio_urls: string[];
}

/** 拼接音频信息请求 */
export interface ConcatAudioInfosRequest {
  audio_infos1: string;
  audio_infos2: string;
}

/** 交换音频片段位置请求 */
export interface SwapAudioSegmentRequest {
  audio_infos: string;
  swap_position: SwapPositionItem[];
  target_timerange_start?: number;
}

/** 修改音频信息请求 */
export interface ModifyAudioInfosRequest {
  /** 音频素材信息（JSON 字符串） */
  audio_infos: string;
  /** 要修改的素材片段的索引，从 1 开始 */
  segment_index: number[];
  target_timerange?: TimeRange;
  source_timerange?: TimeRange;
  speed?: number;
  volume?: number;
  change_pitch?: boolean;
  material_url?: string;
  material_name?: string;
  fade?: FadeSettings;
  effects?: AudioEffect[];
  keyframes?: AudioKeyframe[];
}

// ==================== 文本片段 ====================

/** 创建文本片段请求 */
export interface TextInfoRequest {
  /** 文本内容 */
  content: string;
  /** 片段在轨道上的目标时间范围（微秒） */
  target_timerange?: TimeRange;
  /** 文本样式 */
  style?: TextStyle;
  /** 字体名称 */
  font?: string;
  /** 位置变换设置 */
  clip_settings?: ClipSettings;
  /** 是否锁定 XY 轴缩放比例 */
  uniform_scale?: boolean;
  /** 文本描边 */
  border?: TextBorder;
  /** 文本背景 */
  background?: TextBackground;
  /** 文本阴影 */
  shadow?: TextShadow;
  /** 文本气泡 */
  bubble?: TextBubble;
  /** 花字效果 */
  effect?: TextEffect;
  /** 动画配置 */
  animations?: TextAnimationConfig;
  /** 关键帧列表 */
  keyframes?: KeyframeItem[];
}

/** 文本信息响应 */
export interface TextInfoResponse extends ApiResponse {
  /** 文本素材信息（JSON 字符串） */
  text_infos: string;
  /** 素材片段 ID 列表 */
  segment_ids: string[];
}

/** 根据时间线创建文本素材请求 */
export interface TextInfosByTimelinesRequest {
  timelines: TimelineItem[];
  texts: string[];
}

/** 拼接文本信息请求 */
export interface ConcatTextInfosRequest {
  text_infos1: string;
  text_infos2: string;
}

/** 交换文本片段位置请求 */
export interface SwapTextSegmentRequest {
  text_infos: string;
  swap_position: SwapPositionItem[];
  target_timerange_start?: number;
}

/** 修改文本信息请求 */
export interface ModifyTextInfosRequest {
  /** 文本素材信息（JSON 字符串） */
  text_infos: string;
  /** 要修改的素材片段索引 */
  segment_index: number[];
  content?: string;
  target_timerange?: TimeRange;
  style?: TextStyle;
  font?: string;
  clip_settings?: ClipSettings;
  uniform_scale?: boolean;
  border?: TextBorder;
  background?: TextBackground;
  shadow?: TextShadow;
  bubble?: TextBubble;
  effect?: TextEffect;
  animations?: TextAnimationConfig;
  keyframes?: KeyframeItem[];
}

// ==================== 剪映草稿生成 ====================

/** 生成剪映草稿文件夹请求 */
export interface GenerateJianyingDraftRequest {
  /** 草稿唯一标识 */
  draft_id: string;
  /** 输出文件夹路径（剪映草稿根目录） */
  output_folder: string;
  /** 草稿名称，默认使用 draft_id 前8位 */
  draft_name?: string;
  /** 帧率，默认 30 */
  fps?: number;
}

/** 生成剪映草稿文件夹响应 */
export interface GenerateJianyingDraftResponse extends ApiResponse {
  /** 草稿文件夹路径 */
  draft_folder_path: string;
  /** 草稿内容 JSON */
  draft_content: Record<string, any>;
}

// ==================== 轨道包装类型 ====================

/** 视频轨道 */
export interface VideoTrack {
  /** 轨道名称 */
  track_name?: string;
  /** 是否静音 */
  mute?: boolean;
  /** 视频片段列表 */
  segments: VideoInfoRequest[];
}

/** 音频轨道 */
export interface AudioTrack {
  /** 轨道名称 */
  track_name?: string;
  /** 是否静音 */
  mute?: boolean;
  /** 音频片段列表 */
  segments: AudioInfoRequest[];
}

/** 文本轨道 */
export interface TextTrack {
  /** 轨道名称 */
  track_name?: string;
  /** 文本片段列表 */
  segments: TextInfoRequest[];
}
