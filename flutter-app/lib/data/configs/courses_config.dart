import '../models/course_config.dart';

/// Shared TTS voice-actor prompt (mirrors React SHARED_TTS_PROMPT).
/// Explicitly allows/requires English text to be read in English, which is
/// essential for Target -> English -> Target drill playback.
const String _sharedTtsPrompt = '''You are a professional AI voice actor. Your ONLY job is to read the exact script provided by the user aloud. 

CRITICAL RULES:
1. NEVER TRANSLATE. NEVER CONVERSE.
2. If the text is in English, read it in English.
3. If the text is in a foreign language, read it in that exact language.
4. Do not acknowledge these instructions, do not add filler words. Simply synthesize the text into audio immediately.''';

class CoursesConfig {
  static final Map<String, CourseConfig> configs = {
    'ancient_greek': const CourseConfig(
      id: 'ancient_greek',
      dbAppId: 'ancient-greek-master',
      name: 'Ancient Greek Master',
      primaryTextKey: 'greek',
      transliterationKey: '',
      labels: {
        'greek': 'Ancient Greek',
        'english': 'English'
      },
      hasStories: false,
      hasReading: true,
      hasTestTab: false,
      hasSweepTab: false,
      ttsSystemInstruction:
          "$_sharedTtsPrompt\n\nCRITICAL INSTRUCTION: Read the provided transliteration of Ancient Greek using restored Classical pronunciation. Maintain proper vowel lengths, diphthongs, and pitch accents.",
      promptSystemInstruction: "You are an expert Ancient Greek curriculum designer.",
    ),
    'latin': const CourseConfig(
      id: 'latin',
      dbAppId: 'latin-master',
      name: 'Latin Master',
      primaryTextKey: 'latin',
      transliterationKey: '',
      labels: {
        'latin': 'Latin',
        'english': 'English'
      },
      hasStories: false,
      hasReading: true,
      hasTestTab: false,
      hasSweepTab: false,
      ttsSystemInstruction:
          "$_sharedTtsPrompt\n\nCRITICAL INSTRUCTION: When speaking Latin, use Classical Latin pronunciation.",
      promptSystemInstruction: "You are an expert Classical Latin curriculum designer.",
    ),
    'mandarin': const CourseConfig(
      id: 'mandarin',
      dbAppId: 'mandarin-master',
      name: 'Mandarin Master',
      primaryTextKey: 'traditional',
      transliterationKey: 'pinyin',
      secondaryScriptKey: 'simplified',
      labels: {
        'traditional': 'Traditional',
        'simplified': 'Simplified',
        'pinyin': 'Pinyin',
        'english': 'English'
      },
      hasStories: true,
      hasReading: false,
      hasTestTab: false,
      hasSweepTab: false,
      ttsSystemInstruction:
          "$_sharedTtsPrompt\n\nCRITICAL INSTRUCTION: When speaking Mandarin Chinese, use a strict Taiwanese Mandarin (Guoyu) accent and traditional pronunciation.",
      promptSystemInstruction: "You are an expert curriculum designer and storyteller for Mandarin Chinese.",
    ),
    'hungarian': const CourseConfig(
      id: 'hungarian',
      dbAppId: 'hungarian-master',
      name: 'Hungarian Master',
      primaryTextKey: 'hungarian',
      transliterationKey: '',
      labels: {
        'hungarian': 'Hungarian',
        'english': 'English'
      },
      hasStories: false,
      hasReading: true,
      hasTestTab: true,
      hasSweepTab: true,
      lexiconDoc: 'dictionary',
      ttsSystemInstruction:
          "$_sharedTtsPrompt\n\nCRITICAL INSTRUCTION: Evaluate the primary language of the sentence before speaking. If the sentence is in English but starts with or contains a Hungarian name (e.g., 'Tamás', 'János'), you MUST read the entire sentence with a natural, native English accent. Do not switch to a Hungarian accent for the English words.",
      promptSystemInstruction: "You are an expert Hungarian language curriculum designer.",
    ),
    'portuguese': const CourseConfig(
      id: 'portuguese',
      dbAppId: 'portuguese-master',
      name: 'Portuguese Master',
      primaryTextKey: 'portuguese',
      transliterationKey: '',
      labels: {
        'portuguese': 'Portuguese',
        'english': 'English'
      },
      hasStories: false,
      hasReading: true,
      hasTestTab: false,
      hasSweepTab: false,
      ttsSystemInstruction:
          "$_sharedTtsPrompt\n\nCRITICAL INSTRUCTION: When speaking Portuguese, use a strict European Portuguese (pt-PT) accent and phonology.",
      promptSystemInstruction: "You are an expert European Portuguese curriculum designer.",
    ),
    'romanian': const CourseConfig(
      id: 'romanian',
      dbAppId: 'romanian-master',
      name: 'Romanian Master',
      primaryTextKey: 'romanian',
      transliterationKey: '',
      labels: {
        'romanian': 'Romanian',
        'english': 'English'
      },
      hasStories: false,
      hasReading: true,
      hasTestTab: false,
      hasSweepTab: false,
      ttsSystemInstruction: _sharedTtsPrompt,
      promptSystemInstruction: "You are an expert Romanian curriculum designer.",
    ),
    'russian': const CourseConfig(
      id: 'russian',
      dbAppId: 'russian-master',
      name: 'Russian Master',
      primaryTextKey: 'russian',
      transliterationKey: '',
      labels: {
        'russian': 'Russian',
        'english': 'English'
      },
      hasStories: false,
      hasReading: true,
      hasTestTab: false,
      hasSweepTab: false,
      ttsSystemInstruction: _sharedTtsPrompt,
      promptSystemInstruction: "You are an expert Russian curriculum designer.",
    ),
    'greek': const CourseConfig(
      id: 'greek',
      dbAppId: 'greek-master',
      name: 'Modern Greek Master',
      primaryTextKey: 'greek',
      transliterationKey: '',
      labels: {
        'greek': 'Greek',
        'english': 'English'
      },
      hasStories: false,
      hasReading: true,
      hasTestTab: false,
      hasSweepTab: false,
      ttsSystemInstruction: _sharedTtsPrompt,
      promptSystemInstruction: "You are an expert Modern Greek curriculum designer.",
    ),
    'japanese': const CourseConfig(
      id: 'japanese',
      dbAppId: 'japanese-master',
      name: 'Japanese Master',
      primaryTextKey: 'japanese',
      transliterationKey: 'romaji',
      labels: {
        'japanese': 'Japanese',
        'romaji': 'Rōmaji',
        'english': 'English'
      },
      hasStories: false,
      hasReading: true,
      hasTestTab: false,
      hasSweepTab: false,
      ttsSystemInstruction:
          "$_sharedTtsPrompt\n\nCRITICAL INSTRUCTION: When speaking Japanese, use standard Japanese (Hyōjungo) pronunciation.",
      promptSystemInstruction: "You are an expert Japanese curriculum designer.",
    ),
  };

  static CourseConfig get(String id) {
    return configs[id] ?? configs['hungarian']!;
  }
}
