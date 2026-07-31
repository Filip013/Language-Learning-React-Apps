// lib/services/storage_service.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StorageService {
  static const _storage = FlutterSecureStorage();

  static const _keyApiKey = 'geminiApiKey';
  static const _keyTheme = 'lingocraft_theme';

  static Future<String?> getApiKey() => _storage.read(key: _keyApiKey);

  static Future<void> setApiKey(String key) =>
      _storage.write(key: _keyApiKey, value: key);

  static Future<String?> getTheme() => _storage.read(key: _keyTheme);

  static Future<void> setTheme(String theme) =>
      _storage.write(key: _keyTheme, value: theme);
}
