import { initializeApp } from "firebase/app";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth";

console.log(GoogleAuthProvider.credential("dummy_token"));
