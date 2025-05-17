// build.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

esbuild.build({
    entryPoints: ['src/index.js'],
    bundle: true,
    outfile: 'dist/worker.js',
    platform: 'browser', // 保持 browser 平台，因为 Workers 更接近它
    format: 'esm',
    minify: true,
    sourcemap: true,
    plugins: [
        polyfillNode({
            // 你可以在这里配置哪些 polyfill 被使用，
            // 或者接受默认配置。
            // 例如，如果你知道你不需要 'fs' 的完整功能，
            // 可以尝试禁用它或使用一个更轻量的替代品（如果插件支持）。
            // globals: { process: true, buffer: true } // 默认会注入这些
        }),
    ],
    // 为了处理 jsdom 和其他可能使用 CJS 的模块，
    // 确保 esbuild 可以正确处理它们。
    // 通常 esbuild 默认能做得不错，但如果遇到 CJS 相关问题，
    // 可能需要更细致的配置或确保依赖是 ESM 友好的。
    // target: 'es2020', // 或者你的目标环境支持的最新 ECMAScript 版本
    // mainFields: ['module', 'main'], // 确保 esbuild 优先使用 ESM 版本
    // conditions: ['worker', 'browser', 'import', 'require'], // 帮助解析条件导出
}).catch((e) => {
    console.error("Build failed:", e);
    process.exit(1);
});