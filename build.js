// build.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            // 尝试 'neutral' 或 'node'。'neutral' 可能更好，因为它不假设完整的 Node.js API 集。
            // 如果 'neutral' 不行，再尝试 'node'，但要小心它可能期望更多 Node.js API。
            platform: 'neutral', 
            format: 'esm',
            minify: true,
            sourcemap: true,
            plugins: [
                polyfillNode({
                    // 你可能需要根据错误信息具体配置 polyfills
                    // 例如：
                    // polyfills: {
                    //    process: true, // 或者 'empty'
                    //    buffer: true,
                    //    // 根据之前的 "Could not resolve" 错误，添加必要的模块
                    //    // path: true, fs: 'empty', vm: true, events: true, crypto: true, etc.
                    // }
                }),
            ],
            define: {
                // 'global': 'globalThis', // 在启用了 nodejs_compat 和 polyfillNode 后，这个可能不再需要，或者反而有害
                'process.env': JSON.stringify({ NODE_ENV: 'production' }), // 定义 NODE_ENV 可能有用
            },
            // 这些条件对于同构包非常重要
            conditions: ['worker', 'workerd', 'node', 'import', 'module'], // 优先 'worker' 和 'node'
            mainFields: ['worker', 'module', 'main'], // 优先 'worker' 和 'module'
            // target: 'es2022', // 确保与 Cloudflare Workers 运行时兼容
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}

runBuild();