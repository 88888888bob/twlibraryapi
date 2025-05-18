// build.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            platform: 'node', // <--- 修改这里
            format: 'esm',
            minify: true,
            sourcemap: true,
            plugins: [
                polyfillNode({
                    // 暂时保留默认的 polyfills，看 platform: 'node' 是否足够
                }),
            ],
            define: {
                'process.env': JSON.stringify({ NODE_ENV: 'production' }),
            },
            // conditions: ['worker', 'workerd', 'node', 'import', 'module'], // 这些在 platform: 'node' 时可能行为不同
            // mainFields: ['module', 'main'], // platform: 'node' 时，'main' 可能更受青睐
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}
runBuild();