import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:url_launcher/url_launcher.dart';
import 'desktop_auth/desktop_auth.dart';
import '../constants/app_constants.dart';

class FirebaseService {
  static bool _isInitialized = false;

  static Future<void> init() async {
    if (_isInitialized) return;
    try {
      if (Firebase.apps.isEmpty) {
        if (kIsWeb) {
          await Firebase.initializeApp(
            options: const FirebaseOptions(
              apiKey: AppConstants.firebaseApiKeyDefault,
              authDomain: AppConstants.firebaseAuthDomain,
              projectId: AppConstants.firebaseProjectId,
              storageBucket: AppConstants.firebaseStorageBucket,
              messagingSenderId: AppConstants.firebaseMessagingSenderId,
              appId: AppConstants.firebaseAppId,
            ),
          );
        } else {
          try {
            await Firebase.initializeApp();
          } catch (_) {
            await Firebase.initializeApp(
              options: const FirebaseOptions(
                apiKey: AppConstants.firebaseApiKeyDefault,
                authDomain: AppConstants.firebaseAuthDomain,
                projectId: AppConstants.firebaseProjectId,
                storageBucket: AppConstants.firebaseStorageBucket,
                messagingSenderId: AppConstants.firebaseMessagingSenderId,
                appId: AppConstants.firebaseAppId,
              ),
            );
          }
        }
      }
      _isInitialized = true;
    } catch (e) {
      debugPrint('Firebase core init notice/error: $e');
    }
  }

  static FirebaseFirestore get firestore => FirebaseFirestore.instance;
  static FirebaseAuth get auth => FirebaseAuth.instance;

  static User? get currentUser {
    try {
      return auth.currentUser;
    } catch (_) {
      return null;
    }
  }

  static String? get currentUserId {
    try {
      final uid = auth.currentUser?.uid;
      if (uid != null && uid.isNotEmpty) return uid;
    } catch (_) {}
    return null;
  }

  static Stream<User?> get authStateChanges {
    try {
      return auth.authStateChanges();
    } catch (_) {
      return Stream.value(null);
    }
  }

  static Future<UserCredential?> signInWithGoogle() async {
    try {
      if (kIsWeb) {
        final googleProvider = GoogleAuthProvider();
        return await auth.signInWithPopup(googleProvider);
      } else if (!kIsWeb && defaultTargetPlatform == TargetPlatform.windows) {
        return await _signInWithGoogleWindows();
      } else {
        return await _signInWithGoogleMobile();
      }
    } catch (e) {
      debugPrint('Google Sign-In Error: $e');
      rethrow;
    }
  }

  static Future<UserCredential?> _signInWithGoogleMobile() async {
    try {
      final googleSignIn = GoogleSignIn.instance;
      await googleSignIn.initialize();
      final GoogleSignInAccount googleUser = await googleSignIn.authenticate();
      final GoogleSignInAuthentication googleAuth = googleUser.authentication;
      final AuthCredential credential = GoogleAuthProvider.credential(
        idToken: googleAuth.idToken,
      );
      return await auth.signInWithCredential(credential);
    } catch (e) {
      debugPrint('Mobile native Google Sign-In notice: $e. Falling back to web auth bridge...');
      return await _signInWithGoogleWindows();
    }
  }

  static Future<UserCredential?> _signInWithGoogleWindows() async {
    return await signInWithGoogleWindows(auth);
  }

  static Future<void> _openBrowser(String url) async {
    await openWindowsBrowser(url);
  }

  static Future<void> signOut() async {
    try {
      await auth.signOut();
    } catch (e) {
      debugPrint('Sign-Out Error: $e');
    }
  }

  // Sync API Keys with Firestore at artifacts/hub/users/{uid}
  static Future<String?> fetchUserApiKey(String storageKey) async {
    final uid = currentUserId;
    if (uid == null) return null;
    try {
      final snap = await firestore
          .collection('artifacts')
          .doc('hub')
          .collection('users')
          .doc(uid)
          .get();
      if (snap.exists && snap.data() != null && snap.data()!.containsKey(storageKey)) {
        return snap.data()![storageKey] as String?;
      }
    } catch (e) {
      debugPrint('Error fetching API key from Firestore: $e');
    }
    return null;
  }

  static Future<void> saveUserApiKey(String storageKey, String key) async {
    final uid = currentUserId;
    if (uid == null) return;
    try {
      await firestore
          .collection('artifacts')
          .doc('hub')
          .collection('users')
          .doc(uid)
          .set({storageKey: key.trim()}, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error saving API key to Firestore: $e');
    }
  }

  static Future<void> removeUserApiKey(String storageKey) async {
    final uid = currentUserId;
    if (uid == null) return;
    try {
      await firestore
          .collection('artifacts')
          .doc('hub')
          .collection('users')
          .doc(uid)
          .set({storageKey: FieldValue.delete()}, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error deleting API key from Firestore: $e');
    }
  }

  // Sync user notes
  static Future<void> saveUserNote(String noteId, Map<String, dynamic> data) async {
    final uid = currentUserId;
    if (uid == null) return;
    try {
      await firestore
          .collection('artifacts')
          .doc('hub')
          .collection('users')
          .doc(uid)
          .collection('notes')
          .doc(noteId)
          .set(data, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error saving note to Firebase: $e');
    }
  }

  static Stream<QuerySnapshot<Map<String, dynamic>>>? streamUserNotes() {
    final uid = currentUserId;
    if (uid == null) return null;
    return firestore
        .collection('artifacts')
        .doc('hub')
        .collection('users')
        .doc(uid)
        .collection('notes')
        .snapshots();
  }
}

