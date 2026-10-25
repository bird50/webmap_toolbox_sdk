import {build,context} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('dist',{recursive:true});await copyFile('index.html','dist/index.html');
// MapLibre 6 loads its worker from a sibling of the bundle (`./maplibre-gl-worker.mjs`), so ship it next to app.js.
await copyFile('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs','dist/maplibre-gl-worker.mjs');
const options={entryPoints:['app.tsx'],bundle:true,outdir:'dist',format:'esm',jsx:'automatic',sourcemap:true,loader:{'.svg':'dataurl'},alias:{react:resolve('node_modules/react'),'react-dom':resolve('node_modules/react-dom')}};
if(process.argv.includes('--serve')){const ctx=await context(options);await ctx.watch();const server=await ctx.serve({servedir:'dist',port:4174});console.log(`SDK example http://localhost:${server.port}`);}else await build(options);
