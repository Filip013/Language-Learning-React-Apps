package com.lingohub.app

import android.app.Activity
import android.content.Intent
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class ShareArgs {
  var text: String = ""
}

@TauriPlugin
class SharePlugin(private val activity: Activity) : Plugin(activity) {

  @Command
  fun share(invoke: Invoke) {
    val args = invoke.parseArgs(ShareArgs::class.java)
    val text = args.text
    Log.d("SharePlugin", "Sharing prompt text (${text.length} chars)")

    val sendIntent = Intent(Intent.ACTION_SEND)
    sendIntent.type = "text/plain"
    sendIntent.putExtra(Intent.EXTRA_SUBJECT, "LingoHub Prompt")
    sendIntent.putExtra(Intent.EXTRA_TEXT, text)
    try {
      activity.startActivity(Intent.createChooser(sendIntent, "Share Prompt"))
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject("Share failed: ${e.message}", null, null, null)
    }
  }
}
