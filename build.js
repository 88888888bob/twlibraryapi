// build.js
const esbuild = require('esbuild');

async function runBuild() {
    try {
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            outfile: 'dist/worker.js',
            platform: 'browser', // 'sanitize-html' 适合浏览器环境
            format: 'esm',
            minify: true,
            sourcemap: true,
            // define: { // 可能只需要很少或不需要 define
            //    'process.env.NODE_ENV': JSON.stringify('production'),
            // },
        });
        console.log("Build successful!");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}
runBuild();