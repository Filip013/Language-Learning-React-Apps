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

  factory LingoCraftSentence.fromJson(Map<String, dynamic> json) {
    return LingoCraftSentence(
      original: json['original'] as String? ?? '',
      transcription: json['transcription'] as String? ?? '',
      englishTranslation: json['englishTranslation'] as String? ?? '',
      explanation: json['explanation'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'original': original,
      'transcription': transcription,
      'englishTranslation': englishTranslation,
      'explanation': explanation,
    };
  }
}

class LingoCraftResult {
  final String id;
  final String word;
  final String partOfSpeech;
  final String ipa;
  final String definitionEnglish;
  final List<LingoCraftSentence> sentences;
  final String targetLanguageName;
  final String targetLanguageFlag;
  final String level;
  final int timestamp;

  const LingoCraftResult({
    required this.id,
    required this.word,
    required this.partOfSpeech,
    required this.ipa,
    required this.definitionEnglish,
    required this.sentences,
    required this.targetLanguageName,
    required this.targetLanguageFlag,
    required this.level,
    required this.timestamp,
  });

  factory LingoCraftResult.fromJson(Map<String, dynamic> json) {
    final sentencesRaw = json['sentences'] as List<dynamic>? ?? [];
    final parsedSentences = sentencesRaw
        .map((s) => LingoCraftSentence.fromJson(s as Map<String, dynamic>))
        .toList();

    return LingoCraftResult(
      id: json['id'] as String? ?? DateTime.now().millisecondsSinceEpoch.toString(),
      word: json['word'] as String? ?? '',
      partOfSpeech: json['partOfSpeech'] as String? ?? '',
      ipa: json['ipa'] as String? ?? '',
      definitionEnglish: json['definitionEnglish'] as String? ?? '',
      sentences: parsedSentences,
      targetLanguageName: json['targetLanguageName'] as String? ?? (json['targetLanguage']?['name'] as String? ?? 'Mandarin'),
      targetLanguageFlag: json['targetLanguageFlag'] as String? ?? (json['targetLanguage']?['flag'] as String? ?? '🇹🇼'),
      level: json['level'] as String? ?? 'A2',
      timestamp: json['timestamp'] as int? ?? DateTime.now().millisecondsSinceEpoch,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'word': word,
      'partOfSpeech': partOfSpeech,
      'ipa': ipa,
      'definitionEnglish': definitionEnglish,
      'sentences': sentences.map((s) => s.toJson()).toList(),
      'targetLanguageName': targetLanguageName,
      'targetLanguageFlag': targetLanguageFlag,
      'level': level,
      'timestamp': timestamp,
    };
  }
}
