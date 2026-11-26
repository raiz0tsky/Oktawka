import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const run=args=>execFileSync(process.execPath,args,{stdio:'inherit'});
for(const dir of ['dist','worker'])for(const file of readdirSync(dir))if(/\.(m?js)$/.test(file))run(['--check',`${dir}/${file}`]);
// artifact.mjs needs build/ first (see build-worker.mjs); android.mjs reads the bundle prepare.mjs writes.
run(['android/tools/prepare.mjs']);
for(const file of readdirSync('tests').sort())if(/\.(cjs|mjs)$/.test(file)&&file!=='artifact.mjs')run([`tests/${file}`]);
