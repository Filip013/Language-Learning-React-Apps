// lib/constants/languages.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lingocraft_flutter/models/language.dart';

export 'package:lingocraft_flutter/models/language.dart';


final List<Language> kLanguages = const [
  Language(name: 'English', code: 'en-US', flag: '🇬BW'),
  Language(name: 'French', code: 'fr-FR', flag: '🇫🇷'),
  Language(name: 'German', code: 'de-DE', flag: '🇩🇪'),
  Language(name: 'Spanish', code: 'es-ES', flag: '🇪🇸'),
  Language(name: 'Italian', code: 'it-IT', flag: '🇮🇹'),
  Language(name: 'Portuguese', code: 'pt-PT', flag: '🇵🇹'),
  Language(name: 'Dutch', code: 'nl-NL', flag: '🇳🇱'),
  Language(name: 'Norwegian', code: 'no-NO', flag: '🇳🇴'),
  Language(name: 'Romanian', code: 'ro-RO', flag: '🇷🇴'),
  Language(name: 'Russian', code: 'ru-RU', flag: '🇷🇺'),
  Language(name: 'Serbian', code: 'sr-RS', flag: '🇷🇸'),
  Language(name: 'Greek', code: 'el-GR', flag: '🇬🇷'),
  Language(name: 'Hungarian', code: 'hu-HU', flag: '🇭🇺'),
  Language(name: 'Chinese (Traditional)', code: 'zh-TW', flag: '🇹🇼'),
  Language(name: 'Japanese', code: 'ja-JP', flag: '🇯🇵'),
  Language(name: 'Latin', code: 'la', flag: '🏛️'),
  Language(name: 'Ancient Greek', code: 'grc', flag: '📜'),
];

final List<Map<String, String>> kLevels = const [
  {'id': 'Beginner', 'label': 'A1-A2'},
  {'id': 'Intermediate', 'label': 'B1-B2'},
  {'id': 'Advanced', 'label': 'C1-C2'},
];

bool isCjkLanguage(String name) =>
    name.contains('Chinese') || name.contains('Japanese');

bool isNoBlurLanguage(String name) => name == 'English';

TextStyle getTargetLanguageTextStyle(
  String langName, {
  double fontSize = 20,
  FontWeight fontWeight = FontWeight.w700,
  Color? color,
  double height = 1.4,
  bool isSimplified = false,
  String? scriptKey,
}) {
  final lower = langName.toLowerCase();
  final isChinese = lower.contains('chinese') ||
      lower.contains('mandarin') ||
      lower.contains('cantonese');

  if (isChinese) {
    final useSimplified = isSimplified || scriptKey == 'simplified';
    final fontFamily = useSimplified ? 'STKaiti' : 'DFKai-SB';
    final fontFallback = useSimplified
        ? const ['DFKai-SB', 'sans-serif']
        : const ['STKaiti', 'sans-serif'];

    // Chinese characters are dense and rendered bigger; never bold (w400)
    final scaledSize = fontSize < 24 ? fontSize * 1.4 : fontSize * 1.2;

    return TextStyle(
      fontFamily: fontFamily,
      fontFamilyFallback: fontFallback,
      fontSize: scaledSize,
      fontWeight: FontWeight.w400, // NEVER BOLD for Chinese fonts
      color: color,
      height: height,
    );
  }

  if (lower.contains('japanese')) {
    final scaledSize = fontSize < 24 ? fontSize * 1.35 : fontSize * 1.15;
    return TextStyle(
      fontFamily: 'KyoKaSho',
      fontFamilyFallback: const ['HGSKyokashotai', 'STKaiti', 'sans-serif'],
      fontSize: scaledSize,
      fontWeight: FontWeight.w400, // NEVER BOLD for CJK fonts
      color: color,
      height: height,
    );
  }

  return GoogleFonts.inter(
    fontSize: fontSize,
    fontWeight: fontWeight,
    color: color,
    height: height,
  );
}
