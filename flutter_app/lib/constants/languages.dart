// lib/constants/languages.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class Language {
  final String name;
  final String code;
  final String flag;

  const Language({required this.name, required this.code, required this.flag});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Language &&
          runtimeType == other.runtimeType &&
          name == other.name;

  @override
  int get hashCode => name.hashCode;

  factory Language.fromMap(Map<String, dynamic> m) => Language(
    name: m['name'] as String? ?? '',
    code: m['code'] as String? ?? '',
    flag: m['flag'] as String? ?? '',
  );

  Map<String, dynamic> toMap() => {'name': name, 'code': code, 'flag': flag};
}

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
}) {
  if (langName.contains('Chinese')) {
    return TextStyle(
      fontFamily: 'DFKai-SB',
      fontFamilyFallback: const ['sans-serif'],
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
    );
  }
  if (langName.contains('Japanese')) {
    return TextStyle(
      fontFamily: 'KyoKaSho',
      fontFamilyFallback: const ['HGSKyokashotai', 'STKaiti', 'sans-serif'],
      fontSize: fontSize,
      fontWeight: fontWeight,
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
