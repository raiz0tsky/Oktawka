package app.oktawka.player;
import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;

/** Keeps the WebView player process at foreground priority while music plays (screen off / app in background). */
public final class PlaybackService extends Service {
 private static final String CHANNEL="playback";
 @Override public int onStartCommand(Intent intent,int flags,int id){
  NotificationManager manager=getSystemService(NotificationManager.class);
  manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Playback",NotificationManager.IMPORTANCE_LOW));
  PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_IMMUTABLE);
  Notification n=new Notification.Builder(this,CHANNEL).setSmallIcon(getApplicationInfo().icon).setContentTitle("Oktawka").setContentText("Playing music").setContentIntent(open).setOngoing(true).build();
  if(Build.VERSION.SDK_INT>=29)startForeground(1,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);else startForeground(1,n);
  return START_NOT_STICKY;
 }
 @Override public void onTaskRemoved(Intent root){stopSelf();}
 @Override public IBinder onBind(Intent intent){return null;}
}
