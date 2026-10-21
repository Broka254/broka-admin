package com.broka.admin

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorPanel: View
    private lateinit var errorDetail: TextView
    private var failedUrl: String? = null

    private val approvedHost: String by lazy {
        Uri.parse(BuildConfig.DASHBOARD_URL).host?.lowercase().orEmpty()
    }

    private fun normalize(uri: Uri): String {
        return "${uri.scheme?.lowercase()}:${uri.host?.lowercase() ?: ""}"
    }

    private fun isApproved(uri: Uri): Boolean {
        return uri.scheme?.lowercase() == "https" && !uri.host.isNullOrBlank() &&
            uri.host?.lowercase() == approvedHost
    }

    private fun openExternally(uri: Uri) {
        val scheme = uri.scheme?.lowercase()
        if (scheme != "http" && scheme != "https") {
            blockExternal(uri)
            return
        }
        try {
            val intent = Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show()
        }
    }

    private fun blockExternal(uri: Uri) {
        Toast.makeText(this, getString(R.string.blocked_link, normalize(uri)), Toast.LENGTH_SHORT).show()
    }

    private fun showProgress(shown: Boolean) {
        progressBar.visibility = if (shown) View.VISIBLE else View.GONE
    }

    private fun showError(detail: String, url: String?) {
        failedUrl = url
        errorDetail.text = detail
        errorPanel.visibility = View.VISIBLE
    }

    private fun hideError() {
        errorPanel.visibility = View.GONE
    }

    private fun loadDashboard() {
        failedUrl = null
        webView.loadUrl(BuildConfig.DASHBOARD_URL)
    }

    private fun retry() {
        val target = failedUrl
        if (target.isNullOrBlank() || !isApproved(Uri.parse(target))) {
            loadDashboard()
        } else {
            failedUrl = null
            webView.loadUrl(target)
        }
    }

    private val webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            if (isApproved(uri)) return false
            if (uri.scheme?.lowercase() == "http" || uri.scheme?.lowercase() == "https") {
                openExternally(uri)
            } else {
                blockExternal(uri)
            }
            return true
        }

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            hideError()
            showProgress(true)
            progressBar.progress = 0
        }

        override fun onPageFinished(view: WebView, url: String) {
            showProgress(false)
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame) return
            showError(getString(R.string.error_network_detail, error.description?.toString().orEmpty()), request.url.toString())
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
            if (!request.isForMainFrame) return
            showError(getString(R.string.error_http_detail, errorResponse.statusCode), request.url.toString())
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) {
            handler.cancel()
            showError(getString(R.string.error_ssl_detail), BuildConfig.DASHBOARD_URL)
        }
    }

    private val webChromeClient = object : WebChromeClient() {
        override fun onProgressChanged(view: WebView, newProgress: Int) {
            if (newProgress >= 100) {
                showProgress(false)
            } else {
                showProgress(true)
                progressBar.progress = newProgress
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = false
            mediaPlaybackRequiresUserGesture = true
            cacheMode = WebSettings.LOAD_DEFAULT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }
        webView.webViewClient = webViewClient
        webView.webChromeClient = webChromeClient
        webView.setDownloadListener { _, _, _, _, _ ->
            Toast.makeText(this, R.string.download_unsupported, Toast.LENGTH_SHORT).show()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webview)
        progressBar = findViewById(R.id.progress_bar)
        errorPanel = findViewById(R.id.error_panel)
        errorDetail = findViewById(R.id.error_detail)
        findViewById<Button>(R.id.retry_button).setOnClickListener { retry() }
        configureWebView()
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            loadDashboard()
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }
}
