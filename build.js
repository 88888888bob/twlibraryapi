// build.js
const esbuild = require('esbuild');
// const { polyfillNode } = require('esbuild-plugin-polyfill-node'); // <--- 删除或注释掉这行

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            platform: 'browser', // 或者你正在测试的 'neutral'
            format: 'esm',
            minify: true,
            sourcemap: true,
            // plugins: [ // <--- 如果 polyfillNode 是唯一的插件，删除或注释掉整个 plugins 数组
            //     polyfillNode({
            //         // ...
            //     }),
            // ],
            define: {
                // 'global': 'globalThis', // 如果 nodejs_compat 处理了，这可能不需要
                'process.env': JSON.stringify({}), // 这个通常安全且有用
            },
            conditions: ['worker', 'node', 'import'], // 根据需要调整
            mainFields: ['module', 'main'],       // 根据需要调整
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}

runBuild();