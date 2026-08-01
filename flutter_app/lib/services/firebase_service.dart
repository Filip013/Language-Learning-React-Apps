// lib/services/firebase_service.dart
import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart' as official_fs;
import 'package:firebase_auth/firebase_auth.dart' as official_auth;
import 'package:firedart/firedart.dart' as firedart;
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:lingocraft_flutter/models/lingocraft_result.dart';

class AppUser {
  final String uid;
  final String? email;
  final String? displayName;
  final String? photoURL;

  AppUser({
    required this.uid,
    this.email,
    this.displayName,
    this.photoURL,
  });
}

class AppDocumentSnapshot {
  final bool exists;
  final Map<String, dynamic>? _data;
  AppDocumentSnapshot(this.exists, this._data);
  Map<String, dynamic>? data() => _data;
}

class AppQueryDocumentSnapshot {
  final String id;
  final Map<String, dynamic> _data;
  AppQueryDocumentSnapshot(this.id, this._data);
  Map<String, dynamic> data() => _data;
}

class AppQuerySnapshot {
  final List<AppQueryDocumentSnapshot> docs;
  AppQuerySnapshot(this.docs);
}

class FirebaseService {
  static bool get isLinux =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.linux;

  static const _appId = 'lingocraft';

  // ─── Auth ─────────────────────────────────────────────────────────────────

  static Stream<AppUser?>? _cachedUserStream;

  static Stream<AppUser?> get userStream {
    _cachedUserStream ??= _createUserStream().asBroadcastStream();
    return _cachedUserStream!;
  }

  static Stream<AppUser?> _createUserStream() {
    if (isLinux) {
      return firedart.FirebaseAuth.instance.signInState.map((signedIn) {
        if (!signedIn) return null;
        final uid = firedart.FirebaseAuth.instance.userId;
        return AppUser(
          uid: uid,
          email: 'guest@lingocraft.local',
          displayName: 'Linux Desktop User',
        );
      });
    }
    return official_auth.FirebaseAuth.instance.authStateChanges().map(
          (u) => u == null
              ? null
              : AppUser(
                  uid: u.uid,
                  email: u.email,
                  displayName: u.displayName,
                  photoURL: u.photoURL,
                ),
        );
  }

  static Future<AppUser?> signInWithGoogle() async {
    try {
      if (isLinux) {
        if (!firedart.FirebaseAuth.instance.isSignedIn) {
          final user =
              await firedart.FirebaseAuth.instance.signInAnonymously();
          return AppUser(
            uid: user.id,
            email: user.email,
            displayName: 'Linux Desktop User',
          );
        }
        return AppUser(
          uid: firedart.FirebaseAuth.instance.userId,
          email: 'guest@lingocraft.local',
          displayName: 'Linux Desktop User',
        );
      }

      if (kIsWeb) {
        final googleProvider = official_auth.GoogleAuthProvider();
        final cred =
            await official_auth.FirebaseAuth.instance.signInWithPopup(googleProvider);
        final u = cred.user;
        return u == null
            ? null
            : AppUser(
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                photoURL: u.photoURL,
              );
      } else {
        if (!GoogleSignIn.instance.supportsAuthenticate()) return null;
        final googleUser = await GoogleSignIn.instance.authenticate();
        final credential = official_auth.GoogleAuthProvider.credential(
          idToken: googleUser.authentication.idToken,
        );
        final cred =
            await official_auth.FirebaseAuth.instance.signInWithCredential(credential);
        final u = cred.user;
        return u == null
            ? null
            : AppUser(
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                photoURL: u.photoURL,
              );
      }
    } catch (e) {
      debugPrint('Sign-In Error: $e');
      return null;
    }
  }

  static Future<void> signOut() async {
    if (isLinux) {
      firedart.FirebaseAuth.instance.signOut();
    } else {
      await official_auth.FirebaseAuth.instance.signOut();
    }
  }

  // ─── Preferences ──────────────────────────────────────────────────────────

  static Stream<AppDocumentSnapshot> prefsStream(String uid) {
    if (isLinux) {
      return firedart.Firestore.instance
          .collection('artifacts')
          .document(_appId)
          .collection('users')
          .document(uid)
          .collection('config')
          .document('preferences')
          .stream
          .map((doc) => AppDocumentSnapshot(doc != null, doc?.map))
          .asBroadcastStream();
    }
    return official_fs.FirebaseFirestore.instance
        .collection('artifacts')
        .doc(_appId)
        .collection('users')
        .doc(uid)
        .collection('config')
        .doc('preferences')
        .snapshots()
        .map((snap) => AppDocumentSnapshot(
              snap.exists,
              snap.data(),
            ))
        .asBroadcastStream();
  }

  static Future<void> savePrefs(
    String uid, {
    String? language,
    String? level,
  }) async {
    final data = <String, dynamic>{};
    if (language != null) data['language'] = language;
    if (level != null) data['level'] = level;
    if (data.isEmpty) return;

    if (isLinux) {
      final docRef = firedart.Firestore.instance
          .collection('artifacts')
          .document(_appId)
          .collection('users')
          .document(uid)
          .collection('config')
          .document('preferences');
      if (await docRef.exists) {
        await docRef.update(data);
      } else {
        await docRef.set(data);
      }
    } else {
      await official_fs.FirebaseFirestore.instance
          .collection('artifacts')
          .doc(_appId)
          .collection('users')
          .doc(uid)
          .collection('config')
          .doc('preferences')
          .set(data, official_fs.SetOptions(merge: true));
    }
  }

  // ─── History ──────────────────────────────────────────────────────────────

  static Stream<AppDocumentSnapshot> historyStream(String uid) {
    if (isLinux) {
      return firedart.Firestore.instance
          .collection('artifacts')
          .document(_appId)
          .collection('users')
          .document(uid)
          .collection('data')
          .document('history')
          .stream
          .map((doc) => AppDocumentSnapshot(doc != null, doc?.map))
          .asBroadcastStream();
    }
    return official_fs.FirebaseFirestore.instance
        .collection('artifacts')
        .doc(_appId)
        .collection('users')
        .doc(uid)
        .collection('data')
        .doc('history')
        .snapshots()
        .map((snap) => AppDocumentSnapshot(
              snap.exists,
              snap.data(),
            ))
        .asBroadcastStream();
  }

  static Future<void> saveHistory(
    String uid,
    List<LingoCraftResult> items,
  ) async {
    final data = {'items': items.map((i) => i.toMap()).toList()};
    if (isLinux) {
      await firedart.Firestore.instance
          .collection('artifacts')
          .document(_appId)
          .collection('users')
          .document(uid)
          .collection('data')
          .document('history')
          .set(data);
    } else {
      await official_fs.FirebaseFirestore.instance
          .collection('artifacts')
          .doc(_appId)
          .collection('users')
          .doc(uid)
          .collection('data')
          .doc('history')
          .set(data);
    }
  }

  // ─── Course Streams & Persistence ─────────────────────────────────────────

  static Stream<AppQuerySnapshot> courseEpisodesStream(
    String dbAppId,
    String uid,
  ) {
    if (isLinux) {
      return firedart.Firestore.instance
          .collection('artifacts')
          .document(dbAppId)
          .collection('users')
          .document(uid)
          .collection('episodes')
          .stream
          .map((docs) {
        final list = docs
            .map((d) => AppQueryDocumentSnapshot(d.id, d.map))
            .toList();
        list.sort((a, b) => ((b.data()['timestamp'] ?? 0) as num)
            .compareTo((a.data()['timestamp'] ?? 0) as num));
        return AppQuerySnapshot(list.take(20).toList());
      }).asBroadcastStream();
    }
    return official_fs.FirebaseFirestore.instance
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('episodes')
        .orderBy('timestamp', descending: true)
        .limit(20)
        .snapshots()
        .map((snap) => AppQuerySnapshot(
              snap.docs
                  .map((d) => AppQueryDocumentSnapshot(
                        d.id,
                        d.data(),
                      ))
                  .toList(),
            ))
        .asBroadcastStream();
  }

  static Stream<AppDocumentSnapshot> courseProgressStream(
    String dbAppId,
    String uid,
    String episodeId,
  ) {
    if (isLinux) {
      return firedart.Firestore.instance
          .collection('artifacts')
          .document(dbAppId)
          .collection('users')
          .document(uid)
          .collection('progress')
          .document(episodeId)
          .stream
          .map((doc) => AppDocumentSnapshot(doc != null, doc?.map))
          .asBroadcastStream();
    }
    return official_fs.FirebaseFirestore.instance
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('progress')
        .doc(episodeId)
        .snapshots()
        .map((snap) => AppDocumentSnapshot(
              snap.exists,
              snap.data(),
            ))
        .asBroadcastStream();
  }

  static Stream<AppDocumentSnapshot> vocabStream(
    String dbAppId,
    String uid,
  ) {
    if (isLinux) {
      return firedart.Firestore.instance
          .collection('artifacts')
          .document(dbAppId)
          .collection('users')
          .document(uid)
          .collection('data')
          .document('vocab')
          .stream
          .map((doc) => AppDocumentSnapshot(doc != null, doc?.map))
          .asBroadcastStream();
    }
    return official_fs.FirebaseFirestore.instance
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('data')
        .doc('vocab')
        .snapshots()
        .map((snap) => AppDocumentSnapshot(
              snap.exists,
              snap.data(),
            ))
        .asBroadcastStream();
  }

  static Future<void> saveCourseUserNote(
    String dbAppId,
    String uid,
    String episodeId,
    String noteId,
    String title,
    String content,
  ) async {
    final noteData = {
      'id': noteId,
      'title': title,
      'content': content,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    if (isLinux) {
      final docRef = firedart.Firestore.instance
          .collection('artifacts')
          .document(dbAppId)
          .collection('users')
          .document(uid)
          .collection('progress')
          .document(episodeId);

      Map<String, dynamic> existing = {};
      if (await docRef.exists) {
        final snap = await docRef.get();
        existing = Map<String, dynamic>.from(snap.map);
      }
      final notes = Map<String, dynamic>.from(existing['notes'] as Map? ?? {});
      notes[noteId] = noteData;
      existing['notes'] = notes;
      await docRef.set(existing);
    } else {
      final ref = official_fs.FirebaseFirestore.instance
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('progress')
          .doc(episodeId);

      await ref.set({
        'notes': {noteId: noteData},
      }, official_fs.SetOptions(merge: true));
    }
  }

  static Future<void> saveNewEpisodeDoc(
    String dbAppId,
    String uid,
    String episodeId,
    Map<String, dynamic> episodeDoc,
  ) async {
    if (isLinux) {
      await firedart.Firestore.instance
          .collection('artifacts')
          .document(dbAppId)
          .collection('users')
          .document(uid)
          .collection('episodes')
          .document(episodeId)
          .set(episodeDoc);
    } else {
      await official_fs.FirebaseFirestore.instance
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('episodes')
          .doc(episodeId)
          .set(episodeDoc, official_fs.SetOptions(merge: true));
    }
  }

  static Future<void> updateCourseProgress(
    String dbAppId,
    String uid,
    String episodeId,
    Map<String, dynamic> progressData,
  ) async {
    if (isLinux) {
      final docRef = firedart.Firestore.instance
          .collection('artifacts')
          .document(dbAppId)
          .collection('users')
          .document(uid)
          .collection('progress')
          .document(episodeId);
      if (await docRef.exists) {
        await docRef.update(progressData);
      } else {
        await docRef.set(progressData);
      }
    } else {
      await official_fs.FirebaseFirestore.instance
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('progress')
          .doc(episodeId)
          .set(progressData, official_fs.SetOptions(merge: true));
    }
  }

  static Future<void> deleteEpisodeDoc(
    String dbAppId,
    String uid,
    String episodeId,
  ) async {
    if (isLinux) {
      await firedart.Firestore.instance
          .collection('artifacts')
          .document(dbAppId)
          .collection('users')
          .document(uid)
          .collection('episodes')
          .document(episodeId)
          .delete();
    } else {
      await official_fs.FirebaseFirestore.instance
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('episodes')
          .doc(episodeId)
          .delete();
    }
  }
}
