import 'package:shared_preferences/shared_preferences.dart';
import '../constants/app_constants.dart';

class StorageService {
  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  static String? getString(String key) {
    return _prefs?.getString(key);
  }

  static Future<bool> setString(String key, String value) async {
    return await _prefs?.setString(key, value) ?? false;
  }

  static Future<bool> remove(String key) async {
    return await _prefs?.remove(key) ?? false;
  }

  static String get themeMode => getString(AppConstants.themeKey) ?? 'system';
  static Future<bool> setThemeMode(String mode) => setString(AppConstants.themeKey, mode);

  static String? get geminiApiKey => getString(AppConstants.geminiApiKey);
  static Future<bool> setGeminiApiKey(String key) => setString(AppConstants.geminiApiKey, key);
}
