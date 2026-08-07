class CourseConfig {
  final String id;
  final String dbAppId;
  final String name;
  final String primaryTextKey;
  final String transliterationKey;
  final String? secondaryScriptKey;
  final Map<String, String> labels;
  final String lexiconDoc;
  final bool hasStories;
  final bool hasReading;
  final bool hasTestTab;
  final bool hasSweepTab;
  final String ttsSystemInstruction;
  final String promptSystemInstruction;

  const CourseConfig({
    required this.id,
    required this.dbAppId,
    required this.name,
    required this.primaryTextKey,
    required this.transliterationKey,
    this.secondaryScriptKey,
    required this.labels,
    this.lexiconDoc = 'lexicon',
    this.hasStories = true,
    this.hasReading = false,
    this.hasTestTab = false,
    this.hasSweepTab = false,
    required this.ttsSystemInstruction,
    required this.promptSystemInstruction,
  });
}
