/**
 * 数据库模块
 * 使用 better-sqlite3 进行本地数据存储
 * 集成加密拦截器，自动处理敏感字段的加密/解密
 */

import BetterSqlite3 from 'better-sqlite3';
import { encryptionInterceptor } from '../core';

export class DB {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  /**
   * 初始化所有表
   */
  private initTables(): void {
    // 材料库-文案
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS material_text (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        source TEXT DEFAULT 'manual',
        deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 材料库-视频
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS material_video (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        file_name TEXT,
        duration REAL,
        width INTEGER,
        height INTEGER,
        size INTEGER,
        format TEXT,
        thumbnail TEXT,
        deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 材料库-作品地址
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS material_url (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        platform TEXT,
        content_type TEXT,
        title TEXT,
        cover TEXT,
        deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 素材库-文案
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS draft_text (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        source_id INTEGER,
        deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 素材库-视频
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS draft_video (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        file_name TEXT,
        duration REAL,
        keywords TEXT,
        use_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        thumbnail TEXT,
        deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 素材库-视频关键词关联表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS draft_video_keyword (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES draft_video(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_draft_video_keyword_video_id ON draft_video_keyword(video_id);
      CREATE INDEX IF NOT EXISTS idx_draft_video_keyword_keyword ON draft_video_keyword(keyword);
    `);

    // 作品库
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS works (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        file_name TEXT,
        platform TEXT,
        platform_url TEXT,
        remark TEXT,
        play_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        thumbnail TEXT,
        deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 基础配置
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入默认配置
    const defaultConfigs = [
      ['video_root_path', ''],
      ['jianying_draft_path', ''],
      ['ffmpeg_path', ''],
      ['python_path', 'python'],
      ['api_token', ''],
      ['api_base_url', ''],
      // OSS 配置
      ['oss_access_key_id', ''],
      ['oss_access_key_secret', ''],
      ['oss_bucket', ''],
      ['oss_region', ''],
      ['oss_upload_dir', ''],
    ];

    const insertConfig = this.db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
    for (const [key, value] of defaultConfigs) {
      insertConfig.run(key, value);
    }

    // 音色克隆记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS voice_clone (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voice_id TEXT NOT NULL,
        voice_tag TEXT NOT NULL,
        voice_model_id TEXT NOT NULL,
        audio_file_path TEXT,
        clone_type TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME
      )
    `);

    // 文生视频任务表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS text_to_video_task (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        draft_text_id INTEGER NOT NULL,
        voice_id TEXT,
        voice_model_id TEXT,
        tts_local_path TEXT,
        asr_content TEXT,
        text_used_points INTEGER DEFAULT 0,
        short_sentences TEXT,
        keywords_bind_used_points INTEGER DEFAULT 0,
        video_timelines TEXT,
        video_used_points INTEGER DEFAULT 0,
        bg_music_config TEXT,
        is_muted INTEGER DEFAULT 0,
        draft_generate_used_points INTEGER DEFAULT 5,
        deleted INTEGER DEFAULT 0,
        draft_video_ids TEXT,
        province_at TEXT,
        city_at TEXT,
        place_at TEXT,
        status INTEGER DEFAULT 0,
        current_step TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 为已存在的表添加 deleted 字段（迁移）
    this.migrateAddDeletedField();

    // 为 material_video 表添加 format 字段（迁移）
    this.migrateAddFormatField();

    // 为 draft_text 表添加 status 字段（迁移）
    this.migrateAddDraftTextStatusField();

    // 为 draft_video 表添加业务字段（迁移）
    this.migrateAddDraftVideoFields();

    // 为 draft_video 和 draft_text 表添加 feishu_record_id 字段（迁移）
    this.migrateAddFeishuRecordIdFields();

    // 为 text_to_video_task 表添加 canvas 字段（迁移）
    this.migrateAddTextToVideoTaskCanvasFields();

    // 为 text_to_video_task 表添加草稿相关字段（迁移）
    this.migrateAddTextToVideoTaskDraftFields();

    // 为 text_to_video_task 表添加素材审核相关字段（迁移）
    this.migrateAddDraftReviewFields();

    // 为 material_video 表添加 OSS 字段（迁移）
    this.migrateAddMaterialVideoOssFields();

    // 为 material_video_analysis_result 表添加 keywords 字段（迁移）
    this.migrateAddAnalysisResultKeywordsField();

    // 为 material_video_analysis_result 表添加 is_migrated 和 deleted_at 字段（迁移）
    this.migrateAddAnalysisResultMigrateAndSoftDeleteFields();

    // 为 voice_clone 表添加 clone_type 字段（迁移）
    this.migrateAddVoiceCloneTypeField();

    // 材料库视频智能分割结果表
    this.initMaterialVideoAnalysisResultTable();

    // 初始化配置表
    this.initInitConfigTable();

    // 地区数据表
    this.initPlaceTable();

    console.log('[Database] 表初始化完成');
  }

  /**
   * 迁移：为已存在的表添加 deleted 字段
   */
  private migrateAddDeletedField(): void {
    const tables = ['material_text', 'material_video', 'material_url', 'draft_text', 'draft_video', 'works'];
    for (const table of tables) {
      try {
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN deleted INTEGER DEFAULT 0`);
      } catch (e) {
        // 字段已存在，忽略错误
      }
    }
  }

  /**
   * 迁移：为 material_video 表添加 format 字段
   */
  private migrateAddFormatField(): void {
    try {
      this.db.exec(`ALTER TABLE material_video ADD COLUMN format TEXT`);
    } catch (e) {
      // 字段已存在，忽略错误
    }
  }

  /**
   * 迁移：为 draft_text 表添加 status 字段
   */
  private migrateAddDraftTextStatusField(): void {
    try {
      this.db.exec(`ALTER TABLE draft_text ADD COLUMN status INTEGER DEFAULT 0`);
      // 更新已存在的记录，将 NULL 值设为 0
      this.db.exec(`UPDATE draft_text SET status = 0 WHERE status IS NULL`);
    } catch (e) {
      // 字段已存在，忽略错误
    }
  }

  /**
   * 迁移：为 draft_video 表添加业务字段
   */
  private migrateAddDraftVideoFields(): void {
    const fields = [
      'width INTEGER',
      'height INTEGER',
      'size INTEGER',
      'format TEXT',
      'analysis_status INTEGER DEFAULT 0',
      // 省份ID（支持多选，逗号分隔）
      'province_ids TEXT',
      // 城市ID（支持多选，逗号分隔）
      'city_ids TEXT',
      // 地点关键词（支持多选，逗号分隔）
      'place_names TEXT',
      // 更新时间
      'updated_at DATETIME'
    ];
    for (const field of fields) {
      try {
        this.db.exec(`ALTER TABLE draft_video ADD COLUMN ${field}`);
      } catch (e) {
        // 字段已存在，忽略错误
      }
    }
    // 更新已存在的记录，将 NULL 值设为 0
    try {
      this.db.exec(`UPDATE draft_video SET analysis_status = 0 WHERE analysis_status IS NULL`);
    } catch (e) {
      // 忽略错误
    }
  }

  /**
   * 迁移：为 draft_video 和 draft_text 表添加 feishu_record_id 字段
   */
  private migrateAddFeishuRecordIdFields(): void {
    // draft_video 表添加 feishu_record_id 字段
    try {
      this.db.exec(`ALTER TABLE draft_video ADD COLUMN feishu_record_id TEXT`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_draft_video_feishu_record_id ON draft_video(feishu_record_id)`);
    } catch (e) {
      // 字段已存在，忽略错误
    }

    // draft_text 表添加 feishu_record_id 字段
    try {
      this.db.exec(`ALTER TABLE draft_text ADD COLUMN feishu_record_id TEXT`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_draft_text_feishu_record_id ON draft_text(feishu_record_id)`);
    } catch (e) {
      // 字段已存在，忽略错误
    }
  }

  /**
   * 迁移：为 text_to_video_task 表添加画布尺寸字段
   */
  private migrateAddTextToVideoTaskCanvasFields(): void {
    const fields = [
      'canvas_width INTEGER DEFAULT 1920',
      'canvas_height INTEGER DEFAULT 1080',
      'draft_name TEXT',
    ];
    for (const field of fields) {
      try {
        this.db.exec(`ALTER TABLE text_to_video_task ADD COLUMN ${field}`);
      } catch (e) {
        // 字段已存在，忽略错误
      }
    }
  }

  /**
   * 迁移：为 text_to_video_task 表添加草稿相关字段
   */
  private migrateAddTextToVideoTaskDraftFields(): void {
    const fields = [
      'draft_populate_used_points INTEGER DEFAULT 0',
      'draft_id TEXT',
      'jianying_draft_path TEXT',
    ];
    for (const field of fields) {
      try {
        this.db.exec(`ALTER TABLE text_to_video_task ADD COLUMN ${field}`);
      } catch (e) {
        // 字段已存在，忽略错误
      }
    }
  }

  /**
   * 迁移：为 text_to_video_task 表添加素材审核相关字段
   */
  private migrateAddDraftReviewFields(): void {
    const fields = [
      'edited_video_infos TEXT',
      'edited_audio_infos TEXT',
      'edited_text_infos TEXT',
      'edited_bg_music_config TEXT',
      'edited_video_tracks TEXT',
      'edited_audio_tracks TEXT',
      'edited_text_tracks TEXT',
      'draft_review_status INTEGER DEFAULT 0',
    ];
    for (const field of fields) {
      try {
        this.db.exec(`ALTER TABLE text_to_video_task ADD COLUMN ${field}`);
      } catch (e) {
        // 字段已存在，忽略错误
      }
    }
  }

  /**
   * 迁移：为 material_video 表添加 OSS 相关字段
   */
  private migrateAddMaterialVideoOssFields(): void {
    const fields = [
      'oss_object_name TEXT',
      'oss_uploaded_at DATETIME',
    ];
    for (const field of fields) {
      try {
        this.db.exec(`ALTER TABLE material_video ADD COLUMN ${field}`);
      } catch (e) {
        // 字段已存在，忽略错误
      }
    }
  }

  private migrateAddAnalysisResultKeywordsField(): void {
    try {
      this.db.exec(`ALTER TABLE material_video_analysis_result ADD COLUMN keywords TEXT`);
    } catch (e) {
      // 字段已存在，忽略错误
    }
  }

  private migrateAddAnalysisResultMigrateAndSoftDeleteFields(): void {
    try {
      this.db.exec(`ALTER TABLE material_video_analysis_result ADD COLUMN is_migrated INTEGER DEFAULT 0`);
    } catch (e) {
      // 字段已存在，忽略错误
    }
    try {
      this.db.exec(`ALTER TABLE material_video_analysis_result ADD COLUMN deleted_at DATETIME`);
    } catch (e) {
      // 字段已存在，忽略错误
    }
  }

  /**
   * 迁移：为 voice_clone 表添加 clone_type 字段
   */
  private migrateAddVoiceCloneTypeField(): void {
    try {
      this.db.exec(`ALTER TABLE voice_clone ADD COLUMN clone_type TEXT DEFAULT 'free'`);
    } catch (e) {
      // 字段已存在，忽略错误
    }
  }

  /**
   * 初始化材料库视频智能分割结果表
   */
  private initMaterialVideoAnalysisResultTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS material_video_analysis_result (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_video_id INTEGER NOT NULL,
        segment_start_time REAL NOT NULL,
        segment_end_time REAL NOT NULL,
        segment_duration REAL NOT NULL,
        segment_file_path TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material_video_id) REFERENCES material_video(id) ON DELETE CASCADE
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_mvar_video_id ON material_video_analysis_result(material_video_id)`);
  }

  /**
   * 获取数据库实例
   */
  getDb(): BetterSqlite3.Database {
    return this.db;
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
    console.log('[Database] 数据库连接已关闭');
  }

  // ==================== 材料库-文案 ====================

  /**
   * 添加文案
   */
  addMaterialText(content: string, source: string = 'manual'): number {
    // 拦截器：插入前加密
    const data = encryptionInterceptor.beforeInsert('material_text', { content, source });
    const stmt = this.db.prepare('INSERT INTO material_text (content, source) VALUES (?, ?)');
    const result = stmt.run(data.content, data.source);
    return result.lastInsertRowid as number;
  }

  /**
   * 获取文案列表
   */
  getMaterialTextList(limit: number = 100, offset: number = 0): any[] {
    const stmt = this.db.prepare('SELECT * FROM material_text WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?');
    const results = stmt.all(limit, offset) as any[];
    // 拦截器：查询后解密
    return encryptionInterceptor.afterSelectMany('material_text', results);
  }

  /**
   * 软删除文案
   */
  deleteMaterialText(ids: number[]): number {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`UPDATE material_text SET deleted = 1, updated_at = datetime('now', 'localtime') WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    return result.changes;
  }

  /**
   * 更新文案
   */
  updateMaterialText(id: number, content: string): number {
    // 拦截器：更新前加密
    const data = encryptionInterceptor.beforeUpdate('material_text', { content });
    const stmt = this.db.prepare("UPDATE material_text SET content = ?, updated_at = datetime('now', 'localtime') WHERE id = ?");
    const result = stmt.run(data.content, id);
    return result.changes;
  }

  // ==================== 材料库-视频 ====================

  /**
   * 添加视频
   */
  addMaterialVideo(video: {
    file_path: string;
    file_name: string;
    duration?: number;
    width?: number;
    height?: number;
    size?: number;
    format?: string;
    thumbnail?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO material_video (file_path, file_name, duration, width, height, size, format, thumbnail)
      VALUES (@file_path, @file_name, @duration, @width, @height, @size, @format, @thumbnail)
    `);
    const result = stmt.run(video);
    return result.lastInsertRowid as number;
  }

  /**
   * 获取视频列表
   */
  getMaterialVideoCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM material_video WHERE deleted = 0');
    const row = stmt.get() as any;
    return row?.count ?? 0;
  }

  getMaterialVideoList(limit: number = 100, offset: number = 0): any[] {
    const stmt = this.db.prepare('SELECT * FROM material_video WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }

  /**
   * 软删除视频
   */
  deleteMaterialVideo(ids: number[]): number {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`UPDATE material_video SET deleted = 1 WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    return result.changes;
  }

  /**
   * 获取视频详情
   */
  getMaterialVideo(id: number): any {
    const stmt = this.db.prepare('SELECT * FROM material_video WHERE id = ? AND deleted = 0');
    return stmt.get(id);
  }

  /**
   * 更新材料库视频的 OSS 信息
   */
  updateMaterialVideoOssInfo(id: number, ossObjectName: string): number {
    const stmt = this.db.prepare(
      `UPDATE material_video SET oss_object_name = ?, oss_uploaded_at = CURRENT_TIMESTAMP WHERE id = ?`
    );
    const result = stmt.run(ossObjectName, id);
    return result.changes;
  }

  // ==================== 材料库-视频智能分割结果 ====================

  /**
   * 批量添加智能分割分析结果（时间单位：毫秒）
   */
  addMaterialVideoAnalysisResults(
    materialVideoId: number,
    segments: Array<{ startTime: number; endTime: number; description: string; keywords?: string }>
  ): number[] {
    const stmt = this.db.prepare(`
      INSERT INTO material_video_analysis_result
        (material_video_id, segment_start_time, segment_end_time, segment_duration, description, keywords)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const ids: number[] = [];
    const insertAll = this.db.transaction(() => {
      for (const seg of segments) {
        const startMs = Math.round(seg.startTime * 1000); // 秒 → 毫秒
        const endMs = Math.round(seg.endTime * 1000);
        const durationMs = endMs - startMs;
        const result = stmt.run(materialVideoId, startMs, endMs, durationMs, seg.description || '', seg.keywords || '');
        ids.push(result.lastInsertRowid as number);
      }
    });
    insertAll();
    return ids;
  }

  /**
   * 获取指定视频的智能分割分析结果（排除已软删除的）
   */
  getMaterialVideoAnalysisResults(materialVideoId: number): any[] {
    const stmt = this.db.prepare(
      'SELECT * FROM material_video_analysis_result WHERE material_video_id = ? AND deleted_at IS NULL ORDER BY segment_start_time ASC'
    );
    return stmt.all(materialVideoId);
  }

  /**
   * 更新分割片段的本地文件路径
   */
  updateAnalysisResultFilePath(id: number, filePath: string): number {
    const stmt = this.db.prepare(
      `UPDATE material_video_analysis_result SET segment_file_path = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
    );
    const result = stmt.run(filePath, id);
    return result.changes;
  }

  /**
   * 标记分割片段为已迁移
   */
  updateAnalysisResultMigrated(id: number): number {
    const stmt = this.db.prepare(
      `UPDATE material_video_analysis_result SET is_migrated = 1, updated_at = datetime('now', 'localtime') WHERE id = ?`
    );
    const result = stmt.run(id);
    return result.changes;
  }

  /**
   * 根据视频ID和时间范围查找分析结果记录（时间单位：毫秒）
   */
  getAnalysisResultBySegment(materialVideoId: number, startTimeMs: number, endTimeMs: number): any {
    const stmt = this.db.prepare(
      'SELECT * FROM material_video_analysis_result WHERE material_video_id = ? AND segment_start_time = ? AND segment_end_time = ? LIMIT 1'
    );
    return stmt.get(materialVideoId, startTimeMs, endTimeMs);
  }

  /**
   * 软删除指定视频的所有分析结果
   */
  deleteMaterialVideoAnalysisResults(materialVideoId: number): number {
    const stmt = this.db.prepare(
      `UPDATE material_video_analysis_result SET deleted_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE material_video_id = ? AND deleted_at IS NULL`
    );
    const result = stmt.run(materialVideoId);
    return result.changes;
  }

  // ==================== 材料库-作品地址 ====================

  /**
   * 添加作品地址
   */
  addMaterialUrl(url: {
    url: string;
    platform?: string;
    content_type?: string;
    title?: string;
    cover?: string;
  }): number {
    // 拦截器：插入前加密
    const data = encryptionInterceptor.beforeInsert('material_url', url);
    const stmt = this.db.prepare(`
      INSERT INTO material_url (url, platform, content_type, title, cover)
      VALUES (@url, @platform, @content_type, @title, @cover)
    `);
    const result = stmt.run(data);
    return result.lastInsertRowid as number;
  }

  /**
   * 获取作品地址列表
   */
  getMaterialUrlList(limit: number = 100, offset: number = 0): any[] {
    const stmt = this.db.prepare('SELECT * FROM material_url WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?');
    const results = stmt.all(limit, offset) as any[];
    // 拦截器：查询后解密
    return encryptionInterceptor.afterSelectMany('material_url', results);
  }

  /**
   * 软删除作品地址
   */
  deleteMaterialUrl(ids: number[]): number {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`UPDATE material_url SET deleted = 1 WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    return result.changes;
  }

  // ==================== 素材库-文案 ====================

  /**
   * 添加素材文案
   */
  addDraftText(content: string, sourceId?: number): number {
    // 拦截器：插入前加密
    const data = encryptionInterceptor.beforeInsert('draft_text', { content, sourceId: sourceId || null });
    const stmt = this.db.prepare('INSERT INTO draft_text (content, source_id) VALUES (?, ?)');
    const result = stmt.run(data.content, data.sourceId);
    return result.lastInsertRowid as number;
  }

  /**
   * 获取素材文案列表
   */
  getDraftTextCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM draft_text WHERE deleted = 0');
    const row = stmt.get() as any;
    return row?.count ?? 0;
  }

  getDraftTextList(limit: number = 100, offset: number = 0): any[] {
    const stmt = this.db.prepare('SELECT * FROM draft_text WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?');
    const results = stmt.all(limit, offset) as any[];
    // 拦截器：查询后解密
    return encryptionInterceptor.afterSelectMany('draft_text', results);
  }

  /**
   * 软删除素材文案
   */
  deleteDraftText(ids: number[]): number {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`UPDATE draft_text SET deleted = 1 WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    return result.changes;
  }

  /**
   * 更新素材文案内容
   */
  updateDraftText(id: number, content: string): number {
    const data = encryptionInterceptor.beforeUpdate('draft_text', { content });
    const stmt = this.db.prepare('UPDATE draft_text SET content = ? WHERE id = ?');
    const result = stmt.run(data.content, id);
    return result.changes;
  }

  /**
   * 更新素材文案状态
   */
  updateDraftTextStatus(id: number, status: number): number {
    const stmt = this.db.prepare('UPDATE draft_text SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);
    return result.changes;
  }

  /**
   * 根据飞书记录ID获取素材文案
   */
  getDraftTextByFeishuRecordId(feishuRecordId: string): any {
    const stmt = this.db.prepare('SELECT * FROM draft_text WHERE feishu_record_id = ? AND deleted = 0');
    return stmt.get(feishuRecordId);
  }

  /**
   * 添加素材文案（含飞书记录ID）
   */
  addDraftTextWithFeishuId(content: string, feishuRecordId: string): number {
    // 拦截器：插入前加密
    const data = encryptionInterceptor.beforeInsert('draft_text', { content, feishuRecordId });
    const stmt = this.db.prepare('INSERT INTO draft_text (content, feishu_record_id) VALUES (?, ?)');
    const result = stmt.run(data.content, data.feishuRecordId);
    return result.lastInsertRowid as number;
  }

  // ==================== 素材库-视频 ====================

  /**
   * 添加素材视频
   */
  addDraftVideo(video: {
    file_path: string;
    file_name: string;
    duration?: number;
    width?: number;
    height?: number;
    size?: number;
    format?: string;
    keywords?: string;
    thumbnail?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO draft_video (file_path, file_name, duration, width, height, size, format, keywords, thumbnail)
      VALUES (@file_path, @file_name, @duration, @width, @height, @size, @format, @keywords, @thumbnail)
    `);
    const result = stmt.run(video);
    return result.lastInsertRowid as number;
  }

  /**
   * 获取素材视频
   */
  getDraftVideo(id: number): any {
    const stmt = this.db.prepare('SELECT * FROM draft_video WHERE id = ? AND deleted = 0');
    return stmt.get(id);
  }

  /**
   * 获取素材视频列表
   */
  getDraftVideoCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM draft_video WHERE deleted = 0');
    const row = stmt.get() as any;
    return row?.count ?? 0;
  }

  getDraftVideoList(limit: number = 100, offset: number = 0): any[] {
    const stmt = this.db.prepare('SELECT * FROM draft_video WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }

  /**
   * 根据视频ID列表批量获取视频素材信息
   * @param videoIds 视频 ID 列表
   * @returns 视频素材信息映射（key: video_id, value: 视频信息）
   */
  getDraftVideosByIds(videoIds: number[]): Map<number, any> {
    const videoMap = new Map<number, any>();
    if (!videoIds || videoIds.length === 0) {
      return videoMap;
    }
    const placeholders = videoIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM draft_video WHERE id IN (${placeholders}) AND deleted = 0`);
    const results = stmt.all(...videoIds) as any[];
    for (const video of results) {
      videoMap.set(video.id, video);
    }
    return videoMap;
  }

  /**
   * 根据关键词列表获取关联的视频素材信息
   * @param keywords 关键词列表
   * @returns 视频素材信息映射（key: video_id, value: 视频信息）
   */
  getDraftVideosByKeywords(keywords: string[]): Map<number, any> {
    const videoMap = new Map<number, any>();
    if (!keywords || keywords.length === 0) {
      return videoMap;
    }
    // 通过 draft_video_keyword 表关联查询 draft_video 表
    const placeholders = keywords.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT DISTINCT dv.*
      FROM draft_video dv
      INNER JOIN draft_video_keyword dvk ON dv.id = dvk.video_id
      WHERE dvk.keyword IN (${placeholders}) AND dv.deleted = 0
    `);
    const results = stmt.all(...keywords) as any[];
    for (const video of results) {
      videoMap.set(video.id, video);
    }
    return videoMap;
  }

  /**
   * 更新素材视频使用次数
   */
  incrementDraftVideoUseCount(id: number): number {
    const stmt = this.db.prepare(`
      UPDATE draft_video
      SET use_count = use_count + 1,
          status = CASE WHEN use_count >= 4 THEN 'exceeded' ELSE status END
      WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes;
  }

  /**
   * 更新素材视频分析结果（冗余设计：同时在视频表和关联表存储关键词）
   */
  updateDraftVideoAnalysis(id: number, keywords: string): number {
    // 使用事务确保数据一致性
    const transaction = this.db.transaction(() => {
      // 1. 更新视频表中的关键词（逗号分隔）
      const updateStmt = this.db.prepare('UPDATE draft_video SET keywords = ? WHERE id = ?');
      updateStmt.run(keywords, id);

      // 2. 删除旧的关联记录
      const deleteStmt = this.db.prepare('DELETE FROM draft_video_keyword WHERE video_id = ?');
      deleteStmt.run(id);

      // 3. 解析关键词并插入新的关联记录
      if (keywords && keywords.trim()) {
        const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
        const insertStmt = this.db.prepare('INSERT INTO draft_video_keyword (video_id, keyword) VALUES (?, ?)');
        for (const keyword of keywordList) {
          insertStmt.run(id, keyword);
        }
      }
    });

    transaction();
    return 1;
  }

  /**
   * 更新素材视频分析状态
   * 0-未分析，1-分析中，2-已分析，3-分析失败
   */
  updateDraftVideoAnalysisStatus(id: number, status: number): number {
    const stmt = this.db.prepare('UPDATE draft_video SET analysis_status = ? WHERE id = ?');
    const result = stmt.run(status, id);
    return result.changes;
  }

  /**
   * 更新视频地点信息
   */
  updateDraftVideoLocation(id: number, provinceIds: string | null, cityIds: string | null, placeNames: string | null): number {
    const stmt = this.db.prepare(`
      UPDATE draft_video
      SET province_ids = ?, city_ids = ?, place_names = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const result = stmt.run(provinceIds, cityIds, placeNames, id);
    return result.changes;
  }

  /**
   * 更新素材视频文件名
   */
  updateDraftVideoFileName(id: number, fileName: string): number {
    const stmt = this.db.prepare("UPDATE draft_video SET file_name = ?, updated_at = datetime('now', 'localtime') WHERE id = ?");
    const result = stmt.run(fileName, id);
    return result.changes;
  }

  /**
   * 软删除素材视频
   */
  deleteDraftVideo(ids: number[]): number {
    const placeholders = ids.map(() => '?').join(',');
    // 同时删除关键词关联记录
    const deleteKeywordsStmt = this.db.prepare(`DELETE FROM draft_video_keyword WHERE video_id IN (${placeholders})`);
    deleteKeywordsStmt.run(...ids);
    const stmt = this.db.prepare(`UPDATE draft_video SET deleted = 1 WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    return result.changes;
  }

  /**
   * 根据飞书记录ID获取素材视频
   */
  getDraftVideoByFeishuRecordId(feishuRecordId: string): any {
    const stmt = this.db.prepare('SELECT * FROM draft_video WHERE feishu_record_id = ? AND deleted = 0');
    return stmt.get(feishuRecordId);
  }

  /**
   * 添加素材视频（含飞书记录ID）
   */
  addDraftVideoWithFeishuId(video: {
    file_path: string;
    file_name: string;
    duration?: number;
    width?: number;
    height?: number;
    size?: number;
    format?: string;
    keywords?: string;
    thumbnail?: string;
    feishu_record_id?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO draft_video (file_path, file_name, duration, width, height, size, format, keywords, thumbnail, feishu_record_id, analysis_status)
      VALUES (@file_path, @file_name, @duration, @width, @height, @size, @format, @keywords, @thumbnail, @feishu_record_id, 2)
    `);
    // 提供默认值，避免 SQLite 报错缺少命名参数
    const result = stmt.run({
      duration: null,
      width: null,
      height: null,
      size: null,
      format: null,
      keywords: null,
      thumbnail: null,
      feishu_record_id: null,
      ...video,
    });
    return result.lastInsertRowid as number;
  }

  // ==================== 素材库-视频关键词关联 ====================

  /**
   * 添加视频关键词（批量）
   */
  addVideoKeywords(videoId: number, keywords: string[]): number {
    const stmt = this.db.prepare('INSERT INTO draft_video_keyword (video_id, keyword) VALUES (?, ?)');
    let count = 0;
    for (const keyword of keywords) {
      if (keyword && keyword.trim()) {
        stmt.run(videoId, keyword.trim());
        count++;
      }
    }
    return count;
  }

  /**
   * 获取视频的所有关键词
   */
  getVideoKeywords(videoId: number): string[] {
    const stmt = this.db.prepare('SELECT keyword FROM draft_video_keyword WHERE video_id = ? ORDER BY id');
    const rows = stmt.all(videoId) as { keyword: string }[];
    return rows.map(row => row.keyword);
  }

  /**
   * 删除视频的所有关键词
   */
  deleteVideoKeywords(videoId: number): number {
    const stmt = this.db.prepare('DELETE FROM draft_video_keyword WHERE video_id = ?');
    const result = stmt.run(videoId);
    return result.changes;
  }

  /**
   * 根据关键词搜索视频ID列表
   */
  searchVideoIdsByKeyword(keyword: string): number[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT video_id FROM draft_video_keyword
      WHERE keyword LIKE ?
      ORDER BY video_id
    `);
    const rows = stmt.all(`%${keyword}%`) as { video_id: number }[];
    return rows.map(row => row.video_id);
  }

  /**
   * 获取所有关键词及其使用次数
   */
  getAllKeywordsWithCount(): { keyword: string; count: number }[] {
    const stmt = this.db.prepare(`
      SELECT keyword, COUNT(*) as count
      FROM draft_video_keyword
      GROUP BY keyword
      ORDER BY count DESC, keyword ASC
    `);
    return stmt.all() as { keyword: string; count: number }[];
  }

  // ==================== 作品库 ====================

  /**
   * 添加作品
   */
  addWork(work: {
    file_path: string;
    file_name?: string;
    platform?: string;
    platform_url?: string;
    remark?: string;
    thumbnail?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO works (file_path, file_name, platform, platform_url, remark, thumbnail)
      VALUES (@file_path, @file_name, @platform, @platform_url, @remark, @thumbnail)
    `);
    const result = stmt.run(work);
    return result.lastInsertRowid as number;
  }

  /**
   * 获取作品列表
   */
  getWorkList(limit: number = 100, offset: number = 0): any[] {
    const stmt = this.db.prepare('SELECT * FROM works WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }

  /**
   * 更新作品备注
   */
  updateWorkRemark(id: number, remark: string): number {
    const stmt = this.db.prepare("UPDATE works SET remark = ?, updated_at = datetime('now', 'localtime') WHERE id = ?");
    const result = stmt.run(remark, id);
    return result.changes;
  }

  /**
   * 更新作品数据
   */
  updateWorkStats(id: number, stats: {
    play_count?: number;
    like_count?: number;
    comment_count?: number;
    share_count?: number;
  }): number {
    const stmt = this.db.prepare(`
      UPDATE works
      SET play_count = @play_count, like_count = @like_count,
          comment_count = @comment_count, share_count = @share_count,
          updated_at = datetime('now', 'localtime')
      WHERE id = @id
    `);
    const result = stmt.run({ ...stats, id });
    return result.changes;
  }

  /**
   * 软删除作品
   */
  deleteWork(ids: number[]): number {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`UPDATE works SET deleted = 1, updated_at = datetime('now', 'localtime') WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    return result.changes;
  }

  // ==================== 配置 ====================

  /**
   * 获取配置
   */
  getConfig(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    if (!result?.value) return null;

    // 拦截器：查询后解密
    const decrypted = encryptionInterceptor.afterSelect('config', { value: result.value });
    return decrypted.value;
  }

  /**
   * 设置配置
   */
  setConfig(key: string, value: string): void {
    // 拦截器：插入前加密
    const data = encryptionInterceptor.beforeInsert('config', { key, value });
    const stmt = this.db.prepare(`
      INSERT INTO config (key, value, updated_at)
      VALUES (?, ?, datetime('now', 'localtime'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now', 'localtime')
    `);
    stmt.run(data.key, data.value, data.value);
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): Record<string, string> {
    const stmt = this.db.prepare('SELECT key, value FROM config');
    const rows = stmt.all() as { key: string; value: string }[];
    // 拦截器：查询后解密
    const decryptedRows = encryptionInterceptor.afterSelectMany('config', rows);
    return decryptedRows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
  }

  // ==================== 音色克隆记录 ====================

  /**
   * 添加音色克隆记录
   */
  addVoiceClone(voice: {
    voice_id: string;
    voice_tag: string;
    voice_model_id: string;
    audio_file_path?: string;
    clone_type?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO voice_clone (voice_id, voice_tag, voice_model_id, audio_file_path, clone_type, created_at, updated_at)
      VALUES (@voice_id, @voice_tag, @voice_model_id, @audio_file_path, @clone_type, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);
    if (!voice.clone_type) {
      (voice as any).clone_type = 'free';
    }
    const result = stmt.run(voice);
    return result.lastInsertRowid as number;
  }

  /**
   * 获取音色克隆列表
   */
  getVoiceCloneList(limit: number = 100, offset: number = 0): any[] {
    const stmt = this.db.prepare('SELECT * FROM voice_clone WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }

  /**
   * 获取音色克隆详情
   */
  getVoiceClone(id: number): any {
    const stmt = this.db.prepare('SELECT * FROM voice_clone WHERE id = ? AND deleted = 0');
    return stmt.get(id);
  }

  /**
   * 获取所有激活的音色克隆
   */
  getActiveVoiceClones(): any[] {
    const stmt = this.db.prepare("SELECT * FROM voice_clone WHERE deleted = 0 AND status = 'active' ORDER BY used_at DESC, created_at DESC");
    return stmt.all();
  }

  /**
   * 更新音色克隆状态
   */
  updateVoiceCloneStatus(id: number, status: 'active' | 'expired'): number {
    const stmt = this.db.prepare("UPDATE voice_clone SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?");
    const result = stmt.run(status, id);
    return result.changes;
  }

  /**
   * 更新音色克隆最近使用时间
   */
  updateVoiceCloneUsedAt(id: number): number {
    const stmt = this.db.prepare("UPDATE voice_clone SET used_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?");
    const result = stmt.run(id);
    return result.changes;
  }

  /**
   * 更新音色克隆标签
   */
  updateVoiceCloneTag(id: number, voiceTag: string): number {
    const stmt = this.db.prepare("UPDATE voice_clone SET voice_tag = ?, updated_at = datetime('now', 'localtime') WHERE id = ?");
    const result = stmt.run(voiceTag, id);
    return result.changes;
  }

  /**
   * 软删除音色克隆
   */
  deleteVoiceClone(ids: number[]): number {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`UPDATE voice_clone SET deleted = 1, updated_at = datetime('now', 'localtime') WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    return result.changes;
  }

  /**
   * 检查音色克隆数量是否已达上限
   */
  getVoiceCloneCount(): number {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM voice_clone WHERE deleted = 0");
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * 获取免费音色克隆数量
   */
  getFreeVoiceCloneCount(): number {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM voice_clone WHERE deleted = 0 AND clone_type = 'free'");
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * 自动过期超过指定天数未使用的音色
   * 免费音色超过 freeDays 天未使用则过期，付费音色超过 paidDays 天未使用则过期
   * 注意：使用 created_at 作为起始时间（当 used_at 为空时）
   */
  expireUnusedVoices(freeDays: number = 7, paidDays: number = 30): number {
    const stmt = this.db.prepare(`
      UPDATE voice_clone
      SET status = 'expired', updated_at = datetime('now', 'localtime')
      WHERE deleted = 0
        AND status = 'active'
        AND (
          (clone_type = 'free' AND julianday('now', 'localtime') - julianday(COALESCE(used_at, created_at)) > ?)
          OR
          (clone_type = 'paid' AND julianday('now', 'localtime') - julianday(COALESCE(used_at, created_at)) > ?)
        )
    `);
    const result = stmt.run(freeDays, paidDays);
    return result.changes;
  }

  // ==================== 文生视频任务 ====================

  /**
   * 创建文生视频任务
   */
  createTextToVideoTask(task: {
    draft_text_id: number;
    voice_id: string;
    voice_model_id: string;
    is_muted?: boolean;
    bg_music_config?: string;
    province_at?: string;
    city_at?: string;
    place_at?: string;
    canvas_width?: number;
    canvas_height?: number;
    draft_name?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO text_to_video_task (
        draft_text_id, voice_id, voice_model_id, is_muted, bg_music_config,
        province_at, city_at, place_at, canvas_width, canvas_height, draft_name, status
      )
      VALUES (@draft_text_id, @voice_id, @voice_model_id, @is_muted, @bg_music_config,
              @province_at, @city_at, @place_at,
              @canvas_width, @canvas_height, @draft_name, 0)
    `);
    const result = stmt.run({
      ...task,
      is_muted: task.is_muted ? 1 : 0,
      bg_music_config: task.bg_music_config || null,
      province_at: task.province_at || null,
      city_at: task.city_at || null,
      place_at: task.place_at || null,
      canvas_width: task.canvas_width ?? 1920,
      canvas_height: task.canvas_height ?? 1080,
      draft_name: task.draft_name || null,
    });
    return result.lastInsertRowid as number;
  }

  /**
   * 获取文生视频任务详情
   */
  getTextToVideoTask(id: number): any {
    const stmt = this.db.prepare('SELECT * FROM text_to_video_task WHERE id = ? AND deleted = 0');
    return stmt.get(id);
  }

  /**
   * 根据文案ID获取任务
   */
  getTextToVideoTaskByDraftTextId(draftTextId: number): any {
    const stmt = this.db.prepare('SELECT * FROM text_to_video_task WHERE draft_text_id = ? AND deleted = 0 ORDER BY created_at DESC LIMIT 1');
    return stmt.get(draftTextId);
  }

  /**
   * 获取可恢复的任务
   * 条件：状态为失败(3)或待处理(0)，且有部分步骤数据
   * @param draftTextId 文案ID
   * @returns 可恢复的任务，如果没有则返回null
   */
  getResumableTextToVideoTask(draftTextId: number): any {
    const stmt = this.db.prepare(`
      SELECT * FROM text_to_video_task
      WHERE draft_text_id = ?
        AND deleted = 0
        AND status IN (0, 3)
        AND (
          tts_local_path IS NOT NULL
          OR asr_content IS NOT NULL
          OR short_sentences IS NOT NULL
          OR video_timelines IS NOT NULL
        )
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(draftTextId);
  }

  /**
   * 获取文生视频任务列表
   */
  getTextToVideoTaskList(limit: number = 100, offset: number = 0): any[] {
    const stmt = this.db.prepare('SELECT * FROM text_to_video_task WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }

  /**
   * 更新任务状态
   * status: 0-待处理, 1-处理中, 2-成功, 3-失败
   */
  updateTextToVideoTaskStatus(id: number, status: number, errorMessage?: string): number {
    const stmt = this.db.prepare(`
      UPDATE text_to_video_task
      SET status = ?, error_message = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const result = stmt.run(status, errorMessage || null, id);
    return result.changes;
  }

  /**
   * 更新任务当前步骤
   */
  updateTextToVideoTaskCurrentStep(id: number, step: string): number {
    const stmt = this.db.prepare(`
      UPDATE text_to_video_task SET current_step = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
    `);
    const result = stmt.run(step, id);
    return result.changes;
  }

  /**
   * 更新任务步骤数据（用于断点续传）
   */
  updateTextToVideoTaskStepData(id: number, stepKey: string, data: any): number {
    // 以下划线开头的字段为临时数据，仅用于步骤间传递，不需要保存到数据库
    if (stepKey.startsWith('_')) {
      return 0; // 静默跳过，不打印警告
    }

    const validKeys = [
      'tts_local_path', 'asr_content', 'text_used_points', 'short_sentences',
      'keywords_bind_used_points', 'video_timelines', 'video_used_points', 'draft_video_ids',
      'draft_populate_used_points', 'draft_id', 'jianying_draft_path',
      'edited_video_infos', 'edited_audio_infos', 'edited_text_infos', 'edited_bg_music_config', 'draft_review_status'
    ];
    if (!validKeys.includes(stepKey)) {
      console.warn(`[Database] Invalid stepKey: ${stepKey}`);
      return 0;
    }
    const stmt = this.db.prepare(`
      UPDATE text_to_video_task
      SET ${stepKey} = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const value = typeof data === 'object' ? JSON.stringify(data) : data;
    const result = stmt.run(value, id);
    return result.changes;
  }

  /**
   * 更新任务的语音合成结果
   */
  updateTextToVideoTaskTtsResult(id: number, ttsLocalPath: string, textUsedPoints: number): number {
    const stmt = this.db.prepare(`
      UPDATE text_to_video_task
      SET tts_local_path = ?, text_used_points = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const result = stmt.run(ttsLocalPath, textUsedPoints, id);
    return result.changes;
  }

  /**
   * 更新任务的ASR结果
   */
  updateTextToVideoTaskAsrResult(id: number, asrContent: any): number {
    const stmt = this.db.prepare(`
      UPDATE text_to_video_task
      SET asr_content = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const result = stmt.run(JSON.stringify(asrContent), id);
    return result.changes;
  }

  /**
   * 更新任务的短句绑定结果
   */
  updateTextToVideoTaskShortSentences(id: number, shortSentences: any, keywordsBindUsedPoints: number): number {
    const stmt = this.db.prepare(`
      UPDATE text_to_video_task
      SET short_sentences = ?, keywords_bind_used_points = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const result = stmt.run(JSON.stringify(shortSentences), keywordsBindUsedPoints, id);
    return result.changes;
  }

  /**
   * 更新任务的视频时间线结果
   */
  updateTextToVideoTaskVideoTimelines(id: number, videoTimelines: any, videoUsedPoints: number, draftVideoIds: string): number {
    const stmt = this.db.prepare(`
      UPDATE text_to_video_task
      SET video_timelines = ?, video_used_points = ?, draft_video_ids = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const result = stmt.run(JSON.stringify(videoTimelines), videoUsedPoints, draftVideoIds, id);
    return result.changes;
  }

  /**
   * 更新素材审核状态
   * @param id 任务ID
   * @param status 审核状态：0=未审核, 1=审核中, 2=已确认, 3=已跳过, 4=已取消
   */
  updateTextToVideoTaskReviewStatus(id: number, status: number): number {
    const stmt = this.db.prepare(`
      UPDATE text_to_video_task
      SET draft_review_status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const result = stmt.run(status, id);
    return result.changes;
  }

  /**
   * 更新编辑后的素材数据（轨道化）
   */
  updateTextToVideoTaskEditedMaterials(id: number, materials: {
    videoTracks?: string;
    audioTracks?: string;
    textTracks?: string;
    bgMusicConfig?: string;
  }): number {
    const stmt = this.db.prepare(`
      UPDATE text_to_video_task
      SET edited_video_tracks = ?, edited_audio_tracks = ?, edited_text_tracks = ?, edited_bg_music_config = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const result = stmt.run(
      materials.videoTracks || null,
      materials.audioTracks || null,
      materials.textTracks || null,
      materials.bgMusicConfig || null,
      id
    );
    return result.changes;
  }

  /**
   * 软删除文生视频任务
   */
  deleteTextToVideoTask(ids: number[]): number {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`UPDATE text_to_video_task SET deleted = 1, updated_at = datetime('now', 'localtime') WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    return result.changes;
  }

  // ==================== 初始化配置 ====================

  /**
   * 初始化 init_config 表
   */
  private initInitConfigTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS init_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        init_param TEXT NOT NULL UNIQUE,
        status INTEGER DEFAULT 0,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入默认初始化配置
    const defaultInitConfigs = [
      { init_param: 'download_test_data', status: 0, remark: '下载测试数据' },
    ];

    const insertConfig = this.db.prepare('INSERT OR IGNORE INTO init_config (init_param, status, remark) VALUES (?, ?, ?)');
    for (const config of defaultInitConfigs) {
      insertConfig.run(config.init_param, config.status, config.remark);
    }
  }

  /**
   * 获取初始化配置状态
   * @param initParam 初始化参数标识
   * @returns 状态值，如果不存在返回 0
   */
  getInitConfigStatus(initParam: string): number {
    const stmt = this.db.prepare('SELECT status FROM init_config WHERE init_param = ?');
    const result = stmt.get(initParam) as { status: number } | undefined;
    return result?.status ?? 0;
  }

  /**
   * 更新初始化配置状态
   * @param initParam 初始化参数标识
   * @param status 状态值（0-未初始化，5-已初始化）
   * @returns 影响的行数
   */
  updateInitConfigStatus(initParam: string, status: number): number {
    const stmt = this.db.prepare(`
      UPDATE init_config
      SET status = ?, updated_at = datetime('now', 'localtime')
      WHERE init_param = ?
    `);
    const result = stmt.run(status, initParam);
    return result.changes;
  }

  /**
   * 检查是否已完成初始化
   * @param initParam 初始化参数标识
   * @returns 是否已完成初始化
   */
  isInitConfigCompleted(initParam: string): boolean {
    return this.getInitConfigStatus(initParam) === 5;
  }

  // ==================== 地区数据 ====================

  /**
   * 初始化 place 表并导入种子数据
   */
  private initPlaceTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS place (
        id INTEGER PRIMARY KEY,
        parent_id INTEGER NOT NULL DEFAULT 0,
        name TEXT NOT NULL
      )
    `);

    // 仅在表为空时导入种子数据
    const count = (this.db.prepare('SELECT COUNT(*) as cnt FROM place').get() as { cnt: number }).cnt;
    if (count > 0) return;

    const insertStmt = this.db.prepare('INSERT INTO place (id, parent_id, name) VALUES (?, ?, ?)');
    const insertMany = this.db.transaction((rows: Array<[number, number, string]>) => {
      for (const row of rows) {
        insertStmt.run(row[0], row[1], row[2]);
      }
    });

    // [id, parent_id, name]  parent_id=0 为省份
    const placeRows: Array<[number, number, string]> = [
      // 省份 (parent_id=0)
      [1, 0, '北京'], [2, 0, '天津'], [3, 0, '河北省'], [4, 0, '山西省'],
      [5, 0, '内蒙古自治区'], [6, 0, '辽宁省'], [7, 0, '吉林省'], [8, 0, '黑龙江省'],
      [9, 0, '上海'], [10, 0, '江苏省'], [11, 0, '浙江省'], [12, 0, '安徽省'],
      [13, 0, '福建省'], [14, 0, '江西省'], [15, 0, '山东省'], [16, 0, '河南省'],
      [17, 0, '湖北省'], [18, 0, '湖南省'], [19, 0, '广东省'], [20, 0, '广西壮族自治区'],
      [21, 0, '海南省'], [22, 0, '重庆'], [23, 0, '四川省'], [24, 0, '贵州省'],
      [25, 0, '云南省'], [26, 0, '西藏自治区'], [27, 0, '陕西省'], [28, 0, '甘肃省'],
      [29, 0, '青海省'], [30, 0, '宁夏回族自治区'], [31, 0, '新疆维吾尔自治区'],
      [32, 0, '台湾'], [33, 0, '香港特别行政区'], [34, 0, '澳门特别行政区'], [35, 0, '海外'],
      // 北京
      [36, 1, '北京市'],
      // 天津
      [37, 2, '天津市'],
      // 河北省
      [38, 3, '石家庄市'], [39, 3, '唐山市'], [40, 3, '秦皇岛市'], [41, 3, '邯郸市'],
      [42, 3, '邢台市'], [43, 3, '保定市'], [44, 3, '张家口市'], [45, 3, '承德市'],
      [46, 3, '沧州市'], [47, 3, '廊坊市'], [48, 3, '衡水市'],
      // 山西省
      [49, 4, '太原市'], [50, 4, '大同市'], [51, 4, '阳泉市'], [52, 4, '长治市'],
      [53, 4, '晋城市'], [54, 4, '朔州市'], [55, 4, '晋中市'], [56, 4, '运城市'],
      [57, 4, '忻州市'], [58, 4, '临汾市'], [59, 4, '吕梁市'],
      // 内蒙古自治区
      [60, 5, '呼和浩特市'], [61, 5, '包头市'], [62, 5, '乌海市'], [63, 5, '赤峰市'],
      [64, 5, '通辽市'], [65, 5, '鄂尔多斯市'], [66, 5, '呼伦贝尔市'], [67, 5, '巴彦淖尔市'],
      [68, 5, '乌兰察布市'], [69, 5, '兴安盟'], [70, 5, '锡林郭勒盟'], [71, 5, '阿拉善盟'],
      // 辽宁省
      [72, 6, '沈阳市'], [73, 6, '大连市'], [74, 6, '鞍山市'], [75, 6, '抚顺市'],
      [76, 6, '本溪市'], [77, 6, '丹东市'], [78, 6, '锦州市'], [79, 6, '营口市'],
      [80, 6, '阜新市'], [81, 6, '辽阳市'], [82, 6, '盘锦市'], [83, 6, '铁岭市'],
      [84, 6, '朝阳市'], [85, 6, '葫芦岛市'],
      // 吉林省
      [86, 7, '长春市'], [87, 7, '吉林市'], [88, 7, '四平市'], [89, 7, '辽源市'],
      [90, 7, '通化市'], [91, 7, '白山市'], [92, 7, '松原市'], [93, 7, '白城市'],
      [94, 7, '延边朝鲜族自治州'],
      // 黑龙江省
      [95, 8, '哈尔滨市'], [96, 8, '齐齐哈尔市'], [97, 8, '鸡西市'], [98, 8, '鹤岗市'],
      [99, 8, '双鸭山市'], [100, 8, '大庆市'], [101, 8, '伊春市'], [102, 8, '佳木斯市'],
      [103, 8, '七台河市'], [104, 8, '牡丹江市'], [105, 8, '黑河市'], [106, 8, '绥化市'],
      [107, 8, '大兴安岭地区'],
      // 上海
      [108, 9, '上海市'],
      // 江苏省
      [109, 10, '南京市'], [110, 10, '无锡市'], [111, 10, '徐州市'], [112, 10, '常州市'],
      [113, 10, '苏州市'], [114, 10, '南通市'], [115, 10, '连云港市'], [116, 10, '淮安市'],
      [117, 10, '盐城市'], [118, 10, '扬州市'], [119, 10, '镇江市'], [120, 10, '泰州市'],
      [121, 10, '宿迁市'],
      // 浙江省
      [122, 11, '杭州市'], [123, 11, '宁波市'], [124, 11, '温州市'], [125, 11, '嘉兴市'],
      [126, 11, '湖州市'], [127, 11, '绍兴市'], [128, 11, '金华市'], [129, 11, '衢州市'],
      [130, 11, '舟山市'], [131, 11, '台州市'], [132, 11, '丽水市'],
      // 安徽省
      [133, 12, '合肥市'], [134, 12, '芜湖市'], [135, 12, '蚌埠市'], [136, 12, '淮南市'],
      [137, 12, '马鞍山市'], [138, 12, '淮北市'], [139, 12, '铜陵市'], [140, 12, '安庆市'],
      [141, 12, '黄山市'], [142, 12, '滁州市'], [143, 12, '阜阳市'], [144, 12, '宿州市'],
      [145, 12, '六安市'], [146, 12, '亳州市'], [147, 12, '池州市'], [148, 12, '宣城市'],
      // 福建省
      [149, 13, '福州市'], [150, 13, '厦门市'], [151, 13, '莆田市'], [152, 13, '三明市'],
      [153, 13, '泉州市'], [154, 13, '漳州市'], [155, 13, '南平市'], [156, 13, '龙岩市'],
      [157, 13, '宁德市'],
      // 江西省
      [158, 14, '南昌市'], [159, 14, '景德镇市'], [160, 14, '萍乡市'], [161, 14, '九江市'],
      [162, 14, '新余市'], [163, 14, '鹰潭市'], [164, 14, '赣州市'], [165, 14, '吉安市'],
      [166, 14, '宜春市'], [167, 14, '抚州市'], [168, 14, '上饶市'],
      // 山东省
      [169, 15, '济南市'], [170, 15, '青岛市'], [171, 15, '淄博市'], [172, 15, '枣庄市'],
      [173, 15, '东营市'], [174, 15, '烟台市'], [175, 15, '潍坊市'], [176, 15, '济宁市'],
      [177, 15, '泰安市'], [178, 15, '威海市'], [179, 15, '日照市'], [180, 15, '莱芜市'],
      [181, 15, '临沂市'], [182, 15, '德州市'], [183, 15, '聊城市'], [184, 15, '滨州市'],
      [185, 15, '菏泽市'],
      // 河南省
      [186, 16, '郑州市'], [187, 16, '开封市'], [188, 16, '洛阳市'], [189, 16, '平顶山市'],
      [190, 16, '安阳市'], [191, 16, '鹤壁市'], [192, 16, '新乡市'], [193, 16, '焦作市'],
      [194, 16, '濮阳市'], [195, 16, '许昌市'], [196, 16, '漯河市'], [197, 16, '三门峡市'],
      [198, 16, '南阳市'], [199, 16, '商丘市'], [200, 16, '信阳市'], [201, 16, '周口市'],
      [202, 16, '驻马店市'],
      // 湖北省
      [203, 17, '武汉市'], [204, 17, '黄石市'], [205, 17, '十堰市'], [206, 17, '宜昌市'],
      [207, 17, '襄阳市'], [208, 17, '鄂州市'], [209, 17, '荆门市'], [210, 17, '孝感市'],
      [211, 17, '荆州市'], [212, 17, '黄冈市'], [213, 17, '咸宁市'], [214, 17, '随州市'],
      [215, 17, '恩施土家族苗族自治州'],
      // 湖南省
      [216, 18, '长沙市'], [217, 18, '株洲市'], [218, 18, '湘潭市'], [219, 18, '衡阳市'],
      [220, 18, '邵阳市'], [221, 18, '岳阳市'], [222, 18, '常德市'], [223, 18, '张家界市'],
      [224, 18, '益阳市'], [225, 18, '郴州市'], [226, 18, '永州市'], [227, 18, '怀化市'],
      [228, 18, '娄底市'], [229, 18, '湘西土家族苗族自治州'],
      // 广东省
      [230, 19, '广州市'], [231, 19, '韶关市'], [232, 19, '深圳市'], [233, 19, '珠海市'],
      [234, 19, '汕头市'], [235, 19, '佛山市'], [236, 19, '江门市'], [237, 19, '湛江市'],
      [238, 19, '茂名市'], [239, 19, '肇庆市'], [240, 19, '惠州市'], [241, 19, '梅州市'],
      [242, 19, '汕尾市'], [243, 19, '河源市'], [244, 19, '阳江市'], [245, 19, '清远市'],
      [246, 19, '东莞市'], [247, 19, '中山市'], [248, 19, '东沙群岛'], [249, 19, '潮州市'],
      [250, 19, '揭阳市'], [251, 19, '云浮市'],
      // 广西壮族自治区
      [252, 20, '南宁市'], [253, 20, '柳州市'], [254, 20, '桂林市'], [255, 20, '梧州市'],
      [256, 20, '北海市'], [257, 20, '防城港市'], [258, 20, '钦州市'], [259, 20, '贵港市'],
      [260, 20, '玉林市'], [261, 20, '百色市'], [262, 20, '贺州市'], [263, 20, '河池市'],
      [264, 20, '来宾市'], [265, 20, '崇左市'],
      // 海南省
      [266, 21, '海口市'], [267, 21, '三亚市'], [268, 21, '三沙市'],
      // 重庆
      [269, 22, '重庆市'],
      // 四川省
      [270, 23, '成都市'], [271, 23, '自贡市'], [272, 23, '攀枝花市'], [273, 23, '泸州市'],
      [274, 23, '德阳市'], [275, 23, '绵阳市'], [276, 23, '广元市'], [277, 23, '遂宁市'],
      [278, 23, '内江市'], [279, 23, '乐山市'], [280, 23, '南充市'], [281, 23, '眉山市'],
      [282, 23, '宜宾市'], [283, 23, '广安市'], [284, 23, '达州市'], [285, 23, '雅安市'],
      [286, 23, '巴中市'], [287, 23, '资阳市'], [288, 23, '阿坝藏族羌族自治州'],
      [289, 23, '甘孜藏族自治州'], [290, 23, '凉山彝族自治州'],
      // 贵州省
      [291, 24, '贵阳市'], [292, 24, '六盘水市'], [293, 24, '遵义市'], [294, 24, '安顺市'],
      [295, 24, '铜仁市'], [296, 24, '黔西南布依族苗族自治州'], [297, 24, '毕节市'],
      [298, 24, '黔东南苗族侗族自治州'], [299, 24, '黔南布依族苗族自治州'],
      // 云南省
      [300, 25, '昆明市'], [301, 25, '曲靖市'], [302, 25, '玉溪市'], [303, 25, '保山市'],
      [304, 25, '昭通市'], [305, 25, '丽江市'], [306, 25, '普洱市'], [307, 25, '临沧市'],
      [308, 25, '楚雄彝族自治州'], [309, 25, '红河哈尼族彝族自治州'],
      [310, 25, '文山壮族苗族自治州'], [311, 25, '西双版纳傣族自治州'],
      [312, 25, '大理白族自治州'], [313, 25, '德宏傣族景颇族自治州'],
      [314, 25, '怒江傈僳族自治州'], [315, 25, '迪庆藏族自治州'],
      // 西藏自治区
      [316, 26, '拉萨市'], [317, 26, '昌都市'], [318, 26, '山南地区'], [319, 26, '日喀则市'],
      [320, 26, '那曲地区'], [321, 26, '阿里地区'], [322, 26, '林芝市'],
      // 陕西省
      [323, 27, '西安市'], [324, 27, '铜川市'], [325, 27, '宝鸡市'], [326, 27, '咸阳市'],
      [327, 27, '渭南市'], [328, 27, '延安市'], [329, 27, '汉中市'], [330, 27, '榆林市'],
      [331, 27, '安康市'], [332, 27, '商洛市'],
      // 甘肃省
      [333, 28, '兰州市'], [334, 28, '嘉峪关市'], [335, 28, '金昌市'], [336, 28, '白银市'],
      [337, 28, '天水市'], [338, 28, '武威市'], [339, 28, '张掖市'], [340, 28, '平凉市'],
      [341, 28, '酒泉市'], [342, 28, '庆阳市'], [343, 28, '定西市'], [344, 28, '陇南市'],
      [345, 28, '临夏回族自治州'], [346, 28, '甘南藏族自治州'],
      // 青海省
      [347, 29, '西宁市'], [348, 29, '海东市'], [349, 29, '海北藏族自治州'],
      [350, 29, '黄南藏族自治州'], [351, 29, '海南藏族自治州'], [352, 29, '果洛藏族自治州'],
      [353, 29, '玉树藏族自治州'], [354, 29, '海西蒙古族藏族自治州'],
      // 宁夏回族自治区
      [355, 30, '银川市'], [356, 30, '石嘴山市'], [357, 30, '吴忠市'], [358, 30, '固原市'],
      [359, 30, '中卫市'],
      // 新疆维吾尔自治区
      [360, 31, '乌鲁木齐市'], [361, 31, '克拉玛依市'], [362, 31, '吐鲁番市'],
      [363, 31, '哈密地区'], [364, 31, '昌吉回族自治州'], [365, 31, '博尔塔拉蒙古自治州'],
      [366, 31, '巴音郭楞蒙古自治州'], [367, 31, '阿克苏地区'],
      [368, 31, '克孜勒苏柯尔克孜自治州'], [369, 31, '喀什地区'], [370, 31, '和田地区'],
      [371, 31, '伊犁哈萨克自治州'], [372, 31, '塔城地区'], [373, 31, '阿勒泰地区'],
      // 台湾
      [374, 32, '台北市'], [375, 32, '高雄市'], [376, 32, '台南市'], [377, 32, '台中市'],
      [378, 32, '金门县'], [379, 32, '南投县'], [380, 32, '基隆市'], [381, 32, '新竹市'],
      [382, 32, '嘉义市'], [383, 32, '新北市'], [384, 32, '宜兰县'], [385, 32, '新竹县'],
      [386, 32, '桃园县'], [387, 32, '苗栗县'], [388, 32, '彰化县'], [389, 32, '嘉义县'],
      [390, 32, '云林县'], [391, 32, '屏东县'], [392, 32, '台东县'], [393, 32, '花莲县'],
      [394, 32, '澎湖县'], [395, 32, '连江县'],
      // 香港特别行政区
      [396, 33, '香港岛'], [397, 33, '九龙'], [398, 33, '新界'],
      // 澳门特别行政区
      [399, 34, '澳门半岛'], [400, 34, '离岛'],
      // 海外
      [401, 35, '海外'],
    ];

    insertMany(placeRows);
    console.log(`[Database] 地区数据初始化完成，共 ${placeRows.length} 条`);
  }

  /**
   * 获取所有地区数据，返回与原 place.json 相同格式的嵌套对象
   * @returns Record<string, Record<string, string>>
   */
  getPlaceData(): Record<string, Record<string, string>> {
    const rows = this.db.prepare('SELECT id, parent_id, name FROM place ORDER BY id').all() as Array<{ id: number; parent_id: number; name: string }>;

    const result: Record<string, Record<string, string>> = {};

    // 先构建省份列表 (parent_id=0)
    result['0'] = {};
    for (const row of rows) {
      if (row.parent_id === 0) {
        result['0'][String(row.id)] = row.name;
      }
    }

    // 再按省份分组构建城市列表
    for (const row of rows) {
      if (row.parent_id !== 0) {
        const provinceKey = String(row.parent_id);
        if (!result[provinceKey]) {
          result[provinceKey] = {};
        }
        result[provinceKey][String(row.id)] = row.name;
      }
    }

    return result;
  }

  /**
   * 获取素材库视频中已配置的不重复地点信息
   * @returns { provinces: string[], cities: string[], places: string[] }
   */
  getDraftVideoUsedLocations(): { provinces: string[]; cities: string[]; places: string[] } {
    const provinceRows = this.db.prepare(
      "SELECT DISTINCT province_ids FROM draft_video WHERE deleted = 0 AND province_ids IS NOT NULL AND province_ids != ''"
    ).all() as Array<{ province_ids: string }>;

    const provinceSet = new Set<string>();
    for (const row of provinceRows) {
      for (const id of row.province_ids.split(',')) {
        const trimmed = id.trim();
        if (trimmed) provinceSet.add(trimmed);
      }
    }

    const cityRows = this.db.prepare(
      "SELECT DISTINCT city_ids FROM draft_video WHERE deleted = 0 AND city_ids IS NOT NULL AND city_ids != ''"
    ).all() as Array<{ city_ids: string }>;

    const citySet = new Set<string>();
    for (const row of cityRows) {
      for (const id of row.city_ids.split(',')) {
        const trimmed = id.trim();
        if (trimmed) citySet.add(trimmed);
      }
    }

    const placeRows = this.db.prepare(
      "SELECT DISTINCT place_names FROM draft_video WHERE deleted = 0 AND place_names IS NOT NULL AND place_names != ''"
    ).all() as Array<{ place_names: string }>;

    const placeSet = new Set<string>();
    for (const row of placeRows) {
      for (const name of row.place_names.split(',')) {
        const trimmed = name.trim();
        if (trimmed) placeSet.add(trimmed);
      }
    }

    return {
      provinces: Array.from(provinceSet),
      cities: Array.from(citySet),
      places: Array.from(placeSet),
    };
  }
}