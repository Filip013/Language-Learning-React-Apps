package com.lingohub.app

import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class SystemBarsArgs {
  var isDark: Boolean = false
}

@TauriPlugin
class SystemBarsPlugin(private val activity: android.app.Activity) : Plugin(activity) {

  @Command
  fun setTheme(invoke: Invoke) {
    val args = invoke.parseArgs(SystemBarsArgs::class.java)
    val isDark = args.isDark
    Log.d("SystemBarsPlugin", "setTheme command received from JS: isDark = $isDark")
    (activity as? MainActivity)?.updateSystemBarsTheme(isDark)
    invoke.resolve()
  }
}
