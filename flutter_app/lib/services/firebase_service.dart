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

  // ─── Course Streams & Persistence ─────────────────────────────────────────

  static Stream<QuerySnapshot> courseEpisodesStream(
    String dbAppId,
    String uid,
  ) =>
      _db
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('episodes')
          .orderBy('timestamp', descending: true)
          .limit(20)
          .snapshots();

  static Stream<DocumentSnapshot> courseProgressStream(
    String dbAppId,
    String uid,
    String episodeId,
  ) =>
      _db
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('progress')
          .doc(episodeId)
          .snapshots();

  static Future<void> saveCourseUserNote(
    String dbAppId,
    String uid,
    String episodeId,
    String noteId,
    String title,
    String content,
  ) async {
    final ref = _db
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('progress')
        .doc(episodeId);

    final noteData = {
      'id': noteId,
      'title': title,
      'content': content,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    await ref.set({
      'notes': {noteId: noteData},
    }, SetOptions(merge: true));
  }

  static Future<void> saveNewEpisodeDoc(
    String dbAppId,
    String uid,
    String episodeId,
    Map<String, dynamic> episodeDoc,
  ) async {
    await _db
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('episodes')
        .doc(episodeId)
        .set(episodeDoc, SetOptions(merge: true));
  }

  static Future<void> updateCourseProgress(
    String dbAppId,
    String uid,
    String episodeId,
    Map<String, dynamic> progressData,
  ) async {
    await _db
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('progress')
        .doc(episodeId)
        .set(progressData, SetOptions(merge: true));
  }

  static Future<void> deleteEpisodeDoc(
    String dbAppId,
    String uid,
    String episodeId,
  ) async {
    await _db
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('episodes')
        .doc(episodeId)
        .delete();
  }
}
