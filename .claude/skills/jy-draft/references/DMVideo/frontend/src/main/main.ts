// ==================== 调试模式 ====================
const isDev = process.env.NODE_ENV === 'development';
const isDebug = process.env.DEBUG === 'true' || isDev;

function debugLog(...args: unknown[]): void {
  if (isDebug) {
    const timestamp = new Date().toISOString();
    process.stdout.write(`[DEBUG ${timestamp}] `);
    console.log(...args);
  }
}

debugLog('=== DMVideo 启动调试信息 ===');
debugLog('Node 版本:', process.version);
debugLog('Electron 版本:', process.versions.electron);
debugLog('平台:', process.platform);
debugLog('架构:', process.arch);
debugLog('工作目录:', process.cwd());
debugLog('NODE_ENV:', process.env.NODE_ENV);
debugLog('命令行参数:', process.argv);

// ==================== Electron 模块加载 ====================
import { app, BrowserWindow, ipcMain, session, dialog, shell, Menu, protocol, net } from 'electron';

debugLog('Electron 模块加载成功');
debugLog('app 对象:', app ? '有效' : '无效');

// 在 app ready 之前注册自定义协议的特权
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-video',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    }
  }
]);

import { join, resolve } from 'path';
import { config } from 'dotenv';
import { existsSync, mkdirSync, appendFileSync, createReadStream, statSync } from 'fs';
import { spawn, spawnSync, ChildProcess } from 'child_process';

import { IpcHandleRegister } from './ipc_handle';
import { DB } from './database';
import { McpServer } from './mcp';

// ==================== 日志系统 ====================
let logFilePath: string;

/**
 * 初始化日志系统
 */
function initLogger(): void {
  // 生产环境使用 userData 目录，确保有写入权限
  const logDir = isDev
    ? join(process.cwd(), 'logs')
    : join(app.getPath('userData'), 'logs');

  // 创建日志目录
  if (!existsSync(logDir)) {
    try {
      mkdirSync(logDir, { recursive: true });
    } catch (err) {
      console.error('创建日志目录失败:', err);
    }
  }

  // 日志文件按日期命名
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  logFilePath = join(logDir, `${dateStr}.log`);

  // 写入启动日志
  const timestamp = now.toLocaleString('zh-CN');
  const startLog = `\n${'='.repeat(60)}\n[${timestamp}] DMVideo 视频处理生成工具启动\n${'='.repeat(60)}\n`;
  try {
    appendFileSync(logFilePath, startLog, 'utf-8');
  } catch (err) {
    console.error('写入日志文件失败:', err);
  }
}

/**
 * 写入日志
 */
// 日志级别优先级：DEBUG < INFO < WARN < ERROR
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
const LOG_LEVEL_PRIORITY: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const currentLogLevel: LogLevel = (isDev ? 'DEBUG' : (process.env.LOG_LEVEL as LogLevel)) || 'INFO';

function writeLog(level: string, ...args: unknown[]): void {
  // 日志级别过滤（RENDERER- 前缀的提取实际级别判断）
  const actualLevel = level.replace('RENDERER-', '') as LogLevel;
  if ((LOG_LEVEL_PRIORITY[actualLevel] ?? 0) < (LOG_LEVEL_PRIORITY[currentLogLevel] ?? 0)) {
    return;
  }

  const timestamp = new Date().toLocaleString('zh-CN');
  const message = args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack || ''}`;
    }
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  const logLine = `[${timestamp}] [${level}] ${message}\n`;

  // 输出到控制台（使用原始方法避免递归）
  if (level === 'ERROR' || level === 'RENDERER-ERROR') {
    originalError(...args);
  } else if (level === 'WARN' || level === 'RENDERER-WARN') {
    originalWarn(...args);
  } else {
    originalLog(...args);
  }

  // 写入文件
  if (logFilePath) {
    try {
      appendFileSync(logFilePath, logLine, 'utf-8');
    } catch {
      // 忽略写入错误
    }
  }
}

// 重写 console 方法
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: unknown[]) => writeLog('INFO', ...args);
console.error = (...args: unknown[]) => writeLog('ERROR', ...args);
console.warn = (...args: unknown[]) => writeLog('WARN', ...args);

// ==================== 主程序 ====================

// 解决 Windows 24H2 上 GPU 进程崩溃问题
try {
  app.disableHardwareAcceleration();
  debugLog('已禁用硬件加速');
} catch (err) {
  debugLog('禁用硬件加速失败:', err);
}

// 初始化日志系统（必须在其他代码之前）
initLogger();

// Python 进程实例
let pythonProcess: ChildProcess | null = null;

// MCP 服务实例
let mcpServer: McpServer | null = null;

// 数据库实例
let database: DB | null = null;

// 根据环境加载对应的环境变量配置文件
function loadEnvConfig() {
  debugLog('正在加载环境配置...');

  if (isDev) {
    const envPath = resolve(process.cwd(), '.env');
    const envDevPath = resolve(process.cwd(), '.env.development');

    if (existsSync(envPath)) {
      config({ path: envPath });
      console.log('[Main] 开发环境：已加载 .env');
    } else if (existsSync(envDevPath)) {
      config({ path: envDevPath });
      console.log('[Main] 开发环境：已加载 .env.development');
    } else {
      console.log('[Main] 开发环境：未找到环境配置文件');
    }
  } else {
    const appPath = app.getAppPath();
    const resourcesPath = process.resourcesPath || appPath;

    const possiblePaths = [
      resolve(appPath, '.env.production'),
      resolve(resourcesPath, '.env.production'),
      resolve(process.cwd(), '.env.production'),
    ];

    for (const envPath of possiblePaths) {
      if (existsSync(envPath)) {
        config({ path: envPath });
        console.log('[Main] 生产环境：已加载 .env.production');
        break;
      }
    }
  }
}

loadEnvConfig();
debugLog('环境配置加载完成');

/**
 * 初始化数据库
 */
function initDatabase(): void {
  debugLog('正在初始化数据库...');
  const dbPath = isDev
    ? join(process.cwd(), 'data', 'dmvideo.db')
    : join(app.getPath('userData'), 'dmvideo.db');

  debugLog('数据库路径:', dbPath);

  // 确保数据目录存在
  const dbDir = resolve(dbPath, '..');
  if (!existsSync(dbDir)) {
    debugLog('创建数据目录:', dbDir);
    mkdirSync(dbDir, { recursive: true });
  }

  try {
    database = new DB(dbPath);
    debugLog('数据库初始化成功');
    console.log('[Main] 数据库初始化完成:', dbPath);
  } catch (err) {
    debugLog('数据库初始化失败:', err);
    console.error('[Main] 数据库初始化失败:', err);
  }
}

/**
 * 启动 MCP 服务
 */
function startMcpServer(): void {
  debugLog('正在启动 MCP 服务...');
  const port = parseInt(process.env.MCP_PORT || '3000');
  try {
    mcpServer = new McpServer(port, database!);
    mcpServer.start();
    debugLog('MCP 服务启动成功，端口:', port);
    console.log('[Main] MCP 服务启动成功，端口:', port);
  } catch (err) {
    debugLog('MCP 服务启动失败:', err);
    console.error('[Main] MCP 服务启动失败:', err);
  }
}

/**
 * 停止 MCP 服务
 */
function stopMcpServer(): void {
  if (mcpServer) {
    mcpServer.stop();
    mcpServer = null;
    console.log('[Main] MCP 服务已停止');
  }
}

/**
 * 启动 Python 后端服务
 */
function startPythonBackend(): void {
  // 仅在生产环境启动
  if (isDev) {
    debugLog('开发环境：跳过自动启动 Python 后端');
    console.log('[Main] 开发环境：跳过自动启动 Python 后端');
    return;
  }

  const resourcesPath = process.resourcesPath;

  // 优先查找打包后的 exe，其次查找 Python 脚本
  const exePath = join(resourcesPath, 'server', 'DMVideoBackend', 'DMVideoBackend.exe');
  const scriptPath = join(resourcesPath, 'backend', 'main.py');

  let command: string;
  let args: string[];

  if (existsSync(exePath)) {
    command = exePath;
    args = [];
    console.log('[Main] 尝试启动 Python 后端 (exe):', exePath);
  } else if (existsSync(scriptPath)) {
    command = 'python';
    args = [scriptPath];
    console.log('[Main] 尝试启动 Python 后端 (script):', scriptPath);
  } else {
    console.error('[Main] Python 后端不存在，exe:', exePath, 'script:', scriptPath);
    return;
  }

  try {
    pythonProcess = spawn(command, args, {
      detached: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    pythonProcess.on('error', (err) => {
      console.error('[Main] Python 后端启动失败:', err);
    });

    pythonProcess.on('exit', (code, signal) => {
      console.log(`[Main] Python 后端已退出，code: ${code}, signal: ${signal}`);
      pythonProcess = null;
    });

    pythonProcess.stdout?.on('data', (data) => {
      console.log(`[Python] ${data.toString()}`);
    });

    pythonProcess.stderr?.on('data', (data) => {
      console.error(`[Python Error] ${data.toString()}`);
    });

    console.log('[Main] Python 后端启动成功，PID:', pythonProcess.pid);
  } catch (err) {
    console.error('[Main] 启动 Python 后端异常:', err);
  }
}

/**
 * 停止 Python 后端服务
 */
function stopPythonBackend(): void {
  if (pythonProcess) {
    console.log('[Main] 正在停止 Python 后端, PID:', pythonProcess.pid);

    if (process.platform === 'win32') {
      try {
        const result = spawnSync('taskkill', ['/pid', String(pythonProcess.pid), '/f', '/t'], {
          encoding: 'utf-8',
          timeout: 5000
        });

        if (result.status === 0) {
          console.log('[Main] Python 后端已成功终止');
        }
      } catch (err) {
        console.error('[Main] 终止 Python 后端异常:', err);
      }
    } else {
      pythonProcess.kill('SIGTERM');
    }

    pythonProcess = null;
  }
}

function createWindow() {
  debugLog('正在创建主窗口...');
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#1a1a2e',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  debugLog('BrowserWindow 创建成功');

  // 窗口准备好后显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    debugLog('窗口 ready-to-show，显示窗口');
    mainWindow.show();
  });

  if (isDev) {
    const rendererPort = process.argv[2];
    const url = `http://localhost:${rendererPort}`;
    debugLog('开发模式，加载 URL:', url);
    mainWindow.loadURL(url);

    // 开发模式下自动打开 DevTools
    mainWindow.webContents.openDevTools({ mode: 'right' });
    debugLog('已打开 DevTools 控制台');
  } else {
    const htmlPath = join(app.getAppPath(), 'renderer', 'index.html');
    debugLog('生产模式，加载文件:', htmlPath);
    mainWindow.loadFile(htmlPath);
  }

  // 处理 IPC 调用
  debugLog('正在注册 IPC 处理器...');
  new IpcHandleRegister(mainWindow, database!);
  debugLog('IPC 处理器注册完成');
}

debugLog('正在注册 app.whenReady 处理器...');

app.whenReady().then(() => {
  debugLog('app.whenReady 触发，开始初始化...');

  // 注册自定义协议用于加载本地视频文件
  protocol.handle('local-video', (request) => {
    const url = request.url;
    // local-video:///C:/path/to/file.mp4 -> C:/path/to/file.mp4
    const filePath = decodeURIComponent(url.slice('local-video:///'.length));
    debugLog('加载本地视频:', filePath);

    try {
      if (!existsSync(filePath)) {
        return new Response('File not found', { status: 404 });
      }

      const stats = statSync(filePath);
      const fileSize = stats.size;

      // 解析 Range 请求头
      const rangeHeader = request.headers.get('range');
      debugLog('Range 请求头:', rangeHeader);

      // 获取文件扩展名来确定 Content-Type
      const ext = filePath.toLowerCase().split('.').pop() || 'mp4';
      const contentTypes: Record<string, string> = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
      };
      const contentType = contentTypes[ext] || 'video/mp4';

      if (rangeHeader) {
        // 解析 Range: bytes=start-end
        const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
          const chunkSize = end - start + 1;

          debugLog(`视频 Range 请求: ${start}-${end}/${fileSize}, chunkSize: ${chunkSize}`);

          const fileStream = createReadStream(filePath, { start, end });
          return new Response(fileStream as any, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(chunkSize),
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
            }
          });
        }
      }

      // 无 Range 请求，返回整个文件
      const fileStream = createReadStream(filePath);
      return new Response(fileStream as any, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
        }
      });
    } catch (error) {
      debugLog('加载视频失败:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  // 禁用 DevTools Autofill 等不支持的协议警告
  session.defaultSession.setPreloads([]);
  session.defaultSession.webRequest.onBeforeRequest((_details, callback) => {
    callback({});
  });

  // 初始化数据库
  initDatabase();

  // 启动 MCP 服务
  startMcpServer();

  // 启动 Python 后端
  startPythonBackend();

  createWindow();

  // 隐藏菜单栏
  Menu.setApplicationMenu(null);
  debugLog('菜单栏已隐藏');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': "script-src 'self'; media-src 'self' local-video: blob: data:"
      }
    })
  })

  app.on('activate', function () {
    debugLog('app.activate 触发');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  debugLog('应用初始化完成');
}).catch((err) => {
  debugLog('app.whenReady 错误:', err);
  console.error('[Main] app.whenReady 错误:', err);
});

app.on('window-all-closed', function () {
  stopPythonBackend();
  stopMcpServer();

  if (process.platform !== 'darwin') app.quit()
});

app.on('before-quit', () => {
  console.log('[Main] 应用即将退出...');
  stopPythonBackend();
  stopMcpServer();

  setTimeout(() => {
    console.log('[Main] 应用退出流程完成');
  }, 100);
});

app.on('will-quit', () => {
  console.log('[Main] 应用已退出');
  stopPythonBackend();
  stopMcpServer();
});

process.on('exit', () => {
  console.log('[Main] Node 进程退出...');
  stopPythonBackend();
  stopMcpServer();
});

process.on('SIGINT', () => {
  console.log('[Main] 收到 SIGINT 信号，正在退出...');
  stopPythonBackend();
  stopMcpServer();
  app.quit();
});

process.on('SIGTERM', () => {
  console.log('[Main] 收到 SIGTERM 信号，正在退出...');
  stopPythonBackend();
  stopMcpServer();
  app.quit();
});

// ==================== 基础 IPC ====================

ipcMain.handle('open-directory-dialog', async () => {
  console.log('Handling open-directory-dialog');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  console.log('Directory dialog result:', result);
  return result;
});

ipcMain.handle('open-file-dialog', async (event, filters?: { name: string; extensions: string[] }[]) => {
  console.log('Handling open-file-dialog');
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result;
});

ipcMain.handle('open-external', async (event, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('get-video-play-url', async (event, filePath: string) => {
  // 返回自定义协议 URL
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `local-video:///${normalizedPath}`;
});

// 读取视频文件（用于前端创建 Blob URL）
ipcMain.handle('read-video-file', async (event, filePath: string) => {
  try {
    if (!existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }

    const { readFileSync } = require('fs');
    const buffer = readFileSync(filePath);

    // 获取文件扩展名
    const ext = filePath.toLowerCase().split('.').pop() || 'mp4';
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'video/ogg',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
    };
    const mimeType = mimeTypes[ext] || 'video/mp4';

    // 返回 buffer 和 mime type
    return {
      success: true,
      buffer: buffer,  // Electron 会自动序列化
      mimeType,
    };
  } catch (error: any) {
    console.error('[Main] 读取视频文件失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('renderer-log', (event, level: string, ...args: unknown[]) => {
  writeLog(`RENDERER-${level}`, ...args);
});

// 获取系统版本信息
ipcMain.handle('get-versions', () => {
  return {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch
  };
});