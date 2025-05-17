// build.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

esbuild.build({
    entryPoints: ['src/index.js'],
    bundle: true,
    outfile: 'dist/worker.js',
    platform: 'browser',
    format: 'esm',
    minify: true,
    sourcemap: true,
    plugins: [
        polyfillNode({
            // globals: { process: true, buffer: true } // 这些通常是默认的
        }),
    ],
    // 在这里定义 global 指向 globalThis
    define: {
        'global': 'globalThis', // 或者 'self' 也可以尝试
        // 如果 esbuild-plugin-polyfill-node 没有自动注入 process 和 Buffer，
        // 你可能也需要在这里明确定义它们，尽管插件通常会处理。
        // 'process': JSON.stringify({ env: {} }), // 最小化的 process.env
        // 'Buffer': 'Buffer', // 假设插件提供了 Buffer polyfill
    },
    // target: 'es2020', // 确保目标支持 globalThis
    // mainFields: ['module', 'main'],
    // conditions: ['worker', 'browser', 'import', 'require'],
}).catch((e) => {
    console.error("Build failed:", e);
    process.exit(1);
});