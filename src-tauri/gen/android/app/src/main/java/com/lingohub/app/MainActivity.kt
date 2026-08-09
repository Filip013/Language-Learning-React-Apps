package com.lingohub.app

import android.content.res.Configuration
import android.os.Bundle
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  private var jsThemeSet = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applySystemTheme(resources.configuration)
  }

  override fun onResume() {
    super.onResume()
    // Only use the system theme as a fallback until JS pushes the actual app theme.
    if (!jsThemeSet) {
      applySystemTheme(resources.configuration)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    if (!jsThemeSet) {
      applySystemTheme(newConfig)
    }
  }

  private fun applySystemTheme(config: Configuration) {
    val isDark = (config.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    renderSystemBars(isDark)
  }

  fun updateSystemBarsTheme(isDark: Boolean) {
    jsThemeSet = true
    renderSystemBars(isDark)
  }

  private fun renderSystemBars(isDark: Boolean) {
    runOnUiThread {
      val window = window

      window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
      window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
      window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)

      val color = android.graphics.Color.parseColor(if (isDark) "#09090b" else "#fafaf9")

      window.statusBarColor = color
      window.navigationBarColor = color
      window.decorView.setBackgroundColor(color)

      val insetsController = WindowCompat.getInsetsController(window, window.decorView)
      insetsController.isAppearanceLightStatusBars = !isDark
      insetsController.isAppearanceLightNavigationBars = !isDark

      @Suppress("DEPRECATION")
      var flags = window.decorView.systemUiVisibility
      if (!isDark) {
        flags = flags or android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
          flags = flags or android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
      } else {
        flags = flags and android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
          flags = flags and android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
        }
      }
      window.decorView.systemUiVisibility = flags
    }
  }
}
