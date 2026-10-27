import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,join,normalize,relative} from 'node:path';

// Each tool entry may use shared runtime code but never another tool's files or the all-in-one aggregates,
// so a tool can later move to its own package unchanged.
const src=join(import.meta.dirname,'..','src');
const owners:Record<string,RegExp>={
 photo:/^(ui\/plugins\/photo|ui\/PhotoOverlay|ui\/PhotoEvents|ui\/PhotoPicker|ui\/PhotoSettings|ui\/PublicPhoto\w+|ui\/tools\/PhotoTool|storage\/photo-storage|core\/photo-gps|core\/photo-share|ui\/messages\/(photo\w*|publicPhoto\w+))\.tsx?$/,
 draw:/^(ui\/plugins\/draw|ui\/Drawing\w+|ui\/usePublicDrawings|ui\/tools\/DrawTool|storage\/drawing-storage|core\/drawing|core\/drawing-contract|ui\/messages\/(draw\w*|publicDrawings))\.tsx?$/,
 'data-files':/^(ui\/plugins\/data-files|ui\/DataFilesSettings|ui\/DataFileShare|ui\/PublicDataFilesSettings|ui\/usePublicDataFiles|ui\/tools\/DataFilesTool|ui\/useDataFiles|storage\/data-file-storage|core\/data-files|core\/data-file-share|ui\/messages\/(dataFiles\w*|dataFileShare|publicDataFiles))\.tsx?$/,
 navigation:/^(ui\/plugins\/navigation|ui\/messages\/navigation)\.tsx?$/,
};
const aggregates=new Set(['ui/index.ts','ui/messages.ts','storage/index.ts','core/index.ts','adapters/index.ts']);

function resolve(from:string,specifier:string){
 const base=normalize(join(dirname(from),specifier)).replace(/\.js$/,'');
 for(const ext of ['.ts','.tsx'])if(existsSync(join(src,base+ext)))return base+ext;
 return undefined;
}
function closure(entry:string){
 const seen=new Set<string>(),queue=[entry];
 while(queue.length){
  const file=queue.pop()!;if(seen.has(file))continue;seen.add(file);
  const code=readFileSync(join(src,file),'utf8');
  for(const match of code.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]/g)){
   // Type-only imports are erased at build time and do not couple bundles.
   if(/^(import|export)\s+type\s/.test(match[0]))continue;
   const target=resolve(file,match[1]);if(target)queue.push(target);
  }
 }
 return seen;
}
for(const tool of Object.keys(owners)){
 test(`tools/${tool} reaches only its own files and shared runtime code`,()=>{
  const files=[...closure(`tools/${tool}.ts`)].map(file=>relative('.',file));
  const foreign=files.filter(file=>Object.entries(owners).some(([other,pattern])=>other!==tool&&pattern.test(file)));
  const bundled=files.filter(file=>aggregates.has(file));
  assert.deepEqual(foreign,[],`imports another tool's files`);
  assert.deepEqual(bundled,[],`imports an all-in-one aggregate`);
  assert.ok(files.some(file=>owners[tool].test(file)),'entry exposes the tool itself');
 });
}
