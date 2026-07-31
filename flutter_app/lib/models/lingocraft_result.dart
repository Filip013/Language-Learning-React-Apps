// lib/models/lingocraft_result.dart
import 'package:lingocraft_flutter/models/language.dart';


class LingoCraftSentence {
  final String original;
  final String transcription;
  final String englishTranslation;
  final String explanation;

  const LingoCraftSentence({
    required this.original,
    this.transcription = '',
    required this.englishTranslation,
    required this.explanation,
  });

  factory LingoCraftSentence.fromMap(Map<String, dynamic> m) =>
      LingoCraftSentence(
        original: m['original'] as String? ?? '',
        transcription: m['transcription'] as String? ?? '',
        englishTranslation: m['englishTranslation'] as String? ?? '',
        explanation: m['explanation'] as String? ?? '',
      );

  Map<String, dynamic> toMap() => {
    'original': original,
    'transcription': transcription,
    'englishTranslation': englishTranslation,
    'explanation': explanation,
  };
}

class LingoCraftResult {
  final String id;
  final String word;
  final String partOfSpeech;
  final String ipa;
  final String definitionEnglish;
  final List<LingoCraftSentence> sentences;
  final Language targetLanguage;
  final String level;
  final int timestamp;

  const LingoCraftResult({
    required this.id,
    required this.word,
    required this.partOfSpeech,
    required this.ipa,
    required this.definitionEnglish,
    required this.sentences,
    required this.targetLanguage,
    required this.level,
    required this.timestamp,
  });

  factory LingoCraftResult.fromMap(Map<String, dynamic> m) {
    final rawLang = m['targetLanguage'];
    final Language targetLang;
    if (rawLang is Language) {
      targetLang = rawLang;
    } else if (rawLang is Map) {
      targetLang = Language.fromMap(Map<String, dynamic>.from(rawLang));
    } else {
      targetLang = const Language(name: '', code: '', flag: '');
    }

    final rawTs = m['timestamp'];
    final int ts;
    if (rawTs is int) {
      ts = rawTs;
    } else if (rawTs is num) {
      ts = rawTs.toInt();
    } else {
      ts = int.tryParse(rawTs?.toString() ?? '') ?? 0;
    }

    return LingoCraftResult(
      id: m['id']?.toString() ?? '',
      word: m['word']?.toString() ?? '',
      partOfSpeech: m['partOfSpeech']?.toString() ?? '',
      ipa: m['ipa']?.toString() ?? '',
      definitionEnglish: m['definitionEnglish']?.toString() ?? '',
      sentences: (m['sentences'] as List<dynamic>? ?? [])
          .map(
            (s) => LingoCraftSentence.fromMap(
              s is Map ? Map<String, dynamic>.from(s) : {},
            ),
          )
          .toList(),
      targetLanguage: targetLang,
      level: m['level']?.toString() ?? '',
      timestamp: ts,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'word': word,
    'partOfSpeech': partOfSpeech,
    'ipa': ipa,
    'definitionEnglish': definitionEnglish,
    'sentences': sentences.map((s) => s.toMap()).toList(),
    'targetLanguage': targetLanguage.toMap(),
    'level': level,
    'timestamp': timestamp,
  };
}
