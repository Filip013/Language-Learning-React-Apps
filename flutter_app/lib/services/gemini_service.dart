// lib/services/gemini_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:lingocraft_flutter/constants/prompt_builders.dart';
import 'package:lingocraft_flutter/models/lingocraft_result.dart';

class GeminiService {
  static const _model = 'gemini-2.5-flash-lite';
  static const _baseUrl =
      'https://generativelanguage.googleapis.com/v1beta/models';

  static final _responseSchema = {
    'type': 'OBJECT',
    'properties': {
      'word': {'type': 'STRING'},
      'partOfSpeech': {'type': 'STRING'},
      'ipa': {'type': 'STRING'},
      'definitionEnglish': {'type': 'STRING'},
      'sentences': {
        'type': 'ARRAY',
        'items': {
          'type': 'OBJECT',
          'properties': {
            'original': {'type': 'STRING'},
            'transcription': {'type': 'STRING'},
            'englishTranslation': {'type': 'STRING'},
            'explanation': {'type': 'STRING'},
          },
          'required': ['original', 'englishTranslation', 'explanation'],
        },
      },
    },
    'required': [
      'word',
      'partOfSpeech',
      'ipa',
      'definitionEnglish',
      'sentences',
    ],
  };

  /// Calls the Gemini REST API and returns a [LingoCraftResult].
  static Future<LingoCraftResult> generate({
    required String word,
    required Language language,
    required String level,
    required String apiKey,
  }) async {
    final systemInstruction = getSystemInstruction(language.name);
    final promptText =
        'Analyze the word "$word" in the context of the "${language.name}" language '
        'at a "$level" level. Generate 5 accurate example sentences.';

    final payload = {
      'contents': [
        {
          'parts': [
            {'text': promptText},
          ],
        },
      ],
      'systemInstruction': {
        'parts': [
          {'text': systemInstruction},
        ],
      },
      'generationConfig': {
        'responseMimeType': 'application/json',
        'responseSchema': _responseSchema,
        'thinkingConfig': {'thinkingLevel': 'HIGH'},
      },
    };

    final uri = Uri.parse('$_baseUrl/$_model:generateContent?key=$apiKey');
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    if (response.statusCode != 200) {
      throw Exception(
        'Gemini API error ${response.statusCode}: ${response.body}',
      );
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final rawText =
        (data['candidates'] as List?)
                ?.firstOrNull?['content']?['parts']
                ?.firstOrNull?['text']
            as String?;

    if (rawText == null || rawText.isEmpty) {
      throw Exception('Empty response from Gemini.');
    }

    final parsed = jsonDecode(rawText) as Map<String, dynamic>;
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    return LingoCraftResult.fromMap({
      ...parsed,
      'id': id,
      'targetLanguage': language.toMap(),
      'level': level,
      'timestamp': int.parse(id),
    });
  }
}
