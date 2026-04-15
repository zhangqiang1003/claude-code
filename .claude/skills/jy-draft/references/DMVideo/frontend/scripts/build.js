const Path = require('path');
const Chalk = require('chalk');
const FileSystem = require('fs');
const Vite = require('vite');
const Esbuild = require('esbuild');
const compileTs = require('./private/tsc');
const { execSync } = require('child_process');

// 设置生产环境变量，确保主进程能正确识别环境
process.env.NODE_ENV = 'production';

function buildRenderer() {
    return Vite.build({
        configFile: Path.join(__dirname, '..', 'vite.config.js'),
        base: './',
        mode: 'production'
    });
}

function buildMain() {
    const mainPath = Path.join(__dirname, '..', 'src', 'main');
    return compileTs(mainPath).then(() => stripConsole());
}

/**
 * 移除主进程 JS 文件中的 console 日志语句
 * 使用 esbuild 的 drop 选项在 AST 级别安全移除
 */
async function stripConsole() {
    console.log(Chalk.blueBright('Stripping console statements from main process...'));

    const buildDir = Path.join(__dirname, '..', 'build', 'main');
    const jsFiles = findJsFiles(buildDir);

    for (const file of jsFiles) {
        const code = FileSystem.readFileSync(file, 'utf-8');
        const result = await Esbuild.transform(code, {
            loader: 'js',
            drop: ['console'],
        });
        FileSystem.writeFileSync(file, result.code);
    }

    console.log(Chalk.greenBright(`[strip-console] ${jsFiles.length} files processed`));
}

/**
 * 递归查找目录下所有 .js 文件
 */
function findJsFiles(dir) {
    const files = [];
    const entries = FileSystem.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = Path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findJsFiles(fullPath));
        } else if (entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * 编译主进程为 V8 字节码
 */
function compileBytecode() {
    console.log(Chalk.blueBright('Compiling main process to bytecode...'));
    
    // 必须使用 Electron 来编译字节码，确保 V8 版本兼容
    const electronPath = require.resolve('electron/cli.js');
    const scriptPath = Path.join(__dirname, 'private', 'compile-bytecode.js');
    
    try {
        execSync(`node "${electronPath}" "${scriptPath}"`, {
            stdio: 'inherit'
        });
    } catch (err) {
        console.error(Chalk.red('字节码编译失败'));
        throw err;
    }
}

FileSystem.rmSync(Path.join(__dirname, '..', 'build'), {
    recursive: true,
    force: true,
})

console.log(Chalk.blueBright('Transpiling renderer & main...'));

Promise.allSettled([
    buildRenderer(),
    buildMain(),
]).then((results) => {
    // 检查是否有失败
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        console.error(Chalk.red('Build failed:'));
        failed.forEach((f, i) => {
            console.error(Chalk.red(`  ${i + 1}. ${f.reason}`));
        });
        process.exit(1);
    }
    
    console.log(Chalk.greenBright('Renderer & main successfully transpiled!'));
    
    // 编译字节码
    compileBytecode();
    
    console.log(Chalk.greenBright('Build complete! (ready for electron-builder)'));
});
