// Public station URLs only; never forwards visitor headers or buffers full audio.
export const RADIO_STREAMS={main:'flac',mellow:'mellow-flac',rock:'rock-flac',eclectic:'eclectic-flac'};
export async function handleRadio(request,fetcher=(url,options)=>globalThis.fetch(url,options)){
 const fail=(error,status)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 const params=new URL(request.url).searchParams,station=params.get('station')||'main';
 if(!['GET','HEAD'].includes(request.method))return fail('Use GET to listen.',405);
 if(!Object.hasOwn(RADIO_STREAMS,station))return fail('Unknown station.',400);
 const headers={Accept:'audio/flac, audio/x-flac, */*'};const range=request.headers.get('Range');if(range==='bytes=0-4095')headers.Range=range;
 let url='https://stream.radioparadise.com/'+RADIO_STREAMS[station];
 try{
  for(let i=0;i<4;i++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);let upstream;try{upstream=await fetcher(url,{method:'GET',headers,redirect:'manual',signal:controller.signal})}finally{clearTimeout(timer)}
   if(upstream.status>=300&&upstream.status<400){const next=new URL(upstream.headers.get('Location')||'',url);await upstream.body?.cancel();if(next.protocol!=='https:'||!next.hostname.endsWith('.radioparadise.com')||next.port||next.username||next.password)throw Error('Unexpected stream redirect');url=next.href;continue}
   if(!upstream.ok||!upstream.body){await upstream.body?.cancel();return fail('Radio Paradise is unavailable. Try another mix or retry shortly.',502)}
   const type=upstream.headers.get('Content-Type')||'audio/flac';if(!/audio\/(?:x-)?flac|application\/ogg|audio\/ogg|application\/octet-stream/i.test(type)){await upstream.body.cancel();return fail('The station did not return a FLAC audio stream.',502)}
   console.log('radio_stream_open',JSON.stringify({station,status:upstream.status,type}));
   const out=new Headers({'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'none'});
   // Streaming response: downstream cancellation releases the upstream reader.
   if(request.method==='HEAD'){await upstream.body.cancel();return new Response(null,{headers:out})}return new Response(upstream.body,{status:200,headers:out});
  }throw Error('Too many redirects');
 }catch(e){console.error('radio_stream_failed',JSON.stringify({station,message:String(e.message).slice(0,120)}));return fail('Could not connect to this FLAC station. Retry or try another mix.',502)}
}
