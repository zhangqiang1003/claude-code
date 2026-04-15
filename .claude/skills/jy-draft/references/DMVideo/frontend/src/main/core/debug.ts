/**
 * 文件调试工具
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 将数据保存为本地 JSON 文件
 *
 * 文件名自动添加时间戳前缀，保存到 cwd 目录下。
 * 适用于调试时快速导出数据到本地文件。
 *
 * @param filename 文件名（如 "asr_data.json"）
 * @param data 要保存的数据（会自动 JSON.stringify）
 */
export function dumpJson(filename: string, data: any): void {
  try {
    const outputPath = path.join(process.cwd(), `${Date.now()}_${filename}`);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[dumpJson] 已保存: ${outputPath}`);
  } catch (e) {
    console.warn(`[dumpJson] 保存失败 (${filename}):`, e);
  }
}
