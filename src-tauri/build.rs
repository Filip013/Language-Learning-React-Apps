fn main() {
  println!("cargo:rerun-if-changed=../dist");
  tauri_build::try_build(
    tauri_build::Attributes::new()
      .plugin(
        "systemBars",
        tauri_build::InlinedPlugin::new()
          .commands(&["set_theme"])
          .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
      )
      .plugin(
        "share",
        tauri_build::InlinedPlugin::new()
          .commands(&["share"])
          .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
      )
      .plugin(
        "clipboard",
        tauri_build::InlinedPlugin::new()
          .commands(&["read_text", "write_text"])
          .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
      ),
  )
  .expect("failed to run tauri-build");
}
