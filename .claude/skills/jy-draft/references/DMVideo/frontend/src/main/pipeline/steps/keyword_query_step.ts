/**
 * 关键词查询步骤
 * 从数据库中查询可用的视频关键词
 */

import { PipelineStep, StepResult } from "../base";
import { TextToVideoContext } from "../context";
import { DB } from "../../database";

/**
 * 关键词查询步骤
 */
export class KeywordQueryStep extends PipelineStep {
  private db: DB;

  constructor(db: DB) {
    super();
    this.db = db;
  }

  get name(): string {
    return "关键词查询";
  }

  get stepKey(): string {
    return "keywords";
  }

  async execute(context: TextToVideoContext): Promise<StepResult> {
    console.log(`[KeywordQueryStep] 开始执行`);

    try {
      // 构建查询条件
      // 根据省、市、地点筛选视频
      // 同时限制使用次数小于5次
      const videoList = this.queryVideos(context);

      if (videoList.length === 0) {
        return {
          success: false,
          error: "没有找到符合条件的视频素材",
          pointsUsed: 0,
        };
      }

      // 提取所有关键词并去重
      const keywordSet = new Set<string>();
      const videoKeywordMap = new Map<number, string[]>();
      const videoInfoMap = new Map<number, any>();

      for (const video of videoList) {
        const keywords = video.keywords
          .split(",")
          .map((k: string) => k.trim())
          .filter((k: string) => k);
        videoKeywordMap.set(video.id, keywords);
        video.keywords = keywords; // 将字符串形式的关键词转换为数组形式，方便后续使用
        video.videoId = video.id; // 添加 videoId 字段，方便后续使用
        video.filePath = video.file_path; // 添加 filePath 字段，方便后续使用
        video.useCount = video.use_count; // 添加 useCount 字段，方便后续使用
        video.fileName = video.file_name; // 添加 fileName 字段，方便后续使用
        video.provinceIds = video.province_ids; // 添加 provinceIds 字段，方便后续使用
        video.cityIds = video.city_ids; // 添加 cityIds 字段，方便后续使用
        video.placeNames = video.place_names; // 添加 placeNames 字段，方便后续使用
        videoInfoMap.set(video.id, video);
        for (const keyword of keywords) {
          keywordSet.add(keyword);
        }
      }

      const keywords = Array.from(keywordSet);

      if (keywords.length === 0) {
        return { success: false, error: "没有找到可用的关键词", pointsUsed: 0 };
      }

      console.log(
        `[KeywordQueryStep] 查询完成，视频数: ${videoList.length}，关键词数: ${keywords.length}`,
      );

      // 注意：关键词查询不消耗积分
      return {
        success: true,
        data: {
          keywords,
          _videoList: videoList,
          _videoKeywordMap: videoKeywordMap,
          _videoInfoMap: videoInfoMap,
        },
        pointsUsed: 0,
      };
    } catch (error: any) {
      console.error("[KeywordQueryStep] 执行失败:", error);
      return {
        success: false,
        error: error.message || "未知错误",
        pointsUsed: 0,
      };
    }
  }

  /**
   * 查询符合条件的视频
   */
  private queryVideos(context: TextToVideoContext): any[] {
    // 基础查询：使用次数小于5，未删除
    let sql = `
      SELECT DISTINCT dv.*
      FROM draft_video dv
      LEFT JOIN draft_video_keyword dvk ON dv.id = dvk.video_id
      WHERE dv.deleted = 0 AND dv.analysis_status = 2 AND dv.use_count < 5
    `;

    const params: any[] = [];

    // 按省份筛选（支持多选）
    if (context.provinceAt) {
      const provinces = context.provinceAt
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p);
      if (provinces.length > 0) {
        // 检查 province_ids 字段是否包含任意一个选中的省份ID
        const conditions = provinces
          .map(() => `dv.province_ids LIKE ?`)
          .join(" OR ");
        sql += ` AND (${conditions})`;
        params.push(...provinces.map((p) => `%,${p},%`));
      }
    }

    // 按城市筛选（支持多选）
    if (context.cityAt) {
      const cities = context.cityAt
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c);
      if (cities.length > 0) {
        const conditions = cities.map(() => `dv.city_ids LIKE ?`).join(" OR ");
        sql += ` AND (${conditions})`;
        params.push(...cities.map((c) => `%,${c},%`));
      }
    }

    // 按地点关键词筛选（支持多选）
    if (context.placeAt) {
      const places = context.placeAt
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p);
      if (places.length > 0) {
        // 可以匹配 place_names 字段或者关键词表
        const conditions = places
          .map(() => `dv.place_names LIKE ?`)
          .join(" OR ");
        const placeholders = places.map(() => "?").join(",");
        sql += `
          AND (
            ${conditions}
            OR dv.id IN (
              SELECT DISTINCT video_id FROM draft_video_keyword
              WHERE keyword IN (${placeholders})
            )
          )
        `;
        // 添加 place_names 的参数
        params.push(...places.map((p) => `%,${p},%`));
        // 添加关键词表的参数
        params.push(...places);
      }
    }

    sql += " ORDER BY dv.use_count ASC, dv.created_at DESC";

    const stmt = this.db.getDb().prepare(sql);
    return stmt.all(...params) as any[];
  }

  /**
   * 断点续传检查
   * 关键词查询结果会变化，不建议跳过
   */
  canSkip(context: TextToVideoContext, taskRecord: any): boolean {
    // 关键词查询结果可能变化，每次都重新查询
    return false;
  }
}
