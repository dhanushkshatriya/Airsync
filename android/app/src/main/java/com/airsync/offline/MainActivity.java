package com.airsync.offline;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Programmatically instantiate the WebView for absolute UI reliability
        webView = new WebView(this);
        setContentView(webView);

        // 2. Configure high-performance webview parameters
        WebSettings settings = webView.getSettings();
        
        // Critical: Enable JavaScript for our ES6 modules
        settings.setJavaScriptEnabled(true);
        
        // Critical: Enable DOM Storage for LocalStorage and database caching
        settings.setDomStorageEnabled(true);
        
        // Allow reading files locally (since assets are local)
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        
        // Enable database caching (IndexedDB compatibility)
        settings.setDatabaseEnabled(true);

        // 3. Prevent external browsers from launching when navigating
        webView.setWebViewClient(new WebViewClient());

        // 4. Load our offline web application bundle directly from device storage!
        webView.loadUrl("file:///android_asset/index.html");
    }

    // 5. Intercept hardware back button to allow navigating within Web App history
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
