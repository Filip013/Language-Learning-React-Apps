// lib/models/course_config.dart

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
    this.promptSystemInstruction,
  });
}
