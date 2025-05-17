// build.js
const esbuild = require('esbuild');
// const { polyfillNode } = require('esbuild-plugin-polyfill-node'); // <--- 尝试注释掉或移除

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
            // plugins: [ // <--- 尝试注释掉或移除
            //     polyfillNode({
            //         // ...
            //     }),
            // ],
            define: {
                // 'global': 'globalThis', // <--- 也可以尝试注释掉，看 nodejs_compat 是否足够
                'process.env': JSON.stringify({}), // 保留这个通常是安全的
            },
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}

runBuild();