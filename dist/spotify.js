/* Read-only Spotify library sync. Audio is resolved by Oktawka's existing sources. */
(()=>{
  'use strict';
  const core=window.OktawkaSpotifyCore;
  const icon=name=>`<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
  const keys={auth:'oktawka-spotify-session',pending:'oktawka-spotify-pkce',client:'oktawka-spotify-client'};
  const redirectUri=location.origin+'/';
  let auth=null,profile=null,cache={accountId:'',collections:[],syncedAt:0},playlists=[],controller=null,refreshing=null,clientId='',configuration=null;
  let dialogVersion=0,busy=false,lastMessage='',database,authVersion=0;
  try{auth=JSON.parse(sessionStorage.getItem(keys.auth)||'null');if(!auth?.access_token)auth=null;profile=auth?.profile||null}catch{}
  const client=core.createClient({fetch:(...args)=>fetch(...args),getToken:accessToken,refreshToken:refresh});
  const library=document.createElement('section');library.id='spotify-library';library.className='spotify-library';
  const likedSection=document.createElement('section');likedSection.id='spotify-liked';likedSection.className='spotify-liked';
  $('#home-main').append(library,likedSection);

  function databaseOpen(){
    if(!database)database=new Promise((resolve,reject)=>{
      const request=indexedDB.open('oktawka-spotify',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('library');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(new Error('Device storage is unavailable.'));
    });
    return database;
  }
  async function readCache(){
    const db=await databaseOpen();
    return new Promise((resolve,reject)=>{const tx=db.transaction('library','readonly');const r=tx.objectStore('library').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  }
  async function writeCache(value){
    const db=await databaseOpen();
    return new Promise((resolve,reject)=>{const tx=db.transaction('library','readwrite');tx.objectStore('library').put(value,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(new Error('Not enough device storage. The previous import is unchanged.'));tx.onabort=()=>reject(new Error('The import could not be saved. The previous import is unchanged.'))});
  }
  function validCache(value){
    if(!value||!Array.isArray(value.collections))return null;
    const collections=value.collections.filter(c=>c&&typeof c.id==='string'&&typeof c.title==='string'&&Array.isArray(c.tracks));
    for(const c of collections)c.tracks=c.tracks.filter(t=>t&&typeof t.title==='string'&&typeof t.artist==='string'&&core.spotifyURL('track',t.spotifyId));
    return{accountId:String(value.accountId||''),collections,syncedAt:Number(value.syncedAt)||0};
  }
  function persistAuth(){
    try{if(auth?.remember)sessionStorage.setItem(keys.auth,JSON.stringify({...auth,profile}));else sessionStorage.removeItem(keys.auth)}catch{}
  }
  function clearAuth(){authVersion++;auth=null;profile=null;try{sessionStorage.removeItem(keys.auth)}catch{}renderLibrary()}
  async function tokenRequest(params){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal,redirect:'error'});
      const data=await response.json();
      if(!response.ok||typeof data.access_token!=='string'){clearAuth();throw new Error('Spotify sign-in expired or was rejected. Connect again.')}
      if(data.scope&&!core.scopes.every(scope=>data.scope.split(' ').includes(scope))){clearAuth();throw new Error('Spotify did not grant all library permissions. Connect again and allow playlist and saved-song access.')}
      return data;
    }catch(error){if(error.name==='AbortError')throw new Error('Spotify sign-in timed out. Connect again.');throw error}
    finally{clearTimeout(timer)}
  }
  async function refresh(){
    if(refreshing)return refreshing;
    if(!auth?.refresh_token){clearAuth();throw new Error('Connect Spotify to refresh your library.')}
    refreshing=(async()=>{
      const old=auth;
      const version=authVersion;
      const data=await tokenRequest({grant_type:'refresh_token',refresh_token:old.refresh_token,client_id:old.clientId});
      if(version!==authVersion)throw new Error('Spotify was disconnected. Connect again.');
      auth={...old,...data,refresh_token:data.refresh_token||old.refresh_token,expiresAt:Date.now()+(Number(data.expires_in)||3600)*1000};persistAuth();
      return auth.access_token;
    })();
    try{return await refreshing}finally{refreshing=null}
  }
  async function accessToken(){
    if(!auth)return null;
    if(auth.expiresAt>Date.now()+30000)return auth.access_token;
    return refresh();
  }
  async function getConfiguration(){
    if(!configuration)configuration=(async()=>{
      try{const response=await fetch('/api/spotify-config',{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(/^[a-f0-9]{32}$/i.test(data.clientId||''))return data.clientId}catch{}
      try{return localStorage.getItem(keys.client)||''}catch{return ''}
    })();
    clientId=await configuration;return clientId;
  }
  async function authorize(id,remember){
    const verifier=core.randomString(crypto,48),state='oktawka_spotify_'+core.randomString(crypto,24);
    const codeChallenge=await core.challenge(crypto,verifier);
    const url=core.authorizationURL({clientId:id,redirectUri,state,codeChallenge});
    sessionStorage.setItem(keys.pending,JSON.stringify({clientId:id,verifier,state,redirectUri,remember,createdAt:Date.now()}));
    try{localStorage.setItem(keys.client,id)}catch{}
    location.assign(url);
  }
  function message(text){lastMessage=text;const status=$('#spotify-status');if(status)status.textContent=text}
  function sessionName(){return profile?.display_name||'Spotify account'}
  async function getProfile(){
    if(profile)return profile;
    const me=await client.request('/me');
    if(typeof me.id!=='string')throw new Error('Spotify could not identify this account.');
    profile={id:me.id,display_name:String(me.display_name||'Spotify account').slice(0,160)};
    if(cache.accountId&&cache.accountId!==me.id)cache={accountId:me.id,collections:[],syncedAt:0};
    persistAuth();renderLibrary();return profile;
  }
  function trackCount(count){return count.toLocaleString()+' '+(count===1?'track':'tracks')}
  function timestamp(value){return value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not synced yet'}
  function renderLibrary(){
    library.innerHTML=`<div class="section-heading"><div><h2>Spotify</h2><p>${cache.syncedAt?'Last synced '+escapeHTML(timestamp(cache.syncedAt)):'Your playlists and liked songs, together.'}</p></div><button id="spotify-library-manage">${auth?'Sync Spotify':'Connect Spotify'}</button></div>${cache.collections.length?'<div class="spotify-collections">'+cache.collections.map((c,i)=>`<button class="spotify-collection-card ${c.id==='liked'?'spotify-favorites':''}" data-spotify-collection="${i}"><span class="spotify-collection-art">${icon(c.id==='liked'?'favorite':'queue_music')}</span><span><b>${escapeHTML(c.title)}</b><small>${trackCount(c.tracks.length)} · Spotify</small></span>${icon('chevron_right')}</button>`).join('')+'</div>':'<div class="spotify-intro">'+icon('sync')+'<div><b>Bring your Spotify library</b><p>Sync your playlists and Liked Songs into Oktawka.</p></div><button id="spotify-library-start">Connect</button></div>'}`;
    $('#spotify-library-manage').onclick=open;
    $('#spotify-library-start')?.addEventListener('click',open);
    library.querySelectorAll('[data-spotify-collection]').forEach(b=>b.onclick=()=>openCollection(cache.collections[Number(b.dataset.spotifyCollection)]));
    const favorites=cache.collections.find(c=>c.id==='liked');
    likedSection.hidden=!favorites;
    likedSection.innerHTML=favorites?`<div class="section-heading"><div><h2>Liked Songs from Spotify</h2><p>${trackCount(favorites.tracks.length)} synced</p></div><button id="spotify-open-likes">View songs ${icon('arrow_forward')}</button></div>`:'';
    $('#spotify-open-likes')?.addEventListener('click',()=>openCollection(favorites));
  }
  function openCollection(collection){
    if(!collection)return;
    const version=++dialogVersion;let page=0,query='';
    const sourceLink=collection.id==='liked'?'https://open.spotify.com/collection/tracks':core.spotifyURL('playlist',collection.id);
    modal(`<div class="eyebrow spotify-attribution">Imported from Spotify</div><h2>${escapeHTML(collection.title)}</h2><p>${trackCount(collection.tracks.length)} · synced ${escapeHTML(timestamp(collection.syncedAt||cache.syncedAt))}</p><div class="spotify-collection-actions"><button class="primary" id="spotify-play-collection">${icon('play_arrow')}Play in Oktawka</button><a href="${sourceLink}" target="_blank" rel="noopener noreferrer">Open in Spotify ${icon('open_in_new')}</a></div><p class="note">Imported track list. Playback uses your connected audio sources.</p><label class="sr-only" for="spotify-track-search">Search this playlist</label><input type="search" id="spotify-track-search" placeholder="Search this playlist"><div id="spotify-track-rows"></div><div class="spotify-pagination"><button id="spotify-page-prev">${icon('chevron_left')}Previous</button><span id="spotify-page-label"></span><button id="spotify-page-next">Next${icon('chevron_right')}</button></div>`);
    function rows(){
      if(dialogVersion!==version)return;
      const visible=collection.tracks.map((t,i)=>({t,i})).filter(({t})=>(t.title+' '+t.artist).toLowerCase().includes(query));
      page=Math.min(page,Math.max(0,Math.ceil(visible.length/50)-1));
      $('#spotify-track-rows').innerHTML=visible.slice(page*50,page*50+50).map(({t,i})=>`<div class="spotify-track-row"><button data-spotify-track="${i}" aria-label="Play ${escapeHTML(t.title)} in Oktawka"><span>${i+1}</span><span><b>${escapeHTML(t.title)}</b><small>${escapeHTML(t.credits||t.artist)}</small></span>${icon('play_arrow')}</button><a href="${core.spotifyURL('track',t.spotifyId)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHTML(t.title)} in Spotify">${icon('open_in_new')}</a></div>`).join('')||'<p class="note">No matching songs.</p>';
      $('#spotify-page-prev').disabled=page===0;$('#spotify-page-next').disabled=(page+1)*50>=visible.length;
      $('#spotify-page-label').textContent=visible.length?(page*50+1)+'–'+Math.min((page+1)*50,visible.length)+' of '+visible.length:'0 songs';
      $('#spotify-track-rows').querySelectorAll('[data-spotify-track]').forEach(b=>b.onclick=()=>window.OktawkaFlow?.playAlbum(collection.tracks,Number(b.dataset.spotifyTrack)));
    }
    $('#spotify-play-collection').disabled=!collection.tracks.length;
    $('#spotify-play-collection').onclick=()=>window.OktawkaFlow?.playAlbum(collection.tracks,0);
    $('#spotify-track-search').oninput=e=>{query=e.target.value.toLowerCase();page=0;rows()};
    $('#spotify-page-prev').onclick=()=>{page--;rows()};$('#spotify-page-next').onclick=()=>{page++;rows()};rows();
  }
  function setupHTML(){
    return `<h2>Connect Spotify</h2><p>Bring your playlists and Liked Songs into Oktawka.</p><form id="spotify-connect-form">${clientId?'<p class="spotify-permissions">'+icon('check_circle')+'Ready to connect securely with Spotify.</p>':`<label for="spotify-client-id">Spotify app Client ID</label><input id="spotify-client-id" type="text" maxlength="32" autocomplete="off" spellcheck="false" placeholder="32-character Client ID"><details class="spotify-setup"><summary>Set up Spotify access</summary><ol><li>Create an app in the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">Spotify Developer Dashboard</a> and select Web API.</li><li>Add this exact Redirect URI:<code>${escapeHTML(redirectUri)}</code></li><li>Paste the app’s Client ID above. A Client Secret is never needed.</li></ol><p class="note">Development-mode apps require the app owner to have Spotify Premium. Other users must be added to the app’s allowed users.</p></details>`}<label class="spotify-remember"><input type="checkbox" id="spotify-remember">Keep connected in this tab across refreshes</label><p class="note">Read-only access to playlists and saved songs. Imported metadata stays on this device. Spotify does not supply audio to Oktawka.</p><button class="primary" type="submit" id="spotify-authorize">Continue with Spotify ${icon('arrow_forward')}</button></form><p id="spotify-status" role="status" aria-live="polite"></p>${cache.syncedAt?'<button class="spotify-text-button" id="spotify-cached-library">View imported library</button>':''}`;
  }
  function renderConnected(){
    modal(`<h2>Sync Spotify</h2><p>Connected as ${escapeHTML(sessionName())}</p><div class="spotify-sync-options"><label><input type="checkbox" id="spotify-select-liked" ${!cache.syncedAt||cache.collections.some(c=>c.id==='liked')?'checked':''}>${icon('favorite')}<span><b>Liked Songs</b><small>Your saved songs on Spotify</small></span></label></div><div class="section-heading spotify-select-heading"><h3>Your playlists</h3><button id="spotify-select-all">Select all</button></div><p class="note">Choose playlists to import. Refresh updates additions, removals, and track order.</p><div id="spotify-playlist-choices"><p class="note">Loading your playlists…</p></div><p id="spotify-status" role="status" aria-live="polite">${escapeHTML(lastMessage)}</p><div class="spotify-sync-actions"><button class="primary" id="spotify-sync-now">${icon('sync')}Sync selected</button><button id="spotify-cancel-sync" hidden>Cancel</button><button class="spotify-text-button" id="spotify-disconnect">Disconnect</button></div><p class="note spotify-account-note">Read-only sync · ${escapeHTML(timestamp(cache.syncedAt))}</p>`);
    $('#spotify-sync-now').onclick=syncSelected;
    $('#spotify-cancel-sync').onclick=()=>controller?.abort();
    $('#spotify-disconnect').onclick=()=>{controller?.abort();clearAuth();message('Disconnected. Your imported library remains on this device.');open()};
    $('#spotify-select-all').onclick=()=>{const boxes=[...document.querySelectorAll('[data-spotify-select]')],all=boxes.every(b=>b.checked);boxes.forEach(b=>b.checked=!all);$('#spotify-select-all').textContent=all?'Select all':'Deselect all'};
  }
  function setBusy(value){
    busy=value;$('#spotify-sync-now')?.toggleAttribute('disabled',value);$('#spotify-cancel-sync')?.toggleAttribute('hidden',!value);
    $('#spotify-playlist-choices')?.querySelectorAll('input').forEach(n=>n.disabled=value);
    if($('#spotify-select-liked'))$('#spotify-select-liked').disabled=value;
    if($('#spotify-select-all'))$('#spotify-select-all').disabled=value;
    if($('#spotify-disconnect'))$('#spotify-disconnect').disabled=value;
  }
  async function loadPlaylists(version){
    try{
      const data=await client.pages('/me/playlists?limit=50',{maxItems:1000});
      if(version!==dialogVersion||!$('#spotify-playlist-choices'))return;
      playlists=data.items.map(core.normalizePlaylist).filter(Boolean);
      $('#spotify-playlist-choices').innerHTML=playlists.map((p,i)=>`<label class="spotify-playlist-choice"><input type="checkbox" data-spotify-select="${i}" ${cache.collections.some(c=>c.id===p.id)?'checked':''}><span><b>${escapeHTML(p.title)}</b><small>${trackCount(p.total)}${p.owner?' · '+escapeHTML(p.owner):''}</small></span><a href="${p.spotifyUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHTML(p.title)} in Spotify">${icon('open_in_new')}</a></label>`).join('')||'<p class="note">No playlists found. You can still sync Liked Songs.</p>';
      if(data.truncated)message('Showing the first 1,000 playlists.');
    }catch(error){if(version!==dialogVersion)return;$('#spotify-playlist-choices').innerHTML='<p class="note">Playlists could not load. Reopen Sync Spotify to retry.</p>';message(error.message)}
  }
  async function syncSelected(){
    if(busy)return;
    const selected=[...document.querySelectorAll('[data-spotify-select]:checked')].map(b=>playlists[Number(b.dataset.spotifySelect)]);
    const includeLiked=$('#spotify-select-liked').checked;
    if(!selected.length&&!includeLiked)return message('Select Liked Songs or at least one playlist.');
    const version=dialogVersion,signal=(controller=new AbortController()).signal;
    setBusy(true);
    const collections=cache.collections.slice(),warnings=[];let completed=0;
    const jobs=[...(includeLiked?[{id:'liked',title:'Liked Songs'}]:[]),...selected];
    try{
      for(const item of jobs){
        if(signal.aborted)throw new DOMException('Cancelled','AbortError');
        message('Syncing '+item.title+'… '+completed+' of '+jobs.length+' complete.');
        try{
          const options={signal,maxItems:20000,onPage:(count,total)=>message('Syncing '+item.title+' · '+count.toLocaleString()+(total?' of '+total.toLocaleString():'')+' items…')};
          const data=item.id==='liked'?await client.pages('/me/tracks?limit=50',options):await client.playlistItems(item.id,options);
          const normalized=data.items.map(core.normalizeTrack).filter(Boolean);
          const rows=item.id==='liked'?[...new Map(normalized.map(t=>[t.spotifyId,t])).values()]:normalized;
          const collection={...item,tracks:rows,syncedAt:Date.now(),skipped:data.items.length-normalized.length,truncated:data.truncated};
          const index=collections.findIndex(c=>c.id===item.id);if(index>=0)collections[index]=collection;else collections.push(collection);
          completed++;
          if(collection.skipped)warnings.push(item.title+': '+collection.skipped+' local, unavailable, or non-music items skipped.');
          if(data.truncated)warnings.push(item.title+': first 20,000 items imported.');
        }catch(error){if(error.name==='AbortError'||['RATE_LIMIT','AUTH_REQUIRED'].includes(error.code))throw error;warnings.push(item.title+': '+error.message)}
      }
      if(!completed)throw new Error(warnings.join(' ')||'Nothing could be synced. Your previous library is unchanged.');
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      const next={accountId:profile.id,collections,syncedAt:Date.now()};
      await writeCache(next);cache=next;renderLibrary();
      const accountNote=$('.spotify-account-note');if(accountNote)accountNote.textContent='Read-only sync · '+timestamp(cache.syncedAt);
      message(completed+' '+(completed===1?'collection':'collections')+' synced. '+warnings.join(' '));
      toast('Spotify library synced. Find it in Your library.');
    }catch(error){message(error.name==='AbortError'?'Sync cancelled. Your previous library is unchanged.':error.message)}
    finally{controller=null;busy=false;if(version===dialogVersion)setBusy(false)}
  }
  async function open(){
    if(busy){message('Sync is already running.');return}
    const version=++dialogVersion;lastMessage='';
    if(!auth){await getConfiguration();if(version!==dialogVersion)return;modal(setupHTML());$('#spotify-connect-form').onsubmit=async e=>{e.preventDefault();const b=$('#spotify-authorize');b.disabled=true;try{await authorize(clientId||$('#spotify-client-id').value.trim(),$('#spotify-remember').checked)}catch(error){message(error.message);b.disabled=false}};$('#spotify-cached-library')?.addEventListener('click',()=>{$('#dialog').close();window.OktawkaNavigate?.('library')});return}
    modal('<h2>Sync Spotify</h2><p id="spotify-status" role="status">Checking your connection…</p>');
    try{await getProfile();if(version!==dialogVersion)return;renderConnected();loadPlaylists(version)}catch(error){if(version!==dialogVersion)return;clearAuth();await getConfiguration();modal(setupHTML());$('#spotify-connect-form').onsubmit=async e=>{e.preventDefault();try{await authorize(clientId||$('#spotify-client-id').value.trim(),$('#spotify-remember').checked)}catch(e){message(e.message)}};message(error.message)}
  }
  async function callback(){
    const params=new URLSearchParams(location.search);
    if(!params.get('state')?.startsWith('oktawka_spotify_'))return;
    let pending;try{pending=JSON.parse(sessionStorage.getItem(keys.pending)||'null')}catch{}
    try{
      const code=core.validateCallback(pending,params);
      sessionStorage.removeItem(keys.pending);
      const data=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:pending.redirectUri,client_id:pending.clientId,code_verifier:pending.verifier});
      auth={...data,clientId:pending.clientId,remember:!!pending.remember,expiresAt:Date.now()+(Number(data.expires_in)||3600)*1000};profile=null;
      await getProfile();persistAuth();window.OktawkaNavigate?.('library');await open();
    }catch(error){try{sessionStorage.removeItem(keys.pending)}catch{}toast(error.message);window.OktawkaNavigate?.('library')}
    finally{['code','state','error','error_description'].forEach(k=>params.delete(k));history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash)}
  }
  $('#dialog').addEventListener('close',()=>{if(busy)controller?.abort()});
  window.OktawkaSpotify={open};
  renderLibrary();
  (async()=>{try{const stored=validCache(await readCache());if(stored&&(!profile||profile.id===stored.accountId))cache=stored}catch{}renderLibrary();await callback()})();
})();
