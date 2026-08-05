import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class WebFontService {
  static final Set<String> _loadedFonts = {};

  static Future<void> loadFontOnDemand(String fontFamily, String url) async {
    if (_loadedFonts.contains(fontFamily)) return;

    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        final fontLoader = FontLoader(fontFamily);
        fontLoader.addFont(Future.value(ByteData.sublistView(response.bodyBytes)));
        await fontLoader.load();
        _loadedFonts.add(fontFamily);
        debugPrint("Successfully loaded webfont $fontFamily from $url");
      }
    } catch (e) {
      debugPrint("Failed to dynamically load webfont $fontFamily: $e");
    }
  }

  static void ensurePreferredFontsLoaded(String langName) {
    if (langName.contains('Chinese') || langName.contains('Mandarin')) {
      loadFontOnDemand(
        'DFKai-SB',
        'https://db.onlinewebfonts.com/t/fe4f9dac99fb6b607c03981e6ce16869.ttf',
      );
      loadFontOnDemand(
        'STKaiti',
        'https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.ttf',
      );
    } else if (langName.contains('Japanese')) {
      // Load shrill-dust worker Japanese KyoKaSho font first, plus fallbacks
      loadFontOnDemand(
        'KyoKaSho',
        'https://shrill-dust-3a72.filip013.workers.dev/KyoKaSho.woff2',
      );
      loadFontOnDemand(
        'HGSKyokashotai',
        'https://db.onlinewebfonts.com/t/947e00387f802f409bd2f3e74b9c0730.ttf',
      );
      loadFontOnDemand(
        'STKaiti',
        'https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.ttf',
      );
    }
  }
}
