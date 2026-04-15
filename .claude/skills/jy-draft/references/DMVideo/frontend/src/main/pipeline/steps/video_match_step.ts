/**
 * 视频匹配步骤
 * 根据关键词绑定的结果，生成最优的视频时间线
 */

import { PipelineStep, StepResult } from "../base";
import { TextToVideoContext, VideoTimeline, ShortSentence, RecordSegment } from "../context";
import {
  videoMatchUtil,
  ShortSentence as VmShortSentence,
  RecordInfo as VmRecordInfo,
  dumpJson,
} from "../../core";
import { calculateVideoMatchPoints, deductPointsForStep } from "../points";

/**
 * API 返回的结果项结构
 */
interface ApiResultItem {
  sentence_id: number;
  text: string;
  begin_time: number;
  duration: number;
  keywords: string;
  record_ids: string[];
  record_segments: Array<{
    record_id: string;
    start_time: number;
    end_time: number;
  }>;
  score?: number;
}

/**
 * API 返回的分析结果
 */
interface ApiAnalysis {
  total_sentences: number;
  total_segments: number;
  unique_records_used: number;
  avg_segment_duration_us: number;
  segments_per_sentence: number;
}

/**
 * 视频匹配步骤
 */
export class VideoMatchStep extends PipelineStep {
  private apiToken: string;
  private baseUrl?: string;

  constructor(apiToken: string, baseUrl?: string) {
    super();
    this.apiToken = apiToken;
    this.baseUrl = baseUrl;
  }

  get name(): string {
    return "视频匹配";
  }

  get stepKey(): string {
    return "video_timelines";
  }

  async execute(context: TextToVideoContext): Promise<StepResult> {
    console.log(`[VideoMatchStep] 开始执行`);

    // 检查依赖
    if (!context.shortSentences || context.shortSentences.length === 0) {
      return {
        success: false,
        error: "短句数据为空，请先执行关键词绑定",
        pointsUsed: 0,
      };
    }

    try {
      // 构建 videoMatch 所需的数据结构
      const vmShortSentences = this.buildVmShortSentences(
        context.shortSentences,
      );

      // 打印发送给 API 的数据，便于调试
      console.log(`[VideoMatchStep] 发送给 API 的短句数据: ${JSON.stringify(vmShortSentences)}`);

      // 检查短句是否有关联的视频记录
      const sentencesWithoutRecords = vmShortSentences.filter(ss => !ss.record_ids || ss.record_ids.length === 0);
      if (sentencesWithoutRecords.length > 0) {
        console.warn(`[VideoMatchStep] 有 ${sentencesWithoutRecords.length} 个短句没有关联的视频记录:`,
          sentencesWithoutRecords.map(ss => ({ sentence_id: ss.sentence_id, text: ss.text })));
      }

      //dumpJson("video_matcher.json", vmShortSentences)

      // 调用视频匹配
      const result = await videoMatchUtil.matchVideos(
        { short_sentences: vmShortSentences },
        { apiToken: this.apiToken, baseUrl: this.baseUrl },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "视频匹配失败",
          pointsUsed: 0,
        };
      }

      const matchData = result.data;
      if (!matchData || !matchData.results || matchData.results.length === 0) {
        return { success: false, error: "视频匹配结果为空", pointsUsed: 0 };
      }

      // 打印原始 API 响应，便于调试
      console.log(`[VideoMatchStep] API 原始响应 results 数量: ${matchData.results.length}`);
      console.log(`[VideoMatchStep] API 原始响应 analysis: ${JSON.stringify(matchData.analysis)}`);

      // 转换结果格式，使用 API 返回的 record_ids 和 record_segments
      // const videoTimelines: VideoTimeline[] = matchData.results.map((r: ApiResultItem) => {
      //   // 使用 API 返回的 record_ids[0] 作为 matched_record_id
      //   const matchedRecordId = r.record_ids && r.record_ids.length > 0
      //     ? r.record_ids[0]
      //     : '';
      //
      //   // 转换 record_segments
      //   const recordSegments: RecordSegment[] = (r.record_segments || []).map(seg => ({
      //     record_id: seg.record_id,
      //     start_time: seg.start_time,
      //     end_time: seg.end_time,
      //   }));
      //
      //   return {
      //     sentence_id: r.sentence_id,
      //     text: r.text,
      //     matched_record_id: matchedRecordId,
      //     record_ids: r.record_ids || [],
      //     record_segments: recordSegments,
      //     begin_time: r.begin_time,
      //     end_time: r.begin_time + r.duration,
      //     duration: r.duration,
      //     score: r.score || 0,
      //     keywords: r.keywords || '',
      //   };
      // });
      const videoTimelines: VideoTimeline[] = [];
      let last_end_time = 0;
      matchData.results.forEach((item: ApiResultItem) => {

        let s_begin_time = item.begin_time

        item.record_segments.forEach((seg: RecordSegment) => {

          const _ = {
            sentence_id: item.sentence_id,
            text: item.text,
            matched_record_id: seg.record_id,
            record_ids: [seg.record_id],
            record_segments: [JSON.parse(JSON.stringify(seg))],
            begin_time: s_begin_time,
            duration: seg.end_time - seg.start_time,
            end_time: s_begin_time + (seg.end_time - seg.start_time),
            score: item.score || 0,
            keywords: item.keywords || ''
          }

          videoTimelines.push(_);
          last_end_time = seg.end_time;

          s_begin_time += seg.end_time - seg.start_time;
        })
      })


      // 提取使用的视频ID（去重）
      const videoIds = Array.from(
        new Set(videoTimelines.flatMap(t => t.record_ids).filter(id => id)),
      );

      // 计算积分
      const pointsUsed = calculateVideoMatchPoints(last_end_time);

      // 打印匹配结果摘要
      console.log(`[VideoMatchStep] 视频匹配完成，结果摘要:`);
      console.log(`[VideoMatchStep] - 时间线数量: ${videoTimelines.length}`);
      console.log(`[VideoMatchStep] - 使用视频数量: ${videoIds.length}`);
      console.log(`[VideoMatchStep] - 视频ID列表: ${videoIds.join(', ')}`);
      console.log(`[VideoMatchStep] - 积分消耗: ${pointsUsed}`);

      // 打印每个时间线的详细信息
      for (const timeline of videoTimelines) {
        console.log(`[VideoMatchStep]   sentence_id=${timeline.sentence_id}: "${timeline.text.substring(0, 20)}..." -> record_ids=${JSON.stringify(timeline.record_ids)}`);
      }

      // 扣除积分
      await deductPointsForStep(context, pointsUsed, 'VideoMatchStep');

      return {
        success: true,
        data: {
          video_timelines: videoTimelines,
          video_used_points: pointsUsed,
          draft_video_ids: videoIds.join(","),
        },
        pointsUsed,
      };
    } catch (error: any) {
      console.error("[VideoMatchStep] 执行失败:", error);
      return {
        success: false,
        error: error.message || "未知错误",
        pointsUsed: 0,
      };
    }
  }

  /**
   * 构建 videoMatch 所需的短句数据
   */
  private buildVmShortSentences(
    shortSentences: ShortSentence[],
  ): VmShortSentence[] {
    return shortSentences.map((ss) => ({
      text: ss.text,
      sentence_id: ss.sentence_id,
      duration: ss.duration,
      begin_time: ss.begin_time,
      end_time: ss.end_time,
      video_begin_time: ss.video_begin_time,
      video_end_time: ss.video_end_time,
      videoDuration: ss.videoDuration,
      record_ids: ss.record_ids,
      record_infos: ss.record_infos.map((ri) => ({
        keywords: ri.keywords,
        used_count: ri.used_count,
        video_duration: ri.video_duration,
      })) as VmRecordInfo[],
      keywords: ss.keywords.join(","),
    }));
  }
}
