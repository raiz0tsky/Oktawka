const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('dist/streaming.js','utf8');
function setup(mode='adaptive',connection={}){const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)};const ctx={window:{},document:{getElementById:el},$:el,navigator:{connection},localStorage:{getItem:k=>k==='oktawka-hifi'?'https://service.example':mode},URL,URLSearchParams,AbortController,DOMException,setTimeout,clearTimeout,atob,tracks:[],current:-1};vm.runInNewContext(source,ctx);return {api:ctx.window.OktawkaStreaming,ctx}}
const track={title:'Song',artist:'Artist',album:'Album',duration:180,id:'apple-1'},item={id:7,title:'Song',artist:{name:'Artist'},album:{title:'Album'},duration:181,allowStreaming:true};
assert.equal(setup().api.match(item,track),true);assert.equal(setup().api.match({...item,title:'Song Live'},track),false);assert.equal(setup().api.match({...item,album:{title:'Other'}},track),false);assert.equal(setup().api.match({...item,duration:150},track),false);
assert.deepEqual(Array.from(setup().api.qualities()),['LOSSLESS','HIGH']);assert.deepEqual(Array.from(setup('adaptive',{saveData:true}).api.qualities()),['HIGH','LOW']);assert.deepEqual(Array.from(setup('lossless').api.qualities()),['LOSSLESS']);
const d={trackId:7,assetPresentation:'FULL',manifestMimeType:'application/vnd.tidal.bts',manifest:btoa(JSON.stringify({encryptionType:'NONE',mimeType:'audio/flac',codecs:'flac',urls:['https://audio.example/song.flac']}))};
const parsed=setup().api.manifest(d,7,'LOSSLESS');assert.equal(parsed.sourceCodec,'FLAC');assert.equal(parsed.lossless,false);assert.throws(()=>setup().api.manifest({...d,assetPresentation:'PREVIEW'},7,'LOSSLESS'));assert.throws(()=>setup().api.manifest(d,8,'LOSSLESS'));assert.throws(()=>setup().api.manifest({...d,manifestMimeType:'application/dash+xml'},7,'LOSSLESS'));
(async()=>{const {api,ctx}=setup('lossless');const requests=[];ctx.fetch=async(u,o)=>{requests.push({url:String(u),options:o});return {ok:true,json:async()=>String(u).includes('/search/')?{data:{items:[item]}}:{data:d}}};const result=await api.resolve(track,new AbortController().signal);assert.equal(result.sourceCodec,'FLAC');assert.equal(requests.length,2);assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.headers,undefined);assert.match(requests[1].url,/quality=LOSSLESS/);const abort=new AbortController();abort.abort();ctx.fetch=async()=>{throw new DOMException('Cancelled','AbortError')};await assert.rejects(api.resolve(track,abort.signal),/Cancelled/);console.log('PASS: exact matching, connection-aware quality, full-track validation, unverified FLAC labels, credential isolation and cancellation.');})();

(async()=>{
 const {api,ctx}=setup('hires');assert.deepEqual(Array.from(api.qualities()),['HI_RES_LOSSLESS','LOSSLESS']);
 ctx.setTimeout=(fn,ms)=>setTimeout(fn,ms===12000?12000:0);
 const queued={requestId:'abc-123',statusUrl:'/playback/requests/abc-123',cancelUrl:'/playback/requests/abc-123',queuePosition:1};
 let calls=[];ctx.fetch=async(u,o)=>{calls.push({url:String(u),method:o.method});return calls.length===1?{ok:true,status:202,json:async()=>queued}:{ok:true,status:200,json:async()=>({data:d})}};
 assert.equal((await api.get('track',{id:7},new AbortController().signal)).data.trackId,7);assert.equal(calls.length,2);assert.match(calls[1].url,/playback\/requests/);
 assert.throws(()=>api.queueURL('https://attacker.example/playback/requests/abc-123','https://service.example','abc-123'));
 const controller=new AbortController();calls=[];ctx.fetch=async(u,o)=>{calls.push(o.method);if(o.method==='DELETE')return {ok:true,status:204};controller.abort();return {ok:true,status:202,json:async()=>queued}};
 await assert.rejects(api.get('track',{id:7},controller.signal),/Cancelled/);assert.deepEqual(calls,['GET','DELETE']);
 calls=[];ctx.fetch=async(u,o)=>{calls.push(String(u));if(String(u).includes('/search/'))return {ok:true,status:200,json:async()=>({data:{items:[item]}})};return {ok:true,status:200,json:async()=>({data:String(u).includes('HI_RES_LOSSLESS')?{...d,manifestMimeType:'application/dash+xml'}:d})}};
 const result=await api.resolve(track,new AbortController().signal);assert.equal(result.requestedQuality,'LOSSLESS');assert.equal(result.qualityFallback,true);assert.equal(result.sourceCodec,'FLAC');
 ctx.fetch=async()=>({ok:false,status:401});await assert.rejects(api.get('track',{id:7},new AbortController().signal),/account access failed/);
 console.log('PASS: HiFi queue completion, same-origin queue URLs, cancellation DELETE, hi-res-to-FLAC fallback and account diagnostics.');
})().catch(e=>{console.error(e);process.exitCode=1});
