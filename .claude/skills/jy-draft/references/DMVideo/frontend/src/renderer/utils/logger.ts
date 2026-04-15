/**
 * 渲染进程日志工具
 * 通过 IPC 将日志发送到主进程写入文件
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

// 检查是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && window.electronAPI?.log;

/**
 * 格式化参数为字符串
 */
function formatArgs(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return arg;
    }
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
    }
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }).join(' ');
}

/**
 * 写入日志到主进程文件
 */
async function writeLog(level: LogLevel, ...args: any[]): Promise<void> {
  const timestamp = new Date().toLocaleString('zh-CN');
  const message = formatArgs(args);
  const logLine = `[${timestamp}] [${level}] ${message}`;

  // 控制台输出（开发时可见）
  if (level === 'ERROR') {
    console.error(...args);
  } else if (level === 'WARN') {
    console.warn(...args);
  } else {
    console.log(...args);
  }

  // 发送到主进程写入文件
  if (isElectron) {
    try {
      await window.electronAPI.log(level, ...args);
    } catch {
      // 忽略写入错误
    }
  }
}

/**
 * 日志工具对象
 */
export const logger = {
  /**
   * 信息日志
   */
  info: (...args: any[]) => writeLog('INFO', ...args),

  /**
   * 警告日志
   */
  warn: (...args: any[]) => writeLog('WARN', ...args),

  /**
   * 错误日志
   */
  error: (...args: any[]) => writeLog('ERROR', ...args),

  /**
   * HTTP 请求日志
   */
  httpRequest: (method: string, url: string, data?: any) => {
    const dataStr = data ? formatArgs([data]) : '';
    writeLog('INFO', `[HTTP Request] ${method.toUpperCase()} ${url}`, dataStr);
  },

  /**
   * HTTP 响应日志
   */
  httpResponse: (url: string, status: number, data?: any, duration?: number) => {
    const durationStr = duration ? ` (${duration}ms)` : '';
    const dataStr = data ? formatArgs([data]) : '';
    writeLog('INFO', `[HTTP Response] ${url} ${status}${durationStr}`, dataStr);
  },

  /**
   * HTTP 错误日志
   */
  httpError: (url: string, error: any) => {
    const errorStr = error instanceof Error 
      ? `${error.name}: ${error.message}` 
      : formatArgs([error]);
    writeLog('ERROR', `[HTTP Error] ${url}`, errorStr);
  },
};

export default logger;
