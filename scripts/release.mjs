// Collects changes/*.md into a new CHANGELOG.md section and bumps the package version (see changes/README.md).
import {readFileSync,readdirSync,unlinkSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const dir='changes';
const fragments=readdirSync(dir).filter(name=>name.endsWith('.md')&&name!=='README.md').sort();
if(!fragments.length){console.error('No change fragments in changes/.');process.exit(1);}
const order=['major','minor','patch'];
let bump='patch';
const areas=new Map();
for(const name of fragments){
 let text=readFileSync(`${dir}/${name}`,'utf8').trim();
 const header=text.match(/^bump:\s*(major|minor|patch)\s*\n?/);
 if(header){if(order.indexOf(header[1])<order.indexOf(bump))bump=header[1];text=text.slice(header[0].length).trim();}
 const area=name.split('-')[0]==='data'?'data-files':name.split('-')[0];
 areas.set(area,[...(areas.get(area)??[]),text]);
}
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const [major,minor,patch]=pkg.version.split('.').map(Number);
const version=process.argv[2]??(bump==='major'?`${major+1}.0.0`:bump==='minor'?`${major}.${minor+1}.0`:`${major}.${minor}.${patch+1}`);
if(!/^\d+\.\d+\.\d+$/.test(version)){console.error(`Invalid version ${version}`);process.exit(1);}
const titles={shared:'Shared runtime',photo:'Photo',draw:'Draw','data-files':'Data Files',navigation:'Navigation'};
const section=[`## ${version}`,'',...[...areas].flatMap(([area,texts])=>[`### ${titles[area]??area}`,'',...texts.map(text=>`${text}\n`)])].join('\n');
const changelog=readFileSync('CHANGELOG.md','utf8');
writeFileSync('CHANGELOG.md',changelog.replace(/^# Changelog\n\n/,`# Changelog\n\n${section}\n`));
for(const name of fragments)unlinkSync(`${dir}/${name}`);
execFileSync('npm',['version',version,'--no-git-tag-version'],{stdio:'inherit'});
console.log(`CHANGELOG.md and package.json updated to ${version} from ${fragments.length} fragment(s).`);
