// lib/models/lingocraft_result.dart

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

  factory LingoCraftResult.fromMap(Map<String, dynamic> m) => LingoCraftResult(
    id: m['id'] as String? ?? '',
    word: m['word'] as String? ?? '',
    partOfSpeech: m['partOfSpeech'] as String? ?? '',
    ipa: m['ipa'] as String? ?? '',
    definitionEnglish: m['definitionEnglish'] as String? ?? '',
    sentences: (m['sentences'] as List<dynamic>? ?? [])
        .map(
          (s) =>
              LingoCraftSentence.fromMap(Map<String, dynamic>.from(s as Map)),
        )
        .toList(),
    targetLanguage: Language.fromMap(
      Map<String, dynamic>.from(m['targetLanguage'] as Map),
    ),
    level: m['level'] as String? ?? '',
    timestamp: m['timestamp'] as int? ?? 0,
  );

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
