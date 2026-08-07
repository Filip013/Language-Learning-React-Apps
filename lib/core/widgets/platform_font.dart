import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;

/// Scale factor applied to fonts on Android only.
/// Windows / web / other platforms are untouched.
const double kAndroidFontScale = 0.86;

/// Returns [size] scaled down on Android, unchanged elsewhere.
double platformFontSize(num size) {
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    return size.toDouble() * kAndroidFontScale;
  }
  return size.toDouble();
}

/// Whether the current platform is Android (false on web).
bool get isAndroidDevice =>
    !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
