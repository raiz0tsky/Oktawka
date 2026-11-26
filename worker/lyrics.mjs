// Read-only LRCLIB lookup. User audio, provider keys and cookies never leave Oktawka.
export async function handleLyrics(request,fetcher=(url,options)=>globalThis.fetch(url,options)){
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':status===200?'public, max-age=1800':'no-store','X-Content-Type-Options':'nosniff'}});
 if(request.method!=='GET')return reply({error:'Use GET for lyrics.'},405);
 const params=new URL(request.url).searchParams,title=(params.get('title')||'').trim(),artist=(params.get('artist')||'').trim(),album=(params.get('album')||'').trim(),duration=Number(params.get('duration'));
 if(!title||!artist||title.length>200||artist.length>150||album.length>200)return reply({error:'Valid track and artist names are required.'},400);
 const upstream=new URL('https://lrclib.net/api/get');upstream.searchParams.set('track_name',title);upstream.searchParams.set('artist_name',artist);if(album)upstream.searchParams.set('album_name',album);if(Number.isFinite(duration)&&duration>0&&duration<14400)upstream.searchParams.set('duration',String(Math.round(duration)));
 try{const response=await fetcher(upstream.href,{headers:{Accept:'application/json','User-Agent':'Oktawka/1.1 (lyrics lookup)'},redirect:'manual',signal:AbortSignal.timeout(8000)});if(response.status===404)return reply({found:false});if(!response.ok)return reply({error:response.status===429?'Lyrics are rate limited. Retry in a minute.':'The lyrics service is unavailable. Try again later.'},502);
 const text=await response.text();if(text.length>200000)throw Error('Oversized lyrics response');const data=JSON.parse(text);const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
 // Do not accept a broad-search hit or silently switch a recording version.
 if(normalize(data.trackName)!==normalize(title)||normalize(data.artistName)!==normalize(artist))return reply({found:false});
 if(album&&data.albumName&&normalize(album)!==normalize(data.albumName))return reply({found:false});
 if(duration>0&&Number.isFinite(Number(data.duration))&&Math.abs(duration-Number(data.duration))>3)return reply({found:false});
 const synced=typeof data.syncedLyrics==='string'?data.syncedLyrics.slice(0,100000):'',plain=typeof data.plainLyrics==='string'?data.plainLyrics.slice(0,100000):'';
 return reply({found:!!(data.instrumental||synced||plain),instrumental:data.instrumental===true,synced,plain,source:'LRCLIB'});
 }catch{return reply({error:'Lyrics could not be reached. You can still import an LRC file.'},502)}
}
