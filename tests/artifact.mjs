import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const code=await readFile(new URL('../build/dist/server/index.js',import.meta.url),'utf8');const mod=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const [path,type] of [['/','text/html'],['/addons.js','text/javascript'],['/style.css','text/css'],['/spotify.js','text/javascript'],['/spotify-core.js','text/javascript'],['/spotify.css','text/css']]){const r=await mod.default.fetch(new Request('https://mono.example'+path));assert.equal(r.status,200);assert(r.headers.get('Content-Type').includes(type));assert((await r.text()).length>0)}
assert.equal((await mod.default.fetch(new Request('https://mono.example/api/cloud-search?q='+'x'.repeat(151)))).status,400);assert.equal((await mod.default.fetch(new Request('https://mono.example/missing'))).status,404);
console.log('PASS: packaged Worker serves the player and assets, routes cloud API requests, and handles missing paths.');
