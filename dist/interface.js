/* Shared navigation and the compact app shell. Playback remains owned by the audio engine. */
(()=>{
  'use strict';
  const body=document.body, home=$('#home-main'), shelf=$('.album-library'), listening=$('#listening-home'), lower=$('.lower');
  const icon=name=>`<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
  const navigation=[];let cursor=-1,route='home';
  const titles={home:'Home',search:'Search',library:'Library',liked:'Liked tracks',radio:'Radio',open:'Open albums',sources:'External sources'};
  const originalViews=new Map([...document.querySelectorAll('[data-view]')].map(b=>[b,b.onclick]));
  const originalCategories=new Map([...document.querySelectorAll('[data-category]')].map(b=>[b,b.onclick]));
  const sourceActions=new Map(['external-sources','music-addons','debrid-source','connect','local'].map(id=>[id,$('#'+id).onclick]));
  const themeAction=()=>$('#theme-switch').click();
  const flowAction=$('#flow-options').onclick;
  const importAction=$('#import-library').onclick;

  // Remove presentation-only content from navigation while retaining legacy binding targets.
  $('#cards').hidden=true;
  document.querySelectorAll('.mood,.playlist-label,.quality-panel,.date,.content>.eyebrow,.sidebar>small').forEach(n=>n.hidden=true);
  shelf.previousElementSibling.hidden=true;
  const sidebar=$('.sidebar'),nav=$('.sidebar nav');
  const library=nav.querySelector('[data-view="library"]');
  nav.insertBefore(library,nav.querySelector('[data-category]'));
  const collectionLabel=$('.sidebar .label');
  collectionLabel.innerHTML='<span>Your collection</span><button id="sidebar-add" aria-label="Add music" title="Add music">'+icon('add')+'</button>';
  const storage=document.createElement('div');storage.hidden=true;storage.id='legacy-sources';
  ['external-sources','music-addons','debrid-source','local'].forEach(id=>storage.append($('#'+id)));
  sidebar.append(storage);
  const sideBottom=$('.side-bottom');
  const settingsButton=$('#settings');
  sideBottom.replaceChildren();sideBottom.append(settingsButton);
  const sourceButton=document.createElement('button');sourceButton.id='sidebar-sources';sourceButton.innerHTML=icon('library_add')+'<span>Music sources</span>';
  sideBottom.prepend(sourceButton);
  sidebar.querySelector('[data-view="liked"]').classList.add('liked-navigation');
  $('#add')?.remove();
  $('#flow-options').hidden=true;
  $('#import-library').hidden=true;
  $('#catalog-form').hidden=true;
  $('#section-title').closest('.section-heading').hidden=true;
  $('.lower .section-heading h2').textContent='Tracks on this device';
  $('#import-button').textContent='Add files';
  $('#show-all').hidden=true;
  $('#np-lyric').hidden=true;
  $('#np-engine').hidden=true;
  $('#np-codec').hidden=true;
  $('.lyrics-heading .eyebrow').hidden=true;
  $('#now-playing .np-header>span').textContent='Now playing';
  $('#profile').innerHTML=icon('settings');
  $('#settings').innerHTML=icon('settings')+'<span>Settings</span>';
  $('#settings').setAttribute('aria-label','Settings');
  $('.np-artwork b').textContent='Oktawka';
  $('#page-title').setAttribute('tabindex','-1');
  $('#search').setAttribute('type','search');
  $('#search').setAttribute('autocomplete','off');
  $('#sources-menu').setAttribute('aria-label','Add music');
  document.querySelectorAll('.material-symbols-rounded').forEach(n=>n.setAttribute('aria-hidden','true'));
  library.setAttribute('aria-label','Library');
  nav.querySelector('[data-category="open"]').setAttribute('aria-label','Open albums');
  nav.querySelector('[data-category="radio"]').setAttribute('aria-label','Radio');
  $('#search').setAttribute('aria-label','Search songs, albums, or artists');
  $('.searchbox').firstChild.textContent='';
  $('.searchbox').insertAdjacentHTML('afterbegin',icon('search'));
  $('#now-title').closest('.now').querySelector('div:not(.mini-art)').classList.add('now-copy');
  $('.logo').onclick=e=>{e.preventDefault();navigate('home')};

  const welcome=document.createElement('section');welcome.id='welcome';welcome.className='welcome';
  // First run: the app can't stream albums until a debrid account is connected, so that is the one primary action.
  welcome.innerHTML=`<div><h2>Connect an account to stream full albums</h2><p>Oktawka plays from your own Real-Debrid or AllDebrid account. It doesn’t come with one.</p><div class="welcome-actions"><button class="primary" id="welcome-add">Connect account</button></div><p class="note">You approve access on Real-Debrid’s or AllDebrid’s own site.</p><h3>Play now, no account needed</h3><div class="source-options compact-options"><button class="source-option" id="welcome-local">${icon('folder_open')}<span><b>Files on this device</b><small>FLAC, WAV and MP3</small></span>${icon('chevron_right')}</button><button class="source-option" id="welcome-radio">${icon('radio')}<span><b>Radio Paradise</b><small>4 live mixes in FLAC</small></span>${icon('chevron_right')}</button><button class="source-option" id="welcome-open">${icon('album')}<span><b>Open albums</b><small>Public FLAC recordings, Internet Archive</small></span>${icon('chevron_right')}</button></div></div>`;
  listening.prepend(welcome);
  $('#welcome-add').onclick=()=>chooseSource('debrid-source');
  $('#welcome-local').onclick=()=>chooseSource('local');
  $('#welcome-radio').onclick=()=>navigate('radio');
  $('#welcome-open').onclick=()=>navigate('open');
  document.addEventListener('oktawka:debrid',()=>updateHistory());
  const more=document.createElement('button');more.id='shelf-more';more.textContent='Browse all';more.onclick=()=>navigate('search',{focus:true});shelf.querySelector('.section-heading').append(more);
  const recentHeading=$('#recent-grid').previousElementSibling;
  const recommendationHeading=$('#recommendations').previousElementSibling;
  function updateHistory(){
    const hasRecent=$('#recent-grid').childElementCount>0;
    const hasRecommendations=$('#recommendations').childElementCount>0;
    welcome.hidden=Boolean(window.monoHasDebrid?.());
    recentHeading.hidden=!hasRecent;
    $('#recent-grid').hidden=!hasRecent;
    recommendationHeading.hidden=!hasRecommendations;
    $('#recommendations').hidden=!hasRecommendations;
    listening.querySelectorAll('.material-symbols-rounded').forEach(n=>n.setAttribute('aria-hidden','true'));
    $('#recent-grid').querySelectorAll('img').forEach(img=>img.onerror=()=>{img.hidden=true});
  }
  new MutationObserver(updateHistory).observe(listening,{childList:true,subtree:true});
  updateHistory();
  const libraryTools=document.createElement('div');libraryTools.className='library-tools';
  libraryTools.innerHTML='<button id="library-liked">'+icon('favorite')+'Liked tracks</button><button id="library-playlists">'+icon('playlist_add')+'Import a playlist</button>';
  home.prepend(libraryTools);
  $('#library-liked').onclick=()=>navigate('liked');
  $('#library-playlists').onclick=importAction;

  function navigate(next,{record=true,focus=false}={}){
    if(!titles[next])next='home';
    route=next;
    if(record&&navigation[cursor]!==next){navigation.splice(cursor+1);navigation.push(next);cursor=navigation.length-1}
    body.dataset.route=next;
    home.hidden=next==='radio'||next==='open';
    $('#radio-category').hidden=next!=='radio';$('#open-category').hidden=next!=='open';
    $('#external-sources-panel').hidden=next!=='sources';
    listening.hidden=next!=='home';
    shelf.hidden=!['home','search','library'].includes(next);
    lower.hidden=!['search','library','liked'].includes(next);
    view=next==='liked'?'liked':next==='library'?'library':next==='search'?'search':'discover';
    render();
    $('#hero').hidden=true;
    $('#page-title').textContent=titles[next];
    $('.recent h2').textContent=next==='liked'?'Your liked tracks':next==='search'?'On this device':'Tracks on this device';
    document.querySelectorAll('[data-view],[data-category]').forEach(b=>{
      const target=b.dataset.category||({discover:'home',search:'search',library:'library',liked:'liked'})[b.dataset.view];
      b.classList.toggle('active',target===next);if(target===next)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
    $('#nav-back').disabled=cursor<=0;$('#nav-forward').disabled=cursor>=navigation.length-1;
    if(next==='library'&&$('#saved-albums').getAttribute('aria-pressed')!=='true')$('#saved-albums').click();
    if(['home','search'].includes(next)&&$('#saved-albums').getAttribute('aria-pressed')==='true')$('#saved-albums').click();
    if(next==='library')$('#album-heading').textContent='Saved albums';
    if(next==='search')$('#album-heading').textContent=$('#catalog-artists').getAttribute('aria-pressed')==='true'?'Artists':'Albums';
    if(next==='home')$('#album-heading').textContent='Albums to spend time with';
    if(focus)$('#search').focus();
    window.scrollTo({top:0,behavior:'instant'});
  }
  for(const [button]of originalViews)button.onclick=()=>navigate(({discover:'home',search:'search',library:'library',liked:'liked'})[button.dataset.view],{focus:button.dataset.view==='search'});
  for(const [button]of originalCategories)button.onclick=()=>navigate(button.dataset.category);
  $('#nav-back').onclick=()=>{if(cursor>0){cursor--;navigate(navigation[cursor],{record:false})}};
  // Android Back: close the top dialog, then step back in-app, then let the system exit.
  window.OktawkaBack=()=>{const open=[...document.querySelectorAll('dialog[open]')].pop();if(open){open.close();return true}if(cursor>0){$('#nav-back').click();return true}return false};
  $('#nav-forward').onclick=()=>{if(cursor<navigation.length-1){cursor++;navigate(navigation[cursor],{record:false})}};
  $('#search').addEventListener('input',()=>navigate('search'));
  $('#search').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.value.trim()){$('#catalog-query').value=e.target.value;$('#catalog-form').requestSubmit();navigate('search')}});
  setView=v=>navigate(({discover:'home',search:'search',library:'library',liked:'liked'})[v]||'home');
  function chooseSource(id){$('#dialog').close();if(id==='external-sources'){navigate('sources');$('#home-music-query').focus();return}sourceActions.get(id)?.();}
  function sources(){
    modal(`<h2>Add music</h2><p>Make room for your favorites.</p><div class="source-options compact-options"><button class="source-option" data-source="local">${icon('folder_open')}<span><b>Music from your device</b><small>FLAC and other audio files</small></span>${icon('chevron_right')}</button><button class="source-option" id="source-playlists">${icon('playlist_add')}<span><b>Import a playlist</b><small>CSV or JSON track lists</small></span>${icon('chevron_right')}</button><button class="source-option" data-source="connect">${icon('link')}<span><b>Connect a source</b><small>Direct stream, AllDebrid, or Real-Debrid</small></span>${icon('chevron_right')}</button></div><details class="advanced-sources"><summary>Advanced sources</summary><div class="source-options"><button class="source-option" data-source="external-sources">${icon('travel_explore')}<span><b>External releases</b><small>Search audio sources</small></span>${icon('chevron_right')}</button><button class="source-option" data-source="music-addons">${icon('cloud')}<span><b>Cloud music & add-ons</b><small>Manage connected catalogs</small></span>${icon('chevron_right')}</button></div></details>`);
    $('#dialog-content').querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>chooseSource(b.dataset.source));
    const openMusic=document.createElement('button');openMusic.className='source-option';openMusic.innerHTML=icon('album')+'<span><b>Open albums</b><small>Public FLAC recordings</small></span>'+icon('chevron_right');openMusic.onclick=()=>{$('#dialog').close();navigate('open')};$('#source-playlists').before(openMusic);
    $('#source-playlists').onclick=()=>{ $('#dialog').close();importAction() };
    if(window.OktawkaSpotify){
      const spotify=document.createElement('button');spotify.className='source-option';spotify.id='source-spotify';
      spotify.innerHTML=icon('sync')+'<span><b>Sync Spotify</b><small>Playlists and Liked Songs</small></span>'+icon('chevron_right');
      $('#source-playlists').after(spotify);spotify.onclick=()=>window.OktawkaSpotify.open();
    }
  }
  $('#sources-menu').onclick=sources;$('#sidebar-add').onclick=sources;sourceButton.onclick=sources;
  function settingsMenu(){
    modal(`<h2>Settings</h2><h3 class="settings-group">Playback</h3><div class="source-options compact-options"><button class="source-option" id="setting-stream">${icon('high_quality')}<span><b>Streaming quality</b><small>Adaptive, FLAC and non-debrid HiFi</small></span>${icon('chevron_right')}</button><button class="source-option" id="setting-audio">${icon('speaker')}<span><b>Audio settings</b><small>Playback path and sleep timer</small></span>${icon('chevron_right')}</button><button class="source-option" id="setting-eq">${icon('equalizer')}<span><b>Equalizer</b><small>Shape your sound</small></span>${icon('chevron_right')}</button><button class="source-option" id="setting-flow">${icon('playlist_play')}<span><b>Autoplay</b><small>Album queue and related artists</small></span>${icon('chevron_right')}</button></div><h3 class="settings-group">Accounts and sources</h3><div class="source-options compact-options"><button class="source-option" id="setting-accounts">${icon('link')}<span><b>Real-Debrid and AllDebrid</b><small>${window.monoHasDebrid?.()?'Connected':'Not connected'}</small></span>${icon('chevron_right')}</button><button class="source-option" id="setting-sources">${icon('library_add')}<span><b>Other sources</b><small>Files, direct stream, open albums, add-ons</small></span>${icon('chevron_right')}</button></div><h3 class="settings-group">Appearance</h3><div class="source-options compact-options"><button class="source-option" id="setting-theme">${icon('palette')}<span><b>Theme</b><small>Choose your color theme</small></span>${icon('chevron_right')}</button></div>`);
    $('#setting-accounts').onclick=()=>chooseSource('debrid-source');
    $('#setting-sources').onclick=()=>{ $('#dialog').close();sources() };
    $('#setting-stream').onclick=()=>window.OktawkaStreaming.settings();
    $('#setting-audio').onclick=()=>{ $('#dialog').close();window.OktawkaAudioDetails?.() };
    $('#setting-eq').onclick=()=>{ $('#dialog').close();window.OktawkaEqualizer?.() };
    $('#setting-flow').onclick=()=>{ $('#dialog').close();flowAction() };
    $('#setting-theme').onclick=()=>{ $('#dialog').close();themeAction() };
  }
  settingsButton.onclick=settingsMenu;$('#profile').onclick=settingsMenu;
  $('#about').textContent='About audio';$('#about').onclick=()=>window.OktawkaAudioDetails?.();
  const originalQueue=$('#queue').onclick;
  $('#queue').onclick=()=>{
    const plan=window.OktawkaFlow?.snapshot();
    if(!plan||plan.items.length<=100)return originalQueue();
    let page=Math.floor(Math.max(0,plan.position)/100);
    function queuePage(){
      const start=page*100;
      modal(`<h2>Up next</h2><p class="note">${plan.items.length.toLocaleString()} tracks in your queue.</p>${plan.items.slice(start,start+100).map((t,offset)=>`<button class="track" data-queue-track="${start+offset}"><span>${start+offset===plan.position?'●':start+offset+1}</span><div><b>${escapeHTML(t.title)}</b><small>${escapeHTML(t.artist)}</small></div></button>`).join('')}<div class="spotify-pagination"><button id="queue-page-prev" ${page===0?'disabled':''}>Previous</button><span>${start+1}–${Math.min(start+100,plan.items.length)} of ${plan.items.length}</span><button id="queue-page-next" ${start+100>=plan.items.length?'disabled':''}>Next</button></div>`);
      $('#dialog-content').querySelectorAll('[data-queue-track]').forEach(b=>b.onclick=()=>window.OktawkaFlow.playAlbum(plan.items,Number(b.dataset.queueTrack)));
      $('#queue-page-prev').onclick=()=>{page--;queuePage()};$('#queue-page-next').onclick=()=>{page++;queuePage()};
    }
    queuePage();
  };
  const player=$('.player');
  function syncControls(){
    const hasTrack=current>=0;
    player.classList.toggle('has-track',hasTrack);
    ['like','shuffle','prev','next','repeat','expand-player','seek'].forEach(id=>$('#'+id).disabled=!hasTrack||(id==='seek'&&(tracks[current]?.live||audio.seekable===false)));
    $('#mini-art').disabled=!hasTrack;
    $('#like').setAttribute('aria-pressed',liked.has(current));
    $('#play').title=audio.paused?'Play':'Pause';
    if(!hasTrack)$('#play').setAttribute('aria-label','Add music to play');
    $('#quality').hidden=!hasTrack;
    $('#like').innerHTML=icon(liked.has(current)?'favorite':'favorite_border');
  }
  ['play','pause','loadedmetadata','qualitychange','ended'].forEach(event=>audio.addEventListener(event,syncControls));
  $('#like').addEventListener('click',syncControls);
  // shortcut: matches the album popup row by title only; upgrade if catalog tracks carry a trackId to the player.
  function markPlaying(){const title=tracks[current]?.title?.toLowerCase();document.querySelectorAll('#album-tracks .catalog-track').forEach(row=>{if(title&&row.querySelector('b')?.textContent.toLowerCase()===title)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current')})}
  new MutationObserver(markPlaying).observe($('#dialog-content'),{childList:true,subtree:true});
  const onTrack=window.OktawkaOnTrack;window.OktawkaOnTrack=t=>{onTrack?.(t);syncControls();markPlaying()};
  const onPlay=window.OktawkaOnPlaying;window.OktawkaOnPlaying=t=>{onPlay?.(t);syncControls()};
  $('#play').addEventListener('click',()=>{if(current<0&&!tracks.length)$('#dialog').close()});
  document.querySelectorAll('button').forEach(button=>{if(!button.title&&button.getAttribute('aria-label'))button.title=button.getAttribute('aria-label')});
  $('#dialog').addEventListener('close',()=>$('#dialog').classList.remove('artist-profile-dialog'));
  $('#now-playing').addEventListener('click',e=>{if(e.target===$('#now-playing')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
  window.OktawkaNavigate=navigate;
  syncControls();navigate('home');
})();
