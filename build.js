// build.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node'); // <--- 取消注释或重新添加

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            platform: 'browser', // 保持 'browser'，让 polyfill 插件处理 Node.js 模块
            format: 'esm',
            minify: true,
            sourcemap: true,
            plugins: [ // <--- 重新启用 plugins 数组
                polyfillNode({
                    // 插件通常有合理的默认值来 polyfill 大部分常用 Node.js 模块。
                    // 如果你仍然遇到特定模块找不到的问题，可以在这里进行更细致的配置。
                    // 例如，明确指定需要 polyfill 的模块：
                    // polyfills: {
                    //     fs: true, // 提供一个空的或内存中的 fs 实现
                    //     path: true,
                    //     crypto: true,
                    //     buffer: true,
                    //     stream: true,
                    //     process: 'empty', // 'true' 会引入一个更完整的 polyfill, 'empty' 提供空对象
                    //     // 根据错误日志中列出的模块添加更多...
                    //     // 例如：vm, events, url, os, zlib, string_decoder, util, net, tls, assert, http, https, tty, child_process
                    //     // 对于某些模块，如 http, https, net, tls，polyfill 可能只是提供空实现或抛错，
                    //     // 因为它们在 Workers 中有不同的原生实现或限制。
                    //     // 关键是让 `require()` 不会失败。
                    // }
                }),
            ],
            define: {
                // 'global': 'globalThis', // nodejs_compat 和 polyfillNode 应该会处理全局上下文
                                           // 如果仍有问题，可以尝试加回来。
                'process.env': JSON.stringify({}), // 这个通常是安全的，可以保留
            },
            // conditions: ['worker', 'node', 'import'], // 这些条件可能仍然有用
            // mainFields: ['module', 'main'],         // 帮助 esbuild 解析
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}

runBuild();