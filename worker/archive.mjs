// Fixed public catalog only. No arbitrary proxy, credentials, or audio buffering.
export async function handleArchive(request, fetcher=(url,options)=>globalThis.fetch(url,options)) {
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'public, max-age=120'}});
  if(request.method!=='GET')return reply({error:'Method not allowed'},405);
  const params=new URL(request.url).searchParams, id=params.get('id'), q=(params.get('q')||'').trim(), collection=params.get('collection')||'live';
  const allowedLicense=value=>{try{const u=new URL(Array.isArray(value)?value[0]:value);return ['https:','http:'].includes(u.protocol)&&u.hostname==='creativecommons.org'&&/^\/(licenses|publicdomain)\//.test(u.pathname)}catch{return false}};
  if(!['live','open'].includes(collection))return reply({error:'Unknown collection.'},400);
  if((id&&!/^[A-Za-z0-9_.-]{1,150}$/.test(id))||q.length>100)return reply({error:'Invalid archive search'},400);
  try {
    let upstream;
    if(id)upstream='https://archive.org/metadata/'+encodeURIComponent(id);
    else {const url=new URL('https://archive.org/advancedsearch.php');const words=q.match(/[\p{L}\p{N}]+/gu)||[];url.searchParams.set('q',(collection==='open'?'collection:netlabels AND mediatype:audio AND format:Flac':'collection:etree AND mediatype:etree AND format:Flac')+(words.length?' AND '+words.map(w=>'"'+w+'"').join(' AND '):''));url.searchParams.set('output','json');url.searchParams.set('rows','18');url.searchParams.set('sort[]','downloads desc');for(const f of ['identifier','title','creator','date','licenseurl'])url.searchParams.append('fl[]',f);upstream=url.href}
    const response=await fetcher(upstream,{signal:AbortSignal.timeout(15000),redirect:'manual',headers:{Accept:'application/json'}});
    if(!response.ok){console.error('archive_http_error',JSON.stringify({status:response.status,collection}));return reply({error:response.status===429?'Internet Archive is rate limiting requests. Wait a minute and retry.':'Internet Archive is unavailable (HTTP '+response.status+'). Retry shortly.'},502)}
    const data=await response.json();
    const str=v=>Array.isArray(v)?v.join(', '):String(v||'');
    if(id){const meta=data.metadata||{},collections=Array.isArray(meta.collection)?meta.collection:[meta.collection];if(!(collection==='live'?collections.includes('etree'):collections.includes('netlabels')&&allowedLicense(meta.licenseurl))||data.is_dark||data.is_restricted||meta.access_restricted==='true'||meta.access_restricted===true)return reply({error:'This recording is not available for direct playback.'},404);
      const files=(data.files||[]).filter(f=>/\.flac$/i.test(f.name||'')&&/flac/i.test(f.format||'')&&f.private!=='true'&&f.private!==true).slice(0,250).map(f=>({title:str(f.title)||f.name.replace(/\.flac$/i,''),filename:f.name,url:'https://archive.org/download/'+encodeURIComponent(id)+'/'+f.name.split('/').map(encodeURIComponent).join('/')}));
      console.log('archive_files_ok',JSON.stringify({collection,files:files.length}));return reply({title:str(meta.title),artist:str(meta.creator),id,files,collection,license:allowedLicense(meta.licenseurl)?str(meta.licenseurl):null});
    }
    if(!Array.isArray(data.response?.docs))throw Error('Unexpected catalog response');
    return reply({recordings:data.response.docs.filter(d=>(collection!=='open'||allowedLicense(d.licenseurl))&&/^[A-Za-z0-9_.-]{1,150}$/.test(d.identifier)).map(d=>({id:d.identifier,title:str(d.title),artist:str(d.creator),date:str(d.date).slice(0,10)}))});
  }catch(e){console.error('archive_fetch_failed',JSON.stringify({collection,name:e.name,message:String(e.message).slice(0,140)}));return reply({error:'Internet Archive could not be reached. Retry shortly; no debrid key is needed.'},502)}
}
