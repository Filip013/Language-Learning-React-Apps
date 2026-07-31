// lib/services/gemini_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:lingocraft_flutter/constants/prompt_builders.dart';
import 'package:lingocraft_flutter/models/language.dart';
import 'package:lingocraft_flutter/models/lingocraft_result.dart';


class GeminiService {
  static const _model = 'gemini-3.5-flash-lite';
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
    final candidates = data['candidates'] as List?;
    if (candidates == null || candidates.isEmpty) {
      throw Exception('No candidates returned from Gemini API.');
    }

    final parts = (candidates.first['content'] as Map?)?['parts'] as List?;
    if (parts == null || parts.isEmpty) {
      throw Exception('Empty response parts from Gemini.');
    }

    String? rawText;
    for (final p in parts) {
      if (p is Map && p['text'] is String) {
        final txt = (p['text'] as String).trim();
        final isThought = p['thought'] == true;
        if (!isThought && (txt.startsWith('{') || txt.startsWith('['))) {
          rawText = txt;
          break;
        }
        if (!isThought && rawText == null) {
          rawText = txt;
        }
      }
    }
    rawText ??= (parts.last as Map?)?['text'] as String?;

    if (rawText == null || rawText.isEmpty) {
      throw Exception('Empty response text from Gemini.');
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

  /// Calls Gemini API to generate a new course episode JSON.
  static Future<Map<String, dynamic>> generateCourseEpisode({
    required String systemInstruction,
    required String userPrompt,
    required String apiKey,
  }) async {
    final promptText = 'Topic / Focus: $userPrompt\n\n'
        'Generate the complete episode in valid JSON format.';

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
      throw Exception('Gemini API error ${response.statusCode}: ${response.body}');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final candidates = data['candidates'] as List?;
    if (candidates == null || candidates.isEmpty) {
      throw Exception('No candidates returned from Gemini API.');
    }

    final parts = (candidates.first['content'] as Map?)?['parts'] as List?;
    if (parts == null || parts.isEmpty) {
      throw Exception('Empty response parts from Gemini.');
    }

    String? rawText;
    for (final p in parts) {
      if (p is Map && p['text'] is String) {
        final txt = (p['text'] as String).trim();
        final isThought = p['thought'] == true;
        if (!isThought && (txt.startsWith('{') || txt.startsWith('['))) {
          rawText = txt;
          break;
        }
        if (!isThought && rawText == null) {
          rawText = txt;
        }
      }
    }
    rawText ??= (parts.last as Map?)?['text'] as String?;

    if (rawText == null || rawText.isEmpty) {
      throw Exception('Empty response text from Gemini.');
    }

    var cleanText = rawText.trim();
    if (cleanText.startsWith('```json')) cleanText = cleanText.replaceFirst(RegExp(r'^```json\n?'), '');
    if (cleanText.startsWith('```')) cleanText = cleanText.replaceFirst(RegExp(r'^```\n?'), '');
    if (cleanText.endsWith('```')) cleanText = cleanText.replaceFirst(RegExp(r'\n?```$'), '');

    return jsonDecode(cleanText.trim()) as Map<String, dynamic>;
  }
}
