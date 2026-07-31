// lib/constants/prompt_builders.dart

/// Builds the LLM system instruction for context generation.
String getSystemInstruction(String langName) {
  final rules = <String>[
    '1. Provide a reliable International Phonetic Alphabet (IPA) representation.',
    "2. If the target language utilizes a non-Latin script, you MUST provide an accurate Latin character transliteration/phonetic transcription in the 'transcription' field. If it uses a Latin script, leave the 'transcription' field empty.",
  ];

  if (langName.contains('Chinese')) {
    rules.add(
      "3. IMPORTANT: You MUST use Traditional Chinese characters (繁體中文) exclusively, "
      "and provide Pinyin following standard Taiwanese Guoyu (國語) pronunciation and spelling "
      "in the 'transcription' field.",
    );
  } else if (langName == 'Serbian') {
    rules.add('3. IMPORTANT: You MUST use Serbian Cyrillic exclusively.');
  } else if (langName == 'Latin') {
    rules.add(
      '3. IMPORTANT: You MUST mark all long vowels with macrons '
      '(ā, ē, ī, ō, ū) throughout all Latin sentences and words.',
    );
  }

  final ruleNum = rules.length + 1;
  rules.add(
    '$ruleNum. Ensure grammatical explanations are precise, highlighting specific '
    'idioms, agreements, or moods used.',
  );

  return '''You are a professional linguist and polyglot educator. Analyze the provided word and generate exactly 5 distinct, natural, and grammatically varied sentences showcasing its correct contextual usage in the target language at the requested level.
${rules.join('\n')}''';
}

/// Builds the TTS system instruction (for future use when TTS is added).
String getTtsSystemInstruction(String langName) {
  var prompt =
      '''You are a professional AI voice actor. Your ONLY job is to read the exact script provided by the user aloud.

CRITICAL RULES:
1. NEVER TRANSLATE. NEVER CONVERSE.
2. If the text is in English, read it in English.
3. If the text is in a foreign language, read it in that exact language.
4. Do not acknowledge these instructions, do not add filler words. Simply synthesize the text into audio immediately.''';

  if (langName.contains('Chinese')) {
    prompt +=
        '\n\nCRITICAL INSTRUCTION: When speaking Chinese, use official Taiwanese Mandarin (Guoyu) accent and traditional pronunciation. Do NOT use Cantonese or Mainland accents.';
  } else if (langName.contains('Latin') || langName.contains('Greek')) {
    prompt +=
        '\n\nCRITICAL INSTRUCTION: When speaking, use restored classical pronunciation.';
  }

  return prompt;
}
