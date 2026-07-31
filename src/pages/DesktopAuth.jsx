import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import firebase from 'firebase/compat/app';

const DesktopAuth = () => {
    const [status, setStatus] = useState("Initializing Auth...");
    const [manualToken, setManualToken] = useState(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        
        const performAuth = async () => {
            try {
                // Determine if we are being called from Tauri
                if (urlParams.get('source') === 'tauri') {
                    setStatus("Opening Google Sign In...");
                    const provider = new firebase.auth.GoogleAuthProvider();
                    
                    // We must use signInWithPopup because we are in a real browser now
                    const res = await auth.signInWithPopup(provider);
                    
                    // Get the underlying Google OAuth ID token from the credential object
                    const googleIdToken = res.credential.idToken;
                    
                    // Display the token for manual copying
                    setStatus("Authentication Successful!");
                    setManualToken(googleIdToken);
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
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-stone-200 dark:border-zinc-800 text-center max-w-sm w-full break-words">
                {!manualToken ? (
                    <>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <h1 className="text-xl font-bold mb-2">Desktop Sign In</h1>
                        <p className="text-sm text-stone-500 dark:text-zinc-400">{status}</p>
                        <p className="text-xs text-stone-400 mt-4">Please don't close this window.</p>
                    </>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold mb-4 text-green-500">🎉 Success!</h1>
                        <p className="text-sm text-stone-600 dark:text-zinc-300 mb-6">
                            Please copy the secure token below and paste it into the LingoHub desktop app to complete your login.
                        </p>
                        <div className="bg-stone-100 dark:bg-zinc-950 p-4 rounded-xl border border-stone-200 dark:border-zinc-800 mb-6">
                            <code className="text-xs text-stone-500 dark:text-zinc-500 break-all line-clamp-3">
                                {manualToken}
                            </code>
                        </div>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(manualToken);
                                setStatus("Copied to clipboard!");
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors mb-2"
                        >
                            Copy Token to Clipboard
                        </button>
                        {status === "Copied to clipboard!" && (
                            <p className="text-sm text-green-500 font-medium">{status}</p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DesktopAuth;
