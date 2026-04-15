/**
 * V8 Bytecode Compiler
 * Compiles main process JavaScript to .jsc bytecode files
 * 
 * IMPORTANT: Must use Electron's built-in Node.js to compile bytecode,
 * otherwise version incompatibility will cause runtime errors
 */
const Path = require('path');
const FileSystem = require('fs');

// Check if running in Electron environment
const isElectron = process.versions.electron !== undefined;

/**
 * Recursively compile all JS files in directory to bytecode
 * @param {string} dir Directory path
 * @param {string[]} exclude Files to exclude
 */
async function compileDirectory(dir, exclude = []) {
    // Dynamic import bytenode (must be in Electron environment)
    const bytenode = require('bytenode');
    
    const entries = FileSystem.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = Path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            await compileDirectory(fullPath, exclude);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            // Exclude files that should not be compiled
            if (exclude.includes(entry.name)) {
                console.log(`  [SKIP] ${entry.name} (in exclude list)`);
                continue;
            }
            
            try {
                const jscPath = fullPath.replace('.js', '.jsc');
                console.log(`  [COMPILE] ${entry.name} -> ${Path.basename(jscPath)}`);
                
                // Compile to bytecode
                await bytenode.compileFile({
                    filename: fullPath,
                    output: jscPath
                });
                
                // Delete original JS file, keep only bytecode
                FileSystem.unlinkSync(fullPath);
                
            } catch (err) {
                console.error(`  [ERROR] Failed to compile ${entry.name}:`, err.message);
                throw err;
            }
        }
    }
}

/**
 * Create bootstrap entry file
 * @param {string} mainPath Main process directory
 */
function createBootstrap(mainPath) {
    const bootstrapContent = `require('bytenode');
require('./main.jsc');
`;
    
    const bootstrapPath = Path.join(mainPath, 'index.js');
    FileSystem.writeFileSync(bootstrapPath, bootstrapContent);
    console.log(`  [CREATE] index.js (bootstrap entry)`);
}

/**
 * Handle preload.js - Keep as regular JS file
 * @param {string} mainPath Main process directory
 */
function handlePreload(mainPath) {
    const preloadJsc = Path.join(mainPath, 'preload.jsc');
    const preloadJs = Path.join(mainPath, 'preload.js');
    
    // preload must remain as regular JS file, cannot compile to bytecode
    // Because Electron has special loading mechanism for preload
    
    if (FileSystem.existsSync(preloadJsc)) {
        // If compiled, need to restore
        console.log(`  [WARN] preload.js should not be compiled, restoring...`);
        FileSystem.unlinkSync(preloadJsc);
    }
    
    console.log(`  [KEEP] preload.js (preload script not compiled)`);
}

/**
 * Main function
 */
async function main() {
    // Check if running in Electron environment
    if (!isElectron) {
        console.error('========================================');
        console.error('ERROR: Must compile bytecode in Electron environment');
        console.error('');
        console.error('Please use the following command:');
        console.error('  npx electron scripts/private/compile-bytecode.js');
        console.error('========================================');
        process.exit(1);
    }
    
    const buildDir = Path.join(__dirname, '..', '..', 'build', 'main');
    
    if (!FileSystem.existsSync(buildDir)) {
        console.error('ERROR: build/main directory does not exist, please run tsc first');
        process.exit(1);
    }
    
    console.log('Starting bytecode compilation...');
    console.log(`Target directory: ${buildDir}`);
    console.log(`Node version: ${process.version}`);
    console.log(`Electron version: ${process.versions.electron}\n`);
    
    try {
        // Exclude preload.js, it cannot be compiled to bytecode
        await compileDirectory(buildDir, ['preload.js']);
        
        // Create bootstrap entry file
        createBootstrap(buildDir);
        
        // Handle preload
        handlePreload(buildDir);
        
        console.log('\nBytecode compilation complete!');
        
        // Exit Electron process after compilation
        process.exit(0);
        
    } catch (err) {
        console.error('\nBytecode compilation failed:', err);
        process.exit(1);
    }
}

main();
