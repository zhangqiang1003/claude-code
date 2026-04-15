/**
 * FFmpeg 视频处理模块
 * 提供视频分割、提取音频、静音处理等功能
 */

import { spawn, ChildProcess } from 'child_process';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import { existsSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { app } from 'electron';

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
  size: number;
}

export interface AudioInfo {
  duration: number;
  formatName: string;
  codecName: string;
  sampleRate: number;
  channels: number;
}

export interface SplitResult {
  success: boolean;
  segments: string[];
  error?: string;
}

/**
 * 获取 FFmpeg 可执行文件路径
 * 打包后使用 extraResources 中的文件， * 开发环境使用 node_modules 中的文件
 */
function getFFmpegBinaryPath(): string {
  // 开发环境使用 @ffmpeg-installer 提供的路径
  const devPath = ffmpegPath;

  // 检查是否在打包环境中
  if (app && app.isPackaged) {
    // 打包后，使用 extraResources 中的文件
    const packagedPath = join(process.resourcesPath!, 'bin', 'ffmpeg.exe');
    if (existsSync(packagedPath)) {
      return packagedPath;
    }
    console.warn('[FFmpeg] 打包环境中的 ffmpeg.exe 不存在，回退到开发路径');
  }

  return devPath;
}

/**
 * 获取 FFprobe 可执行文件路径
 */
function getFFprobeBinaryPath(): string {
  // 开发环境使用 @ffprobe-installer 提供的路径
  const devPath = ffprobePath;

  // 检查是否在打包环境中
  if (app && app.isPackaged) {
    // 打包后，使用 extraResources 中的文件
    const packagedPath = join(process.resourcesPath!, 'bin', 'ffprobe.exe');
    if (existsSync(packagedPath)) {
      return packagedPath;
    }
    console.warn('[FFmpeg] 打包环境中的 ffprobe.exe 不存在，回退到开发路径');
  }

  return devPath;
}

export class FFmpeg {
  private ffmpegPath: string;
  private ffprobePath: string;

  constructor(customPath?: string) {
    // 使用新的路径获取逻辑
    this.ffmpegPath = customPath || getFFmpegBinaryPath();
    this.ffprobePath = getFFprobeBinaryPath();

    console.log('[FFmpeg] FFmpeg 路径:', this.ffmpegPath);
    console.log('[FFmpeg] FFprobe 路径:', this.ffprobePath);

    if (!existsSync(this.ffmpegPath)) {
      console.warn('[FFmpeg] FFmpeg 路径不存在:', this.ffmpegPath);
    }
    if (!existsSync(this.ffprobePath)) {
      console.warn('[FFmpeg] FFprobe 路径不存在:', this.ffprobePath);
    }
  }

  /**
   * 执行 FFmpeg 命令
   */
  private execFFmpeg(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      console.log('[FFmpeg] Executing FFmpeg:', this.ffmpegPath, args.join(' '));
      const process = spawn(this.ffmpegPath, args);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr });
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * 执行 FFprobe 命令
   */
  private execFFprobe(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      console.log('[FFmpeg] Executing FFprobe:', this.ffprobePath, args.join(' '));
      const process = spawn(this.ffprobePath, args);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        console.log('[FFmpeg] FFprobe exit code:', code, 'stdout length:', stdout.length, 'stderr length:', stderr.length);
        resolve({ code: code || 0, stdout, stderr });
      });

      process.on('error', (err) => {
        console.error('[FFmpeg] FFprobe spawn error:', err);
        reject(err);
      });
    });
  }

  /**
   * 获取视频信息
   */
  async getVideoInfo(filePath: string): Promise<VideoInfo> {
    // Check if file exists first
    if (!existsSync(filePath)) {
      throw new Error('Video file does not exist: ' + filePath);
    }

    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    console.log('[FFmpeg] Getting video info for:', filePath);
    const { stdout, stderr } = await this.execFFprobe(args);

    if (!stdout || stdout.trim() === '') {
      console.error('[FFmpeg] FFprobe returned empty stdout. stderr:', stderr);
      throw new Error('FFprobe returned empty output. stderr: ' + stderr);
    }

    let info: any;
    try {
      info = JSON.parse(stdout);
    } catch (parseError) {
      console.error('[FFmpeg] Failed to parse FFprobe JSON. stdout sample:', stdout.substring(0, 500));
      throw new Error('Failed to parse FFprobe output: ' + parseError);
    }

    if (!info.format) {
      console.error('[FFmpeg] FFprobe output missing format. Full output:', JSON.stringify(info, null, 2).substring(0, 1000));

      // Try alternative approach: get info from streams
      if (info.streams && info.streams.length > 0) {
        const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
        if (videoStream && videoStream.duration) {
          console.log('[FFmpeg] Using stream duration as fallback');
          return {
            duration: parseFloat(videoStream.duration) || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            fps: this.parseFps(videoStream.r_frame_rate),
            bitrate: 0,
            codec: videoStream.codec_name || 'unknown',
            size: statSync(filePath).size,
          };
        }
      }

      throw new Error('FFprobe output missing format info');
    }

    const videoStream = info.streams?.find((s: any) => s.codec_type === 'video');
    const format = info.format;

    return {
      duration: parseFloat(format.duration) || 0,
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      fps: this.parseFps(videoStream?.r_frame_rate),
      bitrate: parseInt(format.bit_rate) || 0,
      codec: videoStream?.codec_name || 'unknown',
      size: parseInt(format.size) || statSync(filePath).size,
    };
  }

  /**
   * 获取音频文件信息（时长、格式、编码等）
   * 使用 FFprobe 检测音频的实际格式，而非仅依赖文件扩展名
   */
  async getAudioInfo(filePath: string): Promise<AudioInfo> {
    if (!existsSync(filePath)) {
      throw new Error('音频文件不存在: ' + filePath);
    }

    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const { stdout } = await this.execFFprobe(args);

    if (!stdout || stdout.trim() === '') {
      throw new Error('FFprobe 无法识别该文件');
    }

    let info: any;
    try {
      info = JSON.parse(stdout);
    } catch {
      throw new Error('无法解析音频文件信息');
    }

    if (!info.format && (!info.streams || info.streams.length === 0)) {
      throw new Error('无法获取音频文件信息');
    }

    const audioStream = info.streams?.find((s: any) => s.codec_type === 'audio');
    if (!audioStream) {
      throw new Error('该文件不包含音频轨道');
    }

    const format = info.format || {};
    const duration = parseFloat(audioStream.duration || format.duration) || 0;

    return {
      duration,
      formatName: format.format_name || 'unknown',
      codecName: audioStream.codec_name || 'unknown',
      sampleRate: parseInt(audioStream.sample_rate) || 0,
      channels: parseInt(audioStream.channels) || 0,
    };
  }

  /**
   * 解析帧率
   */
  private parseFps(fpsStr?: string): number {
    if (!fpsStr) return 0;
    const [num, den] = fpsStr.split('/');
    if (den && parseInt(den) !== 0) {
      return parseInt(num) / parseInt(den);
    }
    return parseInt(num) || 0;
  }

  /**
   * 提取视频中的音频
   * @param videoPath 视频文件路径
   * @param outputPath 输出音频路径（可选）
   * @param format 音频格式（默认 mp3）
   */
  async extractAudio(
    videoPath: string,
    outputPath?: string,
    format: string = 'mp3'
  ): Promise<string> {
    if (!outputPath) {
      const baseName = basename(videoPath, extname(videoPath));
      outputPath = join(dirname(videoPath), `${baseName}.${format}`);
    }

    const args = [
      '-i', videoPath,
      '-vn', // 不包含视频
      '-acodec', format === 'mp3' ? 'libmp3lame' : 'copy',
      '-y', // 覆盖已存在的文件
      outputPath
    ];

    const { code, stderr } = await this.execFFmpeg(args);

    if (code !== 0) {
      throw new Error(`提取音频失败: ${stderr}`);
    }

    return outputPath;
  }

  /**
   * 视频静音处理
   * @param videoPath 视频文件路径
   * @param outputPath 输出文件路径（可选）
   */
  async muteVideo(videoPath: string, outputPath?: string): Promise<string> {
    if (!outputPath) {
      const baseName = basename(videoPath, extname(videoPath));
      const ext = extname(videoPath);
      outputPath = join(dirname(videoPath), `${baseName}_muted${ext}`);
    }

    const args = [
      '-i', videoPath,
      '-c', 'copy', // 复制视频流
      '-an', // 移除音频流
      '-y',
      outputPath
    ];

    const { code, stderr } = await this.execFFmpeg(args);

    if (code !== 0) {
      throw new Error(`静音处理失败: ${stderr}`);
    }

    return outputPath;
  }

  /**
   * 精准截取视频片段
   * @param videoPath 视频文件路径
   * @param startTime 开始时间（秒）
   * @param duration 持续时间（秒）
   * @param outputPath 输出文件路径（可选）
   * @param reencode 是否重新编码（默认 false，使用流复制；智能分割时建议 true 以避免黑屏）
   */
  async cutVideo(
    videoPath: string,
    startTime: number,
    duration: number,
    outputPath?: string,
    reencode: boolean = false
  ): Promise<string> {
    if (!outputPath) {
      const baseName = basename(videoPath, extname(videoPath));
      const ext = extname(videoPath);
      outputPath = join(dirname(videoPath), `${baseName}_cut_${startTime}_${duration}${ext}`);
    }

    const args = reencode
      ? [
          '-ss', startTime.toString(),
          '-i', videoPath,
          '-t', duration.toString(),
          '-c:v', 'libx264',
          '-crf', '23',
          '-preset', 'fast',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          '-y',
          outputPath
        ]
      : [
          '-ss', startTime.toString(),
          '-i', videoPath,
          '-t', duration.toString(),
          '-c', 'copy', // 快速复制，不重新编码
          '-y',
          outputPath
        ];

    const { code, stderr } = await this.execFFmpeg(args);

    if (code !== 0) {
      throw new Error(`截取视频失败: ${stderr}`);
    }

    return outputPath;
  }

  /**
   * 视频分割（按时间间隔）
   * @param videoPath 视频文件路径
   * @param segmentDuration 每段时长（秒）
   * @param outputDir 输出目录（可选）
   */
  async splitVideoByDuration(
    videoPath: string,
    segmentDuration: number,
    outputDir?: string
  ): Promise<SplitResult> {
    const baseName = basename(videoPath, extname(videoPath));
    const ext = extname(videoPath);
    const dir = outputDir || dirname(videoPath);

    const outputPattern = join(dir, `${baseName}_%03d${ext}`);

    const args = [
      '-i', videoPath,
      '-c', 'copy',
      '-map', '0',
      '-segment_time', segmentDuration.toString(),
      '-f', 'segment',
      '-reset_timestamps', '1',
      '-y',
      outputPattern
    ];

    const { code, stderr } = await this.execFFmpeg(args);

    if (code !== 0) {
      return { success: false, segments: [], error: stderr };
    }

    // 返回生成的分段文件列表
    const segments: string[] = [];
    let i = 0;
    while (true) {
      const segmentPath = join(dir, `${baseName}_${String(i).padStart(3, '0')}${ext}`);
      if (existsSync(segmentPath)) {
        segments.push(segmentPath);
        i++;
      } else {
        break;
      }
    }

    return { success: true, segments };
  }

  /**
   * Detect scene change timestamps using showinfo filter output
   * Use FFmpeg select filter to detect scene changes
   */
  private async detectSceneChanges(
    videoPath: string,
    threshold: number
  ): Promise<number[]> {
    // Method 1: Use select filter with showinfo
    const args = [
      '-i', videoPath,
      '-vf', `select='gt(scene,${threshold})',showinfo`,
      '-f', 'null',
      '-'
    ];

    const { stderr } = await this.execFFmpeg(args);

    // Parse timestamps from stderr
    // showinfo output format: n:123 pts:456 pts_time:1.234 ...
    const timestamps: number[] = [0]; // Start from 0
    const regex = /pts_time:(\d+\.?\d*)/g;
    let match;

    while ((match = regex.exec(stderr)) !== null) {
      const time = parseFloat(match[1]);
      if (time > 0 && !timestamps.includes(time)) {
        timestamps.push(time);
      }
    }

    console.log('[FFmpeg] Scene detection stderr sample:', stderr.substring(0, 500));
    console.log('[FFmpeg] Found timestamps from showinfo:', timestamps);

    // If showinfo method didn't find any timestamps, try alternative method
    if (timestamps.length <= 1) {
      console.log('[FFmpeg] showinfo method found no scene changes, trying alternative method');
      return this.detectSceneChangesAlternative(videoPath, threshold);
    }

    return timestamps;
  }

  /**
   * Alternative scene detection using signalstats and metadata
   */
  private async detectSceneChangesAlternative(
    videoPath: string,
    threshold: number
  ): Promise<number[]> {
    // Use a different approach: detect scene changes using signalstats
    // and print timing info
    const args = [
      '-i', videoPath,
      '-vf', `signalstats,metadata=print:file=-`,
      '-f', 'null',
      '-'
    ];

    try {
      const { stdout, stderr } = await this.execFFmpeg(args);
      const output = stdout + stderr;

      console.log('[FFmpeg] Alternative method output sample:', output.substring(0, 500));

      // Try to find scene change markers in the output
      const timestamps: number[] = [0];

      // Look for pts_time in the output
      const timeRegex = /pts_time[:\s]+(\d+\.?\d*)/g;
      let match;

      while ((match = timeRegex.exec(output)) !== null) {
        const time = parseFloat(match[1]);
        if (time > 0 && !timestamps.includes(time)) {
          timestamps.push(time);
        }
      }

      console.log('[FFmpeg] Alternative method found timestamps:', timestamps);
      return timestamps;
    } catch (error) {
      console.error('[FFmpeg] Alternative scene detection failed:', error);
      return [0];
    }
  }

  /**
   * Detect keyframe timestamps using FFprobe
   * This is a reliable fallback when scene detection doesn't work
   */
  private async detectKeyframeTimestamps(videoPath: string): Promise<number[]> {
    const args = [
      '-v', 'quiet',
      '-select_streams', 'v:0',
      '-show_entries', 'packet=pts_time,flags',
      '-of', 'json',
      videoPath
    ];

    try {
      const { stdout } = await this.execFFprobe(args);

      if (!stdout || stdout.trim() === '') {
        console.log('[FFmpeg] No keyframe output from FFprobe');
        return [0];
      }

      const data = JSON.parse(stdout);
      const packets = data.packets || [];

      // Find packets with K flag (keyframe)
      const timestamps: number[] = [0];

      for (const packet of packets) {
        if (packet.flags && packet.flags.includes('K') && packet.pts_time !== undefined) {
          const time = parseFloat(packet.pts_time);
          if (time > 0 && !timestamps.includes(time)) {
            timestamps.push(time);
          }
        }
      }

      // Sort timestamps
      timestamps.sort((a, b) => a - b);

      console.log('[FFmpeg] Found keyframe timestamps:', timestamps.length, 'keyframes');
      return timestamps;
    } catch (error) {
      console.error('[FFmpeg] Keyframe detection failed:', error);
      return [0];
    }
  }

  /**
   * Get video duration directly using FFprobe (more reliable)
   */
  private async getVideoDurationDirect(videoPath: string): Promise<number> {
    // Method 1: Use FFprobe with format duration
    let args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ];

    try {
      const { stdout, stderr } = await this.execFFprobe(args);
      console.log('[FFmpeg] Direct duration stdout:', stdout.trim(), 'stderr:', stderr.trim());
      const duration = parseFloat(stdout.trim());
      if (!isNaN(duration) && duration > 0) {
        return duration;
      }
    } catch (error) {
      console.error('[FFmpeg] Direct duration check failed:', error);
    }

    // Method 2: Use FFprobe with stream duration
    args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ];

    try {
      const { stdout, stderr } = await this.execFFprobe(args);
      console.log('[FFmpeg] Stream duration stdout:', stdout.trim(), 'stderr:', stderr.trim());
      const duration = parseFloat(stdout.trim());
      if (!isNaN(duration) && duration > 0) {
        return duration;
      }
    } catch (error) {
      console.error('[FFmpeg] Stream duration check failed:', error);
    }

    // Method 3: Use FFmpeg to get duration (parse from stderr)
    const ffmpegArgs = [
      '-i', videoPath,
      '-f', 'null',
      '-'
    ];

    try {
      const { stderr } = await this.execFFmpeg(ffmpegArgs);
      // Parse duration from FFmpeg output like "Duration: 00:01:23.45"
      const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseInt(durationMatch[3]);
        const centiseconds = parseInt(durationMatch[4]);
        const duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
        console.log('[FFmpeg] Got duration from FFmpeg stderr:', duration);
        return duration;
      }
    } catch (error) {
      console.error('[FFmpeg] FFmpeg duration check failed:', error);
    }

    return 0;
  }

  /**
   * Split video by scene detection
   * Automatically split video using scene change detection
   */
  async splitVideoByScene(
    videoPath: string,
    threshold: number = 0.3,
    outputDir?: string
  ): Promise<SplitResult> {
    const baseName = basename(videoPath, extname(videoPath));
    const ext = extname(videoPath);
    const dir = outputDir || dirname(videoPath);

    try {
      // Get video total duration first - try multiple methods
      let totalDuration = 0;

      // Method 1: Try getVideoInfo
      try {
        const videoInfo = await this.getVideoInfo(videoPath);
        if (videoInfo && videoInfo.duration) {
          totalDuration = videoInfo.duration;
          console.log('[FFmpeg] Got duration from getVideoInfo:', totalDuration);
        }
      } catch (infoError: any) {
        console.warn('[FFmpeg] getVideoInfo failed:', infoError?.message || infoError);
      }

      // Method 2: Try direct duration query if first method failed
      if (!totalDuration) {
        console.log('[FFmpeg] Trying direct duration query...');
        totalDuration = await this.getVideoDurationDirect(videoPath);
        if (totalDuration) {
          console.log('[FFmpeg] Got duration from direct query:', totalDuration);
        }
      }

      // If still no duration, use fallback
      if (!totalDuration) {
        console.warn('[FFmpeg] Could not get video duration, using fallback');
        return this.splitVideoByDuration(videoPath, 10, outputDir);
      }

      // Step 1: Detect scene change timestamps
      console.log('[FFmpeg] Detecting scene changes, threshold:', threshold);
      const timestamps = await this.detectSceneChanges(videoPath, threshold);

      console.log('[FFmpeg] Detected', timestamps.length - 1, 'scene change points');

      // If no scene changes detected, try keyframe detection
      if (timestamps.length <= 1) {
        console.log('[FFmpeg] No scene changes detected, trying keyframe detection...');
        const keyframeTimestamps = await this.detectKeyframeTimestamps(videoPath);

        if (keyframeTimestamps.length > 1) {
          console.log('[FFmpeg] Using', keyframeTimestamps.length - 1, 'keyframes for splitting');

          // Split at keyframes
          const segments: string[] = [];
          const segmentTimestamps = [...keyframeTimestamps, totalDuration];

          for (let i = 0; i < segmentTimestamps.length - 1; i++) {
            const startTime = segmentTimestamps[i];
            const endTime = segmentTimestamps[i + 1];
            const duration = endTime - startTime;

            // Skip segments that are too short (less than 1s for keyframe splits)
            if (duration < 1) {
              continue;
            }

            const segmentPath = join(dir, `${baseName}_scene_${String(segments.length + 1).padStart(3, '0')}${ext}`);
            const args = [
              '-ss', startTime.toString(),
              '-i', videoPath,
              '-t', duration.toString(),
              '-c', 'copy',
              '-y',
              segmentPath
            ];

            const { code, stderr } = await this.execFFmpeg(args);

            if (code === 0 && existsSync(segmentPath)) {
              segments.push(segmentPath);
              console.log('[FFmpeg] Generated keyframe segment', segments.length, ':', startTime.toFixed(2) + 's - ' + endTime.toFixed(2) + 's');
            } else {
              console.warn('[FFmpeg] Keyframe segment generation failed:', stderr.slice(0, 200));
            }
          }

          if (segments.length > 0) {
            console.log('[FFmpeg] Keyframe split complete, generated', segments.length, 'segments');
            return { success: true, segments };
          }
        }

        console.log('[FFmpeg] No valid split points found, using fixed duration split');
        return this.splitVideoByDuration(videoPath, 10, outputDir);
      }

      // Step 2: Split video at detected timestamps
      const segments: string[] = [];
      const segmentTimestamps = [...timestamps, totalDuration];

      for (let i = 0; i < segmentTimestamps.length - 1; i++) {
        const startTime = segmentTimestamps[i];
        const endTime = segmentTimestamps[i + 1];
        const duration = endTime - startTime;

        // Skip segments that are too short (less than 0.5s)
        if (duration < 0.5) {
          continue;
        }

        const segmentPath = join(dir, `${baseName}_scene_${String(i + 1).padStart(3, '0')}${ext}`);
        const args = [
          '-ss', startTime.toString(),
          '-i', videoPath,
          '-t', duration.toString(),
          '-c', 'copy', // Use stream copy for speed
          '-y',
          segmentPath
        ];

        const { code, stderr } = await this.execFFmpeg(args);

        if (code === 0 && existsSync(segmentPath)) {
          segments.push(segmentPath);
          console.log('[FFmpeg] Generated segment', i + 1, ':', startTime.toFixed(2) + 's - ' + endTime.toFixed(2) + 's');
        } else {
          console.warn('[FFmpeg] Segment', i + 1, 'generation failed:', stderr.slice(0, 200));
        }
      }

      if (segments.length === 0) {
        console.log('[FFmpeg] No segments generated, using fixed duration split');
        return this.splitVideoByDuration(videoPath, 10, outputDir);
      }

      console.log('[FFmpeg] Scene split complete, generated', segments.length, 'segments');
      return { success: true, segments };
    } catch (error: any) {
      console.error('[FFmpeg] Scene split failed:', error);
      // On failure, use fixed duration split as fallback
      return this.splitVideoByDuration(videoPath, 10, outputDir);
    }
  }

  /**
   * Fallback method for scene detection (fixed duration split)
   */
  private async splitVideoBySceneFallback(
    videoPath: string,
    _threshold: number,
    outputDir?: string
  ): Promise<SplitResult> {
    // Use fixed duration split as fallback
    return this.splitVideoByDuration(videoPath, 10, outputDir);
  }

  /**
   * 生成视频缩略图
   * @param videoPath 视频文件路径
   * @param timePoint 时间点（秒，默认中间位置）
   * @param outputPath 输出路径（可选）
   */
  async generateThumbnail(
    videoPath: string,
    timePoint?: number,
    outputPath?: string
  ): Promise<string> {
    const baseName = basename(videoPath, extname(videoPath));

    if (!outputPath) {
      outputPath = join(dirname(videoPath), `${baseName}_thumb.jpg`);
    }

    // 如果没有指定时间点，获取视频中间帧
    if (timePoint === undefined) {
      const info = await this.getVideoInfo(videoPath);
      timePoint = info.duration / 2;
    }

    const args = [
      '-ss', timePoint.toString(),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      outputPath
    ];

    const { code, stderr } = await this.execFFmpeg(args);

    if (code !== 0) {
      throw new Error(`生成缩略图失败: ${stderr}`);
    }

    return outputPath;
  }

  /**
   * 从视频中提取帧图片
   * @param videoPath 视频文件路径
   * @param options 提取选项
   * @returns 帧图片路径列表
   */
  async extractFrames(
    videoPath: string,
    options: {
      /** 提取间隔（秒），默认1秒 */
      interval?: number;
      /** 开始时间（秒），默认0 */
      startTime?: number;
      /** 结束时间（秒），默认视频结束 */
      endTime?: number;
      /** 输出目录（可选，默认视频所在目录） */
      outputDir?: string;
      /** 图片格式（默认jpg） */
      format?: 'jpg' | 'png';
      /** 图片宽度（可选） */
      width?: number;
      /** 图片高度（可选） */
      height?: number;
      /** 最大帧数（可选，0表示不限制） */
      maxFrames?: number;
    } = {}
  ): Promise<string[]> {
    const {
      interval = 1,
      startTime = 0,
      outputDir,
      format = 'jpg',
      width,
      height,
      maxFrames = 0,
    } = options;

    const baseName = basename(videoPath, extname(videoPath));
    const dir = outputDir || dirname(videoPath);
    const outputPattern = join(dir, `${baseName}_frame_%04d.${format}`);

    // 获取视频信息
    const videoInfo = await this.getVideoInfo(videoPath);
    const endTime = options.endTime || videoInfo.duration;

    // 构建缩放过滤器
    let scaleFilter = '';
    if (width && height) {
      scaleFilter = `scale=${width}:${height},`;
    } else if (width) {
      scaleFilter = `scale=${width}:-1,`;
    } else if (height) {
      scaleFilter = `scale=-1:${height},`;
    }

    // 构建 FPS 过滤器（按间隔提取帧）
    const fps = 1 / interval;
    const vfFilter = `${scaleFilter}fps=${fps}`;

    const args: string[] = [
      '-ss', startTime.toString(),
      '-i', videoPath,
      '-vf', vfFilter,
    ];

    // 如果指定了结束时间
    if (endTime < videoInfo.duration) {
      args.push('-t', (endTime - startTime).toString());
    }

    // 如果限制了最大帧数
    if (maxFrames > 0) {
      args.push('-vframes', maxFrames.toString());
    }

    // 图片质量设置
    if (format === 'jpg') {
      args.push('-q:v', '2'); // 高质量 JPEG
    }

    args.push('-y', outputPattern);

    const { code, stderr } = await this.execFFmpeg(args);

    if (code !== 0) {
      throw new Error(`提取视频帧失败: ${stderr}`);
    }

    // 收集生成的帧图片
    const frames: string[] = [];
    let i = 1;
    while (true) {
      const framePath = join(dir, `${baseName}_frame_${String(i).padStart(4, '0')}.${format}`);
      if (existsSync(framePath)) {
        frames.push(framePath);
        i++;
      } else {
        break;
      }
    }

    return frames;
  }

  /**
   * 从视频中提取关键帧（场景变化帧）
   * @param videoPath 视频文件路径
   * @param options 提取选项
   * @returns 关键帧图片路径列表
   */
  async extractKeyframes(
    videoPath: string,
    options: {
      /** 场景变化阈值（0-1，默认0.3） */
      threshold?: number;
      /** 最小帧间隔（秒，默认0.5） */
      minInterval?: number;
      /** 输出目录（可选） */
      outputDir?: string;
      /** 图片格式（默认jpg） */
      format?: 'jpg' | 'png';
      /** 最大帧数（可选） */
      maxFrames?: number;
    } = {}
  ): Promise<string[]> {
    const {
      threshold = 0.3,
      minInterval = 0.5,
      outputDir,
      format = 'jpg',
      maxFrames = 0,
    } = options;

    const baseName = basename(videoPath, extname(videoPath));
    const dir = outputDir || dirname(videoPath);
    const outputPattern = join(dir, `${baseName}_keyframe_%04d.${format}`);

    // 使用 select 过滤器提取场景变化帧
    const args: string[] = [
      '-i', videoPath,
      '-vf', `select='gt(scene,${threshold})',fps=1/${minInterval}`,
    ];

    if (maxFrames > 0) {
      args.push('-vframes', maxFrames.toString());
    }

    if (format === 'jpg') {
      args.push('-q:v', '2');
    }

    args.push('-vsync', 'vfr', '-y', outputPattern);

    try {
      const { code, stderr } = await this.execFFmpeg(args);

      if (code !== 0) {
        // 如果场景检测失败，使用固定间隔提取
        return this.extractFrames(videoPath, {
          interval: minInterval,
          outputDir,
          format,
          maxFrames: maxFrames || undefined,
        });
      }

      // 收集生成的关键帧图片
      const frames: string[] = [];
      let i = 1;
      while (true) {
        const framePath = join(dir, `${baseName}_keyframe_${String(i).padStart(4, '0')}.${format}`);
        if (existsSync(framePath)) {
          frames.push(framePath);
          i++;
        } else {
          break;
        }
      }

      return frames;
    } catch (error) {
      // 备用方案：使用固定间隔提取
      return this.extractFrames(videoPath, {
        interval: minInterval,
        outputDir,
        format,
        maxFrames: maxFrames || undefined,
      });
    }
  }

  /**
   * 视频转码
   * @param videoPath 视频文件路径
   * @param outputPath 输出文件路径
   * @param codec 编码器（默认 h264）
   * @param crf 质量参数（0-51，默认23）
   */
  async transcodeVideo(
    videoPath: string,
    outputPath: string,
    codec: string = 'libx264',
    crf: number = 23
  ): Promise<string> {
    const args = [
      '-i', videoPath,
      '-c:v', codec,
      '-crf', crf.toString(),
      '-c:a', 'aac',
      '-y',
      outputPath
    ];

    const { code, stderr } = await this.execFFmpeg(args);

    if (code !== 0) {
      throw new Error(`视频转码失败: ${stderr}`);
    }

    return outputPath;
  }

  /**
   * 合并视频
   * @param videoPaths 视频文件路径列表
   * @param outputPath 输出文件路径
   */
  async mergeVideos(videoPaths: string[], outputPath: string): Promise<string> {
    // 创建临时文件列表
    const listContent = videoPaths.map(p => `file '${p}'`).join('\n');
    const listPath = join(dirname(outputPath), 'merge_list.txt');

    // 注意：这里需要 fs 模块写入文件
    const { writeFileSync } = require('fs');
    writeFileSync(listPath, listContent);

    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      '-y',
      outputPath
    ];

    const { code, stderr } = await this.execFFmpeg(args);

    // 删除临时文件
    const { unlinkSync } = require('fs');
    unlinkSync(listPath);

    if (code !== 0) {
      throw new Error(`合并视频失败: ${stderr}`);
    }

    return outputPath;
  }
}

// 导出单例
export const ffmpeg = new FFmpeg();