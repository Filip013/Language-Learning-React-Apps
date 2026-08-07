class LexiconItem {
  final String id;
  final String primaryText;
  final String transliteration;
  final String? secondaryScript;
  final String english;
  final List<String> notes;
  final List<Map<String, String>> examples;

  LexiconItem({
    required this.id,
    required this.primaryText,
    required this.transliteration,
    this.secondaryScript,
    required this.english,
    this.notes = const [],
    this.examples = const [],
  });

  factory LexiconItem.fromMap(Map<String, dynamic> map, {String primaryKey = 'targetText'}) {
    return LexiconItem(
      id: map['id'] ?? '',
      primaryText: map[primaryKey] ?? map['text'] ?? map['word'] ?? '',
      transliteration: map['pinyin'] ?? map['transliteration'] ?? map['reading'] ?? '',
      secondaryScript: map['simplified'],
      english: map['english'] ?? map['translation'] ?? '',
      notes: List<String>.from(map['notes'] ?? []),
      examples: (map['examples'] as List<dynamic>?)
              ?.map((e) => Map<String, String>.from(e as Map))
              .toList() ??
          [],
    );
  }
}
