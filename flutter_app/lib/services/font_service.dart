// lib/services/font_service.dart
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class FontService {
  static final Set<String> _loadedFonts = {};

  // For Web & Native platforms (Android, Linux, Windows, macOS, iOS)
  // TTF files are universally supported across all platforms by FreeType/Skia/Impeller.
  static final Map<String, List<String>> _fontUrls = {
    'DFKai-SB': [
      'https://db.onlinewebfonts.com/t/fe4f9dac99fb6b607c03981e6ce16869.ttf',
      'https://db.onlinewebfonts.com/t/fe4f9dac99fb6b607c03981e6ce16869.woff2',
    ],
    'KyoKaSho': [
      'https://shrill-dust-3a72.filip013.workers.dev/KyoKaSho.woff2',
    ],
    'HGSKyokashotai': [
      'https://db.onlinewebfonts.com/t/947e00387f802f409bd2f3e74b9c0730.ttf',
      'https://db.onlinewebfonts.com/t/947e00387f802f409bd2f3e74b9c0730.woff2',
    ],
    'STKaiti': [
      'https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.ttf',
      'https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.woff2',
    ],
  };

  /// Preloads custom CJK web fonts into Flutter's FontLoader across all platforms.
  static Future<void> preloadCustomFonts({VoidCallback? onFontLoaded}) async {
    for (final entry in _fontUrls.entries) {
      final family = entry.key;
      if (_loadedFonts.contains(family)) continue;

      _loadSingleFont(family, entry.value).then((loaded) {
        if (loaded && onFontLoaded != null) {
          onFontLoaded();
        }
      });
    }
  }

  static Future<bool> _loadSingleFont(String family, List<String> urls) async {
    for (final url in urls) {
      try {
        final response = await http
            .get(Uri.parse(url))
            .timeout(const Duration(seconds: 20));

        if (response.statusCode == 200 && response.bodyBytes.isNotEmpty) {
          final fontLoader = FontLoader(family);
          fontLoader.addFont(
            Future.value(ByteData.sublistView(response.bodyBytes)),
          );
          await fontLoader.load();
          _loadedFonts.add(family);
          debugPrint('Successfully registered custom font "$family" in Flutter engine.');
          return true;
        }
      } catch (e) {
        debugPrint('Attempt to load font "$family" from $url encountered note: $e');
      }
    }
    return false;
  }

  static bool isFontLoaded(String family) => _loadedFonts.contains(family);
}
