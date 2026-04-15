const Path = require('path');
const vuePlugin = require('@vitejs/plugin-vue')
const { config: envConfig } = require('dotenv');

// 加载环境变量（优先使用 .env.development 或 .env.production）
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
envConfig({ path: envFile });

console.log("[VITE CONFIG] SERVER_BASE_URL: ", process.env.SERVER_BASE_URL);


// 导出环境变量供 Vite 使用
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'https://test.dmaodata.cn';

const { defineConfig } = require('vite');

// 获取混淆插件（仅生产环境）
function getObfuscatorPlugin() {
    if (process.env.NODE_ENV !== 'production') {
        return null;
    }
    try {
        const { viteObfuscateFile } = require('vite-plugin-obfuscator');
        return viteObfuscateFile({
            // Vue 兼容的混淆配置 - 最小化风险
            options: {
                // ===== 基本压缩 =====
                compact: true,
                simplify: true,
                
                // ===== 禁用所有危险特性 =====
                controlFlowFlattening: false,
                deadCodeInjection: false,
                debugProtection: false,
                disableConsoleOutput: false,
                selfDefending: false,
                
                // ===== 标识符处理 =====
                identifierNamesGenerator: 'mangled',  // 短名称
                renameGlobals: false,
                renameProperties: false,
                transformObjectKeys: false,
                
                // ===== 完全禁用字符串混淆（关键！）=====
                stringArray: false,                  // 禁用字符串数组
                stringArrayCallsTransform: false,
                stringArrayEncoding: [],
                stringArrayThreshold: 0,
                
                // ===== 其他 =====
                numbersToExpressions: false,
                unicodeEscapeSequence: false,
                log: false
            }
        });
    } catch (e) {
        console.warn('[VITE CONFIG] vite-plugin-obfuscator not loaded:', e.message);
        return null;
    }
}

/**
 * https://vitejs.dev/config
 */
const config = defineConfig({
    root: Path.join(__dirname, 'src', 'renderer'),
    publicDir: 'public',
    server: {
        port: 8080,
    },
    open: false,
    build: {
        outDir: Path.join(__dirname, 'build', 'renderer'),
        emptyOutDir: true,
        // 使用 Terser 进行安全的变量名混淆
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: false,
                drop_debugger: true,
            },
            mangle: {
                // 变量名混淆配置
                toplevel: false,      // 不混淆顶层变量
                safari10: true,
            },
            format: {
                comments: false,      // 移除注释
            },
        },
    },
    plugins: [
        vuePlugin(),
        // 不使用 vite-plugin-obfuscator，改用 Vite 内置的 Terser
    ].filter(Boolean),
    // 定义全局常量，将环境变量传递给渲染进程
    define: {
        'process.env.SERVER_BASE_URL': JSON.stringify(SERVER_BASE_URL),
    },
});

module.exports = config;
