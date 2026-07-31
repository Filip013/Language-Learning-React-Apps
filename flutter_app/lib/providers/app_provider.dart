// lib/providers/app_provider.dart
import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:lingocraft_flutter/config/course_configs.dart';
import 'package:lingocraft_flutter/models/course_config.dart';
import 'package:lingocraft_flutter/services/firebase_service.dart';
import 'package:lingocraft_flutter/services/storage_service.dart';

class AppProvider extends ChangeNotifier {
  User? _user;
  bool _isDarkMode = false;
  String? _apiKey;
  CourseConfig? _activeCourse;

  User? get user => _user;
  bool get isDarkMode => _isDarkMode;
  String? get apiKey => _apiKey;
  CourseConfig? get activeCourse => _activeCourse;

  StreamSubscription? _authSub;

  AppProvider() {
    _init();
  }

  Future<void> _init() async {
    final theme = await StorageService.getTheme();
    _isDarkMode = theme == 'dark';
    _apiKey = await StorageService.getApiKey();
    _authSub = FirebaseService.userStream.listen((u) {
      _user = u;
      notifyListeners();
    });
    notifyListeners();
  }

  void toggleTheme() async {
    _isDarkMode = !_isDarkMode;
    await StorageService.setTheme(_isDarkMode ? 'dark' : 'light');
    notifyListeners();
  }

  Future<void> setApiKey(String key) async {
    _apiKey = key;
    await StorageService.setApiKey(key);
    notifyListeners();
  }

  void selectCourse(String courseId) {
    _activeCourse = kCourseConfigs[courseId];
    notifyListeners();
  }

  Future<void> signIn() => FirebaseService.signInWithGoogle();
  Future<void> signOut() => FirebaseService.signOut();

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }
}
