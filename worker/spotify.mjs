export function handleSpotifyConfig(request,env={}){
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const clientId=/^[a-f0-9]{32}$/i.test(env.SPOTIFY_CLIENT_ID||'')?env.SPOTIFY_CLIENT_ID:'';
  return new Response(JSON.stringify({clientId}),{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
