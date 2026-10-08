package com.tidesmusic.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class MediaNotificationReceiver extends BroadcastReceiver {
    public static final String ACTION_PLAY = "com.tidesmusic.app.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.tidesmusic.app.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.tidesmusic.app.ACTION_NEXT";
    public static final String ACTION_PREV = "com.tidesmusic.app.ACTION_PREV";
    public static final String ACTION_STOP = "com.tidesmusic.app.ACTION_STOP";

    public static final String BROADCAST_WEB_CONTROL = "com.tidesmusic.app.WEB_CONTROL";
    public static final String EXTRA_ACTION = "control_action";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        Intent webIntent = new Intent(BROADCAST_WEB_CONTROL);

        if (ACTION_PLAY.equals(action)) {
            webIntent.putExtra(EXTRA_ACTION, "play");
            context.sendBroadcast(webIntent);
            MediaPlaybackService.updateState(context, true);
        } else if (ACTION_PAUSE.equals(action)) {
            webIntent.putExtra(EXTRA_ACTION, "pause");
            context.sendBroadcast(webIntent);
            MediaPlaybackService.updateState(context, false);
        } else if (ACTION_NEXT.equals(action)) {
            webIntent.putExtra(EXTRA_ACTION, "next");
            context.sendBroadcast(webIntent);
        } else if (ACTION_PREV.equals(action)) {
            webIntent.putExtra(EXTRA_ACTION, "prev");
            context.sendBroadcast(webIntent);
        } else if (ACTION_STOP.equals(action)) {
            webIntent.putExtra(EXTRA_ACTION, "pause");
            context.sendBroadcast(webIntent);
            MediaPlaybackService.stopService(context);
        }
    }
}
