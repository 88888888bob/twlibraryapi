// build.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node'); // <--- 确保导入

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            platform: 'browser', // 保持 'browser'，因为 Workers 更接近这个模型，插件会处理 Node.js 部分
            format: 'esm',
            minify: true,
            sourcemap: true,
            plugins: [
                polyfillNode({
                    // 你可以根据需要配置 polyfills 选项，但通常默认值能处理大部分情况
                    // 例如，如果你确定某些模块不需要，或者想用空实现代替：
                    // polyfills: {
                    //    fs: true, // 提供 fs 的 polyfill (可能是内存中的模拟)
                    //    path: true,
                    //    crypto: true,
                    //    // 如果某个模块在 Workers 中完全不可用且 polyfill 无意义，可以设为 'empty'
                    //    // 'child_process': 'empty', // Workers 不支持子进程
                    // }
                }),
            ],
            define: {
                // 'global': 'globalThis', // nodejs_compat 应该会处理，但如果遇到 'global is not defined' 可以加回来
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'), // 更完整的 process.env 定义
                'process.env': JSON.stringify(process.env), // 或者直接传递所有环境变量（小心敏感信息）
                                                            // 更安全的做法是只定义需要的环境变量
                                                            // 或 'process.env': JSON.stringify({})
            },
            // mainFields: ['module', 'main'], // 通常 'browser', 'module', 'main' 是一个好的顺序
                                               // 对于同构库，可能需要确保 'module' 或 'main' 在 'browser' 之前
                                               // 如果不确定，可以先不设置，让 esbuild 默认处理
            // conditions: ['worker', 'node', 'import'], // 同上，如果需要，添加 'browser'
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e.message); // 输出更简洁的错误信息
        console.error("Full error object:", e); // 如果需要详细堆栈
        process.exit(1);
    }
}

runBuild();