// Fixed upstream only: client input cannot choose a proxy destination.
export function normalizeReleases(data) {
  const rows=Array.isArray(data)?data:Array.isArray(data?.hits)?data.hits:Array.isArray(data?.hits?.hits)?data.hits.hits:Array.isArray(data?.results)?data.results:null;
  if(!rows)throw new Error('invalid-schema');
  const releases=[],seen=new Set();
  for(const entry of rows){const row=entry?._source||entry;if(!row||typeof row!=='object')continue;
    let hash=String(row.hash||row.infoHash||row.info_hash||'');
    if(!/^[a-f0-9]{40}$/i.test(hash)&&typeof row.magnetUrl==='string'){const match=row.magnetUrl.match(/urn:btih:([a-f0-9]{40})(?:&|$)/i);if(match)hash=match[1]}
    hash=hash.toLowerCase();if(!/^[a-f0-9]{40}$/.test(hash)||seen.has(hash))continue;
    const title=String(row.title||row.name||'Lossless release').slice(0,500);seen.add(hash);
    releases.push({hash,title,seeders:Math.max(0,Number(row.liveSeeders??row.seeders)||0)});if(releases.length>=30)break;
  }return releases;
}
function reply(body,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
const searchCache=new Map();
const freshFor=90000,staleFor=10*60*1000;
export function clearSearchCache(){searchCache.clear()}
export async function handleSearch(request,fetcher=(url,options)=>globalThis.fetch(url,options),{now=()=>Date.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  if(request.method!=='GET')return reply({error:'Use GET to search.',code:'METHOD_NOT_ALLOWED'},405);
  const input=new URL(request.url),q=input.searchParams.get('q')?.trim()||'',lossless=input.searchParams.get('quality')!=='all';
  if(q.length>150)return reply({error:'Enter an artist or album title of 1–150 characters.',code:'INVALID_QUERY'},400);
  const key=(lossless?'lossless:':'all:')+q.toLowerCase(),cached=searchCache.get(key);
  if(cached&&now()-cached.at<freshFor)return reply({source:'Knaben',releases:cached.releases,cached:true});
  const upstream=new URL('https://api.knaben.org/v2/'+(q?'search':'browse'));
  upstream.search=new URLSearchParams({...(q?{q}:{}),c:lossless?'1002000':'1000000',o:'seeders',d:'desc',s:'30'});
  let failure,status=502;
  for(let attempt=0;attempt<2;attempt++){
    const timeout=new AbortController(),cancel=()=>timeout.abort(),timer=setTimeout(cancel,8000);
    if(request.signal.aborted)timeout.abort();else request.signal.addEventListener('abort',cancel,{once:true});
    let retry=false;
    try{
      const response=await fetcher(upstream.href,{method:'GET',headers:{Accept:'application/json'},signal:timeout.signal,redirect:'manual'});
      if(!response.ok){
        const upstreamStatus=response.status;
        status=upstreamStatus===429?429:502;
        failure={code:upstreamStatus===429?'INDEXER_RATE_LIMIT':upstreamStatus===403?'INDEXER_ACCESS_DENIED':'INDEXER_UNAVAILABLE',upstreamStatus,error:upstreamStatus===429?'Music search is rate limited. Wait a minute and retry.':upstreamStatus===403?'The music indexer refused this server. Your AllDebrid key is not the cause.':'The music indexer is temporarily unavailable. Retry search or use a direct audio source.'};
        retry=upstreamStatus>=500;
      }else{
        status=502;
        const contentType=response.headers.get('content-type')||'';
        if(!contentType.includes('json'))failure={error:'The music indexer returned a web page instead of results. Try again later.',code:'INDEXER_NOT_JSON'};
        else{
          let data;try{data=await response.json()}catch(error){if(timeout.signal.aborted||error.name==='AbortError')throw error;failure={error:'The music indexer returned an incomplete response. Retry search.',code:'INDEXER_INVALID_JSON'};retry=error instanceof TypeError}
          if(data!==undefined){
            let releases;try{releases=normalizeReleases(data)}catch{failure={error:'The music indexer changed its response format. No results could be read.',code:'INDEXER_SCHEMA_CHANGED'}}
            if(releases){
              searchCache.delete(key);searchCache.set(key,{releases,at:now()});while(searchCache.size>32)searchCache.delete(searchCache.keys().next().value);
              console.log('cloud_search_ok',JSON.stringify({count:releases.length,mode:q?'search':'browse',lossless,attempts:attempt+1}));
              return reply({source:'Knaben',releases,...(attempt?{recovered:true}:{})});
            }
          }
        }
      }
    }catch(error){
      const aborted=timeout.signal.aborted||error.name==='AbortError';
      failure={error:aborted?'Music search timed out after retrying. Try a shorter artist and album name.':'The music indexer is temporarily unreachable after retrying. Your audio connection is unchanged.',code:aborted?'INDEXER_TIMEOUT':'INDEXER_NETWORK_ERROR'};
      status=aborted?504:502;retry=true;
      console.error('cloud_search_upstream_failed',JSON.stringify({name:String(error.name||'Error'),message:String(error.message||'').slice(0,350),attempt:attempt+1}));
    }finally{clearTimeout(timer);request.signal.removeEventListener('abort',cancel)}
    if(!retry||request.signal.aborted)break;
    if(attempt===0)await wait(250);
  }
  if(cached&&now()-cached.at<staleFor&&!['INDEXER_ACCESS_DENIED','INDEXER_SCHEMA_CHANGED'].includes(failure?.code))return reply({source:'Knaben',releases:cached.releases,cached:true,stale:true,warning:'Showing recent source results while the indexer reconnects. File availability is checked before playback.'});
  const requestId=request.headers.get('cf-ray');
  return reply({...failure,...(requestId?{requestId}:{})},status);
}
