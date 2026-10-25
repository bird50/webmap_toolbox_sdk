import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import {readFile,writeFile} from 'node:fs/promises';
const result=await postcss([tailwind()]).process(await readFile('src/styles.css','utf8'),{from:'src/styles.css',to:'dist/styles.css'});
await writeFile('dist/styles.css',result.css);
