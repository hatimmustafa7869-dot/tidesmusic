package com.tidesmusic.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MediaPlaybackService extends Service {
    public static final String CHANNEL_ID = "tides_music_playback";
    public static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START_OR_UPDATE = "com.tidesmusic.app.START_OR_UPDATE";
    public static final String ACTION_UPDATE_STATE = "com.tidesmusic.app.UPDATE_STATE";
    public static final String ACTION_STOP = "com.tidesmusic.app.STOP";

    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_ARTIST = "extra_artist";
    public static final String EXTRA_COVER_URL = "extra_cover_url";
    public static final String EXTRA_IS_PLAYING = "extra_is_playing";

    private PowerManager.WakeLock wakeLock;
    private MediaSessionCompat mediaSession;

    private String currentTitle = "Tides Music";
    private String currentArtist = "Streaming";
    private String currentCoverUrl = "";
    private Bitmap currentCoverBitmap = null;
    private boolean isPlaying = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // Initialize WakeLock
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TidesMusic:PlaybackWakeLock");
            wakeLock.setReferenceCounted(false);
        }

        // Initialize MediaSessionCompat
        mediaSession = new MediaSessionCompat(this, "TidesMusicMediaSession");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                sendControlBroadcast("play");
                updatePlaybackState(true);
            }

            @Override
            public void onPause() {
                sendControlBroadcast("pause");
                updatePlaybackState(false);
            }

            @Override
            public void onSkipToNext() {
                sendControlBroadcast("next");
            }

            @Override
            public void onSkipToPrevious() {
                sendControlBroadcast("prev");
            }

            @Override
            public void onStop() {
                sendControlBroadcast("pause");
                stopSelf();
            }
        });
        mediaSession.setActive(true);
    }

    private void sendControlBroadcast(String action) {
        Intent intent = new Intent(MediaNotificationReceiver.BROADCAST_WEB_CONTROL);
        intent.putExtra(MediaNotificationReceiver.EXTRA_ACTION, action);
        sendBroadcast(intent);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            releaseWakeLock();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_START_OR_UPDATE.equals(action)) {
            String newTitle = intent.getStringExtra(EXTRA_TITLE);
            String newArtist = intent.getStringExtra(EXTRA_ARTIST);
            String newCover = intent.getStringExtra(EXTRA_COVER_URL);
            boolean newPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);

            if (newTitle != null) currentTitle = newTitle;
            if (newArtist != null) currentArtist = newArtist;
            isPlaying = newPlaying;

            if (isPlaying) {
                acquireWakeLock();
            } else {
                releaseWakeLock();
            }

            if (newCover != null && !newCover.equals(currentCoverUrl)) {
                currentCoverUrl = newCover;
                fetchCoverBitmap(newCover);
            } else {
                updateNotificationAndSession();
            }
        } else if (ACTION_UPDATE_STATE.equals(action)) {
            isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);
            if (isPlaying) {
                acquireWakeLock();
            } else {
                releaseWakeLock();
            }
            updateNotificationAndSession();
        }

        return START_STICKY;
    }

    private void acquireWakeLock() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(12 * 60 * 60 * 1000L); // 12 hours max
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    private void fetchCoverBitmap(String coverUrl) {
        new Thread(() -> {
            Bitmap bitmap = null;
            try {
                if (coverUrl != null && (coverUrl.startsWith("http://") || coverUrl.startsWith("https://"))) {
                    URL url = new URL(coverUrl);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setDoInput(true);
                    connection.setConnectTimeout(5000);
                    connection.setReadTimeout(5000);
                    connection.connect();
                    InputStream input = connection.getInputStream();
                    bitmap = BitmapFactory.decodeStream(input);
                }
            } catch (Exception e) {
                // Ignore and use default
            }
            currentCoverBitmap = bitmap;
            updateNotificationAndSession();
        }).start();
    }

    private void updateNotificationAndSession() {
        // Update MediaSession
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE |
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                        PlaybackStateCompat.ACTION_STOP)
                .setState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                        PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f);
        mediaSession.setPlaybackState(stateBuilder.build());

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Tides Music");

        if (currentCoverBitmap != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentCoverBitmap);
        }
        mediaSession.setMetadata(metaBuilder.build());

        // Build Notification
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                this, 0, openAppIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        PendingIntent prevIntent = PendingIntent.getBroadcast(
                this, 1, new Intent(this, MediaNotificationReceiver.class).setAction(MediaNotificationReceiver.ACTION_PREV),
                PendingIntent.FLAG_IMMUTABLE
        );

        Intent playPauseIntent = new Intent(this, MediaNotificationReceiver.class)
                .setAction(isPlaying ? MediaNotificationReceiver.ACTION_PAUSE : MediaNotificationReceiver.ACTION_PLAY);
        PendingIntent playPausePendingIntent = PendingIntent.getBroadcast(
                this, 2, playPauseIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        PendingIntent nextIntent = PendingIntent.getBroadcast(
                this, 3, new Intent(this, MediaNotificationReceiver.class).setAction(MediaNotificationReceiver.ACTION_NEXT),
                PendingIntent.FLAG_IMMUTABLE
        );

        androidx.media.app.NotificationCompat.MediaStyle mediaStyle = new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSubText("Tides Music")
                .setContentIntent(contentPendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(isPlaying)
                .setStyle(mediaStyle)
                .addAction(R.drawable.ic_prev, "Previous", prevIntent)
                .addAction(isPlaying ? R.drawable.ic_pause : R.drawable.ic_play, isPlaying ? "Pause" : "Play", playPausePendingIntent)
                .addAction(R.drawable.ic_next, "Next", nextIntent);

        if (currentCoverBitmap != null) {
            builder.setLargeIcon(currentCoverBitmap);
        }

        Notification notification = builder.build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ignored) {}
        }
    }

    private void updatePlaybackState(boolean playing) {
        isPlaying = playing;
        if (isPlaying) {
            acquireWakeLock();
        } else {
            releaseWakeLock();
        }
        updateNotificationAndSession();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.notification_channel_name),
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription(getString(R.string.notification_channel_description));
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    public static void startWithTrack(Context context, String title, String artist, String coverUrl, boolean isPlaying) {
        Intent intent = new Intent(context, MediaPlaybackService.class);
        intent.setAction(ACTION_START_OR_UPDATE);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_ARTIST, artist);
        intent.putExtra(EXTRA_COVER_URL, coverUrl);
        intent.putExtra(EXTRA_IS_PLAYING, isPlaying);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void updateState(Context context, boolean isPlaying) {
        Intent intent = new Intent(context, MediaPlaybackService.class);
        intent.setAction(ACTION_UPDATE_STATE);
        intent.putExtra(EXTRA_IS_PLAYING, isPlaying);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stopService(Context context) {
        Intent intent = new Intent(context, MediaPlaybackService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }
}
