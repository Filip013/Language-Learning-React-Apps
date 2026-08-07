import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../../core/services/firebase_service.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/services/tts_service.dart';
import '../../../core/services/web_font_service.dart';
import '../../../data/configs/languages_config.dart';
import '../../../data/models/language.dart';
import '../../../data/models/lingocraft_result.dart';

class LingoCraftProvider extends ChangeNotifier {
  static const String _dbAppId = 'lingocraft';

  String _word = '';
  Language _selectedLanguage = LanguagesConfig.allCourses.firstWhere(
    (l) => l.id == 'hungarian',
    orElse: () => LanguagesConfig.allCourses.first,
  );
  String _selectedLevel = 'B1–B2';
  bool _loading = false;
  String? _error;

  LingoCraftResult? _result;
  List<LingoCraftResult> _history = [];
  final Set<int> _revealedSentences = {};

  int _currentIdx = 0;
  int? _playingId;
  String _activeTab = 'main'; // 'main' | 'history'
  bool _showSearchOverlay = false;
  String _historySearch = '';

  // Getters
  String get word => _word;
  Language get selectedLanguage => _selectedLanguage;
  String get selectedLevel => _selectedLevel;
  bool get loading => _loading;
  String? get error => _error;
  LingoCraftResult? get result => _result;
  List<LingoCraftResult> get history => _history;
  Set<int> get revealedSentences => _revealedSentences;
  int get currentIdx => _currentIdx;
  int? get playingId => _playingId;
  String get activeTab => _activeTab;
  bool get showSearchOverlay => _showSearchOverlay;
  String get historySearch => _historySearch;

  // Exactly 3 levels (A1–A2, B1–B2, C1–C2)
  List<String> get levels => const ['A1–A2', 'B1–B2', 'C1–C2'];

  String _normalizeLevel(String lvl) {
    if (lvl == 'Beginner' || lvl == 'A1-A2' || lvl == 'A1–A2') return 'A1–A2';
    if (lvl == 'Intermediate' || lvl == 'B1-B2' || lvl == 'B1–B2') return 'B1–B2';
    if (lvl == 'Advanced' || lvl == 'C1-C2' || lvl == 'C1–C2') return 'C1–C2';
    return 'B1–B2';
  }

  LingoCraftProvider() {
    _loadLocalPrefs();
    _loadHistoryLocal();
    _syncFirestore();
  }

  void _loadLocalPrefs() {
    final savedLangName = StorageService.getString('lingocraft_language');
    if (savedLangName != null && savedLangName.isNotEmpty) {
      final found = LanguagesConfig.allCourses.firstWhere(
        (l) => l.name == savedLangName,
        orElse: () => _selectedLanguage,
      );
      _selectedLanguage = found;
      WebFontService.ensurePreferredFontsLoaded(found.name);
    }

    final savedLvl = StorageService.getString('lingocraft_level');
    if (savedLvl != null && savedLvl.isNotEmpty) {
      _selectedLevel = _normalizeLevel(savedLvl);
    } else {
      _selectedLevel = 'B1–B2';
    }
  }

  void setSelectedLanguage(Language lang) {
    _selectedLanguage = lang;
    WebFontService.ensurePreferredFontsLoaded(lang.name);
    StorageService.setString('lingocraft_language', lang.name);
    _savePreferencesFirestore();
    notifyListeners();
  }

  void setSelectedLevel(String lvl) {
    _selectedLevel = _normalizeLevel(lvl);
    StorageService.setString('lingocraft_level', _selectedLevel);
    _savePreferencesFirestore();
    notifyListeners();
  }

  void setActiveTab(String tab) {
    _activeTab = tab;
    notifyListeners();
  }

  void resetToMainScreen() {
    _activeTab = 'main';
    _result = null;
    _word = '';
    _error = null;
    _showSearchOverlay = false;
    notifyListeners();
  }

  void toggleSearchOverlay() {
    _showSearchOverlay = !_showSearchOverlay;
    notifyListeners();
  }

  void setHistorySearch(String query) {
    _historySearch = query;
    notifyListeners();
  }

  void setCurrentIdx(int idx) {
    _currentIdx = idx;
    notifyListeners();
  }

  void revealSentence(int idx) {
    _revealedSentences.add(idx);
    notifyListeners();
  }

  String _getTtsSystemInstruction(String langName) {
    String prompt = '''You are a professional AI voice actor. Your ONLY job is to read the exact script provided by the user aloud. 

CRITICAL RULES:
1. NEVER TRANSLATE. NEVER CONVERSE.
2. If the text is in English, read it in English.
3. If the text is in a foreign language, read it in that exact language.
4. Do not acknowledge these instructions, do not add filler words. Simply synthesize the text into audio immediately.''';

    if (langName.contains('Chinese')) {
      prompt += '\n\nCRITICAL INSTRUCTION: When speaking Chinese, use official Taiwanese Mandarin (Guoyu) accent and traditional pronunciation. Do NOT use Cantonese or Mainland accents.';
    } else if (langName.contains('Latin') || langName.contains('Greek')) {
      prompt += '\n\nCRITICAL INSTRUCTION: When speaking, use restored classical pronunciation.';
    }

    return prompt;
  }

  Future<void> generateContext() async {
    final queryWord = _word.trim();
    if (queryWord.isEmpty) return;

    final apiKey = StorageService.getString('geminiPaidApiKey') ??
        StorageService.getString('geminiApiKey');
    if (apiKey == null || apiKey.isEmpty) {
      _error = 'Paid or Free Gemini API Key required for context generation.';
      notifyListeners();
      return;
    }

    _loading = true;
    _error = null;
    _revealedSentences.clear();
    _currentIdx = 0;
    notifyListeners();

    WebFontService.ensurePreferredFontsLoaded(_selectedLanguage.name);

    try {
      final rules = [
        "1. Provide a reliable International Phonetic Alphabet (IPA) representation.",
        "2. If the target language utilizes a non-Latin script, you MUST provide an accurate Latin character transliteration/phonetic transcription (e.g., Hepburn Romaji for Japanese, Pinyin for Chinese, Latin alphabet for Greek/Russian/Serbian) in the 'transcription' field. If it uses a Latin script, leave the 'transcription' field empty.",
      ];

      if (_selectedLanguage.name.contains('Chinese')) {
        rules.add("3. IMPORTANT: You MUST use Traditional Chinese characters (繁體中文) exclusively, and provide Pinyin following standard Taiwanese Guoyu (國語) pronunciation and spelling in the 'transcription' field.");
      } else if (_selectedLanguage.name.contains('Japanese')) {
        rules.add("3. IMPORTANT: You MUST provide standard Hepburn Romaji (Latin script) in the 'transcription' field (e.g. 'Kyou wa asa kara zutto ame ga futte imasu.'), NOT Hiragana or Katakana.");
      } else if (_selectedLanguage.name.contains('Serbian')) {
        rules.add("3. IMPORTANT: You MUST use Serbian Cyrillic exclusively.");
      } else if (_selectedLanguage.name == 'Latin') {
        rules.add("3. IMPORTANT: You MUST mark all long vowels with macrons (ā, ē, ī, ō, ū) throughout all Latin sentences and words.");
      }

      final ruleNum = rules.length + 1;
      rules.add("$ruleNum. Ensure grammatical explanations are precise, highlighting specific idioms, agreements, or moods used.");

      final systemInstruction = '''You are a professional linguist and polyglot educator. Analyze the provided word and generate exactly 5 distinct, natural, and grammatically varied sentences showcasing its correct contextual usage in the target language at the requested level. 
${rules.join('\n')}''';

      final promptText = '''Word: "$queryWord"
Target Language: ${_selectedLanguage.name}
Level: $_selectedLevel

Please generate 5 contextual sentences for this word.''';

      final responseSchema = {
        "type": "OBJECT",
        "properties": {
          "word": {"type": "STRING"},
          "partOfSpeech": {"type": "STRING"},
          "ipa": {"type": "STRING"},
          "definitionEnglish": {"type": "STRING"},
          "sentences": {
            "type": "ARRAY",
            "items": {
              "type": "OBJECT",
              "properties": {
                "original": {"type": "STRING"},
                "transcription": {"type": "STRING"},
                "englishTranslation": {"type": "STRING"},
                "explanation": {"type": "STRING"}
              },
              "required": ["original", "englishTranslation", "explanation"]
            }
          }
        },
        "required": ["word", "partOfSpeech", "ipa", "definitionEnglish", "sentences"]
      };

      final payload = {
        "contents": [
          {
            "parts": [
              {"text": promptText}
            ]
          }
        ],
        "systemInstruction": {
          "parts": [
            {"text": systemInstruction}
          ]
        },
        "generationConfig": {
          "responseMimeType": "application/json",
          "responseSchema": responseSchema,
        }
      };

      final url = Uri.parse(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey');

      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      );

      if (response.statusCode != 200) {
        throw Exception('Gemini API Error: ${response.statusCode} - ${response.body}');
      }

      final body = jsonDecode(response.body);
      final jsonText = body['candidates'][0]['content']['parts'][0]['text'];
      final parsed = jsonDecode(jsonText);

      final newResult = LingoCraftResult(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        word: parsed['word'] ?? queryWord,
        partOfSpeech: parsed['partOfSpeech'] ?? 'Word',
        ipa: parsed['ipa'] ?? '',
        definitionEnglish: parsed['definitionEnglish'] ?? '',
        targetLanguageName: _selectedLanguage.name,
        targetLanguageFlag: _selectedLanguage.flag,
        level: _selectedLevel,
        sentences: (parsed['sentences'] as List).map((s) => LingoCraftSentence.fromJson(s)).toList(),
        timestamp: DateTime.now().millisecondsSinceEpoch,
      );

      _result = newResult;
      _history.insert(0, newResult);
      _activeTab = 'main';

      await _saveHistoryLocal();
      await _saveHistoryFirestore();
    } catch (e) {
      debugPrint('LingoCraft Error: $e');
      _error = 'Unable to generate contexts. Please check your connection or API key.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void loadHistoryItem(LingoCraftResult item) {
    _result = item;
    _word = '';
    _selectedLevel = item.level;
    _currentIdx = 0;
    _revealedSentences.addAll([0, 1, 2, 3, 4]);
    _activeTab = 'main';
    WebFontService.ensurePreferredFontsLoaded(item.targetLanguageName);
    notifyListeners();
  }

  Future<void> deleteHistoryItem(String id) async {
    _history.removeWhere((item) => item.id == id);
    if (_result?.id == id) _result = null;
    notifyListeners();
    await _saveHistoryLocal();
    await _saveHistoryFirestore();
  }

  Future<void> stopAudio() async {
    await TTSService.stop();
    _playingId = null;
    notifyListeners();
  }

  Future<void> toggleAudio(LingoCraftSentence sentence, int index) async {
    if (_playingId != null || TTSService.isPlaying) {
      await TTSService.stop();
      _playingId = null;
      notifyListeners();
      return;
    }

    _playingId = index;
    notifyListeners();

    List<String> textsToSpeak;
    if (_selectedLanguage.name == 'English') {
      textsToSpeak = [sentence.original];
    } else {
      final targetScript = (_selectedLanguage.name.contains('Greek') && sentence.transcription.isNotEmpty)
          ? sentence.transcription
          : sentence.original;
      textsToSpeak = [targetScript, sentence.englishTranslation, targetScript];
    }

    await TTSService.speakList(
      texts: textsToSpeak,
      systemInstruction: _getTtsSystemInstruction(_selectedLanguage.name),
      onComplete: () {
        _playingId = null;
        revealSentence(index);
        notifyListeners();
      },
      onError: () {
        _playingId = null;
        notifyListeners();
      },
    );
  }

  void _loadHistoryLocal() {
    final raw = StorageService.getString('lingocraft_history');
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw) as List<dynamic>;
        _history = decoded.map((e) => LingoCraftResult.fromJson(e)).toList();
        notifyListeners();
      } catch (e) {
        debugPrint('Error decoding local LingoCraft history: $e');
      }
    }
  }

  Future<void> _saveHistoryLocal() async {
    final jsonList = _history.map((e) => e.toJson()).toList();
    await StorageService.setString('lingocraft_history', jsonEncode(jsonList));
  }

  void setWord(String val) {
    _word = val;
    notifyListeners();
  }

  Future<void> _syncPreferencesFirestore() async {
    final uid = FirebaseService.currentUserId;
    if (uid == null) return;

    try {
      final doc = await FirebaseService.firestore
          .collection('artifacts')
          .doc(_dbAppId)
          .collection('users')
          .doc(uid)
          .collection('config')
          .doc('preferences')
          .get();

      if (doc.exists && doc.data() != null) {
        final data = doc.data()!;
        if (data['language'] != null) {
          final langName = data['language'] as String;
          final found = LanguagesConfig.allCourses.firstWhere(
            (l) => l.name == langName,
            orElse: () => _selectedLanguage,
          );
          _selectedLanguage = found;
          StorageService.setString('lingocraft_language', found.name);
          WebFontService.ensurePreferredFontsLoaded(found.name);
        }
        if (data['level'] != null) {
          _selectedLevel = data['level'] as String;
          StorageService.setString('lingocraft_level', _selectedLevel);
        }
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Firestore preferences sync error: $e');
    }
  }

  Future<void> _savePreferencesFirestore() async {
    final uid = FirebaseService.currentUserId;
    if (uid == null) return;

    try {
      await FirebaseService.firestore
          .collection('artifacts')
          .doc(_dbAppId)
          .collection('users')
          .doc(uid)
          .collection('config')
          .doc('preferences')
          .set({
        'language': _selectedLanguage.name,
        'level': _selectedLevel,
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Firestore preferences save error: $e');
    }
  }

  Future<void> _syncFirestore() async {
    await _syncPreferencesFirestore();
    final uid = FirebaseService.currentUserId;
    if (uid == null) return;

    try {
      final doc = await FirebaseService.firestore
          .collection('artifacts')
          .doc(_dbAppId)
          .collection('users')
          .doc(uid)
          .collection('data')
          .doc('history')
          .get();

      if (doc.exists && doc.data() != null && doc.data()!['items'] != null) {
        final items = doc.data()!['items'] as List<dynamic>;
        _history = items.map((e) => LingoCraftResult.fromJson(e)).toList();
        await _saveHistoryLocal();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Firestore history sync error: $e');
    }
  }

  Future<void> _saveHistoryFirestore() async {
    final uid = FirebaseService.currentUserId;
    if (uid == null) return;

    try {
      final jsonList = _history.map((e) => e.toJson()).toList();
      await FirebaseService.firestore
          .collection('artifacts')
          .doc(_dbAppId)
          .collection('users')
          .doc(uid)
          .collection('data')
          .doc('history')
          .set({'items': jsonList}, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Firestore history save error: $e');
    }
  }
}
