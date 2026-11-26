package app.oktawka.player;
import android.app.*;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.webkit.*;
import android.view.*;
import java.io.*;
import java.net.*;
import java.util.*;

public final class MainActivity extends Activity {
 private static final String HOST="app.oktawka.local";
 private WebView web; private ValueCallback<Uri[]> picker;
 @Override public void onCreate(Bundle state){super.onCreate(state);startMediaSession();getWindow().setStatusBarColor(0xff070708);getWindow().setNavigationBarColor(0xff070708);
 android.widget.FrameLayout container=new android.widget.FrameLayout(this);web=new WebView(this);container.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));setContentView(container);
 if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
 container.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener(){@Override public WindowInsets onApplyWindowInsets(View v,WindowInsets insets){int left,top,right,bottom;if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());left=bars.left;top=bars.top;right=bars.right;bottom=bars.bottom;}else{left=insets.getSystemWindowInsetLeft();top=insets.getSystemWindowInsetTop();right=insets.getSystemWindowInsetRight();bottom=insets.getSystemWindowInsetBottom();}v.setPadding(left,top,right,bottom);return Build.VERSION.SDK_INT>=30?WindowInsets.CONSUMED:insets.consumeSystemWindowInsets();}});container.requestApplyInsets();WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(false);android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
 web.setWebViewClient(new WebViewClient(){
 @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){Uri u=request.getUrl();if("https".equals(u.getScheme())&&HOST.equals(u.getHost()))return false;if("https".equals(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(ActivityNotFoundException ignored){}}return true;}
 @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){Uri u=request.getUrl();if(!HOST.equals(u.getHost()))return null;try{if(!"GET".equals(request.getMethod()))return error("Method not allowed",405);String path=u.getPath();if(path.equals("/native/playback"))return playback(u);if(path.equals("/api/radio"))return radio(u,request);if(path.startsWith("/native/")){String upstream;if(path.equals("/native/archive-search"))upstream="https://archive.org/advancedsearch.php";else if(path.startsWith("/native/archive-metadata/")){String id=path.substring(25);if(!id.matches("[A-Za-z0-9_.-]{1,150}"))return error("Invalid recording",400);upstream="https://archive.org/metadata/"+id;}else if(path.equals("/native/knaben/search"))upstream="https://api.knaben.org/v2/search";else if(path.equals("/native/knaben/browse"))upstream="https://api.knaben.org/v2/browse";else if(path.equals("/native/lyrics"))upstream="https://lrclib.net/api/get";else if(path.matches("/native/deezer/(search/artist|artist/[0-9]+/(related|top))"))upstream="https://api.deezer.com/"+path.substring(15);else return error("Not found",404);if(u.getEncodedQuery()!=null)upstream+="?"+u.getEncodedQuery();return upstream(upstream);}
 String file=path.equals("/")?"index.html":path.substring(1);if(file.contains("..")||file.contains("/"))return error("Not found",404);String mime=file.endsWith(".html")?"text/html":file.endsWith(".css")?"text/css":file.endsWith(".woff2")?"font/woff2":file.endsWith(".tgz")?"application/gzip":file.endsWith(".txt")?"text/plain":"text/javascript";return new WebResourceResponse(mime,"UTF-8",getAssets().open(file));}catch(Exception e){return error("Source could not be reached. Retry shortly.",502);}}
 });
 web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){if(picker!=null)picker.onReceiveValue(null);picker=callback;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType("*/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"audio/*","text/plain","text/csv","application/json","application/octet-stream"});intent.addCategory(Intent.CATEGORY_OPENABLE);intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);try{startActivityForResult(intent,42);return true;}catch(ActivityNotFoundException e){picker=null;return false;}}});
 web.loadUrl("https://"+HOST+"/");
 }
 private WebResourceResponse radio(Uri uri,WebResourceRequest request)throws IOException{
 String station=uri.getQueryParameter("station"),path="flac";if(station==null||station.equals("main")){}else if(station.equals("mellow")||station.equals("rock")||station.equals("eclectic"))path=station+"-flac";else return error("Unknown station",400);
 URL target=new URL("https://stream.radioparadise.com/"+path);
 for(int i=0;i<4;i++){final HttpURLConnection connection=(HttpURLConnection)target.openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(12000);connection.setReadTimeout(20000);connection.setRequestProperty("Accept","audio/flac, audio/x-flac");if("bytes=0-4095".equals(request.getRequestHeaders().get("Range")))connection.setRequestProperty("Range","bytes=0-4095");int code=connection.getResponseCode();if(code>=300&&code<400){String location=connection.getHeaderField("Location");connection.disconnect();if(location==null)return error("Missing redirect",502);URL next=new URL(target,location);if(!next.getProtocol().equals("https")||!next.getHost().endsWith(".radioparadise.com")||next.getUserInfo()!=null||next.getPort()!=-1)return error("Invalid redirect",502);target=next;continue;}String type=connection.getContentType();if(code<200||code>=300||type==null||!type.matches("(?i).*(audio/(x-)?flac|audio/ogg|application/ogg|application/octet-stream).*")){connection.disconnect();return error("Station unavailable",502);}InputStream stream=new FilterInputStream(connection.getInputStream()){@Override public void close()throws IOException{try{super.close();}finally{connection.disconnect();}}};return new WebResourceResponse(type.split(";")[0],null,200,"OK",Collections.singletonMap("Cache-Control","no-store"),stream);}return error("Too many redirects",502);
 }
 private boolean askedNotifications;
 // Media session state, read by PlaybackService when it starts.
 private static MediaSession session;
 private static String mediaTitle="Oktawka",mediaArtist="",artUrl="";
 private static Bitmap mediaArt;
 private static boolean mediaPlaying;
 private BroadcastReceiver mediaReceiver;
 static Notification notification(Context c){return PlaybackService.build(c,session,mediaTitle,mediaArtist,mediaArt,mediaPlaying);}
 private void startMediaSession(){
  session=new MediaSession(this,"Oktawka");
  session.setCallback(new MediaSession.Callback(){
   @Override public void onPlay(){command("play",0);}
   @Override public void onPause(){command("pause",0);}
   @Override public void onStop(){command("pause",0);}
   @Override public void onSkipToNext(){command("next",0);}
   @Override public void onSkipToPrevious(){command("previous",0);}
   @Override public void onSeekTo(long ms){command("seek",ms);}
  });
  mediaReceiver=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent i){command(i.getStringExtra("command"),0);}};
  IntentFilter filter=new IntentFilter(PlaybackService.ACTION);
  if(Build.VERSION.SDK_INT>=33)registerReceiver(mediaReceiver,filter,Context.RECEIVER_NOT_EXPORTED);else registerReceiver(mediaReceiver,filter);
 }
 /** Sends a fixed media command to the web player; anything outside the list is dropped. */
 private void command(final String c,final long ms){
  if(!Arrays.asList("play","pause","next","previous","seek").contains(c))return;
  runOnUiThread(new Runnable(){@Override public void run(){if(web!=null)web.evaluateJavascript("window.OktawkaMedia&&window.OktawkaMedia('"+c+"',"+ms+")",null);}});
 }
 private static String text(String v,String fallback,int max){if(v==null||v.trim().isEmpty())return fallback;v=v.trim();return v.length()>max?v.substring(0,max):v;}
 private static long number(String v){try{long n=Long.parseLong(v);return n>0&&n<1000L*60*60*24?n:0;}catch(RuntimeException e){return 0;}}
 private void publish(long duration,long position){
  MediaMetadata.Builder meta=new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,mediaTitle).putString(MediaMetadata.METADATA_KEY_ARTIST,mediaArtist);
  if(duration>0)meta.putLong(MediaMetadata.METADATA_KEY_DURATION,duration);
  if(mediaArt!=null)meta.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART,mediaArt);
  session.setMetadata(meta.build());
  long actions=PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_STOP|(duration>0?PlaybackState.ACTION_SEEK_TO:0);
  session.setPlaybackState(new PlaybackState.Builder().setActions(actions).setState(mediaPlaying?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED,position,mediaPlaying?1f:0f,SystemClock.elapsedRealtime()).build());
  session.setActive(true);
  if(PlaybackService.running)getSystemService(NotificationManager.class).notify(PlaybackService.ID,notification(this));
 }
 /** Album art for the media card: HTTPS only, no redirects, at most 2 MB, scaled to about 512 px. */
 private static Bitmap loadArt(String url){
  try{URL target=new URL(url);if(!"https".equals(target.getProtocol())||target.getUserInfo()!=null)return null;
   HttpURLConnection connection=(HttpURLConnection)target.openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(10000);connection.setReadTimeout(10000);
   try{if(connection.getResponseCode()!=200)return null;InputStream in=connection.getInputStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
    while((n=in.read(buffer))!=-1){if(bytes.size()+n>2*1024*1024)return null;bytes.write(buffer,0,n);}
    byte[] data=bytes.toByteArray();BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(data,0,data.length,bounds);
    BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=1;while(bounds.outWidth/(options.inSampleSize*2)>=512)options.inSampleSize*=2;
    return BitmapFactory.decodeByteArray(data,0,data.length,options);}finally{connection.disconnect();}
  }catch(IOException|RuntimeException e){return null;}
 }
 private WebResourceResponse playback(Uri u){
  String state=u.getQueryParameter("state");mediaPlaying="playing".equals(state);
  mediaTitle=text(u.getQueryParameter("title"),"Oktawka",200);mediaArtist=text(u.getQueryParameter("artist"),"",200);
  final long duration=number(u.getQueryParameter("duration")),position=number(u.getQueryParameter("position"));
  final String art=text(u.getQueryParameter("art"),"",2048);
  if(!art.equals(artUrl)){artUrl=art;mediaArt=null;if(art.startsWith("https://"))new Thread(new Runnable(){@Override public void run(){Bitmap b=loadArt(art);if(b!=null&&art.equals(artUrl)){mediaArt=b;publish(duration,position);}}}).start();}
  publish(duration,position);
  if(mediaPlaying&&!PlaybackService.running){try{startForegroundService(new Intent(this,PlaybackService.class));}catch(RuntimeException e){return error("Background playback unavailable",409);}
   if(Build.VERSION.SDK_INT>=33&&!askedNotifications){askedNotifications=true;runOnUiThread(new Runnable(){@Override public void run(){if(checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},7);}});}}
  return new WebResourceResponse("application/json","UTF-8",204,"No Content",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream(new byte[0]));
 }
 private WebResourceResponse upstream(String url)throws IOException{HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(15000);connection.setRequestProperty("Accept","application/json");try{int code=connection.getResponseCode();if(code>=300&&code<400)return error("Upstream redirect refused",502);InputStream in=code<400?connection.getInputStream():connection.getErrorStream();if(in==null)return error("Source unavailable",502);ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(bytes.size()+n>8*1024*1024)throw new IOException("Response too large");bytes.write(buffer,0,n);}in.close();return new WebResourceResponse("application/json","UTF-8",code,"Upstream",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream(bytes.toByteArray()));}finally{connection.disconnect();}}
 private WebResourceResponse error(String message,int code){return new WebResourceResponse("application/json","UTF-8",code,"Unavailable",Collections.emptyMap(),new ByteArrayInputStream(("{\"error\":\""+message+"\"}").getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==42&&picker!=null){ArrayList<Uri> uris=new ArrayList<>();if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null)for(int i=0;i<data.getClipData().getItemCount();i++)uris.add(data.getClipData().getItemAt(i).getUri());else if(data.getData()!=null)uris.add(data.getData());}picker.onReceiveValue(uris.isEmpty()?null:uris.toArray(new Uri[0]));picker=null;}}
 @Override public void onBackPressed(){web.evaluateJavascript("!!(window.OktawkaBack&&window.OktawkaBack())",new ValueCallback<String>(){@Override public void onReceiveValue(String handled){if(!"true".equals(handled))moveTaskToBack(true);}});}
 @Override protected void onDestroy(){stopService(new Intent(this,PlaybackService.class));if(mediaReceiver!=null)unregisterReceiver(mediaReceiver);if(session!=null){session.release();session=null;}if(picker!=null)picker.onReceiveValue(null);web.destroy();super.onDestroy();}
}
