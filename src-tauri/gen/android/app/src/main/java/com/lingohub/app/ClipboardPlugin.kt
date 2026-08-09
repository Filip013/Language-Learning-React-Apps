package com.lingohub.app

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class ClipboardWriteArgs {
  var text: String = ""
}

@TauriPlugin
class ClipboardPlugin(private val activity: Activity) : Plugin(activity) {

  @Command
  fun readText(invoke: Invoke) {
    val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = clipboard.primaryClip
    val text = if (clip != null && clip.itemCount > 0) clip.getItemAt(0).coerceToText(activity).toString() else ""
    Log.d("ClipboardPlugin", "Read ${text.length} chars from clipboard")
    invoke.resolveObject(text)
  }

  @Command
  fun writeText(invoke: Invoke) {
    val args = invoke.parseArgs(ClipboardWriteArgs::class.java)
    val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("LingoHub", args.text))
    invoke.resolve()
  }
}
