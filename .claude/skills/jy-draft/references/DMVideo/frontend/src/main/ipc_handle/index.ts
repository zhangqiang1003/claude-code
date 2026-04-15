/**
 * IPC 处理注册
 * 主进程与渲染进程通信的桥梁
 */

import { BrowserWindow, ipcMain, dialog, app, shell } from 'electron';
import { DB } from '../database';
import { ffmpeg } from '../ffmpeg';
import {
  tokenApiUtil,
  ossUtil,
  OSSConfig,
  tokenConfigUtil,
  bailianUtil,
  BailianClientConfig,
  bailianAudioUtil,
  BailianAudioConfig,
  VoiceModelId,
  videoMatchUtil,
  draftApiClient,
  videoAnalysisUtil,
  feishuBitableUtil,
  wechatAuthUtil,
  qqAuthUtil,
  clientInfoUtil,
  SyncProgress,
  AddTextsRequest, AddAudiosRequest, AddVideosRequest,
  TaskType,
  TaskStatus
} from '../core';
import * as fs from 'fs';
import * as path from 'path';

// 子文件夹名称常量
const MATERIAL_VIDEO_DIR = 'materialVideo';
const DRAFT_VIDEO_DIR = 'draftVideo';

export class IpcHandleRegister {
  private window: BrowserWindow;
  private db: DB;
  // 外部 HTTP 客户端基础 URL（用于通用 HTTP 请求）
  private externalHttpBaseUrl: string = '';

  constructor(window: BrowserWindow, db: DB) {
    this.window = window;
    this.db = db;
    this.register();
  }

  register(): void {
    this.registerDatabaseHandlers();
    this.registerFFmpegHandlers();
    this.registerDialogHandlers();
    this.registerTokenApiHandlers();
    this.registerOSSHandlers();
    this.registerTokenConfigHandlers();
    this.registerBailianHandlers();
    this.registerBailianAudioHandlers();
    this.registerVideoMatchHandlers();
    this.registerVideoAnalysisHandlers();
    this.registerDraftApiHandlers();
    this.registerTextToVideoHandlers();
    this.registerPlaceDataHandlers();
    this.registerFeishuHandlers();
    this.registerWechatAuthHandlers();
    this.registerQQAuthHandlers();
    this.registerHttpHandlers();
    this.registerSmartSplitHandlers();
    this.registerClientInfoHandlers();
  }

  // ==================== 数据库相关 ====================
  registerDatabaseHandlers(): void {
    // 材料库-文案
    ipcMain.handle('db:add-material-text', async (_, content: string, source?: string) => {
      return { id: this.db.addMaterialText(content, source) };
    });

    ipcMain.handle('db:get-material-text-list', async (_, limit?: number, offset?: number) => {
      return this.db.getMaterialTextList(limit, offset);
    });

    ipcMain.handle('db:update-material-text', async (_, id: number, content: string) => {
      return { changes: this.db.updateMaterialText(id, content) };
    });

    ipcMain.handle('db:delete-material-text', async (_, ids: number[]) => {
      return { changes: this.db.deleteMaterialText(ids) };
    });

    // 材料库-视频
    ipcMain.handle('db:add-material-video', async (_, video: any) => {
      return { id: this.db.addMaterialVideo(video) };
    });

    // 添加材料库视频（带复制和提取信息）
    ipcMain.handle('db:add-material-video-with-copy', async (_, sourceFilePaths: string[]) => {
      const results: { success: boolean; file_name?: string; error?: string }[] = [];

      // 获取视频根路径
      const videoRootPath = this.db.getConfig('video_root_path');
      if (!videoRootPath) {
        return { success: false, error: '请先在基本配置中设置视频存放根路径' };
      }

      // 构建目标目录路径：videoRootPath/materialVideo/日期
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const materialVideoDir = path.join(videoRootPath, MATERIAL_VIDEO_DIR, dateStr);

      // 确保目录存在
      if (!fs.existsSync(materialVideoDir)) {
        fs.mkdirSync(materialVideoDir, { recursive: true });
        console.log(`[IPC] 创建视频目录: ${materialVideoDir}`);
      }

      // 处理每个视频文件
      for (const sourcePath of sourceFilePaths) {
        try {
          // 获取源文件名和扩展名
          const originalName = path.basename(sourcePath);
          const ext = path.extname(sourcePath);
          const nameWithoutExt = path.basename(sourcePath, ext);

          // 生成目标文件路径
          let targetPath = path.join(materialVideoDir, originalName);
          let counter = 1;

          // 如果文件已存在，添加序号
          while (fs.existsSync(targetPath)) {
            targetPath = path.join(materialVideoDir, `${nameWithoutExt}_${counter}${ext}`);
            counter++;
          }

          // 复制文件
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`[IPC] 复制视频: ${sourcePath} -> ${targetPath}`);

          // 获取视频信息
          const videoInfo = await ffmpeg.getVideoInfo(targetPath);

          // 提取视频格式（扩展名去掉点）
          const format = ext.replace('.', '').toLowerCase();

          // 保存到数据库
          const id = this.db.addMaterialVideo({
            file_path: targetPath,
            file_name: path.basename(targetPath),
            duration: videoInfo.duration,
            width: videoInfo.width,
            height: videoInfo.height,
            size: videoInfo.size,
            format: format,
            thumbnail: undefined
          });

          results.push({ success: true, file_name: path.basename(targetPath) });
        } catch (error: any) {
          console.error(`[IPC] 处理视频失败: ${sourcePath}`, error);
          results.push({ success: false, file_name: path.basename(sourcePath), error: error.message });
        }
      }

      return { success: true, results };
    });

    ipcMain.handle('db:get-material-video-list', async (_, limit?: number, offset?: number) => {
      return this.db.getMaterialVideoList(limit, offset);
    });

    ipcMain.handle('db:get-material-video-count', async () => {
      return { count: this.db.getMaterialVideoCount() };
    });

    ipcMain.handle('db:get-material-video', async (_, id: number) => {
      return this.db.getMaterialVideo(id);
    });

    ipcMain.handle('db:delete-material-video', async (_, ids: number[]) => {
      // 先获取视频文件路径，再删除本地文件
      for (const id of ids) {
        const video = this.db.getMaterialVideo(id);
        if (video && video.file_path && fs.existsSync(video.file_path)) {
          try {
            fs.unlinkSync(video.file_path);
            console.log(`[IPC] 删除视频文件: ${video.file_path}`);
          } catch (err) {
            console.error(`[IPC] 删除视频文件失败: ${video.file_path}`, err);
          }
        }
      }
      return { changes: this.db.deleteMaterialVideo(ids) };
    });

    // 材料库-作品地址
    ipcMain.handle('db:add-material-url', async (_, url: any) => {
      return { id: this.db.addMaterialUrl(url) };
    });

    ipcMain.handle('db:get-material-url-list', async (_, limit?: number, offset?: number) => {
      return this.db.getMaterialUrlList(limit, offset);
    });

    ipcMain.handle('db:delete-material-url', async (_, ids: number[]) => {
      return { changes: this.db.deleteMaterialUrl(ids) };
    });

    // 素材库-文案
    ipcMain.handle('db:add-draft-text', async (_, content: string, sourceId?: number) => {
      return { id: this.db.addDraftText(content, sourceId) };
    });

    ipcMain.handle('db:get-draft-text-list', async (_, limit?: number, offset?: number) => {
      return this.db.getDraftTextList(limit, offset);
    });

    ipcMain.handle('db:get-draft-text-count', async () => {
      return { count: this.db.getDraftTextCount() };
    });

    ipcMain.handle('db:delete-draft-text', async (_, ids: number[]) => {
      return { changes: this.db.deleteDraftText(ids) };
    });

    ipcMain.handle('db:update-draft-text', async (_, id: number, content: string) => {
      return { changes: this.db.updateDraftText(id, content) };
    });

    ipcMain.handle('db:update-draft-text-status', async (_, id: number, status: number) => {
      return { changes: this.db.updateDraftTextStatus(id, status) };
    });

    // 素材库-视频
    ipcMain.handle('db:add-draft-video', async (_, video: any) => {
      return { id: this.db.addDraftVideo(video) };
    });

    // 添加素材库视频（带复制和提取信息）
    ipcMain.handle('db:add-draft-video-with-copy', async (_, sourceFilePaths: string[]) => {
      const results: { success: boolean; id?: number; file_name?: string; error?: string }[] = [];
      const filtered: { file_name: string; duration: number }[] = [];
      const MIN_VIDEO_DURATION = 2; // 最小视频时长（秒）

      // 获取视频根路径
      const videoRootPath = this.db.getConfig('video_root_path');
      if (!videoRootPath) {
        return { success: false, error: '请先在基本配置中设置视频存放根路径' };
      }

      // 构建目标目录路径：videoRootPath/draftVideo/日期
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const draftVideoDir = path.join(videoRootPath, DRAFT_VIDEO_DIR, dateStr);

      // 确保目录存在
      if (!fs.existsSync(draftVideoDir)) {
        fs.mkdirSync(draftVideoDir, { recursive: true });
        console.log(`[IPC] 创建视频目录: ${draftVideoDir}`);
      }

      // 处理每个视频文件
      for (const sourcePath of sourceFilePaths) {
        try {
          // 获取源文件名和扩展名
          const originalName = path.basename(sourcePath);
          const ext = path.extname(sourcePath);
          const nameWithoutExt = path.basename(sourcePath, ext);

          // 先获取视频信息（在复制前检查时长）
          const videoInfo = await ffmpeg.getVideoInfo(sourcePath);

          // 检查视频时长是否满足要求
          if (videoInfo.duration < MIN_VIDEO_DURATION) {
            console.log(`[IPC] 视频时长不足，已过滤: ${originalName}, 时长: ${videoInfo.duration.toFixed(2)}s`);
            filtered.push({ file_name: originalName, duration: videoInfo.duration });
            continue; // 跳过该视频
          }

          // 生成目标文件路径
          let targetPath = path.join(draftVideoDir, originalName);
          let counter = 1;

          // 如果文件已存在，添加序号
          while (fs.existsSync(targetPath)) {
            targetPath = path.join(draftVideoDir, `${nameWithoutExt}_${counter}${ext}`);
            counter++;
          }

          // 复制文件
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`[IPC] 复制视频: ${sourcePath} -> ${targetPath}`);

          // 提取视频格式（扩展名去掉点）
          const format = ext.replace('.', '').toLowerCase();

          // 保存到数据库
          const id = this.db.addDraftVideo({
            file_path: targetPath,
            file_name: path.basename(targetPath),
            duration: videoInfo.duration,
            width: videoInfo.width,
            height: videoInfo.height,
            size: videoInfo.size,
            format: format,
            keywords: undefined,
            thumbnail: undefined
          });

          results.push({ success: true, id, file_name: path.basename(targetPath) });
        } catch (error: any) {
          console.error(`[IPC] 处理视频失败: ${sourcePath}`, error);
          results.push({ success: false, file_name: path.basename(sourcePath), error: error.message });
        }
      }

      return { success: true, results, filtered };
    });

    ipcMain.handle('db:get-draft-video-list', async (_, limit?: number, offset?: number) => {
      return this.db.getDraftVideoList(limit, offset);
    });

    ipcMain.handle('db:get-draft-video-count', async () => {
      return { count: this.db.getDraftVideoCount() };
    });

    ipcMain.handle('db:get-draft-video', async (_, id: number) => {
      return this.db.getDraftVideo(id);
    });

    ipcMain.handle('db:update-draft-video-analysis', async (_, id: number, keywords: string) => {
      return { changes: this.db.updateDraftVideoAnalysis(id, keywords) };
    });

    ipcMain.handle('db:update-draft-video-analysis-status', async (_, id: number, status: number) => {
      return { changes: this.db.updateDraftVideoAnalysisStatus(id, status) };
    });

    ipcMain.handle('db:update-draft-video-location', async (_, id: number, provinceIds: string | null, cityIds: string | null, placeNames: string | null) => {
      return { changes: this.db.updateDraftVideoLocation(id, provinceIds, cityIds, placeNames) };
    });

    ipcMain.handle('db:update-draft-video-file-name', async (_, id: number, fileName: string) => {
      return { changes: this.db.updateDraftVideoFileName(id, fileName) };
    });

    ipcMain.handle('db:increment-draft-video-use-count', async (_, id: number) => {
      return { changes: this.db.incrementDraftVideoUseCount(id) };
    });

    ipcMain.handle('db:delete-draft-video', async (_, ids: number[]) => {
      // 先获取视频文件路径，再删除本地文件
      for (const id of ids) {
        const video = this.db.getDraftVideo(id);
        if (video && video.file_path && fs.existsSync(video.file_path)) {
          try {
            fs.unlinkSync(video.file_path);
            console.log(`[IPC] 删除视频文件: ${video.file_path}`);
          } catch (err) {
            console.error(`[IPC] 删除视频文件失败: ${video.file_path}`, err);
          }
        }
      }
      return { changes: this.db.deleteDraftVideo(ids) };
    });

    // 素材库-视频关键词关联
    ipcMain.handle('db:add-video-keywords', async (_, videoId: number, keywords: string[]) => {
      return { count: this.db.addVideoKeywords(videoId, keywords) };
    });

    ipcMain.handle('db:get-video-keywords', async (_, videoId: number) => {
      return this.db.getVideoKeywords(videoId);
    });

    ipcMain.handle('db:delete-video-keywords', async (_, videoId: number) => {
      return { changes: this.db.deleteVideoKeywords(videoId) };
    });

    ipcMain.handle('db:search-videos-by-keyword', async (_, keyword: string) => {
      return this.db.searchVideoIdsByKeyword(keyword);
    });

    ipcMain.handle('db:get-all-keywords-with-count', async () => {
      return this.db.getAllKeywordsWithCount();
    });

    // 作品库
    ipcMain.handle('db:add-work', async (_, work: any) => {
      return { id: this.db.addWork(work) };
    });

    ipcMain.handle('db:get-work-list', async (_, limit?: number, offset?: number) => {
      return this.db.getWorkList(limit, offset);
    });

    ipcMain.handle('db:update-work-remark', async (_, id: number, remark: string) => {
      return { changes: this.db.updateWorkRemark(id, remark) };
    });

    ipcMain.handle('db:update-work-stats', async (_, id: number, stats: any) => {
      return { changes: this.db.updateWorkStats(id, stats) };
    });

    ipcMain.handle('db:delete-work', async (_, ids: number[]) => {
      return { changes: this.db.deleteWork(ids) };
    });

    // 配置
    ipcMain.handle('db:get-config', async (_, key: string) => {
      return { value: this.db.getConfig(key) };
    });

    ipcMain.handle('db:set-config', async (_, key: string, value: string) => {
      this.db.setConfig(key, value);
      return { success: true };
    });

    ipcMain.handle('db:get-all-configs', async () => {
      return this.db.getAllConfigs();
    });

    // 设置视频根路径（自动创建子文件夹）
    ipcMain.handle('db:set-video-root-path', async (_, videoRootPath: string) => {
      try {
        if (!videoRootPath) {
          return { success: false, error: '路径不能为空' };
        }

        // 创建子文件夹路径
        const materialVideoPath = path.join(videoRootPath, MATERIAL_VIDEO_DIR);
        const draftVideoPath = path.join(videoRootPath, DRAFT_VIDEO_DIR);

        // 创建文件夹（如果不存在）
        if (!fs.existsSync(videoRootPath)) {
          fs.mkdirSync(videoRootPath, { recursive: true });
          console.log(`[IPC] 创建视频根路径: ${videoRootPath}`);
        }

        if (!fs.existsSync(materialVideoPath)) {
          fs.mkdirSync(materialVideoPath, { recursive: true });
          console.log(`[IPC] 创建材料库视频文件夹: ${materialVideoPath}`);
        }

        if (!fs.existsSync(draftVideoPath)) {
          fs.mkdirSync(draftVideoPath, { recursive: true });
          console.log(`[IPC] 创建素材库视频文件夹: ${draftVideoPath}`);
        }

        // 保存配置到数据库
        this.db.setConfig('video_root_path', videoRootPath);

        return {
          success: true,
          data: {
            videoRootPath,
            materialVideoPath,
            draftVideoPath
          }
        };
      } catch (error: any) {
        console.error('[IPC] 设置视频根路径失败:', error);
        return { success: false, error: error.message };
      }
    });

    // ==================== 音色克隆记录 ====================

    // 添加音色克隆记录
    ipcMain.handle('db:add-voice-clone', async (_, voice: any) => {
      return { id: this.db.addVoiceClone(voice) };
    });

    // 获取音色克隆列表
    ipcMain.handle('db:get-voice-clone-list', async (_, limit?: number, offset?: number) => {
      return this.db.getVoiceCloneList(limit, offset);
    });

    // 获取音色克隆详情
    ipcMain.handle('db:get-voice-clone', async (_, id: number) => {
      return this.db.getVoiceClone(id);
    });

    // 获取所有激活的音色克隆
    ipcMain.handle('db:get-active-voice-clones', async () => {
      return this.db.getActiveVoiceClones();
    });

    // 更新音色克隆状态
    ipcMain.handle('db:update-voice-clone-status', async (_, id: number, status: string) => {
      return { changes: this.db.updateVoiceCloneStatus(id, status as 'active' | 'expired') };
    });

    // 更新音色克隆最近使用时间
    ipcMain.handle('db:update-voice-clone-used-at', async (_, id: number) => {
      return { changes: this.db.updateVoiceCloneUsedAt(id) };
    });

    // 更新音色克隆标签
    ipcMain.handle('db:update-voice-clone-tag', async (_, id: number, voiceTag: string) => {
      return { changes: this.db.updateVoiceCloneTag(id, voiceTag) };
    });

    // 删除音色克隆
    ipcMain.handle('db:delete-voice-clone', async (_, ids: number[]) => {
      return { changes: this.db.deleteVoiceClone(ids) };
    });

    // 获取音色克隆数量
    ipcMain.handle('db:get-voice-clone-count', async () => {
      return { count: this.db.getVoiceCloneCount() };
    });

    // 获取免费音色克隆数量
    ipcMain.handle('db:get-free-voice-clone-count', async () => {
      return { count: this.db.getFreeVoiceCloneCount() };
    });

    // 自动过期未使用的音色
    ipcMain.handle('db:expire-unused-voices', async (_, freeDays?: number, paidDays?: number) => {
      return { changes: this.db.expireUnusedVoices(freeDays, paidDays) };
    });

    // ==================== 初始化配置 ====================

    // 获取初始化配置状态
    ipcMain.handle('db:get-init-config-status', async (_, initParam: string) => {
      return { status: this.db.getInitConfigStatus(initParam) };
    });

    // 更新初始化配置状态
    ipcMain.handle('db:update-init-config-status', async (_, initParam: string, status: number) => {
      return { changes: this.db.updateInitConfigStatus(initParam, status) };
    });

    // 检查是否已完成初始化
    ipcMain.handle('db:is-init-config-completed', async (_, initParam: string) => {
      return { completed: this.db.isInitConfigCompleted(initParam) };
    });
  }

  // ==================== FFmpeg 相关 ====================
  registerFFmpegHandlers(): void {
    // 获取视频信息
    ipcMain.handle('ffmpeg:get-video-info', async (_, filePath: string) => {
      try {
        const info = await ffmpeg.getVideoInfo(filePath);
        return { success: true, data: info };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 获取音频文件信息（格式、时长等）
    ipcMain.handle('ffmpeg:get-audio-info', async (_, filePath: string) => {
      try {
        const info = await ffmpeg.getAudioInfo(filePath);
        return { success: true, data: info };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 提取音频
    ipcMain.handle('ffmpeg:extract-audio', async (_, videoPath: string, outputPath?: string, format?: string) => {
      try {
        const result = await ffmpeg.extractAudio(videoPath, outputPath, format);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 静音处理
    ipcMain.handle('ffmpeg:mute-video', async (_, videoPath: string, outputPath?: string) => {
      try {
        const result = await ffmpeg.muteVideo(videoPath, outputPath);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 截取视频
    ipcMain.handle('ffmpeg:cut-video', async (_, videoPath: string, startTime: number, duration: number, outputPath?: string) => {
      try {
        const result = await ffmpeg.cutVideo(videoPath, startTime, duration, outputPath);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 按时长分割
    ipcMain.handle('ffmpeg:split-by-duration', async (_, videoPath: string, segmentDuration: number, outputDir?: string) => {
      try {
        const result = await ffmpeg.splitVideoByDuration(videoPath, segmentDuration, outputDir);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 镜头检测分割
    ipcMain.handle('ffmpeg:split-by-scene', async (_, videoPath: string, threshold?: number, outputDir?: string) => {
      try {
        const result = await ffmpeg.splitVideoByScene(videoPath, threshold, outputDir);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 生成缩略图
    ipcMain.handle('ffmpeg:generate-thumbnail', async (_, videoPath: string, timePoint?: number, outputPath?: string) => {
      try {
        const result = await ffmpeg.generateThumbnail(videoPath, timePoint, outputPath);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 视频转码
    ipcMain.handle('ffmpeg:transcode', async (_, videoPath: string, outputPath: string, codec?: string, crf?: number) => {
      try {
        const result = await ffmpeg.transcodeVideo(videoPath, outputPath, codec, crf);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 合并视频
    ipcMain.handle('ffmpeg:merge-videos', async (_, videoPaths: string[], outputPath: string) => {
      try {
        const result = await ffmpeg.mergeVideos(videoPaths, outputPath);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 提取视频帧
    ipcMain.handle('ffmpeg:extract-frames', async (_, videoPath: string, options?: any) => {
      try {
        const result = await ffmpeg.extractFrames(videoPath, options);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 提取关键帧
    ipcMain.handle('ffmpeg:extract-keyframes', async (_, videoPath: string, options?: any) => {
      try {
        const result = await ffmpeg.extractKeyframes(videoPath, options);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }

  // ==================== 对话框相关 ====================
  registerDialogHandlers(): void {
    // 打开目录选择对话框
    ipcMain.handle('dialog:open-directory', async () => {
      const result = await dialog.showOpenDialog(this.window, {
        properties: ['openDirectory', 'createDirectory']
      });
      return result;
    });

    // 打开文件选择对话框
    ipcMain.handle('dialog:open-file', async (_, filters?: { name: string; extensions: string[] }[]) => {
      const result = await dialog.showOpenDialog(this.window, {
        properties: ['openFile', 'multiSelections'],
        filters: filters || [{ name: 'All Files', extensions: ['*'] }]
      });
      return result;
    });

    // 打开视频文件选择对话框
    ipcMain.handle('dialog:open-video', async (_, multiSelections: boolean = true) => {
      const result = await dialog.showOpenDialog(this.window, {
        properties: multiSelections ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'] }
        ]
      });
      return result;
    });

    // 保存文件对话框
    ipcMain.handle('dialog:save-file', async (_, defaultName?: string, filters?: { name: string; extensions: string[] }[]) => {
      const result = await dialog.showSaveDialog(this.window, {
        defaultPath: defaultName,
        filters: filters || [{ name: 'All Files', extensions: ['*'] }]
      });
      return result;
    });

    // 消息对话框
    ipcMain.handle('dialog:message', async (_, type: 'none' | 'info' | 'error' | 'question' | 'warning', title: string, message: string, buttons?: string[]) => {
      const result = await dialog.showMessageBox(this.window, {
        type,
        title,
        message,
        buttons: buttons || ['确定']
      });
      return result;
    });

    // 打开文件所在目录
    ipcMain.handle('dialog:show-item-in-folder', async (_, filePath: string) => {
      shell.showItemInFolder(filePath);
      return { success: true };
    });
  }

  // ==================== Token API 相关 ====================
  registerTokenApiHandlers(): void {
    // 获取 API 基础地址
    ipcMain.handle('token:get-base-url', async () => {
      return { baseUrl: tokenApiUtil.getBaseUrl() };
    });

    // 设置 API 基础地址
    ipcMain.handle('token:set-base-url', async (_, url: string) => {
      tokenApiUtil.setBaseUrl(url);
      return { success: true };
    });

    // 获取 Token 信息
    ipcMain.handle('token:get-token-info', async (_, apiToken: string, taskId?: string) => {
      try {
        const result = await tokenApiUtil.getTokenInfo(apiToken, taskId);
        return result;
      } catch (error: any) {
        return { code: -1, msg: error.message, data: null };
      }
    });

    // 生成 Token
    ipcMain.handle('token:generate-token', async (_, expireTime: string, totalPoints: number) => {
      try {
        const result = await tokenApiUtil.generateSelfToken({ expireTime, totalPoints });
        return result;
      } catch (error: any) {
        return { code: -1, msg: error.message, data: null };
      }
    });

    // 禁用 Token
    ipcMain.handle('token:unused-token', async (_, apiToken: string) => {
      try {
        const result = await tokenApiUtil.unusedToken(apiToken);
        return result;
      } catch (error: any) {
        return { code: -1, msg: error.message, data: null };
      }
    });

    // 记录 Token 日志（扣除积分）
    ipcMain.handle('token:record-log', async (_, apiToken: string, usedPoints: number, taskType?: number, taskId?: string, taskStatus?: number) => {
      try {
        const result = await tokenApiUtil.deductPointsAuto(apiToken, usedPoints, taskType, taskId, taskStatus);
        return result;
      } catch (error: any) {
        return { code: -1, msg: error.message, data: null };
      }
    });

    // 检查 Token 是否有效
    ipcMain.handle('token:check-valid', async (_, apiToken: string) => {
      try {
        const result = await tokenApiUtil.checkTokenValid(apiToken);
        return result;
      } catch (error: any) {
        return { valid: false, error: error.message };
      }
    });

    // 获取剩余积分
    ipcMain.handle('token:get-remaining-points', async (_, apiToken: string) => {
      try {
        const points = await tokenApiUtil.getRemainingPoints(apiToken);
        return { points };
      } catch (error: any) {
        return { points: 0, error: error.message };
      }
    });

    // 检查是否有足够积分
    ipcMain.handle('token:has-enough-points', async (_, apiToken: string, requiredPoints: number) => {
      try {
        const hasEnough = await tokenApiUtil.hasEnoughPoints(apiToken, requiredPoints);
        const remaining = await tokenApiUtil.getRemainingPoints(apiToken);
        return { sufficient: hasEnough, remaining };
      } catch (error: any) {
        return { sufficient: false, remaining: 0, error: error.message };
      }
    });

    // 扣除积分（自动获取 tokenId）
    ipcMain.handle('token:deduct-points', async (_, apiToken: string, usedPoints: number) => {
      try {
        const result = await tokenApiUtil.deductPointsAuto(apiToken, usedPoints);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 获取 Token 显示信息
    ipcMain.handle('token:get-display-info', async (_, apiToken: string) => {
      try {
        const result = await tokenApiUtil.getTokenDisplayInfo(apiToken);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }

  // ==================== OSS 相关 ====================
  registerOSSHandlers(): void {
    // 初始化 OSS 配置
    ipcMain.handle('oss:init', async (_, config: OSSConfig) => {
      try {
        ossUtil.init(config);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 从数据库加载配置并初始化
    ipcMain.handle('oss:init-from-db', async () => {
      try {
        const accessKeyId = this.db.getConfig('oss_access_key_id');
        const accessKeySecret = this.db.getConfig('oss_access_key_secret');
        const bucket = this.db.getConfig('oss_bucket');
        const region = this.db.getConfig('oss_region');
        const uploadDir = this.db.getConfig('oss_upload_dir');

        if (!accessKeyId || !accessKeySecret || !bucket || !region) {
          return { success: false, error: 'OSS 配置不完整' };
        }

        ossUtil.init({
          accessKeyId,
          accessKeySecret,
          bucket,
          region,
          useInternal: true,
          uploadDir: uploadDir || undefined,
        });

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 上传文件
    ipcMain.handle('oss:upload-file', async (_, filePath: string, objectName?: string) => {
      try {
        const result = await ossUtil.uploadFile(filePath, { objectName });
        return result;
      } catch (error: any) {
        return { success: false, error: error.message, name: '', internalUrl: '', publicUrl: '' };
      }
    });

    // 批量上传文件
    ipcMain.handle('oss:upload-files', async (_, filePaths: string[]) => {
      try {
        const results = await ossUtil.uploadFiles(filePaths);
        return results;
      } catch (error: any) {
        return [{ success: false, error: error.message, name: '', internalUrl: '', publicUrl: '' }];
      }
    });

    // 删除文件
    ipcMain.handle('oss:delete-file', async (_, objectName: string) => {
      try {
        const result = await ossUtil.deleteFile(objectName);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 检查文件是否存在
    ipcMain.handle('oss:exists', async (_, objectName: string) => {
      try {
        const exists = await ossUtil.exists(objectName);
        return { exists };
      } catch (error: any) {
        return { exists: false, error: error.message };
      }
    });

    // 检查是否已初始化
    ipcMain.handle('oss:is-initialized', async () => {
      return { initialized: ossUtil.isInitialized() };
    });

    // 获取内网地址
    ipcMain.handle('oss:get-internal-url', async (_, objectName: string) => {
      try {
        const url = ossUtil.getInternalUrl(objectName);
        return { url };
      } catch (error: any) {
        return { url: '', error: error.message };
      }
    });

    // 获取外网地址
    ipcMain.handle('oss:get-public-url', async (_, objectName: string) => {
      try {
        const url = ossUtil.getPublicUrl(objectName);
        return { url };
      } catch (error: any) {
        return { url: '', error: error.message };
      }
    });
  }

  // ==================== TokenConfig 相关 ====================
  registerTokenConfigHandlers(): void {
    // 获取 Token 配置信息
    ipcMain.handle('token-config:get-info', async (_, forceRefresh?: boolean) => {
      try {
        const result = await tokenConfigUtil.getConfigInfo(forceRefresh);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message, data: null };
      }
    });

    // 获取 OSS 临时凭证
    ipcMain.handle('token-config:get-oss-credentials', async (_, forceRefresh?: boolean) => {
      try {
        const result = await tokenConfigUtil.getOSSCredentials(forceRefresh);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message, data: null };
      }
    });

    // 获取百炼临时 API Key
    ipcMain.handle('token-config:get-bailian-api-key', async (_, forceRefresh?: boolean) => {
      try {
        const result = await tokenConfigUtil.getBailianApiKey(forceRefresh);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message, data: null };
      }
    });

    // 设置 API 基础地址
    ipcMain.handle('token-config:set-base-url', async (_, url: string) => {
      try {
        tokenConfigUtil.setBaseUrl(url);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 获取 API 基础地址
    ipcMain.handle('token-config:get-base-url', async () => {
      return { url: tokenConfigUtil.getBaseUrl() };
    });

    // 清除缓存
    ipcMain.handle('token-config:clear-cache', async () => {
      tokenConfigUtil.clearCache();
      return { success: true };
    });

    // 检查缓存是否有效
    ipcMain.handle('token-config:is-cache-valid', async () => {
      return { valid: tokenConfigUtil.isCacheValid() };
    });

    // 使用临时凭证初始化 OSS
    ipcMain.handle('token-config:init-oss-with-sts', async (_, forceRefresh?: boolean) => {
      try {
        const credentials = await tokenConfigUtil.getOSSCredentials(forceRefresh);
        if (!credentials) {
          return { success: false, error: '获取 OSS 凭证失败' };
        }

        ossUtil.init({
          accessKeyId: credentials.accessKeyId,
          accessKeySecret: credentials.accessKeySecret,
          bucket: credentials.bucket,
          region: credentials.region,
          useInternal: false, // 使用公网 endpoint，本地环境和百炼服务都能访问
          securityToken: credentials.securityToken,
        });

        return { success: true, data: credentials };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }

  // ==================== 百炼大模型相关 ====================
  registerBailianHandlers(): void {
    // 初始化百炼客户端
    ipcMain.handle('bailian:init', async (_, config: BailianClientConfig) => {
      try {
        bailianUtil.init(config);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 检查是否已初始化
    ipcMain.handle('bailian:is-initialized', async () => {
      return { initialized: bailianUtil.isInitialized() };
    });

    // 设置 API Key
    ipcMain.handle('bailian:set-api-key', async (_, apiKey: string) => {
      try {
        bailianUtil.setApiKey(apiKey);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 简单文本对话
    ipcMain.handle('bailian:chat', async (_, prompt: string, systemPrompt?: string, options?: any) => {
      try {
        const result = await bailianUtil.chat(prompt, systemPrompt, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 聊天完成（多轮对话）
    ipcMain.handle('bailian:chat-completion', async (_, messages: any[], options?: any) => {
      try {
        const result = await bailianUtil.chatCompletion(messages, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 图像理解
    ipcMain.handle('bailian:analyze-image', async (_, imageUrl: string, question: string, options?: any) => {
      try {
        const result = await bailianUtil.analyzeImage(imageUrl, question, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 多图像理解
    ipcMain.handle('bailian:analyze-images', async (_, imageUrls: string[], question: string, options?: any) => {
      try {
        const result = await bailianUtil.analyzeImages(imageUrls, question, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 视频分析（基于帧）
    ipcMain.handle('bailian:analyze-video-frames', async (_, frameUrls: string[], options?: any) => {
      try {
        const result = await bailianUtil.analyzeVideoFrames(frameUrls, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 视频内容总结
    ipcMain.handle('bailian:summarize-video', async (_, frameUrls: string[], options?: any) => {
      try {
        const result = await bailianUtil.summarizeVideo(frameUrls, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 提取视频关键词
    ipcMain.handle('bailian:extract-video-keywords', async (_, frameUrls: string[], options?: any) => {
      try {
        const result = await bailianUtil.extractVideoKeywords(frameUrls, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 视频详细描述
    ipcMain.handle('bailian:describe-video', async (_, frameUrls: string[], options?: any) => {
      try {
        const result = await bailianUtil.describeVideo(frameUrls, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 自定义视频分析
    ipcMain.handle('bailian:custom-video-analysis', async (_, frameUrls: string[], customPrompt: string, options?: any) => {
      try {
        const result = await bailianUtil.customVideoAnalysis(frameUrls, customPrompt, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 文本匹配关键词
    ipcMain.handle('bailian:match-keywords', async (_, text: string, availableKeywords?: string[], options?: any) => {
      try {
        const result = await bailianUtil.matchKeywords(text, availableKeywords, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }

  // ==================== 百炼语音相关 ====================
  registerBailianAudioHandlers(): void {
    // 初始化
    ipcMain.handle('bailian-audio:init', async (_, config: BailianAudioConfig) => {
      try {
        bailianAudioUtil.init(config);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 检查是否已初始化
    ipcMain.handle('bailian-audio:is-initialized', async () => {
      return { initialized: bailianAudioUtil.isInitialized() };
    });

    // 设置 API Key
    ipcMain.handle('bailian-audio:set-api-key', async (_, apiKey: string) => {
      try {
        bailianAudioUtil.setApiKey(apiKey);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 音色克隆
    ipcMain.handle('bailian-audio:clone-voice', async (_, audioFilePath: string, options: any) => {
      try {
        const result = await bailianAudioUtil.cloneVoice(audioFilePath, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 语音合成
    ipcMain.handle('bailian-audio:synthesize-speech', async (_, text: string, voiceId: string, outputFilePath?: string, options?: any) => {
      try {
        const result = await bailianAudioUtil.synthesizeSpeech(text, voiceId, outputFilePath, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 文本转语音（使用预设音色）
    ipcMain.handle('bailian-audio:text-to-speech', async (_, text: string, outputFilePath: string, voiceId?: string, options?: any) => {
      try {
        const result = await bailianAudioUtil.textToSpeech(text, outputFilePath, voiceId, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 文本转语音（返回 Buffer）
    ipcMain.handle('bailian-audio:text-to-speech-buffer', async (_, text: string, voiceId?: string, options?: any) => {
      try {
        const result = await bailianAudioUtil.textToSpeechBuffer(text, voiceId, options);
        // 如果有 audioData，转换为 base64 返回
        if (result.success && result.audioData) {
          return {
            ...result,
            audioData: result.audioData.toString('base64'),
          };
        }
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 获取预设音色列表
    ipcMain.handle('bailian-audio:get-preset-voices', async () => {
      return { voices: bailianAudioUtil.getPresetVoices() };
    });

    // 获取支持的音色模型列表
    ipcMain.handle('bailian-audio:get-supported-models', async () => {
      return { models: bailianAudioUtil.getSupportedModels() };
    });

    // 通过公网URL克隆音色
    ipcMain.handle('bailian-audio:clone-voice-by-url', async (_, audioUrl: string, options: any) => {
      try {
        const result = await bailianAudioUtil.cloneVoiceByUrl(audioUrl, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 语音识别（ASR）
    ipcMain.handle('bailian-audio:recognize-speech', async (_, audioFilePath: string, options?: any) => {
      try {
        const result = await bailianAudioUtil.recognizeSpeech(audioFilePath, options);
        return result;
      } catch (error: any) {
        return { success: false, sentences: [], error: error.message };
      }
    });
  }

  // ==================== 视频素材匹配相关 ====================
  registerVideoMatchHandlers(): void {
    // 设置 API 基础地址
    ipcMain.handle('video-match:set-base-url', async (_, url: string) => {
      videoMatchUtil.setBaseUrl(url);
      return { success: true };
    });

    // 获取 API 基础地址
    ipcMain.handle('video-match:get-base-url', async () => {
      return { url: videoMatchUtil.getBaseUrl() };
    });

    // 生成 content hash
    ipcMain.handle('video-match:generate-content-hash', async (_, dateStr?: string) => {
      try {
        const hash = videoMatchUtil.generateContentHash(dateStr);
        return { success: true, hash };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 执行视频匹配
    ipcMain.handle('video-match:match-videos', async (_, request: any, options: any) => {
      try {
        const result = await videoMatchUtil.matchVideos(request, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 构建短句数据
    ipcMain.handle('video-match:build-short-sentence', async (_, text: string, sentenceId: number, duration: number, recordIds: string[], recordInfos: any[], keywords: string) => {
      try {
        const result = videoMatchUtil.buildShortSentence(text, sentenceId, duration, recordIds, recordInfos, keywords);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 批量构建短句数据
    ipcMain.handle('video-match:build-short-sentences', async (_, sentences: any[]) => {
      try {
        const result = videoMatchUtil.buildShortSentences(sentences);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }

  // ==================== 视频分析相关 ====================
  registerVideoAnalysisHandlers(): void {
    // 分析视频
    ipcMain.handle('video-analysis:analyze', async (_, videoPath: string, options?: any) => {
      try {
        const result = await videoAnalysisUtil.analyzeVideo(videoPath, options);
        if (result.success && result.usage) {
          console.log(`[VideoAnalysis] 视频: ${videoPath}`);
          console.log(`[VideoAnalysis] Token 输入: ${result.usage.promptTokens}, Token 输出: ${result.usage.completionTokens}, 总计: ${result.usage.totalTokens}`);
        }
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 提取视频关键词
    ipcMain.handle('video-analysis:extract-keywords', async (_, videoPath: string, options?: any) => {
      try {
        const result = await videoAnalysisUtil.extractVideoKeywords(videoPath, options);
        if (result.success && result.usage) {
          console.log(`[VideoAnalysis] 视频: ${videoPath}`);
          console.log(`[VideoAnalysis] Token 输入: ${result.usage.promptTokens}, Token 输出: ${result.usage.completionTokens}, 总计: ${result.usage.totalTokens}`);
        }
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 视频摘要
    ipcMain.handle('video-analysis:summarize', async (_, videoPath: string, options?: any) => {
      try {
        const result = await videoAnalysisUtil.summarizeVideo(videoPath, options);
        if (result.success && result.usage) {
          console.log(`[VideoAnalysis] 视频: ${videoPath}`);
          console.log(`[VideoAnalysis] Token 输入: ${result.usage.promptTokens}, Token 输出: ${result.usage.completionTokens}, 总计: ${result.usage.totalTokens}`);
        }
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 视频详细描述
    ipcMain.handle('video-analysis:describe', async (_, videoPath: string, options?: any) => {
      try {
        const result = await videoAnalysisUtil.describeVideo(videoPath, options);
        if (result.success && result.usage) {
          console.log(`[VideoAnalysis] 视频: ${videoPath}`);
          console.log(`[VideoAnalysis] Token 输入: ${result.usage.promptTokens}, Token 输出: ${result.usage.completionTokens}, 总计: ${result.usage.totalTokens}`);
        }
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 自定义视频分析
    ipcMain.handle('video-analysis:custom-analyze', async (_, videoPath: string, customPrompt: string, options?: any) => {
      try {
        const result = await videoAnalysisUtil.customAnalyzeVideo(videoPath, customPrompt, options);
        if (result.success && result.usage) {
          console.log(`[VideoAnalysis] 视频: ${videoPath}`);
          console.log(`[VideoAnalysis] Token 输入: ${result.usage.promptTokens}, Token 输出: ${result.usage.completionTokens}, 总计: ${result.usage.totalTokens}`);
        }
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 批量提取关键词
    ipcMain.handle('video-analysis:batch-extract-keywords', async (_, videoPaths: string[], options?: any) => {
      try {
        const results = await videoAnalysisUtil.batchExtractKeywords(videoPaths, options);
        // 将 Map 转换为普通对象，并打印每个视频的 token 使用量
        const resultObj: Record<string, any> = {};
        results.forEach((value, key) => {
          resultObj[key] = value;
          if (value.success && value.usage) {
            console.log(`[VideoAnalysis] 视频: ${key}`);
            console.log(`[VideoAnalysis] Token 输入: ${value.usage.promptTokens}, Token 输出: ${value.usage.completionTokens}, 总计: ${value.usage.totalTokens}`);
          }
        });
        return { success: true, data: resultObj };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 批量提取关键词（并发控制，带进度事件，主进程更新数据库）
    // videoIdMap: 视频路径 -> 视频ID 的映射
    ipcMain.handle('video-analysis:batch-extract-keywords-concurrent', async (event, videoPaths: string[], videoIdMap: Record<string, number>, options?: any) => {
      try {
        const results = await videoAnalysisUtil.batchExtractKeywordsConcurrent(
          videoPaths,
          options,
          (progress) => {
            // 发送进度事件到渲染进程
            event.sender.send('video-analysis:batch-progress', progress);

            // 在主进程中更新数据库状态
            if (progress.currentVideo && progress.currentResult) {
              const videoId = videoIdMap[progress.currentVideo];
              if (videoId) {
                if (progress.currentResult.success && progress.currentResult.keywords) {
                  const keywordsStr = progress.currentResult.keywords.join(',');
                  this.db.updateDraftVideoAnalysis(videoId, keywordsStr);
                  this.db.updateDraftVideoAnalysisStatus(videoId, 2); // 已分析
                } else {
                  this.db.updateDraftVideoAnalysisStatus(videoId, 3); // 分析失败
                }
              }
              // 打印 token 使用量统计
              if (progress.currentResult.usage) {
                console.log(`[VideoAnalysis] 视频: ${progress.currentVideo}`);
                console.log(`[VideoAnalysis] Token 输入: ${progress.currentResult.usage.promptTokens}, Token 输出: ${progress.currentResult.usage.completionTokens}, 总计: ${progress.currentResult.usage.totalTokens}`);
              }
            }
          }
        );
        // 将 Map 转换为普通对象
        const resultObj: Record<string, any> = {};
        results.forEach((value, key) => {
          resultObj[key] = value;
        });
        return { success: true, data: resultObj };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 获取默认配置
    ipcMain.handle('video-analysis:get-default-config', async () => {
      return { config: videoAnalysisUtil.getDefaultConfig() };
    });

    // 更新默认配置
    ipcMain.handle('video-analysis:update-default-config', async (_, config: any) => {
      videoAnalysisUtil.updateDefaultConfig(config);
      return { success: true };
    });

    // ==================== 异步批量分析 API ====================

    // 提交异步批量视频关键词分析
    ipcMain.handle('video-analysis:batch-submit', async (_, videos: Array<{ id: string; filePath: string }>, options?: any) => {
      try {
        const result = await videoAnalysisUtil.batchExtractKeywordsAsync(videos, options);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 查询异步批量任务状态 & 获取结果
    ipcMain.handle('video-analysis:batch-check', async (_, batchId: string) => {
      try {
        const result = await videoAnalysisUtil.checkBatchResult(batchId);

        // 如果有终态结果，更新数据库
        if (result.results) {
          for (const r of result.results) {
            const videoId = parseInt(r.customId);
            if (isNaN(videoId)) continue;

            if (r.success && r.keywords) {
              this.db.updateDraftVideoAnalysis(videoId, r.keywords);
              this.db.updateDraftVideoAnalysisStatus(videoId, 2); // 已分析
            } else {
              this.db.updateDraftVideoAnalysisStatus(videoId, 3); // 分析失败
            }
          }
        }

        return result;
      } catch (error: any) {
        return { status: 'unknown', error: error.message };
      }
    });

    // 取消异步批量任务
    ipcMain.handle('video-analysis:batch-cancel', async (_, batchId: string) => {
      try {
        const result = await videoAnalysisUtil.cancelBatchTask(batchId);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }

  // ==================== 剪映草稿 API 相关 ====================
  registerDraftApiHandlers(): void {
    // 设置基础 URL
    ipcMain.handle('draft-api:set-base-url', async (_, url: string) => {
      draftApiClient.setBaseUrl(url);
      return { success: true };
    });

    // 获取基础 URL
    ipcMain.handle('draft-api:get-base-url', async () => {
      return { url: draftApiClient.getBaseUrl() };
    });

    // ==================== 草稿管理 ====================

    // 创建草稿
    ipcMain.handle('draft-api:create-draft', async (_, width: number, height: number) => {
      try {
        const result = await draftApiClient.createDraft(width, height);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 删除草稿
    ipcMain.handle('draft-api:delete-draft', async (_, draftId: string) => {
      try {
        const result = await draftApiClient.deleteDraft(draftId);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 获取草稿模板
    ipcMain.handle('draft-api:get-draft-template', async (_, draftId: string) => {
      try {
        const result = await draftApiClient.getDraftTemplate(draftId);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // ==================== 添加素材 ====================

    // 添加视频素材
    ipcMain.handle('draft-api:add-videos', async (_, request: AddVideosRequest) => {
      try {
        const result = await draftApiClient.addVideos(request);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 添加音频素材
    ipcMain.handle('draft-api:add-audios', async (_, request: AddAudiosRequest) => {
      try {
        const result = await draftApiClient.addAudios(request);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 添加文本素材
    ipcMain.handle('draft-api:add-texts', async (_, request: AddTextsRequest) => {
      try {
        const result = await draftApiClient.addTexts(request);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // ==================== 时间线 ====================

    // 生成时间线
    ipcMain.handle('draft-api:generate-timelines', async (_, timelineSegment: number[]) => {
      try {
        const result = await draftApiClient.generateTimelines(timelineSegment);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 根据音频生成时间线
    ipcMain.handle('draft-api:generate-timelines-by-audio', async (_, audioUrls: string[]) => {
      try {
        const result = await draftApiClient.generateTimelinesByAudio(audioUrls);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // ==================== 视频处理 ====================

    // 创建视频片段信息
    ipcMain.handle('draft-api:create-video-info', async (_, request: any) => {
      try {
        const result = await draftApiClient.createVideoInfo(request);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 根据时间线创建视频素材
    ipcMain.handle('draft-api:create-video-infos-by-timelines', async (_, timelines: any[], videoUrls: string[]) => {
      try {
        const result = await draftApiClient.createVideoInfosByTimelines(timelines, videoUrls);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 拼接视频信息
    ipcMain.handle('draft-api:concat-video-infos', async (_, videoInfos1: string, videoInfos2: string) => {
      try {
        const result = await draftApiClient.concatVideoInfos(videoInfos1, videoInfos2);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 交换视频片段位置
    ipcMain.handle('draft-api:swap-video-segment', async (_, videoInfos: string, swapPosition: any[], targetTimerangeStart?: number) => {
      try {
        const result = await draftApiClient.swapVideoSegment(videoInfos, swapPosition, targetTimerangeStart);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 修改视频信息
    ipcMain.handle('draft-api:modify-video-infos', async (_, videoInfos: string, segmentIndex: number[], modifications: any) => {
      try {
        const result = await draftApiClient.modifyVideoInfos(videoInfos, segmentIndex, modifications);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // ==================== 音频处理 ====================

    // 创建音频片段信息
    ipcMain.handle('draft-api:create-audio-info', async (_, request: any) => {
      try {
        const result = await draftApiClient.createAudioInfo(request);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 根据时间线创建音频素材
    ipcMain.handle('draft-api:create-audio-infos-by-timelines', async (_, timelines: any[], audioUrls: string[]) => {
      try {
        const result = await draftApiClient.createAudioInfosByTimelines(timelines, audioUrls);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 拼接音频信息
    ipcMain.handle('draft-api:concat-audio-infos', async (_, audioInfos1: string, audioInfos2: string) => {
      try {
        const result = await draftApiClient.concatAudioInfos(audioInfos1, audioInfos2);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 交换音频片段位置
    ipcMain.handle('draft-api:swap-audio-segment', async (_, audioInfos: string, swapPosition: any[], targetTimerangeStart?: number) => {
      try {
        const result = await draftApiClient.swapAudioSegment(audioInfos, swapPosition, targetTimerangeStart);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 修改音频信息
    ipcMain.handle('draft-api:modify-audio-infos', async (_, audioInfos: string, segmentIndex: number[], modifications: any) => {
      try {
        const result = await draftApiClient.modifyAudioInfos(audioInfos, segmentIndex, modifications);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // ==================== 文本处理 ====================

    // 创建文本片段信息
    ipcMain.handle('draft-api:create-text-info', async (_, request: any) => {
      try {
        const result = await draftApiClient.createTextInfo(request);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 根据时间线创建文本素材
    ipcMain.handle('draft-api:create-text-infos-by-timelines', async (_, timelines: any[], texts: string[]) => {
      try {
        const result = await draftApiClient.createTextInfosByTimelines(timelines, texts);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 拼接文本信息
    ipcMain.handle('draft-api:concat-text-infos', async (_, textInfos1: string, textInfos2: string) => {
      try {
        const result = await draftApiClient.concatTextInfos(textInfos1, textInfos2);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 交换文本片段位置
    ipcMain.handle('draft-api:swap-text-segment', async (_, textInfos: string, swapPosition: any[], targetTimerangeStart?: number) => {
      try {
        const result = await draftApiClient.swapTextSegment(textInfos, swapPosition, targetTimerangeStart);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // 修改文本信息
    ipcMain.handle('draft-api:modify-text-infos', async (_, textInfos: string, segmentIndex: number[], modifications: any) => {
      try {
        const result = await draftApiClient.modifyTextInfos(textInfos, segmentIndex, modifications);
        return result;
      } catch (error: any) {
        return { code: -1, message: error.message };
      }
    });

    // ==================== 辅助方法 ====================

    // 解析 JSON
    ipcMain.handle('draft-api:parse-json', async (_, jsonStr: string) => {
      try {
        const result = draftApiClient.parseJson(jsonStr);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 转换为 JSON
    ipcMain.handle('draft-api:to-json', async (_, obj: any) => {
      try {
        const result = draftApiClient.toJson(obj);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 时间转换
    ipcMain.handle('draft-api:seconds-to-microseconds', async (_, seconds: number) => {
      return { microseconds: draftApiClient.secondsToMicroseconds(seconds) };
    });

    ipcMain.handle('draft-api:microseconds-to-seconds', async (_, microseconds: number) => {
      return { seconds: draftApiClient.microsecondsToSeconds(microseconds) };
    });

    ipcMain.handle('draft-api:milliseconds-to-microseconds', async (_, milliseconds: number) => {
      return { microseconds: draftApiClient.millisecondsToMicroseconds(milliseconds) };
    });

    ipcMain.handle('draft-api:microseconds-to-milliseconds', async (_, microseconds: number) => {
      return { milliseconds: draftApiClient.microsecondsToMilliseconds(microseconds) };
    });
  }

  // ==================== 文生视频相关 ====================
  registerTextToVideoHandlers(): void {
    // 动态导入管道模块
    const { TextToVideoPipeline, TextToVideoContext } = require('../pipeline');
    const { TtsStep } = require('../pipeline/steps/tts_step');
    const { AsrStep } = require('../pipeline/steps/asr_step');
    const { KeywordQueryStep } = require('../pipeline/steps/keyword_query_step');
    const { KeywordBindStep } = require('../pipeline/steps/keyword_bind_step');
    const { VideoMatchStep } = require('../pipeline/steps/video_match_step');
    const { DraftPopulateStep } = require('../pipeline/steps/draft_populate_step');
    const { DraftReviewStep, getPendingReviewStep } = require('../pipeline/steps/draft_review_step');
    const { DraftGenerateStep } = require('../pipeline/steps/draft_generate_step');

    // 存储正在执行的任务
    const runningPipelines = new Map<number, any>();

    // 创建文生视频任务
    ipcMain.handle('text-to-video:create-task', async (_, params: {
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
    }) => {
      try {
        const taskId = this.db.createTextToVideoTask(params);
        return { success: true, taskId };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 获取任务详情
    ipcMain.handle('text-to-video:get-task', async (_, taskId: number) => {
      try {
        const task = this.db.getTextToVideoTask(taskId);
        return { success: true, task };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 获取任务列表
    ipcMain.handle('text-to-video:get-task-list', async (_, limit?: number, offset?: number) => {
      try {
        const tasks = this.db.getTextToVideoTaskList(limit, offset);
        return { success: true, tasks };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 获取可恢复的任务
    ipcMain.handle('text-to-video:get-resumable-task', async (_, draftTextId: number) => {
      try {
        const task = this.db.getResumableTextToVideoTask(draftTextId);
        if (!task) {
          return { success: true, task: null };
        }

        // 分析已完成步骤
        const completedSteps: string[] = [];
        if (task.tts_local_path) completedSteps.push('tts');
        if (task.asr_content) completedSteps.push('asr');
        if (task.short_sentences) completedSteps.push('keyword_bind');
        if (task.video_timelines) completedSteps.push('video_match');
        if (task.draft_populate_used_points) completedSteps.push('draft_populate');
        if (task.draft_id) completedSteps.push('draft_generate');

        return {
          success: true,
          task: {
            ...task,
            completedSteps,
            // 解析 JSON 字段
            asr_content: task.asr_content ? JSON.parse(task.asr_content) : null,
            short_sentences: task.short_sentences ? JSON.parse(task.short_sentences) : null,
            video_timelines: task.video_timelines ? JSON.parse(task.video_timelines) : null,
            bg_music_config: task.bg_music_config ? JSON.parse(task.bg_music_config) : null,
          }
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 启动任务执行
    ipcMain.handle('text-to-video:start', async (_, taskId: number) => {
      try {
        const task = this.db.getTextToVideoTask(taskId);
        if (!task) {
          return { success: false, error: '任务不存在' };
        }

        if (task.status === 1) {
          return { success: false, error: '任务正在执行中' };
        }

        // 获取文案内容
        const draftText = this.db.getDraftTextList(1000, 0).find((t: any) => t.id === task.draft_text_id);
        if (!draftText) {
          return { success: false, error: '关联的文案不存在' };
        }

        // 创建上下文
        const context = TextToVideoContext.fromRecord(task, draftText.content);

        // 获取配置
        const apiToken = this.db.getConfig('api_token') || '';
        const apiBaseUrl = this.db.getConfig('api_base_url') || '';
        const jianyingDraftPath = this.db.getConfig('jianying_draft_path') || '';
        const videoRootPath = this.db.getConfig('video_root_path') || '';

        // 注入 apiToken 到 context（用于积分扣除）
        context.apiToken = apiToken;

        // 初始化 OSS（用于 ASR 上传音频）- 使用 tokenConfigUtil 获取临时凭证
        try {
          const ossCredentials = await tokenConfigUtil.getOSSCredentials();
          if (ossCredentials) {
            ossUtil.init({
              accessKeyId: ossCredentials.accessKeyId,
              accessKeySecret: ossCredentials.accessKeySecret,
              bucket: ossCredentials.bucket,
              region: ossCredentials.region,
              securityToken: ossCredentials.securityToken,
              useInternal: false, // 本地环境使用外网地址
            });
            console.log('[TextToVideo] OSS 初始化成功（使用临时凭证）');
          } else {
            console.warn('[TextToVideo] 获取 OSS 临时凭证失败，ASR 步骤可能失败');
          }
        } catch (ossError: any) {
          console.error('[TextToVideo] OSS 初始化失败:', ossError.message);
        }

        // 初始化百炼客户端（用于关键词绑定）- 使用 tokenConfigUtil 获取临时 API Key
        try {
          const bailianApiKey = await tokenConfigUtil.getBailianApiKey();
          if (bailianApiKey) {
            bailianUtil.init({ apiKey: bailianApiKey });
            console.log('[TextToVideo] 百炼客户端初始化成功（使用临时 API Key）');
          } else {
            console.warn('[TextToVideo] 获取百炼 API Key 失败，关键词绑定步骤可能失败');
          }
        } catch (bailianError: any) {
          console.error('[TextToVideo] 百炼客户端初始化失败:', bailianError.message);
        }

        // 创建管道
        const pipeline = new TextToVideoPipeline(this.db, this.window);

        // 添加步骤
        const ttsOutputDir = path.join(videoRootPath, 'tts_output');
        pipeline.addStep(new TtsStep(ttsOutputDir));
        pipeline.addStep(new AsrStep());
        pipeline.addStep(new KeywordQueryStep(this.db));
        pipeline.addStep(new KeywordBindStep());
        pipeline.addStep(new VideoMatchStep(apiToken, apiBaseUrl));
        pipeline.addStep(new DraftPopulateStep(this.db, jianyingDraftPath, videoRootPath));
        // TODO: DraftReviewStep 临时停用，待轨道编辑功能完善后恢复
        // pipeline.addStep(new DraftReviewStep(this.window, this.db));
        pipeline.addStep(new DraftGenerateStep(this.db, jianyingDraftPath));

        // 存储管道实例（用于取消）
        runningPipelines.set(taskId, pipeline);

        // 异步执行管道
        pipeline.run(context).then(() => {
          runningPipelines.delete(taskId);
        }).catch((error: any) => {
          console.error('[TextToVideo] 执行失败:', error);
          runningPipelines.delete(taskId);
        });

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 取消任务
    ipcMain.handle('text-to-video:cancel', async (_, taskId: number) => {
      try {
        const pipeline = runningPipelines.get(taskId);
        if (pipeline) {
          pipeline.cancel();
          runningPipelines.delete(taskId);
        }
        this.db.updateTextToVideoTaskStatus(taskId, 3, '用户取消');
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 删除任务
    ipcMain.handle('text-to-video:delete', async (_, ids: number[]) => {
      try {
        const changes = this.db.deleteTextToVideoTask(ids);
        return { success: true, changes };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // ==================== 草稿审核相关 ====================

    // 提交编辑结果
    ipcMain.handle('draft-review:submit', async (_, taskId: number, result: any) => {
      try {
        const { action, editedMaterials } = result;

        // 根据操作类型更新数据库
        if (action === 'confirm' && editedMaterials) {
          this.db.updateTextToVideoTaskEditedMaterials(taskId, {
            videoTracks: editedMaterials.videoTracks ? JSON.stringify(editedMaterials.videoTracks) : undefined,
            audioTracks: editedMaterials.audioTracks ? JSON.stringify(editedMaterials.audioTracks) : undefined,
            textTracks: editedMaterials.textTracks ? JSON.stringify(editedMaterials.textTracks) : undefined,
            bgMusicConfig: editedMaterials.bgMusicConfig ? JSON.stringify(editedMaterials.bgMusicConfig) : undefined,
          });
          this.db.updateTextToVideoTaskReviewStatus(taskId, 2); // 已确认
        } else if (action === 'skip') {
          this.db.updateTextToVideoTaskReviewStatus(taskId, 3); // 已跳过
        } else if (action === 'cancel') {
          this.db.updateTextToVideoTaskReviewStatus(taskId, 4); // 已取消
        }

        // 恢复 pipeline 执行
        const step = getPendingReviewStep(taskId);
        if (step) {
          console.log(`[ ipc_handle ] [draft-review:submit] result = ${JSON.stringify(result)}`);
          step.handleUserResponse(taskId, result);
        }

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 获取审核数据（断点续传用）
    ipcMain.handle('draft-review:get-data', async (_, taskId: number) => {
      try {
        const task = this.db.getTextToVideoTask(taskId);
        if (!task) {
          return { success: false, error: '任务不存在' };
        }

        return {
          success: true,
          data: {
            videoTracks: task.edited_video_tracks ? JSON.parse(task.edited_video_tracks) : null,
            audioTracks: task.edited_audio_tracks ? JSON.parse(task.edited_audio_tracks) : null,
            textTracks: task.edited_text_tracks ? JSON.parse(task.edited_text_tracks) : null,
            bgMusicConfig: task.edited_bg_music_config ? JSON.parse(task.edited_bg_music_config) : null,
            reviewStatus: task.draft_review_status,
          }
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }

  // ==================== 地区数据相关 ====================
  registerPlaceDataHandlers(): void {
    // 获取省市区数据
    ipcMain.handle('place:get-data', async () => {
      try {
        const data = this.db.getPlaceData();
        return { success: true, data };
      } catch (error: any) {
        console.error('[PlaceData] 读取地区数据失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取素材库视频中已使用的地点信息
    ipcMain.handle('place:get-used-locations', async () => {
      try {
        const data = this.db.getDraftVideoUsedLocations();
        return { success: true, data };
      } catch (error: any) {
        console.error('[PlaceData] 获取已用地点信息失败:', error);
        return { success: false, error: error.message };
      }
    });
  }

  // ==================== 飞书多维表格同步相关 ====================
  registerFeishuHandlers(): void {
    // 初始化飞书模块
    feishuBitableUtil.init(this.db);

    // 同步视频素材
    ipcMain.handle('feishu:sync-videos', async (_, options?: { overwrite?: boolean }) => {
      try {
        const result = await feishuBitableUtil.syncVideos(options || {}, (progress: SyncProgress) => {
          this.window.webContents.send('feishu:sync-progress', progress);
        });
        return result;
      } catch (error: any) {
        console.error('[Feishu] 同步视频失败:', error);
        return { success: false, error: error.message, successCount: 0, skipCount: 0, failCount: 0, errors: [] };
      }
    });

    // 同步文案
    ipcMain.handle('feishu:sync-texts', async (_, options?: { overwrite?: boolean; textFieldName?: string }) => {
      try {
        const result = await feishuBitableUtil.syncTexts(options || {}, (progress: SyncProgress) => {
          this.window.webContents.send('feishu:sync-progress', progress);
        });
        return result;
      } catch (error: any) {
        console.error('[Feishu] 同步文案失败:', error);
        return { success: false, error: error.message, successCount: 0, skipCount: 0, failCount: 0, errors: [] };
      }
    });

    // 获取视频表格字段
    ipcMain.handle('feishu:get-video-fields', async () => {
      try {
        // 从 tokenConfig 获取源视频素材表格地址
        const sourceTableUrl = await tokenConfigUtil.getSourceTableUrl();
        if (!sourceTableUrl) {
          return { success: false, error: '获取源视频素材表格地址失败' };
        }

        // 确保飞书客户端已初始化
        const feishuConfig = await tokenConfigUtil.getFeishuConfig();
        if (!feishuConfig) {
          return { success: false, error: '获取飞书配置失败' };
        }

        // 解析表格 URL
        const urlObj = new URL(sourceTableUrl);
        const baseMatch = urlObj.pathname.match(/\/base\/([a-zA-Z0-9]+)/);
        if (!baseMatch) {
          return { success: false, error: '表格地址格式无效' };
        }
        const appToken = baseMatch[1];
        const tableId = urlObj.searchParams.get('table');
        if (!tableId) {
          return { success: false, error: '表格地址缺少 table 参数' };
        }

        const fields = await feishuBitableUtil.getTableFields(appToken, tableId);
        return { success: true, fields };
      } catch (error: any) {
        console.error('[Feishu] 获取视频表格字段失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取文案表格字段
    ipcMain.handle('feishu:get-text-fields', async () => {
      try {
        // 从 tokenConfig 获取仿写文案表格地址
        const rewriteTableUrl = await tokenConfigUtil.getRewriteTableUrl();
        if (!rewriteTableUrl) {
          return { success: false, error: '获取仿写文案表格地址失败' };
        }

        // 确保飞书客户端已初始化
        const feishuConfig = await tokenConfigUtil.getFeishuConfig();
        if (!feishuConfig) {
          return { success: false, error: '获取飞书配置失败' };
        }

        // 解析表格 URL
        const urlObj = new URL(rewriteTableUrl);
        const baseMatch = urlObj.pathname.match(/\/base\/([a-zA-Z0-9]+)/);
        if (!baseMatch) {
          return { success: false, error: '表格地址格式无效' };
        }
        const appToken = baseMatch[1];
        const tableId = urlObj.searchParams.get('table');
        if (!tableId) {
          return { success: false, error: '表格地址缺少 table 参数' };
        }

        const fields = await feishuBitableUtil.getTableFields(appToken, tableId);
        return { success: true, fields };
      } catch (error: any) {
        console.error('[Feishu] 获取文案表格字段失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 更新飞书配置（已废弃，配置从 tokenConfig 获取）
    ipcMain.handle('feishu:update-config', async () => {
      return { success: false, error: '此接口已废弃，飞书配置现在从服务端动态获取' };
    });

    // 获取飞书配置（已废弃，配置从 tokenConfig 获取）
    ipcMain.handle('feishu:get-config', async () => {
      try {
        const feishuConfig = await tokenConfigUtil.getFeishuConfig();
        return { success: true, config: feishuConfig };
      } catch (error: any) {
        console.error('[Feishu] 获取配置失败:', error);
        return { success: false, error: error.message };
      }
    });
  }

  // ==================== 微信扫码登录相关 ====================
  registerWechatAuthHandlers(): void {
    // 获取微信扫码登录二维码
    ipcMain.handle('wechat-auth:get-qrcode', async () => {
      try {
        const result = await wechatAuthUtil.getQrcodeLogin();
        return result;
      } catch (error: any) {
        console.error('[WechatAuth] 获取二维码失败:', error);
        return { code: -1, msg: error.message || '获取二维码失败', data: null };
      }
    });

    // 查询微信扫码登录状态
    ipcMain.handle('wechat-auth:check-status', async (_, state: string) => {
      try {
        const result = await wechatAuthUtil.checkQrcodeLoginStatus(state);
        return result;
      } catch (error: any) {
        console.error('[WechatAuth] 查询登录状态失败:', error);
        return { code: -1, msg: error.message || '查询登录状态失败', data: null };
      }
    });

    // 设置微信 API 基础 URL
    ipcMain.handle('wechat-auth:set-base-url', async (_, baseUrl: string) => {
      try {
        wechatAuthUtil.setBaseUrl(baseUrl);
        return { success: true };
      } catch (error: any) {
        console.error('[WechatAuth] 设置基础 URL 失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取微信 API 基础 URL
    ipcMain.handle('wechat-auth:get-base-url', async () => {
      return { baseUrl: wechatAuthUtil.getBaseUrl() };
    });
  }

  // ==================== QQ 扫码登录相关 ====================
  registerQQAuthHandlers(): void {
    // 获取QQ扫码登录二维码
    ipcMain.handle('qq-auth:get-qrcode', async () => {
      try {
        const result = await qqAuthUtil.getQrcodeLogin();
        return result;
      } catch (error: any) {
        console.error('[QqAuth] 获取二维码失败:', error);
        return { code: -1, msg: error.message || '获取二维码失败', data: null };
      }
    });

    // 查询QQ扫码登录状态
    ipcMain.handle('qq-auth:check-status', async (_, state: string) => {
      try {
        const result = await qqAuthUtil.checkQrcodeLoginStatus(state);
        return result;
      } catch (error: any) {
        console.error('[QqAuth] 查询登录状态失败:', error);
        return { code: -1, msg: error.message || '查询登录状态失败', data: null };
      }
    });

    // 设置QQ API 基础 URL
    ipcMain.handle('qq-auth:set-base-url', async (_, baseUrl: string) => {
      try {
        qqAuthUtil.setBaseUrl(baseUrl);
        return { success: true };
      } catch (error: any) {
        console.error('[QqAuth] 设置基础 URL 失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取QQ API 基础 URL
    ipcMain.handle('qq-auth:get-base-url', async () => {
      return { baseUrl: qqAuthUtil.getBaseUrl() };
    });
  }

  // ==================== HTTP 请求处理 ====================
  registerHttpHandlers(): void {
    const axios = require('axios');

    // GET 请求（通用）
    ipcMain.handle('http:get', async (_, url: string, params?: any, headers?: Record<string, string>) => {
      try {
        const fullUrl = this.externalHttpBaseUrl && !url.startsWith('http')
          ? `${this.externalHttpBaseUrl}${url}`
          : url;

        const response = await axios.get(fullUrl, {
          params,
          headers: { 'Content-Type': 'application/json', ...headers },
          timeout: 30000,
        });
        return response.data;
      } catch (error: any) {
        console.error('[HTTP] GET 请求失败:', error);
        return { code: -1, msg: error.message || '请求失败', data: null };
      }
    });

    // POST 请求（通用）
    ipcMain.handle('http:post', async (_, url: string, data?: any, headers?: Record<string, string>) => {
      try {
        const fullUrl = this.externalHttpBaseUrl && !url.startsWith('http')
          ? `${this.externalHttpBaseUrl}${url}`
          : url;

        const response = await axios.post(fullUrl, data, {
          headers: { 'Content-Type': 'application/json', ...headers },
          timeout: 30000,
        });
        return response.data;
      } catch (error: any) {
        console.error('[HTTP] POST 请求失败:', error);
        return { code: -1, msg: error.message || '请求失败', data: null };
      }
    });

    // PUT 请求
    ipcMain.handle('http:put', async (_, url: string, data?: any, headers?: Record<string, string>) => {
      try {
        const fullUrl = this.externalHttpBaseUrl && !url.startsWith('http')
          ? `${this.externalHttpBaseUrl}${url}`
          : url;

        const response = await axios.put(fullUrl, data, {
          headers: { 'Content-Type': 'application/json', ...headers },
          timeout: 30000,
        });
        return response.data;
      } catch (error: any) {
        console.error('[HTTP] PUT 请求失败:', error);
        return { code: -1, msg: error.message || '请求失败', data: null };
      }
    });

    // DELETE 请求
    ipcMain.handle('http:delete', async (_, url: string, data?: any, headers?: Record<string, string>) => {
      try {
        const fullUrl = this.externalHttpBaseUrl && !url.startsWith('http')
          ? `${this.externalHttpBaseUrl}${url}`
          : url;

        const response = await axios.delete(fullUrl, {
          data,
          headers: { 'Content-Type': 'application/json', ...headers },
          timeout: 30000,
        });
        return response.data;
      } catch (error: any) {
        console.error('[HTTP] DELETE 请求失败:', error);
        return { code: -1, msg: error.message || '请求失败', data: null };
      }
    });

    // 设置基础 URL
    ipcMain.handle('http:set-base-url', async (_, baseUrl: string) => {
      try {
        this.externalHttpBaseUrl = baseUrl;
        console.log('[HTTP] 外部 API 基础 URL 已设置为:', baseUrl);
        return { success: true };
      } catch (error: any) {
        console.error('[HTTP] 设置基础 URL 失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取基础 URL
    ipcMain.handle('http:get-base-url', async () => {
      return { baseUrl: this.externalHttpBaseUrl };
    });

    // 文件上传
    ipcMain.handle('http:upload-file', async (
      _,
      url: string,
      fileData: { base64: string; fileName: string; mimeType: string },
      formData?: Record<string, any>,
      headers?: Record<string, string>
    ) => {
      try {
        const fullUrl = this.externalHttpBaseUrl && !url.startsWith('http')
          ? `${this.externalHttpBaseUrl}${url}`
          : url;

        // 将 base64 转换为 Buffer
        const buffer = Buffer.from(fileData.base64, 'base64');

        // 创建 FormData（使用 Node.js 的 form-data 库）
        const FormData = require('form-data');
        const form = new FormData();

        // 添加文件
        form.append('file', buffer, {
          filename: fileData.fileName,
          contentType: fileData.mimeType,
        });

        // 添加额外的表单数据
        if (formData) {
          for (const [key, value] of Object.entries(formData)) {
            form.append(key, value);
          }
        }

        // 发送请求
        const response = await axios.post(fullUrl, form, {
          headers: {
            ...form.getHeaders(),
            ...headers,
          },
          timeout: 60000,
        });
        return response.data;
      } catch (error: any) {
        console.error('[HTTP] 文件上传失败:', error);
        return { code: -1, msg: error.message || '上传失败', data: null };
      }
    });
  }

  // ==================== 智能分割相关 ====================
  registerSmartSplitHandlers(): void {
    // 检查积分是否足够
    ipcMain.handle('smart-split:check-points', async (_, requiredPoints: number) => {
      try {
        const apiToken = this.db.getConfig('api_token');
        if (!apiToken) {
          return { sufficient: false, remaining: 0, error: '未配置 API Token' };
        }
        const hasEnough = await tokenApiUtil.hasEnoughPoints(apiToken, requiredPoints);
        const points = await tokenApiUtil.getRemainingPoints(apiToken);
        return { sufficient: hasEnough, remaining: points };
      } catch (error: any) {
        return { sufficient: false, remaining: 0, error: error.message };
      }
    });

    // 智能分割：预估积分
    ipcMain.handle('smart-split:estimate-points', async (_, videoDurationSeconds: number) => {
      try {
        const { calculateVideoAnalysisPoints } = await import('../pipeline/points');
        const estimatedPoints = await calculateVideoAnalysisPoints(videoDurationSeconds, 'scene_segmentation');
        return { success: true, estimatedPoints };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 智能分割：预扣除积分
    ipcMain.handle('smart-split:pre-deduct-points', async (_, points: number, videoId: number) => {
      try {
        const apiToken = this.db.getConfig('api_token');
        if (!apiToken) {
          return { success: false, error: '未配置 API Token' };
        }

        // 执行积分扣除
        const result = await tokenApiUtil.deductPointsAuto(
          apiToken,
          points,
          TaskType.VIDEO_ANALYSIS,
          String(videoId),
          TaskStatus.SUBMITTED
        );

        if (!result.success) {
          return { success: false, error: result.error || '积分扣除失败' };
        }

        console.log(`[SmartSplit] 预扣除积分成功: videoId=${videoId}, points=${points}, remaining=${result.remainingPoints}`);
        return { success: true, remainingPoints: result.remainingPoints };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 智能分割：查询已有分析结果
    ipcMain.handle('smart-split:get-analysis-results', async (_, videoId: number) => {
      try {
        const results = this.db.getMaterialVideoAnalysisResults(videoId);
        return { success: true, results };
      } catch (error: any) {
        return { success: false, results: [], error: error.message };
      }
    });

    // 智能分割：删除已有分析结果（重新分析前调用，软删除）
    ipcMain.handle('smart-split:delete-analysis-results', async (_, videoId: number) => {
      try {
        this.db.deleteMaterialVideoAnalysisResults(videoId);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 智能分割：标记分析结果为已迁移
    ipcMain.handle('smart-split:mark-migrated', async (_, resultId: number) => {
      try {
        this.db.updateAnalysisResultMigrated(resultId);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 智能分割：AI 分析视频返回时间片段
    ipcMain.handle('smart-split:analyze', async (_, videoPath: string, options?: any) => {
      try {
        // 如果已有 OSS object name，传给分析工具跳过上传
        const analyzeOptions: any = { ...options };
        if (options?.videoId) {
          const video = this.db.getMaterialVideo(options.videoId);
          if (video?.oss_object_name) {
            analyzeOptions.ossObjectName = video.oss_object_name;
            console.log(`[SmartSplit] 视频已上传 OSS，跳过上传: ${video.oss_object_name}`);
          }
        }

        const result = await videoAnalysisUtil.analyzeVideoSegments(videoPath, analyzeOptions);

        // 分析成功后，如果有 videoId 且上传了 OSS，保存 oss_object_name 到数据库
        if (result.success && result.ossObjectName && options?.videoId) {
          try {
            this.db.updateMaterialVideoOssInfo(options.videoId, result.ossObjectName);
            console.log(`[SmartSplit] 已保存 OSS 信息到 material_video id=${options.videoId}, objectName=${result.ossObjectName}`);
          } catch (dbError: any) {
            console.error('[SmartSplit] 保存 OSS 信息失败:', dbError.message);
          }
        }

        // 分析成功后，将分析结果保存到 material_video_analysis_result 表
        if (result.success && result.segments && result.segments.length > 0 && options?.videoId) {
          try {
            const ids = this.db.addMaterialVideoAnalysisResults(options.videoId, result.segments);
            console.log(`[SmartSplit] 已保存 ${ids.length} 条分析结果到 material_video_analysis_result, videoId=${options.videoId}`);
          } catch (dbError: any) {
            console.error('[SmartSplit] 保存分析结果失败:', dbError.message);
          }
        }

        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 智能分割：执行 FFmpeg 切割
    ipcMain.handle('smart-split:execute', async (_, videoPath: string, segments: Array<{ startTime: number; endTime: number; id?: number }>, options?: { videoId?: number }) => {
      try {
        const outputFiles: string[] = [];
        for (const seg of segments) {
          const duration = seg.endTime - seg.startTime;
          if (duration <= 0) continue;
          // ffmpeg.cutVideo startTime 单位为秒
          const outputPath = await ffmpeg.cutVideo(videoPath, seg.startTime, duration, undefined, true);
          if (outputPath) {
            outputFiles.push(outputPath);

            // 更新分析结果记录中的本地文件路径（优先按 ID，回退按时间匹配）
            if (options?.videoId) {
              try {
                let recordId: number | undefined;
                // 优先使用前端传入的 DB 记录 ID
                if (seg.id) {
                  recordId = seg.id;
                } else {
                  // 回退：按时间范围匹配（DB 中存储的是毫秒）
                  const startMs = Math.round(seg.startTime * 1000);
                  const endMs = Math.round(seg.endTime * 1000);
                  const record = this.db.getAnalysisResultBySegment(options.videoId, startMs, endMs);
                  if (record) {
                    recordId = record.id;
                  }
                }
                if (recordId) {
                  this.db.updateAnalysisResultFilePath(recordId, outputPath);
                }
              } catch (dbError: any) {
                console.error('[SmartSplit] 更新分割结果文件路径失败:', dbError.message);
              }
            }
          }
        }
        return { success: true, outputFiles };
      } catch (error: any) {
        return { success: false, outputFiles: [], error: error.message };
      }
    });

    // 智能分割：归类存储（预留钩子）
    ipcMain.handle('smart-split:classify', async (_, _params: any) => {
      // TODO: 归类逻辑后续补充
      return { success: true, message: '归类功能待实现' };
    });

    // 智能分割：异步提交 Batch 分析任务（含积分预扣除）
    ipcMain.handle('smart-split:analyze-async', async (_, videoPath: string, options?: any) => {
      try {
        const analyzeOptions: any = { ...options };
        if (options?.videoId) {
          const video = this.db.getMaterialVideo(options.videoId);
          if (video?.oss_object_name) {
            analyzeOptions.ossObjectName = video.oss_object_name;
            console.log(`[SmartSplit] 视频已上传 OSS，跳过上传: ${video.oss_object_name}`);
          }
        }

        const result = await videoAnalysisUtil.analyzeVideoSegmentsAsync(videoPath, analyzeOptions);

        // 保存 OSS object name
        if (result.success && result.ossObjectName && options?.videoId) {
          try {
            this.db.updateMaterialVideoOssInfo(options.videoId, result.ossObjectName);
            console.log(`[SmartSplit] 已保存 OSS 信息, videoId=${options.videoId}`);
          } catch (dbError: any) {
            console.error('[SmartSplit] 保存 OSS 信息失败:', dbError.message);
          }
        }

        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 智能分割：查询异步 Batch 任务结果（含积分结算）
    ipcMain.handle('smart-split:check-batch-result', async (_, batchId: string, videoId?: number, preDeductedPoints?: number) => {
      try {
        const result = await videoAnalysisUtil.checkVideoSegmentsBatchResult(batchId);

        // 如果已完成，保存分析结果到数据库，并执行积分结算
        if (result.status === 'completed' && result.segments && result.segments.length > 0 && videoId) {
          try {
            // 先删除旧结果
            this.db.deleteMaterialVideoAnalysisResults(videoId);
            // 保存新结果
            const ids = this.db.addMaterialVideoAnalysisResults(videoId, result.segments);
            console.log(`[SmartSplit] 异步分析完成，已保存 ${ids.length} 条结果, videoId=${videoId}`);

            // 执行积分结算（如果有预扣除积分和 token 使用量信息）
            if (preDeductedPoints && preDeductedPoints > 0 && result.usage) {
              try {
                const { calculatePointsSettlement } = await import('../pipeline/points');
                const settlement = await calculatePointsSettlement(
                  preDeductedPoints,
                  result.usage.promptTokens,
                  result.usage.completionTokens
                );

                console.log(`[SmartSplit] 积分结算: 预扣=${settlement.preDeductedPoints}, 实际=${settlement.actualPoints}, 差额=${settlement.difference}, 类型=${settlement.settlementType}`);

                // 如果需要补扣或退还积分
                if (settlement.settlementType !== 'exact' && Math.abs(settlement.difference) >= 0.5) {
                  const apiToken = this.db.getConfig('api_token');
                  if (apiToken) {
                    if (settlement.settlementType === 'charge') {
                      // 需要补扣积分
                      const chargeResult = await tokenApiUtil.deductPointsAuto(
                        apiToken,
                        Math.abs(settlement.difference),
                        TaskType.VIDEO_ANALYSIS,
                        String(videoId),
                        TaskStatus.SUCCESS
                      );
                      if (chargeResult.success) {
                        console.log(`[SmartSplit] 补扣积分成功: ${Math.abs(settlement.difference)}`);
                      } else {
                        console.error(`[SmartSplit] 补扣积分失败: ${chargeResult.error}`);
                      }
                    } else if (settlement.settlementType === 'refund') {
                      // 需要退还积分（通过传入负数实现）
                      // 注意：这里假设 deductPointsAuto 支持负数退款，如果不支持需要调用专门的退款接口
                      console.log(`[SmartSplit] 需要退还积分: ${Math.abs(settlement.difference)}（暂不支持自动退款，请手动处理）`);
                      // TODO: 实现积分退还逻辑
                    }
                  }
                }

                // 将结算信息附加到返回结果中
                (result as any).settlement = settlement;
              } catch (settlementError: any) {
                console.error('[SmartSplit] 积分结算失败:', settlementError.message);
              }
            }
          } catch (dbError: any) {
            console.error('[SmartSplit] 保存异步分析结果失败:', dbError.message);
          }
        }

        return result;
      } catch (error: any) {
        return { status: 'unknown', error: error.message };
      }
    });
  }

  // ==================== 客户端信息相关 ====================
  registerClientInfoHandlers(): void {
    // 获取微信二维码地址
    ipcMain.handle('client-info:get-qrcode', async () => {
      try {
        const qrcodeUrl = await clientInfoUtil.getQrcode();
        if (qrcodeUrl) {
          return { success: true, qrcodeUrl };
        }
        return { success: false, error: '获取二维码地址失败' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // 异步下载图片转 base64，完成后通过事件推送
    ipcMain.handle('client-info:download-qrcode-base64', async (event, imageUrl: string) => {
      try {
        const base64 = await clientInfoUtil.downloadImageAsBase64(imageUrl);
        if (base64) {
          event.sender.send('client-info:qrcode-base64-ready', { imageUrl, base64 });
        }
      } catch (error: any) {
        console.error('[ClientInfo] 下载二维码 base64 失败:', error.message);
      }
    });
  }
}
