const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
console.log(firebase.auth.GoogleAuthProvider.credential("idtoken").idToken);
