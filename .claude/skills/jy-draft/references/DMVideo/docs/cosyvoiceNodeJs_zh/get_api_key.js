#!/usr/bin/env node
/**
 * DashScope API Key 获取指引
 */

console.log('='.repeat(80));
console.log('DashScope API Key 获取指引');
console.log('='.repeat(80));
console.log('');
console.log('由于 DashScope API Key 管理暂无公开 OpenAPI 接口，请手动获取：');
console.log('');
console.log('方法1: 从百炼控制台复制现有 API Key');
console.log('  1. 访问: https://bailian.console.aliyun.com/cn-beijing/#/efm/api_key');
console.log('  2. 点击任意 API Key 右侧的复制图标');
console.log('  3. 复制完整的 API Key（格式: sk-xxxxxxxxxxxx）');
console.log('');
console.log('方法2: 创建新的 API Key');
console.log('  1. 访问: https://bailian.console.aliyun.com/cn-beijing/#/efm/api_key');
console.log('  2. 点击 "创建 API Key" 按钮');
console.log('  3. 填写描述（如：CosyVoice 语音合成测试）');
console.log('  4. 点击确定，复制生成的 API Key');
console.log('');
console.log('='.repeat(80));
console.log('获取后，使用以下命令设置环境变量：');
console.log('');

if (process.platform === 'win32') {
  console.log('  Windows (CMD):');
  console.log('    set DASHSCOPE_API_KEY=sk-xxxxxxxxxxxx');
  console.log('');
  console.log('  Windows (PowerShell):');
  console.log('    $env:DASHSCOPE_API_KEY=\'sk-xxxxxxxxxxxx\'');
} else {
  console.log('  macOS/Linux:');
  console.log('    export DASHSCOPE_API_KEY=\'sk-xxxxxxxxxxxx\'');
}

console.log('');
console.log('然后运行启动脚本：');
console.log('');
console.log('  ./start.sh       (macOS/Linux)');
console.log('  start.bat        (Windows)');
console.log('  npm start        (跨平台)');
console.log('');
console.log('='.repeat(80));
