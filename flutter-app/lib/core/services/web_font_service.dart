import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class WebFontService {
  // Families fully loaded (font registered in the engine).
  static final Set<String> _loadedFonts = {};
  // In-flight downloads per family — guards concurrent calls from multiple
  // tabs so the same font is fetched at most once per run.
  static final Map<String, Future<void>> _inFlight = {};

  /// Loads [fontFamily] from [url] unless already loaded or loading.
  /// Returns true if the family ended up registered (either just loaded or
  /// already available).
  static Future<bool> loadFontOnDemand(String fontFamily, String url) async {
    if (_loadedFonts.contains(fontFamily)) return true;

    final existing = _inFlight[fontFamily];
    if (existing != null) {
      await existing;
      return _loadedFonts.contains(fontFamily);
    }

    final future = _doLoad(fontFamily, url);
    _inFlight[fontFamily] = future;
    try {
      await future;
    } finally {
      _inFlight.remove(fontFamily);
    }
    return _loadedFonts.contains(fontFamily);
  }

  static Future<void> _doLoad(String fontFamily, String url) async {
    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        final fontLoader = FontLoader(fontFamily);
        fontLoader.addFont(Future.value(ByteData.sublistView(response.bodyBytes)));
        await fontLoader.load();
        _loadedFonts.add(fontFamily);
        debugPrint("Successfully loaded webfont $fontFamily from $url");
      } else {
        debugPrint("Failed to load webfont $fontFamily: HTTP ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Failed to dynamically load webfont $fontFamily: $e");
    }
  }

  /// Loads the preferred CJK font for [langName]; fallback families are only
  /// fetched if the preferred one could not be loaded.
  static Future<void> ensurePreferredFontsLoaded(String langName) async {
    if (langName.contains('Chinese') || langName.contains('Mandarin')) {
      final preferred = await loadFontOnDemand(
        'DFKai-SB',
        'https://db.onlinewebfonts.com/t/fe4f9dac99fb6b607c03981e6ce16869.ttf',
      );
      if (!preferred) {
        await loadFontOnDemand(
          'STKaiti',
          'https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.ttf',
        );
      }
    } else if (langName.contains('Japanese')) {
      final preferred = await loadFontOnDemand(
        'KyoKaSho',
        'https://shrill-dust-3a72.filip013.workers.dev/KyoKaSho.woff2',
      );
      if (!preferred) {
        await loadFontOnDemand(
          'HGSKyokashotai',
          'https://db.onlinewebfonts.com/t/947e00387f802f409bd2f3e74b9c0730.ttf',
        );
      }
    }
  }
}
