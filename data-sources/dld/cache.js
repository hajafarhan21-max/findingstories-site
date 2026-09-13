import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
export async function readLastKnownGood(path){try{return JSON.parse(await readFile(path,'utf8'))}catch{return null}}
export async function writeLastKnownGood(path,value){await mkdir(dirname(path),{recursive:true});const temp=`${path}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,path)}
