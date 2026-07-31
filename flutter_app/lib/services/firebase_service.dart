// lib/services/firebase_service.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:lingocraft_flutter/models/lingocraft_result.dart';

class FirebaseService {
  static final _auth = FirebaseAuth.instance;
  static final _db = FirebaseFirestore.instance;

  static const _appId = 'lingocraft';

  // ─── Auth ─────────────────────────────────────────────────────────────────

  static Stream<User?> get userStream => _auth.authStateChanges();

  static Future<UserCredential?> signInWithGoogle() async {
    try {
      if (kIsWeb) {
        final googleProvider = GoogleAuthProvider();
        return await _auth.signInWithPopup(googleProvider);
      } else {
        if (!GoogleSignIn.instance.supportsAuthenticate()) return null;
        final googleUser = await GoogleSignIn.instance.authenticate();
        final credential = GoogleAuthProvider.credential(
          idToken: googleUser.authentication.idToken,
        );
        return await _auth.signInWithCredential(credential);
      }
    } catch (e) {
      debugPrint('Google Sign-In Error: $e');
      return null;
    }
  }

  static Future<void> signOut() async {
    await _auth.signOut();
  }

  // ─── Firestore helpers ────────────────────────────────────────────────────

  static DocumentReference _prefsDoc(String uid) => _db
      .collection('artifacts')
      .doc(_appId)
      .collection('users')
      .doc(uid)
      .collection('config')
      .doc('preferences');

  static DocumentReference _historyDoc(String uid) => _db
      .collection('artifacts')
      .doc(_appId)
      .collection('users')
      .doc(uid)
      .collection('data')
      .doc('history');

  // ─── Preferences ──────────────────────────────────────────────────────────

  static Stream<DocumentSnapshot> prefsStream(String uid) =>
      _prefsDoc(uid).snapshots();

  static Future<void> savePrefs(
    String uid, {
    String? language,
    String? level,
  }) async {
    final data = <String, dynamic>{};
    if (language != null) data['language'] = language;
    if (level != null) data['level'] = level;
    if (data.isNotEmpty) {
      await _prefsDoc(uid).set(data, SetOptions(merge: true));
    }
  }

  // ─── History ──────────────────────────────────────────────────────────────

  static Stream<DocumentSnapshot> historyStream(String uid) =>
      _historyDoc(uid).snapshots();

  static Future<void> saveHistory(
    String uid,
    List<LingoCraftResult> items,
  ) async {
    await _historyDoc(uid).set({'items': items.map((i) => i.toMap()).toList()});
  }
}
