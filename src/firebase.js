// src/firebase.js
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { getApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithCredential, signInWithPopup, browserPopupRedirectResolver } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyC4FcjFosdCMxWnPAeMe_ObZPDShnHZy2E",
    authDomain: "gen-lang-client-0142372615.firebaseapp.com",
    projectId: "gen-lang-client-0142372615",
    storageBucket: "gen-lang-client-0142372615.firebasestorage.app",
    messagingSenderId: "115950049911",
    appId: "1:115950049911:web:72954612553e4cf3c78472"
};

// Initialize the app via the compat API (this registers it in the global registry)
firebase.initializeApp(firebaseConfig);

// Get the corresponding Modular app instance from the registry!
const modularApp = getApp();

// Initialize Modular Auth on the modular app!
// By explicitly specifying browserLocalPersistence without the popupRedirectResolver,
// we completely disable the cross-origin iframe bug in WebKitGTK!
const nativeAuth = initializeAuth(modularApp, { persistence: browserLocalPersistence });

// Export a proxy object that perfectly mimics the v8 Auth API used by the rest of the app
export const auth = {
    onAuthStateChanged: (callback) => onAuthStateChanged(nativeAuth, callback),
    signOut: () => signOut(nativeAuth),
    GoogleAuthProvider: GoogleAuthProvider,
    signInWithCredential: (cred) => signInWithCredential(nativeAuth, cred),
    // We must manually provide the resolver here since we omitted it during initialization!
    signInWithPopup: (provider) => signInWithPopup(nativeAuth, provider, browserPopupRedirectResolver),
    get currentUser() { return nativeAuth.currentUser; }
};

export const db = firebase.firestore();
export default firebase;