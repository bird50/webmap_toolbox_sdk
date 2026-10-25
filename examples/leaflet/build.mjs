import {build,context} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('dist',{recursive:true});await copyFile('index.html','dist/index.html');
const options={entryPoints:['app.tsx'],bundle:true,outdir:'dist',format:'esm',jsx:'automatic',sourcemap:true,loader:{'.png':'dataurl','.svg':'dataurl'},alias:{react:resolve('node_modules/react'),'react-dom':resolve('node_modules/react-dom')}};
if(process.argv.includes('--serve')){const ctx=await context(options);await ctx.watch();const server=await ctx.serve({servedir:'dist',port:4175});console.log(`Leaflet example http://localhost:${server.port}`);}else await build(options);
