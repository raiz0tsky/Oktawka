package app.oktawka.player;
import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.media.session.MediaSession;
import android.os.*;

/** Foreground media service: keeps playback alive with the screen off and shows the system media card (title, artist, art, controls). */
public final class PlaybackService extends Service {
 static final String CHANNEL="playback",ACTION="app.oktawka.player.MEDIA";
 static final int ID=1;
 static volatile boolean running;

 /** MediaStyle notification bound to the session, so One UI / Android 13+ show it as a media player card. */
 static Notification build(Context c,MediaSession session,String title,String artist,Bitmap art,boolean playing){
  NotificationManager manager=c.getSystemService(NotificationManager.class);
  manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Playback",NotificationManager.IMPORTANCE_LOW));
  PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder b=new Notification.Builder(c,CHANNEL).setSmallIcon(c.getApplicationInfo().icon).setContentTitle(title).setContentText(artist).setContentIntent(open)
   .setOngoing(playing).setShowWhen(false).setVisibility(Notification.VISIBILITY_PUBLIC).setCategory(Notification.CATEGORY_TRANSPORT);
  if(art!=null)b.setLargeIcon(art);
  b.addAction(action(c,"previous",android.R.drawable.ic_media_previous,"Previous",1));
  b.addAction(playing?action(c,"pause",android.R.drawable.ic_media_pause,"Pause",2):action(c,"play",android.R.drawable.ic_media_play,"Play",3));
  b.addAction(action(c,"next",android.R.drawable.ic_media_next,"Next",4));
  Notification.MediaStyle style=new Notification.MediaStyle().setShowActionsInCompactView(0,1,2);
  if(session!=null)style.setMediaSession(session.getSessionToken());
  return b.setStyle(style).build();
 }
 // Android 13+ draws its controls from the session; these actions cover Android 8-12.
 @SuppressWarnings("deprecation")
 private static Notification.Action action(Context c,String command,int icon,String label,int code){
  Intent intent=new Intent(ACTION).setPackage(c.getPackageName()).putExtra("command",command);
  return new Notification.Action.Builder(icon,label,PendingIntent.getBroadcast(c,code,intent,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT)).build();
 }
 @Override public int onStartCommand(Intent intent,int flags,int id){
  Notification n=MainActivity.notification(this);
  if(Build.VERSION.SDK_INT>=29)startForeground(ID,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);else startForeground(ID,n);
  running=true;
  return START_NOT_STICKY;
 }
 @Override public void onDestroy(){running=false;super.onDestroy();}
 @Override public void onTaskRemoved(Intent root){stopSelf();}
 @Override public IBinder onBind(Intent intent){return null;}
}
