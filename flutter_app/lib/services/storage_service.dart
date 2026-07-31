// lib/services/storage_service.dart
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StorageService {
  static const _storage = FlutterSecureStorage();

  static const _keyApiKey = 'geminiApiKey';
  static const _keyTheme = 'lingocraft_theme';
  static const _keyRecentAccess = 'lingocraft_recent_access';

  static Future<String?> getApiKey() => _storage.read(key: _keyApiKey);

  static Future<void> setApiKey(String key) =>
      _storage.write(key: _keyApiKey, value: key);

  static Future<String?> getTheme() => _storage.read(key: _keyTheme);

  static Future<void> setTheme(String theme) =>
      _storage.write(key: _keyTheme, value: theme);

  static Future<Map<String, int>> getRecentAccess() async {
    final raw = await _storage.read(key: _keyRecentAccess);
    if (raw == null || raw.isEmpty) return {};
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return decoded.map((k, v) => MapEntry(k, (v as num).toInt()));
    } catch (_) {
      return {};
    }
  }

  static Future<void> setRecentAccess(Map<String, int> map) =>
      _storage.write(key: _keyRecentAccess, value: jsonEncode(map));
}
