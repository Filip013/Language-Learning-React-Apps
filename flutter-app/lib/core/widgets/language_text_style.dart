import 'package:flutter/material.dart';

import 'platform_font.dart';

/// Shared text style for target-language script rendering across course tabs.
///
/// CJK scripts (Chinese / Mandarin / Japanese) use their dedicated font
/// families, a minimum readable size (36px) and a tighter line height (1.3).
/// All other languages render at 18px with a 1.5 line height.
///
/// Set [minCjkSize] to `false` for compact UI elements (e.g. word pills)
/// where the CJK minimum size would be too large.
TextStyle languageTextStyle(
  String langName, {
  required double fontSize,
  required Color color,
  bool isBold = false,
  bool isSimplified = false,
  bool minCjkSize = true,
}) {
  final isBigFontLang =
      langName.contains('Chinese') || langName.contains('Japanese') || langName.contains('Mandarin');
  final effectiveSize = platformFontSize(
    (isBigFontLang && minCjkSize && fontSize < 30) ? 36.0 : fontSize,
  );

  if (langName.contains('Chinese') || langName.contains('Mandarin')) {
    if (isSimplified) {
      return TextStyle(
        fontFamily: 'STKaiti',
        fontFamilyFallback: const ['KaiTi', 'DFKai-SB', 'sans-serif'],
        fontSize: effectiveSize,
        color: color,
        fontWeight: isBold ? FontWeight.w800 : FontWeight.normal,
        height: 1.3,
      );
    }
    return TextStyle(
      fontFamily: 'DFKai-SB',
      fontFamilyFallback: const ['BiauKai', 'Kaiti TC', 'STKaiti', 'serif'],
      fontSize: effectiveSize,
      color: color,
      fontWeight: isBold ? FontWeight.w800 : FontWeight.normal,
      height: 1.3,
    );
  } else if (langName.contains('Japanese')) {
    return TextStyle(
      fontFamily: 'KyoKaSho',
      fontFamilyFallback: const ['HGSKyokashotai', 'STKaiti', 'DFKai-SB', 'sans-serif'],
      fontSize: effectiveSize,
      color: color,
      fontWeight: isBold ? FontWeight.w800 : FontWeight.normal,
      height: 1.3,
    );
  } else {
    return TextStyle(
      fontSize: effectiveSize,
      color: color,
      fontWeight: isBold ? FontWeight.w900 : FontWeight.normal,
      height: 1.5,
    );
  }
}
