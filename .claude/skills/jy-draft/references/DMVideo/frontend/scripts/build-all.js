const Path = require('path');
const Chalk = require('chalk');
const FileSystem = require('fs');
const Vite = require('vite');
const compileTs = require('./private/tsc');
const { execSync } = require('child_process');

// ========== 配置 ==========
const ROOT_DIR = Path.join(__dirname, '..');
const BUILD_DIR = Path.join(ROOT_DIR, 'build');
const MAIN_SRC = Path.join(ROOT_DIR, 'src', 'main');
const IDENTITY_FILE = Path.join(MAIN_SRC, 'core', 'clientIdentity.ts');
const CLIENTS_FILE = Path.join(ROOT_DIR, 'build-clients.json');
const PLACEHOLDER = '__CLIENT_ID_PLACEHOLDER__';
const OUTPUT_BASE = 'dist-all';

process.env.NODE_ENV = 'production';

// ========== 读取客户端配置 ==========
if (!FileSystem.existsSync(CLIENTS_FILE)) {
  console.error(Chalk.red(`错误: 找不到客户端配置文件 ${CLIENTS_FILE}`));
  process.exit(1);
}

const clients = JSON.parse(FileSystem.readFileSync(CLIENTS_FILE, 'utf-8'));
if (!Array.isArray(clients) || clients.length === 0) {
  console.error(Chalk.red('错误: build-clients.json 必须是非空数组'));
  process.exit(1);
}

console.log(Chalk.cyan(`共 ${clients.length} 个客户端待构建\n`));

// ========== 工具函数 ==========

const IDENTITY_TEMPLATE = `/**\n * 客户端唯一标识\n * 构建时由 build-all.js 自动写入，编译为 V8 字节码后不可篡改\n */\nexport const CLIENT_ID: string = '${PLACEHOLDER}';\n`;

/** 恢复占位符 */
function restorePlaceholder() {
  FileSystem.writeFileSync(IDENTITY_FILE, IDENTITY_TEMPLATE);
}

/** 输出构建报告 */
function printReport(results) {
  console.log(Chalk.cyan('\n===== 构建报告 ====='));
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  results.forEach((r, i) => {
    const status = r.success ? Chalk.green('✓') : Chalk.red('✗');
    console.log(`  ${status} [${i + 1}] ${r.name}`);
    if (!r.success) {
      console.log(Chalk.red(`      错误: ${r.error}`));
    }
  });

  console.log(Chalk.cyan(`\n总计: ${results.length} | 成功: ${successCount} | 失败: ${failCount}`));
  console.log(Chalk.cyan(`输出目录: ${Path.join(ROOT_DIR, OUTPUT_BASE)}`));
  return failCount;
}

// ========== 主流程 ==========

async function buildAll() {
  // Step 1: 构建 Renderer（只做一次）
  console.log(Chalk.blueBright('===== Step 1: 构建 Renderer（只做一次）====='));
  FileSystem.rmSync(BUILD_DIR, { recursive: true, force: true });
  await Vite.build({
    configFile: Path.join(ROOT_DIR, 'vite.config.js'),
    base: './',
    mode: 'production'
  });
  console.log(Chalk.greenBright('Renderer 构建完成!\n'));

  // Step 2: 循环构建每个客户端（每个客户端全量打包）
  const results = [];

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const label = `${client.name} (${client.id.substring(0, 8)}...)`;
    console.log(Chalk.blueBright(`\n===== [${i + 1}/${clients.length}] 构建: ${label} =====`));

    try {
      // 2a: 写入 clientId
      FileSystem.writeFileSync(
        IDENTITY_FILE,
        `export const CLIENT_ID: string = '${client.id}';\n`
      );

      // 2b: 清理并重新编译主进程 TS → JS
      const mainBuildDir = Path.join(BUILD_DIR, 'main');
      FileSystem.rmSync(mainBuildDir, { recursive: true, force: true });
      await compileTs(MAIN_SRC);

      // 2c: 编译字节码
      const electronPath = require.resolve('electron/cli.js');
      const bytecodeScript = Path.join(__dirname, 'private', 'compile-bytecode.js');
      execSync(`node "${electronPath}" "${bytecodeScript}"`, { stdio: 'inherit' });

      // 2d: electron-builder 打包
      const outputDir = `${OUTPUT_BASE}/${client.name}`;
      execSync(`npx electron-builder --win --config.directories.output="${outputDir}"`, {
        cwd: ROOT_DIR,
        stdio: 'inherit'
      });

      results.push({ name: client.name, id: client.id, success: true });
      console.log(Chalk.green(`✓ ${label} 构建成功`));

    } catch (err) {
      results.push({ name: client.name, id: client.id, success: false, error: err.message });
      console.error(Chalk.red(`✗ ${label} 构建失败: ${err.message}`));
    }
  }

  // 恢复占位符
  restorePlaceholder();

  // 输出报告
  const failCount = printReport(results);
  if (failCount > 0) process.exit(1);
}

// ========== 启动 ==========

buildAll().catch(err => {
  restorePlaceholder();
  console.error(Chalk.red(`\n构建过程中发生未预期错误: ${err.message}`));
  process.exit(1);
});
