import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../../../core/services/firebase_service.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/services/tts_service.dart';
import '../../../data/configs/courses_config.dart';
import '../../../data/models/course_config.dart';
import '../../../data/models/user_note.dart';

class CourseProvider extends ChangeNotifier {
  String _courseId = 'mandarin';
  late CourseConfig _config;
  int _activeEpisodeIndex = 0;
  String _activeTab = 'studio'; // studio | episode | lexicon | drill | quiz | reading | story | sweep | test

  // Audio state
  String? _playingId;
  String _searchQuery = '';
  bool _isFlashcardMode = false;

  // Episodes & Studio state
  List<Map<String, dynamic>> _episodesList = [];
  String? _activeEpisodeId;
  Map<String, dynamic>? _activeEpisode;
  Map<String, dynamic> _progressState = {};
  Map<String, dynamic>? _globalLexicon;
  List<Map<String, dynamic>> _storyList = [];
  String? _activeStoryId;

  // Studio Form state
  String _topicInput = '';
  bool _isGenerating = false;
  bool _isExporting = false;
  bool _isCopied = false;
  String _genError = '';
  bool _showGenerateConfirm = false;
  String? _deletingEpisodeId;
  bool _dropdownOpen = false;

  final Map<String, UserNote> _userNotes = {};

  // Firestore subscriptions
  StreamSubscription? _episodesSub;
  StreamSubscription? _activeEpisodeSub;
  StreamSubscription? _progressSub;
  StreamSubscription? _lexiconSub;
  StreamSubscription? _storiesSub;

  // Getters
  String get courseId => _courseId;
  CourseConfig get config => _config;
  int get activeEpisodeIndex => _activeEpisodeIndex;
  String get activeTab => _activeTab;
  String? get playingId => _playingId;
  String get searchQuery => _searchQuery;
  bool get isFlashcardMode => _isFlashcardMode;
  Map<String, UserNote> get userNotes => _userNotes;

  List<Map<String, dynamic>> get episodesList => _episodesList;
  String? get activeEpisodeId => _activeEpisodeId;
  Map<String, dynamic>? get activeEpisode => _activeEpisode;
  Map<String, dynamic> get progressState => _progressState;
  List<Map<String, dynamic>> get storyList => _storyList;
  Map<String, dynamic>? get globalLexicon => _globalLexicon;
  String? get activeStoryId => _activeStoryId;

  String get topicInput => _topicInput;
  bool get isGenerating => _isGenerating;
  bool get isExporting => _isExporting;
  bool get isCopied => _isCopied;
  String get genError => _genError;
  bool get showGenerateConfirm => _showGenerateConfirm;
  String? get deletingEpisodeId => _deletingEpisodeId;
  bool get dropdownOpen => _dropdownOpen;

  // ---- Progress helpers (Drill / Quiz / Reading progress) ----

  bool get isLatestEpisode =>
      _episodesList.isNotEmpty && _activeEpisodeId == _episodesList.first['id'];

  Set<String> get listenedDrills {
    final raw = _progressState['listenedDrills'];
    if (raw is List) return raw.map((e) => e.toString()).toSet();
    return {};
  }

  Set<String> get drillRevealed {
    final raw = _progressState['drillRevealed'];
    if (raw is List) return raw.map((e) => e.toString()).toSet();
    return {};
  }

  Set<String> get listenedReading {
    final raw = _progressState['listenedReading'];
    if (raw is List) return raw.map((e) => e.toString()).toSet();
    return {};
  }

  Map<String, dynamic> get userSelections {
    final raw = _progressState['selections'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return {};
  }

  Set<String> get revealedIds {
    final raw = _progressState['revealed'];
    if (raw is List) return raw.map((e) => e.toString()).toSet();
    return {};
  }

  Set<String> get gradedIds {
    final raw = _progressState['gradedIds'];
    if (raw is List) return raw.map((e) => e.toString()).toSet();
    return {};
  }

  Map<String, dynamic> get testMastered {
    final raw = _progressState['testMastered'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return {};
  }

  Map<String, dynamic> get testRevealed {
    final raw = _progressState['testRevealed'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return {};
  }

  Map<String, dynamic> get sweepMastered {
    final raw = _progressState['sweepMastered'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return {};
  }

  Map<String, dynamic> get sweepRevealed {
    final raw = _progressState['sweepRevealed'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return {};
  }

  Map<String, dynamic> get progressNotes {
    final raw = _progressState['notes'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return {};
  }

  CourseProvider() {
    _config = CoursesConfig.get(_courseId);
    _initFirestoreSync();
  }

  void setCourse(String id) {
    if (_courseId == id) return;
    _courseId = id;
    _config = CoursesConfig.get(id);
    _activeEpisodeIndex = 0;
    _activeTab = 'studio';
    _activeEpisodeId = null;
    _activeEpisode = null;
    _episodesList = [];
    _topicInput = '';
    _genError = '';

    _cancelSubscriptions();
    _initFirestoreSync();
    notifyListeners();
  }

  void setActiveTab(String tab) {
    _activeTab = tab;
    notifyListeners();
  }

  void setEpisodeIndex(int index) {
    _activeEpisodeIndex = index;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void toggleFlashcardMode() {
    _isFlashcardMode = !_isFlashcardMode;
    notifyListeners();
  }

  void setTopicInput(String val) {
    _topicInput = val;
    notifyListeners();
  }

  void setDropdownOpen(bool open) {
    _dropdownOpen = open;
    notifyListeners();
  }

  void setShowGenerateConfirm(bool show) {
    _showGenerateConfirm = show;
    notifyListeners();
  }

  void setDeletingEpisodeId(String? id) {
    _deletingEpisodeId = id;
    notifyListeners();
  }

  void setActiveEpisodeId(String epId) {
    if (_activeEpisodeId == epId) return;
    _activeEpisodeId = epId;
    _subscribeToActiveEpisode(epId);
    notifyListeners();
  }

  void setActiveStoryId(String? id) {
    if (_activeStoryId == id) return;
    _activeStoryId = id;
    notifyListeners();
  }

  void _cancelSubscriptions() {
    _episodesSub?.cancel();
    _activeEpisodeSub?.cancel();
    _progressSub?.cancel();
    _lexiconSub?.cancel();
    _storiesSub?.cancel();
  }

  @override
  void dispose() {
    _cancelSubscriptions();
    super.dispose();
  }

  void _initFirestoreSync() {
    final uid = FirebaseService.currentUserId;
    if (uid == null) return;

    final dbAppId = _config.dbAppId;

    // Lexicon Sync
    final docName = _config.lexiconDoc;
    _lexiconSub = FirebaseService.firestore
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('database')
        .doc(docName)
        .snapshots()
        .listen((snap) {
      if (snap.exists && snap.data() != null) {
        _globalLexicon = snap.data();
      } else {
        _globalLexicon = {};
      }
      notifyListeners();
    });

    // Stories Sync
    if (_config.hasStories) {
      _storiesSub = FirebaseService.firestore
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('stories')
          .snapshots()
          .listen((snap) {
        _storyList = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
        notifyListeners();
      });
    }

    // Episodes List Sync
    _episodesSub = FirebaseService.firestore
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('episodes')
        .orderBy('timestamp', descending: true)
        .limit(10)
        .snapshots()
        .listen((snap) {
      _episodesList = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();

      if (_activeEpisodeId == null && _episodesList.isNotEmpty) {
        setActiveEpisodeId(_episodesList.first['id'] as String);
      }
      notifyListeners();
    });
  }

  void _subscribeToActiveEpisode(String epId) {
    _activeEpisodeSub?.cancel();
    _progressSub?.cancel();

    final uid = FirebaseService.currentUserId;
    if (uid == null) return;
    final dbAppId = _config.dbAppId;

    _activeEpisodeSub = FirebaseService.firestore
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('episodes')
        .doc(epId)
        .snapshots()
        .listen((snap) {
      if (snap.exists && snap.data() != null) {
        _activeEpisode = {'id': snap.id, ...snap.data()!};
      } else {
        _activeEpisode = null;
      }
      notifyListeners();
    });

    _progressSub = FirebaseService.firestore
        .collection('artifacts')
        .doc(dbAppId)
        .collection('users')
        .doc(uid)
        .collection('progress')
        .doc(epId)
        .snapshots()
        .listen((snap) {
      if (snap.exists && snap.data() != null) {
        _progressState = snap.data()!;
      } else {
        _progressState = {};
      }
      notifyListeners();
    });
  }

  String _buildPromptString(bool isForAPI) {
    List<dynamic> prioritizedWords = [];
    List<dynamic> otherWords = [];

    final lex = _globalLexicon ?? {};
    if (lex['accumulated'] != null) {
      prioritizedWords = List.from(lex['accumulated']);
    } else if (lex['entries'] != null) {
      prioritizedWords = List.from(lex['entries']);
    }

    lex.forEach((key, val) {
      if (key != 'accumulated' && key != 'entries' && val is List) {
        otherWords.addAll(val);
      }
    });

    final flatLexicon = [...prioritizedWords, ...otherWords].map((w) {
      if (w is String) return w;
      if (w is Map) return w['word'] ?? w[_config.primaryTextKey] ?? w['targetText'] ?? '';
      return '';
    }).where((s) => s.toString().isNotEmpty).join(', ');

    String pastContext = '';
    final count = _episodesList.length > 5 ? 5 : _episodesList.length;
    for (int i = 0; i < count; i++) {
      final ep = _episodesList[i];
      final title = ep['title'] ?? 'Lesson';
      pastContext += '\n--- Past Episode: $title ---\n';
    }

    final pastContextBlock = pastContext.isNotEmpty
        ? '\nRECENT CONTEXT & PERFORMANCE:\n$pastContext\n'
        : '';
    final outputInstruction = isForAPI
        ? 'OUTPUT FORMAT (Provide response strictly as raw JSON, without any markdown formatting or backticks):\n{ "title": "...", "tutorIntroduction": "...", "drills": [] }'
        : 'OUTPUT FORMAT (Provide response as JSON inside a ```json codeblock):\n{ "title": "...", "tutorIntroduction": "...", "drills": [] }';

    return '''SYSTEM INSTRUCTION:
${_config.promptSystemInstruction}

KNOWN VOCABULARY:
[$flatLexicon]
$pastContextBlock
USER REQUEST:
$_topicInput

---

$outputInstruction''';
  }

  /// AI Translate: translate [text] to English (+ transliteration when the
  /// course has a transliteration script). Mirrors React AiTranslatePopup.
  Future<Map<String, String>> aiTranslate(String text) async {
    final apiKey = StorageService.getString('geminiPaidApiKey') ??
        StorageService.getString('geminiApiKey');
    if (apiKey == null || apiKey.isEmpty) {
      throw Exception('No API Key found in settings.');
    }

    final hasTranslit = _config.transliterationKey.isNotEmpty;
    final translitLabel = hasTranslit
        ? (_config.labels[_config.transliterationKey] ?? _config.transliterationKey)
        : null;

    final prompt = hasTranslit
        ? 'Translate the following text to English. Also provide its $translitLabel transliteration. Text: "$text"\nOutput JSON strictly with keys: {"translation": "...", "transliteration": "..."}'
        : 'Translate the following text to English. Text: "$text"\nOutput JSON strictly with keys: {"translation": "..."}';

    final url = Uri.parse(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey');

    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'contents': [
          {
            'parts': [
              {'text': prompt}
            ]
          }
        ],
        'generationConfig': {
          'responseMimeType': 'application/json',
        }
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Translation failed (${response.statusCode}).');
    }

    final resData = jsonDecode(response.body);
    final rawText = resData['candidates']?[0]?['content']?['parts']?[0]?['text'];
    if (rawText == null) throw Exception('Empty response from API.');

    final parsed = jsonDecode(rawText.toString());
    return {
      'translation': (parsed is Map ? parsed['translation'] ?? '' : '').toString(),
      'transliteration': hasTranslit
          ? (parsed is Map ? parsed['transliteration'] ?? '' : '').toString()
          : '',
    };
  }

  /// Merge [patch] into the course's lexicon document (database/{lexiconDoc}).
  Future<void> updateLexicon(Map<String, dynamic> patch) async {
    final uid = FirebaseService.currentUserId;
    if (uid == null) return;

    try {
      await FirebaseService.firestore
          .collection('artifacts')
          .doc(_config.dbAppId)
          .collection('users')
          .doc(uid)
          .collection('database')
          .doc(_config.lexiconDoc)
          .set(patch, SetOptions(merge: true));
    } catch (e) {
      debugPrint('updateLexicon error: $e');
    }
  }

  Future<void> handleExportPrompt() async {
    if (_topicInput.trim().isEmpty) return;
    _isExporting = true;
    _genError = '';
    notifyListeners();

    try {
      final exportedText = _buildPromptString(false);
      await Clipboard.setData(ClipboardData(text: exportedText));
      _isCopied = true;
      notifyListeners();

      Timer(const Duration(milliseconds: 2500), () {
        _isCopied = false;
        notifyListeners();
      });
    } catch (e) {
      _genError = 'Failed to build prompt: $e';
    } finally {
      _isExporting = false;
      notifyListeners();
    }
  }

  Future<void> handleGenerateLLM() async {
    if (_topicInput.trim().isEmpty) return;

    final apiKey = StorageService.getString('geminiApiKey') ??
        StorageService.getString('geminiPaidApiKey') ??
        '';

    if (apiKey.isEmpty) {
      _genError = 'No API Key found. Please set your Gemini API Key in Hub Settings.';
      _showGenerateConfirm = false;
      notifyListeners();
      return;
    }

    _isGenerating = true;
    _genError = '';
    _showGenerateConfirm = false;
    notifyListeners();

    try {
      final promptText = _buildPromptString(true);
      final url = Uri.parse(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey');

      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'contents': [
            {
              'parts': [
                {'text': promptText}
              ]
            }
          ],
          'generationConfig': {
            'responseMimeType': 'application/json',
          }
        }),
      );

      if (response.statusCode != 200) {
        final errJson = jsonDecode(response.body);
        throw Exception(errJson['error']?['message'] ?? 'API Error ${response.statusCode}');
      }

      final resData = jsonDecode(response.body);
      final rawText = resData['candidates']?[0]?['content']?['parts']?[0]?['text'];

      if (rawText == null || rawText.toString().trim().isEmpty) {
        throw Exception('Empty response received from API.');
      }

      await processImportedJSON(rawText.toString().trim());
    } catch (e) {
      _genError = 'Generation failed: $e';
    } finally {
      _isGenerating = false;
      notifyListeners();
    }
  }

  Future<void> processImportedJSON(String textToParse) async {
    final uid = FirebaseService.currentUserId;
    if (uid == null) return;

    try {
      var cleaned = textToParse.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replaceFirst(RegExp(r'^```json\n?'), '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replaceFirst(RegExp(r'^```\n?'), '');
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.replaceFirst(RegExp(r'\n?```$'), '');
      }

      final Map<String, dynamic> lessonJSON = jsonDecode(cleaned.trim());
      final newEpisodeId = 'ep_${DateTime.now().millisecondsSinceEpoch}';

      final episodeDoc = {
        ...lessonJSON,
        'id': newEpisodeId,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
        'userPrompt': _topicInput.isNotEmpty ? _topicInput : 'Imported Lesson',
      };

      final dbAppId = _config.dbAppId;
      await FirebaseService.firestore
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('episodes')
          .doc(newEpisodeId)
          .set(episodeDoc);

      setActiveEpisodeId(newEpisodeId);
      _topicInput = '';
      _genError = '';
      notifyListeners();
    } catch (e) {
      _genError = 'Import failed. Make sure data contains valid JSON: $e';
      notifyListeners();
    }
  }

  Future<void> handleDeleteEpisode() async {
    final epId = _activeEpisodeId;
    final uid = FirebaseService.currentUserId;
    if (epId == null || uid == null) return;

    try {
      final dbAppId = _config.dbAppId;
      await FirebaseService.firestore
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('episodes')
          .doc(epId)
          .delete();

      await FirebaseService.firestore
          .collection('artifacts')
          .doc(dbAppId)
          .collection('users')
          .doc(uid)
          .collection('progress')
          .doc(epId)
          .delete();

      _deletingEpisodeId = null;
      _activeEpisodeId = _episodesList.isNotEmpty ? _episodesList.first['id'] as String : null;
      notifyListeners();
    } catch (e) {
      debugPrint('Delete episode error: $e');
    }
  }

  void saveUserNote(String targetText, String noteText) {
    if (noteText.isEmpty) {
      _userNotes.remove(targetText);
    } else {
      _userNotes[targetText] = UserNote(
        id: targetText,
        text: targetText,
        note: noteText,
        createdAt: DateTime.now(),
      );
    }
    notifyListeners();
  }

  Future<void> speakText(String text, String id) async {
    if (_playingId == id) {
      await TTSService.stop();
      _playingId = null;
      notifyListeners();
      return;
    }

    _playingId = id;
    notifyListeners();

    await TTSService.speak(
      text: text,
      systemInstruction: _config.ttsSystemInstruction,
      onComplete: () {
        _playingId = null;
        notifyListeners();
      },
      onError: () {
        _playingId = null;
        notifyListeners();
      },
    );
  }

  /// Speak a sequence of texts (e.g. Target, English, Target) and track it as [id].
  Future<void> speakListTexts(List<String> texts, String id) async {
    if (_playingId == id) {
      await TTSService.stop();
      _playingId = null;
      notifyListeners();
      return;
    }

    _playingId = id;
    notifyListeners();

    await TTSService.speakList(
      texts: texts,
      systemInstruction: _config.ttsSystemInstruction,
      onComplete: () {
        _playingId = null;
        notifyListeners();
      },
      onError: () {
        _playingId = null;
        notifyListeners();
      },
    );
  }

  Future<void> stopSpeaking() async {
    await TTSService.stop();
    _playingId = null;
    notifyListeners();
  }

  /// Merge [updates] into the current episode's progress doc (Firestore + local state).
  Future<void> updateFirebase(Map<String, dynamic> updates) async {
    _progressState = {..._progressState, ...updates};
    notifyListeners();

    final uid = FirebaseService.currentUserId;
    final epId = _activeEpisodeId;
    if (uid == null || epId == null) return;

    try {
      await FirebaseService.firestore
          .collection('artifacts')
          .doc(_config.dbAppId)
          .collection('users')
          .doc(uid)
          .collection('progress')
          .doc(epId)
          .set(updates, SetOptions(merge: true));
    } catch (e) {
      debugPrint('updateFirebase error: $e');
    }
  }

  // ---- Tab navigation (mirrors React handleTabNext/handleTabPrev) ----

  List<String> get _tabOrder {
    final tabs = <String>[
      'studio',
      'reading',
      'drill',
      'quiz',
    ];
    if (_config.hasTestTab) tabs.add('test');
    if (_config.hasSweepTab) tabs.add('sweep');
    tabs.add('lexicon');
    if (_config.hasStories) tabs.add('story');
    return tabs;
  }

  String get _normalizedActiveTab => _activeTab;

  void goToNextTab() {
    final order = _tabOrder;
    final idx = order.indexWhere((t) => t == _normalizedActiveTab);
    if (idx != -1 && idx < order.length - 1) {
      setActiveTab(order[idx + 1]);
    }
  }

  void goToPrevTab() {
    final order = _tabOrder;
    final idx = order.indexWhere((t) => t == _normalizedActiveTab);
    if (idx > 0) {
      setActiveTab(order[idx - 1]);
    }
  }
}
