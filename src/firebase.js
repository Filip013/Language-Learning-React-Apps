// src/firebase.js
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyC4FcjFosdCMxWnPAeMe_ObZPDShnHZy2E",
    authDomain: "gen-lang-client-0142372615.firebaseapp.com",
    projectId: "gen-lang-client-0142372615",
    storageBucket: "gen-lang-client-0142372615.firebasestorage.app",
    messagingSenderId: "115950049911",
    appId: "1:115950049911:web:72954612553e4cf3c78472"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export default firebase;