// build.js (再次强调这个版本)
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            platform: 'node', // <--- 关键
            format: 'esm',
            minify: true,
            sourcemap: true,
            plugins: [
                polyfillNode({
                    polyfills: {
                        "assert": true,
                        "buffer": true,
                        "child_process": "empty",
                        "crypto": true,
                        "dns": "empty",
                        "events": true, // <--- 确保 EventEmitter 被正确提供
                        "fs": "empty",
                        "http": "empty",
                        "https": "empty",
                        "module": true, // 尝试
                        "net": "empty",
                        "os": true,
                        "path": true,
                        "process": true, // 或 'empty' 如果只需要 process.env
                        "querystring": true,
                        "stream": true,
                        "string_decoder": true,
                        "timers": true,
                        "tls": "empty",
                        "tty": "empty",
                        "url": true,
                        "util": true,
                        "vm": true,
                        "zlib": true,
                        // 根据需要添加或调整
                    }
                }),
            ],
            define: {
                'process.env': JSON.stringify({ NODE_ENV: 'production' }),
            },
            conditions: ['worker', 'workerd', 'node', 'import', 'module'],
            mainFields: ['module', 'main'],
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}
runBuild();