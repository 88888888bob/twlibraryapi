// build.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            platform: 'node', // 保持 'node'
            format: 'esm',
            minify: true,
            sourcemap: true,
            plugins: [
                polyfillNode({
                    polyfills: { /* 你之前成功的详尽列表 */
                        "assert": true, "buffer": true, "child_process": "empty", "crypto": true,
                        "dns": "empty", "events": true, "fs": "empty", "http": "empty", "https": "empty",
                        "module": true, "net": "empty", "os": true, "path": true, "process": true,
                        "querystring": true, "stream": true, "string_decoder": true, "timers": true,
                        "tls": "empty", "tty": "empty", "url": true, "util": true, "vm": true, "zlib": true,
                    }
                }),
            ],
            define: {
                'process.env': JSON.stringify({ NODE_ENV: 'production' }),
                'global': 'globalThis', // 尝试加回这个
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