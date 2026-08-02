// This MUST run before any Firebase imports to successfully mock the environment
if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
    // console.log("Mocking Cordova environment for Firebase Auth...");
    window.cordova = true;
}
