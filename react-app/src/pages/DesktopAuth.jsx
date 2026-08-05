import React, { useState } from 'react';
import { auth } from '../firebase';

const DesktopAuth = () => {
    const [status, setStatus] = useState("");
    const [token, setToken] = useState("");
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setStatus("Opening Google Sign In...");
        try {
            const provider = new auth.GoogleAuthProvider();
            const res = await auth.signInWithPopup(provider);
            const credential = auth.GoogleAuthProvider.credentialFromResult(res);
            const googleIdToken = credential?.idToken;
            
            if (googleIdToken) {
                setToken(googleIdToken);
                setStatus("Authentication Successful!");

                // 1. Try deep link redirect
                window.location.href = `lingohub://auth?token=${googleIdToken}`;

                // 2. Try background HTTP fetch to local server fallback
                fetch(`http://127.0.0.1:51730/?token=${googleIdToken}`).catch(() => {});
            } else {
                setStatus("Could not retrieve Google ID Token.");
            }
        } catch (err) {
            console.error("Auth Error:", err);
            setStatus(`Sign in error: ${err.message || err}`);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!token) return;
        navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-zinc-100 font-sans">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-stone-200 dark:border-zinc-800 text-center max-w-sm w-full">
                <div className="text-3xl mb-3">🔑</div>
                <h1 className="text-xl font-bold mb-2">LingoHub Authentication</h1>
                <p className="text-sm text-stone-500 dark:text-zinc-400 mb-6">
                    {token ? "Authentication complete! Copy your token below or return to LingoHub." : "Click below to sign in with your Google account."}
                </p>

                {!token && (
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <span>Sign in with Google</span>
                        )}
                    </button>
                )}

                {status && (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-4">{status}</p>
                )}

                {token && (
                    <div className="mt-6 pt-4 border-t border-stone-200 dark:border-zinc-800">
                        <label className="block text-xs font-semibold text-stone-500 mb-1 text-left">Your Auth Token:</label>
                        <textarea
                            readOnly
                            value={token}
                            className="w-full text-xs font-mono p-2 bg-stone-100 dark:bg-zinc-800 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-200 h-20 resize-none mb-3"
                        />
                        <button 
                            onClick={copyToClipboard}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-colors shadow-sm mb-2 cursor-pointer"
                        >
                            {copied ? "✓ Copied to Clipboard!" : "Copy Auth Token"}
                        </button>
                        <a 
                            href={`lingohub://auth?token=${token}`}
                            className="inline-block w-full bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-medium text-xs py-2 px-4 rounded-xl hover:bg-stone-200 transition-colors"
                        >
                            Open LingoHub App
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DesktopAuth;
