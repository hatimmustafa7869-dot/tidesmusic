package com.tidesmusic.app;

import android.content.Context;
import android.webkit.JavascriptInterface;

public class WebAppInterface {
    private final Context context;

    public WebAppInterface(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public void onTrackChange(String title, String artist, String coverUrl, boolean isPlaying) {
        MediaPlaybackService.startWithTrack(context, title, artist, coverUrl, isPlaying);
    }

    @JavascriptInterface
    public void onPlaybackStateChange(boolean isPlaying) {
        MediaPlaybackService.updateState(context, isPlaying);
    }

    @JavascriptInterface
    public void stopPlaybackService() {
        MediaPlaybackService.stopService(context);
    }

    @JavascriptInterface
    public String getAppVersion() {
        return "1.0.0-native";
    }

    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }
}
