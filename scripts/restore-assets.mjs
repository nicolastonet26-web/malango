import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
const source=new URL('./',import.meta.url),dir=new URL('../public/assets/',import.meta.url);await mkdir(dir,{recursive:true});
for(const file of await readdir(source)){if(file.endsWith('.b64'))await writeFile(new URL(file.slice(0,-4),dir),Buffer.from(await readFile(new URL(file,source),'utf8'),'base64'));}
await writeFile(new URL('mango-reindeer.jpeg',dir),await readFile(new URL('mango-fun.jpeg',dir)));
