// build.js
const esbuild = require('esbuild');
// const { polyfillNode } = require('esbuild-plugin-polyfill-node'); // 暂时不用

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            platform: 'browser', // 保持 'browser' 或尝试 'neutral'
            format: 'esm',
            minify: true,
            sourcemap: true,
            // plugins: [], // 暂时移除 polyfillNode
            define: {
                // 'global': 'globalThis', // nodejs_compat 应该处理这个，先移除
                'process.env': JSON.stringify({}), // 这个通常安全且有用
            },
            // 尝试添加/调整 conditions
            conditions: ['worker', 'node', 'import'], // 确保 'node' 或 'worker' 条件优先
            // 尝试调整 mainFields
            mainFields: ['module', 'main'], // 移除 'browser' 或降低其优先级
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}

runBuild();