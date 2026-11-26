(()=>{'use strict';let selection=0;const names={main:'Main mix',mellow:'Mellow mix',rock:'Rock mix',eclectic:'Eclectic mix'},status=$('#radio-status');
$('#radio-stations').querySelectorAll('[data-radio]').forEach(button=>button.onclick=async()=>{
 const station=button.dataset.radio;if(!Object.hasOwn(names,station))return;const version=++selection;
 const url=new URL('/api/radio?station='+station,location.href).href;let i=tracks.findIndex(t=>t.url===url);
 if(i<0){tracks.push({title:'Radio Paradise · '+names[station],artist:'Live radio · curated by Radio Paradise',url,live:true,sourceCodec:'FLAC',lossless:false,format:'FLAC radio · bit depth unverified'});i=tracks.length-1}
 status.textContent='Connecting to '+names[station]+' in FLAC…';await play(i);if(version!==selection)return;
 status.textContent=audio.paused?'Could not start this station. Retry, choose another mix, or check your browser’s FLAC support.':'Playing '+names[station]+' inside Oktawka. This is a continuous live mix.';
});
audio.addEventListener('error',()=>{if(tracks[current]?.live)status.textContent='The FLAC stream could not play. Choose another mix or retry; no lossy audio was substituted.'});
})();
