// Trick Firebase Auth v8 into thinking it's running inside React Native.
// React Native does not support iframes, so Firebase completely disables
// the cross-origin iframe initialization and uses AsyncStorage instead!
// We will mock AsyncStorage using native localStorage.
if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
    // console.log("Spoofing React Native environment for Firebase Auth...");
    
    // Spoof React Native
    Object.defineProperty(navigator, 'product', { value: 'ReactNative', configurable: true });
    
    // Mock AsyncStorage so Firebase can save the session natively without IndexedDB headaches
    window.AsyncStorage = {
        getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
        setItem: (key, value) => {
            window.localStorage.setItem(key, value);
            return Promise.resolve();
        },
        removeItem: (key) => {
            window.localStorage.removeItem(key);
            return Promise.resolve();
        }
    };
}
