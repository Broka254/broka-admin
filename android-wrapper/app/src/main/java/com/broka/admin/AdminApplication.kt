package com.broka.admin

import android.app.Application
import android.webkit.WebView

class AdminApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    }
}
