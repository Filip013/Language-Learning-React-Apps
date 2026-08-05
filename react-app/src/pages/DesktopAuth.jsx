import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import firebase from 'firebase/compat/app';

const DesktopAuth = () => {
    const [status, setStatus] = useState("Initializing Auth...");

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        
        const performAuth = async () => {
            try {
                // Determine if we are being called from Tauri
                if (urlParams.get('source') === 'tauri') {
                    setStatus("Opening Google Sign In...");
                    const provider = new auth.GoogleAuthProvider();
                    
                    // We must use signInWithPopup because we are in a real browser now
                    const res = await auth.signInWithPopup(provider);
                    
                    // Get the underlying Google OAuth ID token from the credential object using the v9 Modular API
                    const credential = auth.GoogleAuthProvider.credentialFromResult(res);
                    const googleIdToken = credential.idToken;
                    
                    // Redirect back to the Tauri app's local server
                    window.location.href = `http://127.0.0.1:51730/?token=${googleIdToken}`;
                } else {
                    setStatus("Invalid Request Source");
                }
            } catch (err) {
                console.error("Auth Proxy Error:", err);
                setStatus(`Authentication Failed: ${err.message}`);
            }
        };

        performAuth();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-zinc-100 font-sans">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-stone-200 dark:border-zinc-800 text-center max-w-sm w-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <h1 className="text-xl font-bold mb-2">Desktop Sign In</h1>
                <p className="text-sm text-stone-500 dark:text-zinc-400">{status}</p>
                <p className="text-xs text-stone-400 mt-4">Please don't close this window.</p>
            </div>
        </div>
    );
};

export default DesktopAuth;
