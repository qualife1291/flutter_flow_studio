import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dest = fileURLToPath(new URL('../lib/src/web_assets/', import.meta.url));
await mkdir(dest, {recursive:true});
for (const name of await readdir(dest)) await rm(`${dest}/${name}`, {recursive:true,force:true});
await cp(fileURLToPath(new URL('../web_studio/dist/',import.meta.url)), dest, {recursive:true});
