'use strict';
// Phone layout for Oktawka 2.0 (Penpot page "Oktawka 2.0 – Screens"). It only adds labels and moves existing
// controls; search, playback, library and sources keep their own modules and handlers.
(()=>{
const $=s=>document.querySelector(s);
const phone=window.matchMedia?.('(max-width:600px)').matches;
// shortcut: layout is chosen once at load; rotating a tablet across 600 px keeps the first layout. Upgrade if tablets matter.
if(!phone||!$('.content')||!window.OktawkaNavigate)return;
document.documentElement.classList.add('phone-2');
const icon=n=>`<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
const go=(route,focus)=>window.OktawkaNavigate(route,{focus});
const row=(id,ic,title,sub)=>`<button class="phone-row" id="${id}">${icon(ic)}<span><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span>${icon('chevron_right')}</button>`;

// App bar on Home: wordmark and a labeled Settings button (the header gear had no visible label).
const bar=document.createElement('div');bar.className='phone-bar';
bar.innerHTML=`<b class="wordmark">Oktawka</b><button class="phone-quiet" id="phone-settings">${icon('settings')}<span>Settings</span></button>`;
$('.content').prepend(bar);
$('#phone-settings').onclick=()=>$('#profile').click();

// Home search field: looks like the field, opens Search with the real input focused.
const homeSearch=document.createElement('button');homeSearch.id='phone-home-search';homeSearch.className='phone-field';
homeSearch.innerHTML=`<span class="phone-label">Search albums or artists</span><span class="phone-input">${icon('search')}<span>Artist, album or song</span></span>`;
homeSearch.onclick=()=>go('search',true);
$('#home-main').prepend(homeSearch);
// Connected but nothing played yet: say why Home is empty and give the one action that fills it.
const empty=document.createElement('div');empty.id='phone-home-empty';empty.className='phone-empty';
empty.innerHTML=`${icon('album')}<b>Nothing played yet</b><p>Find an album and press Play. It will show up here so you can pick up where you stopped.</p><button class="phone-secondary" id="phone-empty-search">${icon('search')}<span>Search albums</span></button>`;
homeSearch.after(empty);$('#phone-empty-search').onclick=()=>go('search',true);

// Search page: the real search input moves out of the hidden header, under a visible label.
const box=$('.searchbox');
if(box){const wrap=document.createElement('div');wrap.id='phone-search';wrap.innerHTML='<label class="phone-label" for="search">Search albums or artists</label>';wrap.append(box);$('.title-line').after(wrap);
  $('#search').placeholder='Artist, album or song';}

// Library: one list of places, then the ways to bring music in. Rows open the existing actions.
const tools=$('.library-tools');
if(tools){
  const head=document.createElement('div');head.className='phone-library';
  head.innerHTML=`<div class="phone-rows">${row('phone-liked','favorite','Liked tracks','Tracks you hearted')}${row('phone-saved','bookmark','Saved albums','Albums you saved')}${row('phone-device','smartphone','On this phone','Files you added')}</div>
  <h3>Bring music in</h3><div class="phone-rows">${row('phone-spotify','sync','Spotify playlists','Import playlists and Liked Songs')}${row('phone-file','upload_file','Playlist file','CSV or JSON track list')}</div>`;
  tools.after(head);
  const add=document.createElement('button');add.className='phone-secondary';add.id='phone-add-files';add.innerHTML=icon('add')+'<span>Add files</span>';
  $('.title-line').append(add);
  add.onclick=()=>$('#local')?.click();
  $('#phone-liked').onclick=()=>$('#library-liked').click();
  $('#phone-file').onclick=()=>$('#library-playlists').click();
  $('#phone-saved').onclick=()=>$('.album-library')?.scrollIntoView({behavior:'smooth'});
  $('#phone-device').onclick=()=>$('.lower')?.scrollIntoView({behavior:'smooth'});
  $('#phone-spotify').onclick=()=>window.OktawkaSpotify?window.OktawkaSpotify.open():$('#spotify-library')?.scrollIntoView({behavior:'smooth'});
}

// Mini player: the whole card opens Now Playing, so the separate expand icon goes away.
const now=$('.player .now');
if(now)now.addEventListener('click',e=>{if(!e.target.closest('button')&&!$('#expand-player').disabled)$('#expand-player').click()});

// Now Playing header: plain words instead of the tracked uppercase label.
const npLabel=$('#now-playing .np-header>span');if(npLabel)npLabel.textContent='Now playing';
})();
