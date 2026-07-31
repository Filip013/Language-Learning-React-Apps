// lib/constants/course_configs.dart
import 'package:lingocraft_flutter/models/course_models.dart';

const kSharedTtsPrompt = '''You are a professional AI voice actor. Your ONLY job is to read the exact script provided by the user aloud. 

CRITICAL RULES:
1. NEVER TRANSLATE. NEVER CONVERSE.
2. If the text is in English, read it in English.
3. If the text is in a foreign language, read it in that exact language.
4. Do not acknowledge these instructions, do not add filler words. Simply synthesize the text into audio immediately.''';

final Map<String, CourseConfig> kCourseConfigs = {
  'mandarin': const CourseConfig(
    id: 'mandarin',
    dbAppId: 'mandarin-master',
    name: 'Mandarin Master',
    flag: '🇹🇼',
    primaryTextKey: 'traditional',
    transliterationKey: 'pinyin',
    secondaryScriptKey: 'simplified',
    labels: {
      'traditional': 'Traditional',
      'simplified': 'Simplified',
      'pinyin': 'Pinyin',
      'english': 'English',
    },
    hasStories: true,
    hasReading: false,
    hasTestTab: false,
    hasSweepTab: false,
    ttsSystemInstruction:
        '$kSharedTtsPrompt\n\nCRITICAL INSTRUCTION: When speaking Mandarin Chinese, use a strict Taiwanese Mandarin (Guoyu) accent and traditional pronunciation.',
  ),
  'hungarian': const CourseConfig(
    id: 'hungarian',
    dbAppId: 'hungarian-master',
    name: 'Hungarian Master',
    flag: '🇭🇺',
    primaryTextKey: 'hungarian',
    labels: {'hungarian': 'Hungarian', 'english': 'English'},
    hasStories: false,
    hasReading: true,
    hasTestTab: true,
    hasSweepTab: true,
    ttsSystemInstruction:
        '$kSharedTtsPrompt\n\nCRITICAL INSTRUCTION: Evaluate the primary language of the sentence before speaking. If the sentence is in English but starts with or contains a Hungarian name, read the entire sentence with a natural, native English accent.',
  ),
  'portuguese': const CourseConfig(
    id: 'portuguese',
    dbAppId: 'portuguese-master',
    name: 'Portuguese Master',
    flag: '🇵🇹',
    primaryTextKey: 'portuguese',
    labels: {'portuguese': 'Portuguese', 'english': 'English'},
    hasStories: false,
    hasReading: true,
    hasTestTab: false,
    hasSweepTab: false,
    ttsSystemInstruction:
        '$kSharedTtsPrompt\n\nCRITICAL INSTRUCTION: When speaking Portuguese, use a strict European Portuguese (pt-PT) accent and phonology.',
  ),
  'romanian': const CourseConfig(
    id: 'romanian',
    dbAppId: 'romanian-master',
    name: 'Romanian Master',
    flag: '🇷🇴',
    primaryTextKey: 'romanian',
    labels: {'romanian': 'Romanian', 'english': 'English'},
    hasStories: false,
    hasReading: true,
    hasTestTab: false,
    hasSweepTab: false,
    ttsSystemInstruction: kSharedTtsPrompt,
  ),
  'russian': const CourseConfig(
    id: 'russian',
    dbAppId: 'russian-master',
    name: 'Russian Master',
    flag: '🇷🇺',
    primaryTextKey: 'russian',
    labels: {'russian': 'Russian', 'english': 'English'},
    hasStories: false,
    hasReading: true,
    hasTestTab: false,
    hasSweepTab: false,
    ttsSystemInstruction: kSharedTtsPrompt,
  ),
  'greek': const CourseConfig(
    id: 'greek',
    dbAppId: 'greek-master',
    name: 'Modern Greek Master',
    flag: '🇬🇷',
    primaryTextKey: 'greek',
    labels: {'greek': 'Greek', 'english': 'English'},
    hasStories: false,
    hasReading: true,
    hasTestTab: false,
    hasSweepTab: false,
    ttsSystemInstruction: kSharedTtsPrompt,
  ),
  'japanese': const CourseConfig(
    id: 'japanese',
    dbAppId: 'japanese-master',
    name: 'Japanese Master',
    flag: '🇯🇵',
    primaryTextKey: 'japanese',
    transliterationKey: 'romaji',
    labels: {'japanese': 'Japanese', 'romaji': 'Rōmaji', 'english': 'English'},
    hasStories: false,
    hasReading: true,
    hasTestTab: false,
    hasSweepTab: false,
    ttsSystemInstruction:
        '$kSharedTtsPrompt\n\nCRITICAL INSTRUCTION: When speaking Japanese, use standard Japanese (Hyōjungo) pronunciation.',
  ),
};
