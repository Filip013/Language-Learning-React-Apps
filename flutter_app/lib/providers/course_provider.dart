// lib/providers/course_provider.dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:lingocraft_flutter/constants/course_configs.dart';
import 'package:lingocraft_flutter/models/course_models.dart';
import 'package:lingocraft_flutter/providers/lingocraft_provider.dart';
import 'package:lingocraft_flutter/services/firebase_service.dart';
import 'package:lingocraft_flutter/services/font_service.dart';
import 'package:lingocraft_flutter/services/gemini_service.dart';
import 'package:lingocraft_flutter/services/storage_service.dart';
import 'package:lingocraft_flutter/services/tts_service.dart';

class CourseProvider extends ChangeNotifier {
  AppUser? _user;
  AppUser? get user => _user;

  CourseConfig _selectedConfig = kCourseConfigs['mandarin']!;
  CourseConfig get selectedConfig => _selectedConfig;

  int _selectedEpisodeIdx = 0;
  int get selectedEpisodeIdx => _selectedEpisodeIdx;

  String _activeTab = 'episode';
  String get activeTab => _activeTab;

  List<Episode> _episodes = [];
  List<Episode> get episodes => _episodes;

  Episode? get currentEpisode =>
      _episodes.isNotEmpty && _selectedEpisodeIdx < _episodes.length
          ? _episodes[_selectedEpisodeIdx]
          : null;

  Set<String> _bookmarkedSentences = {};
  Set<String> get bookmarkedSentences => _bookmarkedSentences;

  Map<String, UserNote> _userNotes = {};
  Map<String, UserNote> get userNotes => _userNotes;

  bool _loading = false;
  bool get loading => _loading;

  String? _error;
  String? get error => _error;

  int _currentSentenceIdx = 0;
  int get currentSentenceIdx => _currentSentenceIdx;

  Set<int> _revealedSentences = {};
  Set<int> get revealedSentences => _revealedSentences;

  bool _showTranslation = true;
  bool get showTranslation => _showTranslation;

  bool _showTransliteration = true;
  bool get showTransliteration => _showTransliteration;

  String _activeScriptKey = 'primary';
  String get activeScriptKey => _activeScriptKey;

  Map<int, String> _quizSelections = {};
  Map<int, String> get quizSelections => _quizSelections;

  Set<int> _quizRevealed = {};
  Set<int> get quizRevealed => _quizRevealed;

  Set<int> _testRevealed = {};
  Set<int> get testRevealed => _testRevealed;

  Set<int> _sweepRevealed = {};
  Set<int> get sweepRevealed => _sweepRevealed;

  bool _isGenerating = false;
  bool get isGenerating => _isGenerating;

  String? _genError;
  String? get genError => _genError;

  PlayState _playState = const PlayState();
  PlayState get playState => _playState;

  final TtsService _ttsService = TtsService();

  StreamSubscription? _authSub;
  StreamSubscription? _episodesSub;
  StreamSubscription? _progressSub;

  CourseProvider() {
    FontService.preloadCustomFonts(onFontLoaded: notifyListeners);
    _authSub = FirebaseService.userStream.listen(_onAuthChanged);
  }

  void _onAuthChanged(AppUser? user) {
    _user = user;
    _subscribeToCourseData();
    notifyListeners();
  }

  void selectCourse(String courseId) {
    if (kCourseConfigs.containsKey(courseId)) {
      _selectedConfig = kCourseConfigs[courseId]!;
      _selectedEpisodeIdx = 0;
      _currentSentenceIdx = 0;
      _revealedSentences = {};
      stopSpeak();
      _subscribeToCourseData();
      notifyListeners();
    }
  }

  void _subscribeToCourseData() {
    _episodesSub?.cancel();
    _progressSub?.cancel();

    if (_user == null) {
      _episodes = [];
      _userNotes = {};
      notifyListeners();
      return;
    }

    _loading = true;
    notifyListeners();

    _episodesSub = FirebaseService.courseEpisodesStream(
      _selectedConfig.dbAppId,
      _user!.uid,
    ).listen(
      (snap) {
        _loading = false;
        _episodes = snap.docs
            .map(
              (doc) => Episode.fromMap(
                Map<String, dynamic>.from(doc.data() as Map),
                _selectedConfig,
              ),
            )
            .toList();

        if (_selectedEpisodeIdx >= _episodes.length && _episodes.isNotEmpty) {
          _selectedEpisodeIdx = 0;
        }

        _subscribeToProgressData();
        notifyListeners();
      },
      onError: (err) {
        _loading = false;
        _error = 'Failed loading course episodes: $err';
        notifyListeners();
      },
    );
  }

  void _subscribeToProgressData() {
    _progressSub?.cancel();
    if (_user == null || currentEpisode == null) return;

    _progressSub = FirebaseService.courseProgressStream(
      _selectedConfig.dbAppId,
      _user!.uid,
      currentEpisode!.id,
    ).listen((snap) {
      if (snap.exists) {
        final data = snap.data();
        
        final rawNotes = data?['notes'] as Map<String, dynamic>? ?? {};
        final Map<String, UserNote> loadedNotes = {};
        rawNotes.forEach((k, v) {
          if (v is Map) {
            loadedNotes[k] = UserNote.fromMap(Map<String, dynamic>.from(v));
          }
        });

        final rawSelections = data?['selections'] as Map<String, dynamic>? ?? {};
        final Map<int, String> loadedSelections = {};
        rawSelections.forEach((k, v) {
          if (k.startsWith('quiz_')) {
            final idx = int.tryParse(k.split('_')[1]);
            if (idx != null) loadedSelections[idx] = v.toString();
          }
        });

        final rawQuizRevealed = data?['quizRevealed'] as List<dynamic>? ?? [];
        final Set<int> loadedQuizRevealed = {};
        for (final k in rawQuizRevealed) {
          if (k.toString().startsWith('quiz_')) {
            final idx = int.tryParse(k.toString().split('_')[1]);
            if (idx != null) loadedQuizRevealed.add(idx);
          }
        }

        final rawTestRevealed = data?['testRevealed'] as Map<String, dynamic>? ?? {};
        final Set<int> loadedTestRevealed = {};
        rawTestRevealed.forEach((k, v) {
          if (v == true && k.startsWith('test_')) {
            final idx = int.tryParse(k.split('_')[1]);
            if (idx != null) loadedTestRevealed.add(idx);
          }
        });

        final rawSweepRevealed = data?['sweepRevealed'] as Map<String, dynamic>? ?? {};
        final Set<int> loadedSweepRevealed = {};
        rawSweepRevealed.forEach((k, v) {
          if (v == true && k.startsWith('sweep_')) {
            final idx = int.tryParse(k.split('_')[1]);
            if (idx != null) loadedSweepRevealed.add(idx);
          }
        });

        final rawListenedDrills = data?['listenedDrills'] as List<dynamic>? ?? [];
        final Set<String> loadedListenedDrills = rawListenedDrills.map((e) => e.toString()).toSet();

        _userNotes = loadedNotes;
        _quizSelections = loadedSelections;
        _quizRevealed = loadedQuizRevealed;
        _testRevealed = loadedTestRevealed;
        _sweepRevealed = loadedSweepRevealed;
        _listenedDrills = loadedListenedDrills;
        
        notifyListeners();
      }
    });
  }

  void toggleShowTranslation() {
    _showTranslation = !_showTranslation;
    notifyListeners();
  }

  void toggleShowTransliteration() {
    _showTransliteration = !_showTransliteration;
    notifyListeners();
  }

  void setActiveScriptKey(String key) {
    _activeScriptKey = key;
    notifyListeners();
  }

  void selectQuizOption(int questionIdx, String option) {
    _quizSelections = {..._quizSelections, questionIdx: option};
    _quizRevealed = {..._quizRevealed, questionIdx};
    notifyListeners();
    _updateProgress({
      'selections': _quizSelections.map((k, v) => MapEntry('quiz_$k', v)),
      'quizRevealed': _quizRevealed.map((k) => 'quiz_$k').toList(),
      'gradedIds': _quizSelections.keys.map((k) => 'quiz_$k').toList(),
    });
  }

  void resetQuiz() {
    _quizSelections = {};
    _quizRevealed = {};
    notifyListeners();
    _updateProgress({
      'selections': {},
      'quizRevealed': [],
      'gradedIds': [],
    });
  }

  void revealTestItem(int index) {
    _testRevealed = {..._testRevealed, index};
    notifyListeners();
    _updateProgress({
      'testRevealed': _testRevealed.map((k) => MapEntry('test_$k', true)).fold<Map<String, bool>>({}, (map, entry) => map..[entry.key] = entry.value),
    });
  }

  void resetTest() {
    _testRevealed = {};
    notifyListeners();
    _updateProgress({
      'testRevealed': {},
    });
  }

  void revealSweepItem(int index) {
    _sweepRevealed = {..._sweepRevealed, index};
    notifyListeners();
    _updateProgress({
      'sweepRevealed': _sweepRevealed.map((k) => MapEntry('sweep_$k', true)).fold<Map<String, bool>>({}, (map, entry) => map..[entry.key] = entry.value),
    });
  }

  void resetSweep() {
    _sweepRevealed = {};
    notifyListeners();
    _updateProgress({
      'sweepRevealed': {},
    });
  }

  Set<String> _listenedDrills = {};
  Set<String> get listenedDrills => _listenedDrills;

  void revealDrill(String drillId) {
    _listenedDrills = {..._listenedDrills, drillId};
    notifyListeners();
    _updateProgress({
      'listenedDrills': _listenedDrills.toList(),
    });
  }

  Future<void> _updateProgress(Map<String, dynamic> data) async {
    if (_user == null || currentEpisode == null) return;
    try {
      await FirebaseService.updateCourseProgress(
        _selectedConfig.dbAppId,
        _user!.uid,
        currentEpisode!.id,
        data,
      );
    } catch (e) {
      debugPrint('Failed to update progress: $e');
    }
  }

  Future<void> generateNextEpisode(String topicPrompt) async {
    if (_user == null) {
      _genError = 'Sign in to generate episodes.';
      notifyListeners();
      return;
    }

    final sysInst = _selectedConfig.promptSystemInstruction;
    if (sysInst == null || sysInst.isEmpty) {
      _genError = 'System prompt not configured for ${_selectedConfig.name}.';
      notifyListeners();
      return;
    }

    _isGenerating = true;
    _genError = null;
    notifyListeners();

    try {
      final apiKey = await StorageService.getApiKey() ?? '';
      final episodeJson = await GeminiService.generateCourseEpisode(
        systemInstruction: sysInst,
        userPrompt: topicPrompt,
        apiKey: apiKey,
      );

      final newEpId = 'ep_${DateTime.now().millisecondsSinceEpoch}';
      episodeJson['id'] = newEpId;
      episodeJson['timestamp'] = DateTime.now().millisecondsSinceEpoch;
      episodeJson['userPrompt'] = topicPrompt;

      await FirebaseService.saveNewEpisodeDoc(
        _selectedConfig.dbAppId,
        _user!.uid,
        newEpId,
        episodeJson,
      );

      _isGenerating = false;
      _genError = null;
      notifyListeners();
    } catch (e) {
      _isGenerating = false;
      _genError = 'Episode generation failed: $e';
      notifyListeners();
    }
  }

  Future<void> importEpisodeJSON(String jsonString) async {
    if (_user == null) {
      _genError = 'Sign in to import episodes.';
      notifyListeners();
      return;
    }

    _isGenerating = true;
    _genError = null;
    notifyListeners();

    try {
      var clean = jsonString.trim();
      if (clean.startsWith('```json')) clean = clean.replaceFirst(RegExp(r'^```json\n?'), '');
      if (clean.startsWith('```')) clean = clean.replaceFirst(RegExp(r'^```\n?'), '');
      if (clean.endsWith('```')) clean = clean.replaceFirst(RegExp(r'\n?```$'), '');

      final Map<String, dynamic> episodeJson = jsonDecode(clean.trim());
      final newEpId = 'ep_${DateTime.now().millisecondsSinceEpoch}';
      episodeJson['id'] = newEpId;
      episodeJson['timestamp'] = DateTime.now().millisecondsSinceEpoch;

      await FirebaseService.saveNewEpisodeDoc(
        _selectedConfig.dbAppId,
        _user!.uid,
        newEpId,
        episodeJson,
      );

      _isGenerating = false;
      _genError = null;
      notifyListeners();
    } catch (e) {
      _isGenerating = false;
      _genError = 'Import failed. Verify JSON format: $e';
      notifyListeners();
    }
  }

  Future<void> deleteEpisode(String episodeId) async {
    if (_user == null) return;
    try {
      await FirebaseService.deleteEpisodeDoc(
        _selectedConfig.dbAppId,
        _user!.uid,
        episodeId,
      );
      if (_episodes.isNotEmpty && currentEpisode?.id == episodeId) {
        _selectedEpisodeIdx = 0;
      }
    } catch (e) {
      debugPrint('Failed to delete episode: $e');
    }
  }

  void setEpisodeIndex(int idx) {
    if (_episodes.isNotEmpty) {
      stopSpeak();
      _selectedEpisodeIdx = idx.clamp(0, _episodes.length - 1);
      _currentSentenceIdx = 0;
      _revealedSentences = {};
      resetQuiz();
      resetTest();
      resetSweep();
      notifyListeners();
    }
  }

  void setActiveTab(String tab) {
    stopSpeak();
    _activeTab = tab;
    notifyListeners();
  }

  void setCurrentSentenceIdx(int idx) {
    if (currentEpisode == null) return;
    stopSpeak();
    _currentSentenceIdx = idx.clamp(0, currentEpisode!.sentences.length - 1);
    notifyListeners();
  }

  void goNextSentence() {
    if (currentEpisode != null &&
        _currentSentenceIdx < currentEpisode!.sentences.length - 1) {
      stopSpeak();
      _currentSentenceIdx++;
      notifyListeners();
    }
  }

  void goPrevSentence() {
    if (_currentSentenceIdx > 0) {
      stopSpeak();
      _currentSentenceIdx--;
      notifyListeners();
    }
  }

  void revealSentence(int index) {
    _revealedSentences = {..._revealedSentences, index};
    notifyListeners();
  }

  void toggleBookmark(String sentenceId) {
    if (_bookmarkedSentences.contains(sentenceId)) {
      _bookmarkedSentences = {..._bookmarkedSentences}..remove(sentenceId);
    } else {
      _bookmarkedSentences = {..._bookmarkedSentences, sentenceId};
    }
    notifyListeners();
  }

  void saveUserNote(String itemId, String title, String content) {
    final note = UserNote(
      id: itemId,
      title: title,
      content: content.trim(),
      timestamp: DateTime.now().millisecondsSinceEpoch,
    );
    if (content.trim().isEmpty) {
      _userNotes = Map.from(_userNotes)..remove(itemId);
    } else {
      _userNotes = Map.from(_userNotes)..[itemId] = note;
    }
    notifyListeners();

    if (_user != null && currentEpisode != null) {
      FirebaseService.saveCourseUserNote(
        _selectedConfig.dbAppId,
        _user!.uid,
        currentEpisode!.id,
        itemId,
        title,
        content.trim(),
      );
    }
  }

  Future<void> toggleAudio(int index, List<String> texts) async {
    if (_playState.index == index && _playState.status == PlayStatus.playing) {
      _ttsService.stop();
      _playState = const PlayState(index: null, status: PlayStatus.idle);
      notifyListeners();
      return;
    }

    _ttsService.stop();
    _playState = PlayState(index: index, status: PlayStatus.loading);
    notifyListeners();

    final apiKey = await StorageService.getApiKey() ?? '';
    final ttsInstruction = _selectedConfig.ttsSystemInstruction ?? '';

    _playState = PlayState(index: index, status: PlayStatus.playing);
    notifyListeners();

    _ttsService.speak(
      texts: texts,
      systemInstruction: ttsInstruction,
      apiKey: apiKey,
      onComplete: () {
        _playState = const PlayState(index: null, status: PlayStatus.idle);
        revealSentence(index);
        notifyListeners();
      },
      onError: () {
        _playState = const PlayState(index: null, status: PlayStatus.idle);
        _error = 'Audio playback failed.';
        notifyListeners();
      },
    );
  }

  void stopSpeak() {
    _ttsService.stop();
    _playState = const PlayState(index: null, status: PlayStatus.idle);
    notifyListeners();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _episodesSub?.cancel();
    _progressSub?.cancel();
    _ttsService.stop();
    super.dispose();
  }
}
