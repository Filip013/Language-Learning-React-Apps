import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../core/services/firebase_service.dart';
import '../../../core/services/storage_service.dart';

class HomeProvider extends ChangeNotifier with WidgetsBindingObserver {
  bool _isDarkMode = false;
  bool _isSigningIn = false;
  String? _activePanel; // null | 'tools' | 'settings'
  String _freeGeminiKey = '';
  String _paidGeminiKey = '';

  Map<String, int> _recentAccess = {};
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _recentAccessSub;
  StreamSubscription<User?>? _authSub;

  bool get isDarkMode => _isDarkMode;
  bool get isSigningIn => _isSigningIn;
  User? get user => FirebaseService.currentUser;
  bool get isSignedIn => user != null;
  String? get activePanel => _activePanel;
  String get freeGeminiKey => _freeGeminiKey;
  String get paidGeminiKey => _paidGeminiKey;
  Map<String, int> get recentAccess => _recentAccess;

  HomeProvider() {
    _loadSettings();
    _initRecentAccessSync();
    _listenToAuthChanges();
    WidgetsBinding.instance.addObserver(this);
  }

  void _listenToAuthChanges() {
    _authSub = FirebaseService.authStateChanges.listen((user) {
      _loadSettings();
      _initRecentAccessSync();
      notifyListeners();
    });
  }

  @override
  void didChangePlatformBrightness() {
    super.didChangePlatformBrightness();
    // Whenever the browser/OS system theme changes, clear local manual override so system change takes effect:
    StorageService.remove('lingocraft_theme');
    final systemIsDark = WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark;
    if (_isDarkMode != systemIsDark) {
      _isDarkMode = systemIsDark;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _recentAccessSub?.cancel();
    _authSub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _initRecentAccessSync() {
    _recentAccessSub?.cancel();
    final uid = FirebaseService.currentUserId;
    if (uid == null) {
      _recentAccess = {};
      return;
    }

    _recentAccessSub = FirebaseService.firestore
        .collection('artifacts')
        .doc('hub')
        .collection('users')
        .doc(uid)
        .snapshots()
        .listen((snap) {
      if (snap.exists && snap.data() != null && snap.data()!['recentAccess'] != null) {
        final rawMap = snap.data()!['recentAccess'] as Map<String, dynamic>;
        _recentAccess = rawMap.map((k, v) => MapEntry(k, (v as num).toInt()));
        notifyListeners();
      }
    });
  }

  Future<void> touchCourseAccess(String courseId) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    _recentAccess[courseId] = now;
    notifyListeners();

    final uid = FirebaseService.currentUserId;
    if (uid == null) return;

    try {
      await FirebaseService.firestore
          .collection('artifacts')
          .doc('hub')
          .collection('users')
          .doc(uid)
          .set({
        'recentAccess': _recentAccess,
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error updating recentAccess: $e');
    }
  }

  Future<void> _loadSettings() async {
    final savedTheme = StorageService.getString('lingocraft_theme');
    if (savedTheme != null) {
      _isDarkMode = savedTheme == 'dark';
    } else {
      _isDarkMode = WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark;
    }
    
    // Load local (Only 2 keys: geminiApiKey & geminiPaidApiKey)
    _freeGeminiKey = StorageService.getString('geminiApiKey') ?? '';
    _paidGeminiKey = StorageService.getString('geminiPaidApiKey') ?? '';
    notifyListeners();

    // Pull from Firestore if authenticated
    final cloudFreeKey = await FirebaseService.fetchUserApiKey('geminiApiKey');
    if (cloudFreeKey != null && cloudFreeKey.isNotEmpty) {
      _freeGeminiKey = cloudFreeKey;
      StorageService.setString('geminiApiKey', cloudFreeKey);
    }

    final cloudPaidKey = await FirebaseService.fetchUserApiKey('geminiPaidApiKey');
    if (cloudPaidKey != null && cloudPaidKey.isNotEmpty) {
      _paidGeminiKey = cloudPaidKey;
      StorageService.setString('geminiPaidApiKey', cloudPaidKey);
    }
    
    notifyListeners();
  }

  Future<bool> signInWithGoogle() async {
    _isSigningIn = true;
    notifyListeners();
    try {
      final credential = await FirebaseService.signInWithGoogle();
      _isSigningIn = false;
      notifyListeners();
      return credential != null;
    } catch (e) {
      _isSigningIn = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> signOut() async {
    await FirebaseService.signOut();
    _freeGeminiKey = '';
    _paidGeminiKey = '';
    _recentAccess = {};
    notifyListeners();
  }

  void toggleTheme() {
    _isDarkMode = !_isDarkMode;
    StorageService.setString('lingocraft_theme', _isDarkMode ? 'dark' : 'light');
    notifyListeners();
  }

  void setActivePanel(String? panel) {
    _activePanel = panel;
    notifyListeners();
  }

  Future<void> saveApiKey(String storageKey, String value) async {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return;

    if (storageKey == 'geminiApiKey') {
      _freeGeminiKey = trimmed;
    } else if (storageKey == 'geminiPaidApiKey') {
      _paidGeminiKey = trimmed;
    }

    await StorageService.setString(storageKey, trimmed);
    await FirebaseService.saveUserApiKey(storageKey, trimmed);
    notifyListeners();
  }

  Future<void> removeApiKey(String storageKey) async {
    if (storageKey == 'geminiApiKey') {
      _freeGeminiKey = '';
    } else if (storageKey == 'geminiPaidApiKey') {
      _paidGeminiKey = '';
    }

    await StorageService.remove(storageKey);
    await FirebaseService.removeUserApiKey(storageKey);
    notifyListeners();
  }
}

