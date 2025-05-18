// build.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node'); // <--- 确保这行存在且路径正确

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            platform: 'browser',
            format: 'esm',
            minify: true,
            sourcemap: true,
            plugins: [ // <--- 确保 plugins 数组存在并包含 polyfillNode
                polyfillNode({
                    // 你可以根据需要配置 polyfills 对象，
                    // 但通常插件的默认值能处理大部分情况。
                    // 如果仍然遇到 "Could not resolve" 错误，再来这里添加。
                    // polyfills: { fs: true, crypto: true /* ... */ }
                }),
            ],
            define: {
                // 'global': 'globalThis', // nodejs_compat 和 polyfillNode 应该处理全局上下文
                'process.env': JSON.stringify({}),
            },
            // conditions: ['worker', 'node', 'import'], // 可选
            // mainFields: ['module', 'main'],         // 可选
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}

runBuild();