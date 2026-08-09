fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new()
      .plugin(
        "systemBars",
        tauri_build::InlinedPlugin::new()
          .commands(&["set_theme"])
          .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
      ),
  )
  .expect("failed to run tauri-build");
}
