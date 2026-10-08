package com.tidesmusic.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import android.webkit.WebView;

/**
 * Custom WebView that stays active in the background.
 * Overriding window visibility prevents Chromium from pausing HTML5 audio/video
 * when the user turns off the screen or switches to another app.
 */
public class KeepAliveWebView extends WebView {

    public KeepAliveWebView(Context context) {
        super(context);
    }

    public KeepAliveWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public KeepAliveWebView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        // Prevent Chromium from pausing audio when activity is hidden or screen turns off
        super.onWindowVisibilityChanged(View.VISIBLE);
    }

    @Override
    public void dispatchWindowVisibilityChanged(int visibility) {
        // Prevent Chromium from dispatching invisible event to web elements
        super.dispatchWindowVisibilityChanged(View.VISIBLE);
    }
}
