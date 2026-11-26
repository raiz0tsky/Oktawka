/* Spotify library transfer. Only metadata read scopes are requested. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.OktawkaSpotifyCore=api;
})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  const scopes=['playlist-read-private','playlist-read-collaborative','user-library-read'];
  const apiOrigin='https://api.spotify.com';
  function apiURL(value){
    const url=new URL(value.startsWith('/')?'/v1'+value:value,apiOrigin);
    if(url.origin!==apiOrigin||!url.pathname.startsWith('/v1/')||url.username||url.password)throw new Error('Spotify returned an invalid page address.');
    return url.href;
  }
  function spotifyURL(kind,id){
    return /^[a-zA-Z0-9]{22}$/.test(id||'')?'https://open.spotify.com/'+kind+'/'+id:'';
  }
  function normalizeTrack(row){
    const t=row?.item||row?.track||row;
    if(!t||t.type==='episode'||t.is_local||typeof t.name!=='string'||!t.id)return null;
    const artist=Array.isArray(t.artists)?t.artists.map(a=>a?.name).filter(a=>typeof a==='string'&&a.trim()):[];
    const link=spotifyURL('track',t.id);
    if(!link||!artist.length||!t.name.trim())return null;
    return {id:'spotify:'+t.id,spotifyId:t.id,title:t.name.slice(0,300),artist:artist[0].slice(0,160),credits:artist.join(', ').slice(0,500),album:String(t.album?.name||'').slice(0,300),duration:Number.isFinite(t.duration_ms)?Math.max(0,t.duration_ms/1000):0,spotifyUrl:link};
  }
  function normalizePlaylist(p){
    if(!p||typeof p.name!=='string'||!spotifyURL('playlist',p.id))return null;
    return {id:p.id,title:p.name.slice(0,300),owner:String(p.owner?.display_name||'').slice(0,160),ownerId:String(p.owner?.id||''),collaborative:!!p.collaborative,total:Number(p.items?.total??p.tracks?.total)||0,snapshot:String(p.snapshot_id||''),spotifyUrl:spotifyURL('playlist',p.id)};
  }
  function randomString(crypto,length=48){
    return Array.from(crypto.getRandomValues(new Uint8Array(length)),n=>n.toString(16).padStart(2,'0')).join('');
  }
  async function challenge(crypto,verifier){
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
    let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function authorizationURL({clientId,redirectUri,state,codeChallenge}){
    if(!/^[a-f0-9]{32}$/i.test(clientId))throw new Error('Enter the 32-character Spotify Client ID.');
    const redirect=new URL(redirectUri);
    if(redirect.protocol!=='https:'&&!(redirect.protocol==='http:'&&['127.0.0.1','[::1]'].includes(redirect.hostname)))throw new Error('Spotify needs an HTTPS redirect address.');
    const url=new URL('https://accounts.spotify.com/authorize');
    url.search=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirect.href,scope:scopes.join(' '),state,code_challenge_method:'S256',code_challenge:codeChallenge});
    return url.href;
  }
  function validateCallback(pending,params,now=Date.now()){
    if(!pending||typeof pending.verifier!=='string'||!pending.state||pending.state!==params.get('state'))throw new Error('Spotify sign-in could not be verified. Connect again.');
    if(!Number.isFinite(pending.createdAt)||now-pending.createdAt>15*60*1000||now<pending.createdAt)throw new Error('Spotify sign-in expired. Connect again.');
    if(params.get('error'))throw new Error(params.get('error')==='access_denied'?'Spotify access was cancelled.':'Spotify sign-in failed. Connect again.');
    const code=params.get('code');if(!code||code.length>4096)throw new Error('Spotify did not return an authorization code.');
    return code;
  }
  function createClient({fetch:fetcher,getToken,refreshToken}){
    let blockedUntil=0;
    async function request(path,{signal,retry=true}={}){
      if(Date.now()<blockedUntil){const error=new Error('Spotify is busy. Try again after '+new Date(blockedUntil).toLocaleTimeString()+'.');error.code='RATE_LIMIT';error.retryAt=blockedUntil;throw error}
      const url=apiURL(path),token=await getToken();
      if(!token){const error=new Error('Connect Spotify to refresh your library.');error.code='AUTH_REQUIRED';throw error}
      const controller=new AbortController();
      const abort=()=>controller.abort();if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,20000);let response;
      try{response=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+token},signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error'})}
      catch(error){if(error.name==='AbortError')throw error;throw new Error('Spotify could not be reached. Your saved library is still available.')}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
      if(response.status===401&&retry&&refreshToken){await refreshToken();return request(path,{signal,retry:false})}
      if(response.status===401){const error=new Error('Your Spotify connection expired. Connect again.');error.code='AUTH_REQUIRED';throw error}
      if(response.status===403){const error=new Error('Spotify denied access. Check the app’s allowed users and Premium requirements. Some followed playlists cannot be imported.');error.code='FORBIDDEN';throw error}
      if(response.status===404){const error=new Error('This Spotify playlist is no longer available.');error.code='NOT_FOUND';throw error}
      if(response.status===429){const seconds=Math.min(86400,Math.max(1,Number(response.headers.get('Retry-After'))||30));blockedUntil=Date.now()+seconds*1000;const error=new Error('Spotify’s request limit was reached. Try again in '+seconds+' seconds.');error.code='RATE_LIMIT';error.retryAt=blockedUntil;throw error}
      if(!response.ok)throw new Error('Spotify could not load this part of your library. Try again later.');
      let data;try{data=await response.json()}catch{throw new Error('Spotify returned an unreadable response.')}
      return data;
    }
    async function pages(path,{signal,maxItems=20000,onPage=()=>{}}={}){
      const result=[],seen=new Set();let next=apiURL(path),total=0;
      while(next){
        if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
        if(seen.has(next))throw new Error('Spotify returned a repeated page. Your previous import is unchanged.');
        seen.add(next);
        const data=await request(next,{signal});
        if(!Array.isArray(data?.items))throw new Error('Spotify returned an invalid library page.');
        total=Math.max(total,Number(data.total)||0);
        result.push(...data.items.slice(0,maxItems-result.length));
        onPage(result.length,total);
        next=data.next?apiURL(data.next):null;
        if(result.length>=maxItems)return{items:result,total,truncated:!!next||total>result.length};
      }
      return{items:result,total,truncated:false};
    }
    async function playlistItems(id,options){
      if(!spotifyURL('playlist',id))throw new Error('Invalid Spotify playlist.');
      try{return await pages('/playlists/'+id+'/items?limit=50',options)}
      catch(error){if(error.code!=='NOT_FOUND')throw error;return pages('/playlists/'+id+'/tracks?limit=50',options)}
    }
    return{request,pages,playlistItems};
  }
  return{scopes,apiURL,spotifyURL,normalizeTrack,normalizePlaylist,randomString,challenge,authorizationURL,validateCallback,createClient};
});
