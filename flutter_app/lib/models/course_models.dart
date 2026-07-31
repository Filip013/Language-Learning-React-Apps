// lib/models/course_models.dart

class CourseConfig {
  final String id;
  final String dbAppId;
  final String name;
  final String flag;
  final String primaryTextKey;
  final String? transliterationKey;
  final String? secondaryScriptKey;
  final Map<String, String> labels;
  final bool hasStories;
  final bool hasReading;
  final bool hasTestTab;
  final bool hasSweepTab;
  final String? ttsSystemInstruction;
  final String? promptSystemInstruction;

  const CourseConfig({
    required this.id,
    required this.dbAppId,
    required this.name,
    required this.flag,
    required this.primaryTextKey,
    this.transliterationKey,
    this.secondaryScriptKey,
    required this.labels,
    this.hasStories = true,
    this.hasReading = false,
    this.hasTestTab = false,
    this.hasSweepTab = false,
    this.ttsSystemInstruction,
    this.promptSystemInstruction,
  });
}

class ReadingDefinition {
  final String word;
  final String text;

  const ReadingDefinition({required this.word, required this.text});

  factory ReadingDefinition.fromMap(Map<String, dynamic> m) => ReadingDefinition(
    word: m['word']?.toString() ?? '',
    text: m['text']?.toString() ?? '',
  );
}

class ReadingFocus {
  final String word;
  final String explanation;

  const ReadingFocus({required this.word, required this.explanation});

  factory ReadingFocus.fromMap(Map<String, dynamic> m) => ReadingFocus(
    word: m['word']?.toString() ?? '',
    explanation: m['explanation']?.toString() ?? '',
  );
}

class ReadingData {
  final List<ReadingDefinition> definitions;
  final String targetText;
  final String transliterationText;
  final String englishText;
  final List<ReadingFocus> focus;

  const ReadingData({
    this.definitions = const [],
    this.targetText = '',
    this.transliterationText = '',
    this.englishText = '',
    this.focus = const [],
  });

  factory ReadingData.fromMap(Map<String, dynamic> m, CourseConfig config) {
    final defs = (m['definitions'] as List<dynamic>? ?? [])
        .map((e) => ReadingDefinition.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();
    final focusList = (m['focus'] as List<dynamic>? ?? [])
        .map((e) => ReadingFocus.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();

    final primary = m[config.primaryTextKey]?.toString() ??
        m['hungarian']?.toString() ??
        m['portuguese']?.toString() ??
        m['romanian']?.toString() ??
        m['russian']?.toString() ??
        m['greek']?.toString() ??
        m['japanese']?.toString() ??
        m['target']?.toString() ??
        '';

    final trans = config.transliterationKey != null
        ? (m[config.transliterationKey!]?.toString() ?? m['romaji']?.toString() ?? m['pinyin']?.toString() ?? '')
        : '';
    final english = m['english']?.toString() ?? '';

    return ReadingData(
      definitions: defs,
      targetText: primary,
      transliterationText: trans,
      englishText: english,
      focus: focusList,
    );
  }
}

class SentenceItem {
  final String primaryText;
  final String transliteration;
  final String secondaryText;
  final String englishTranslation;

  const SentenceItem({
    required this.primaryText,
    this.transliteration = '',
    this.secondaryText = '',
    required this.englishTranslation,
  });

  factory SentenceItem.fromMap(Map<String, dynamic> m, CourseConfig config) {
    return SentenceItem(
      primaryText: m[config.primaryTextKey]?.toString() ?? m['primaryText']?.toString() ?? m['original']?.toString() ?? '',
      transliteration: config.transliterationKey != null
          ? (m[config.transliterationKey!]?.toString() ?? m['pinyin']?.toString() ?? m['romaji']?.toString() ?? '')
          : '',
      secondaryText: config.secondaryScriptKey != null
          ? (m[config.secondaryScriptKey!]?.toString() ?? m['simplified']?.toString() ?? '')
          : '',
      englishTranslation: m['english']?.toString() ?? m['englishTranslation']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toMap(CourseConfig config) => {
    config.primaryTextKey: primaryText,
    if (config.transliterationKey != null) config.transliterationKey!: transliteration,
    if (config.secondaryScriptKey != null) config.secondaryScriptKey!: secondaryText,
    'english': englishTranslation,
  };
}

class VocabItem {
  final String word;
  final String transliteration;
  final String definition;
  final List<String> notes;
  final List<SentenceItem> examples;

  const VocabItem({
    required this.word,
    this.transliteration = '',
    required this.definition,
    this.notes = const [],
    this.examples = const [],
  });

  factory VocabItem.fromMap(Map<String, dynamic> m, CourseConfig config) {
    final rawExamples = m['examples'] as List<dynamic>? ?? [];
    return VocabItem(
      word: m['word']?.toString() ?? m[config.primaryTextKey]?.toString() ?? m['primaryText']?.toString() ?? '',
      transliteration: m['pinyin']?.toString() ?? m['romaji']?.toString() ?? m['transliteration']?.toString() ?? '',
      definition: m['definition']?.toString() ?? m['translation']?.toString() ?? m['english']?.toString() ?? '',
      notes: (m['notes'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
      examples: rawExamples.map((e) => SentenceItem.fromMap(Map<String, dynamic>.from(e as Map), config)).toList(),
    );
  }
}

class GrammarRule {
  final String title;
  final String explanation;
  final List<SentenceItem> examples;

  const GrammarRule({
    required this.title,
    required this.explanation,
    this.examples = const [],
  });

  factory GrammarRule.fromMap(Map<String, dynamic> m, CourseConfig config) {
    final rawExamples = m['examples'] as List<dynamic>? ?? [];
    return GrammarRule(
      title: m['title']?.toString() ?? m['word']?.toString() ?? '',
      explanation: m['explanation']?.toString() ?? m['notes']?.toString() ?? '',
      examples: rawExamples.map((e) => SentenceItem.fromMap(Map<String, dynamic>.from(e as Map), config)).toList(),
    );
  }
}

class QuizQuestion {
  final String sentence;
  final String answer;
  final List<String> distractors;
  final String englishHint;

  const QuizQuestion({
    required this.sentence,
    required this.answer,
    required this.distractors,
    this.englishHint = '',
  });

  factory QuizQuestion.fromMap(Map<String, dynamic> m) {
    return QuizQuestion(
      sentence: m['sentence']?.toString() ?? '',
      answer: m['answer']?.toString() ?? '',
      distractors: (m['distractors'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
      englishHint: m['englishHint']?.toString() ?? m['english']?.toString() ?? '',
    );
  }
}

class Episode {
  final String id;
  final int number;
  final String title;
  final String storyTitle;
  final String storyStatus;
  final String userPrompt;
  final String tutorIntroduction;
  final Map<String, String> storyScripts;
  final ReadingData? reading;
  final List<SentenceItem> sentences;
  final List<VocabItem> drills;
  final List<GrammarRule> grammar;
  final List<QuizQuestion> quiz;
  final List<SentenceItem> test;
  final List<SentenceItem> sweep;
  final List<String> newLemmas;

  const Episode({
    required this.id,
    required this.number,
    required this.title,
    this.storyTitle = '',
    this.storyStatus = 'continue',
    this.userPrompt = '',
    this.tutorIntroduction = '',
    required this.storyScripts,
    this.reading,
    required this.sentences,
    this.drills = const [],
    this.grammar = const [],
    this.quiz = const [],
    this.test = const [],
    this.sweep = const [],
    this.newLemmas = const [],
  });

  factory Episode.fromMap(Map<String, dynamic> m, CourseConfig config) {
    final rawStory = m['story'];
    final Map<String, String> scripts = {};
    if (rawStory is Map) {
      rawStory.forEach((k, v) {
        scripts[k.toString()] = v.toString();
      });
    }

    final rawReading = m['reading'];
    ReadingData? readingData;
    if (rawReading is Map) {
      readingData = ReadingData.fromMap(Map<String, dynamic>.from(rawReading), config);
    }

    final rawSentences = m['sentences'] as List<dynamic>? ?? [];
    final rawDrills = m['drills'] as List<dynamic>? ?? m['vocab'] as List<dynamic>? ?? [];
    final rawGrammar = m['grammar'] as List<dynamic>? ?? [];
    final rawQuiz = m['quiz'] as List<dynamic>? ?? [];
    final rawTest = m['test'] as List<dynamic>? ?? [];
    final rawSweep = m['sweep'] as List<dynamic>? ?? [];

    return Episode(
      id: m['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
      number: m['number'] is int ? m['number'] as int : int.tryParse(m['number']?.toString() ?? '') ?? 1,
      title: m['title']?.toString() ?? 'Episode 1',
      storyTitle: m['storyTitle']?.toString() ?? '',
      storyStatus: m['storyStatus']?.toString() ?? 'continue',
      userPrompt: m['userPrompt']?.toString() ?? '',
      tutorIntroduction: m['tutorIntroduction']?.toString() ?? '',
      storyScripts: scripts,
      reading: readingData,
      sentences: rawSentences.map((e) => SentenceItem.fromMap(Map<String, dynamic>.from(e as Map), config)).toList(),
      drills: rawDrills.map((e) => VocabItem.fromMap(Map<String, dynamic>.from(e as Map), config)).toList(),
      grammar: rawGrammar.map((e) => GrammarRule.fromMap(Map<String, dynamic>.from(e as Map), config)).toList(),
      quiz: rawQuiz.map((e) => QuizQuestion.fromMap(Map<String, dynamic>.from(e as Map))).toList(),
      test: rawTest.map((e) => SentenceItem.fromMap(Map<String, dynamic>.from(e as Map), config)).toList(),
      sweep: rawSweep.map((e) => SentenceItem.fromMap(Map<String, dynamic>.from(e as Map), config)).toList(),
      newLemmas: (m['newLemmas'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
    );
  }
}

class UserNote {
  final String id;
  final String title;
  final String content;
  final int timestamp;

  const UserNote({
    required this.id,
    required this.title,
    required this.content,
    required this.timestamp,
  });

  factory UserNote.fromMap(Map<String, dynamic> m) => UserNote(
    id: m['id']?.toString() ?? '',
    title: m['title']?.toString() ?? '',
    content: m['content']?.toString() ?? '',
    timestamp: m['timestamp'] is int ? m['timestamp'] as int : int.tryParse(m['timestamp']?.toString() ?? '') ?? 0,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'content': content,
    'timestamp': timestamp,
  };
}
