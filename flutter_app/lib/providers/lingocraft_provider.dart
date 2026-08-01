// lib/providers/lingocraft_provider.dart
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:lingocraft_flutter/constants/languages.dart';
import 'package:lingocraft_flutter/constants/prompt_builders.dart';
import 'package:lingocraft_flutter/models/lingocraft_result.dart';
import 'package:lingocraft_flutter/services/firebase_service.dart';
import 'package:lingocraft_flutter/services/font_service.dart';
import 'package:lingocraft_flutter/services/gemini_service.dart';
import 'package:lingocraft_flutter/services/storage_service.dart';
import 'package:lingocraft_flutter/services/tts_service.dart';

enum PlayStatus { idle, loading, playing }

class PlayState {
  final int? index;
  final PlayStatus status;
  const PlayState({this.index, this.status = PlayStatus.idle});
}

class LingoCraftProvider extends ChangeNotifier {
  AppUser? _user;
  AppUser? get user => _user;

  Language _selectedLanguage = kLanguages.first;
  String _selectedLevel = 'Intermediate';

  Language get selectedLanguage => _selectedLanguage;
  String get selectedLevel => _selectedLevel;

  LingoCraftResult? _result;
  List<LingoCraftResult> _history = [];
  bool _loading = false;
  String? _error;

  LingoCraftResult? get result => _result;
  List<LingoCraftResult> get history => _history;
  bool get loading => _loading;
  String? get error => _error;

  int _currentIdx = 0;
  Set<int> _revealedSentences = {};
  PlayState _playState = const PlayState();
  bool _isDarkMode = false;
  String _activeTab = 'main';
  String _historySearch = '';

  final TtsService _ttsService = TtsService();

  int get currentIdx => _currentIdx;
  Set<int> get revealedSentences => _revealedSentences;
  PlayState get playState => _playState;
  bool get isDarkMode => _isDarkMode;
  String get activeTab => _activeTab;
  String get historySearch => _historySearch;

  List<LingoCraftResult> get filteredHistory => _history.where((i) {
    final q = _historySearch.toLowerCase();
    return i.word.toLowerCase().contains(q) ||
        i.targetLanguage.name.toLowerCase().contains(q);
  }).toList();

  StreamSubscription? _authSub;
  StreamSubscription? _prefsSub;
  StreamSubscription? _historySub;

  LingoCraftProvider() {
    _initTheme();
    FontService.preloadCustomFonts(onFontLoaded: notifyListeners);
    _authSub = FirebaseService.userStream.listen(_onAuthChanged);
  }

  Future<void> _initTheme() async {
    final theme = await StorageService.getTheme();
    _isDarkMode = theme == 'dark';
    notifyListeners();
  }

  void _onAuthChanged(AppUser? user) {
    _user = user;
    _prefsSub?.cancel();
    _historySub?.cancel();
    if (user != null) {
      _subscribeToPrefs(user.uid);
      _subscribeToHistory(user.uid);
    }
    notifyListeners();
  }

  void _subscribeToPrefs(String uid) {
    _prefsSub = FirebaseService.prefsStream(uid).listen((snap) {
      if (snap.exists) {
        final data = snap.data() as Map<String, dynamic>;
        final langName = data['language'] as String?;
        final level = data['level'] as String?;
        if (langName != null) {
          _selectedLanguage = kLanguages.firstWhere(
            (l) => l.name == langName,
            orElse: () => kLanguages.first,
          );
        }
        if (level != null) _selectedLevel = level;
        notifyListeners();
      }
    });
  }

  void _subscribeToHistory(String uid) {
    _historySub = FirebaseService.historyStream(uid).listen((snap) {
      if (snap.exists) {
        final data = snap.data();
        final items = data?['items'] as List<dynamic>? ?? [];
        _history = items
            .map(
              (i) =>
                  LingoCraftResult.fromMap(Map<String, dynamic>.from(i as Map)),
            )
            .toList();
        notifyListeners();
      }
    });
  }

  List<String> _getTtsText(LingoCraftSentence item, String langName) {
    if (langName == 'English') return [item.original];
    final targetScript =
        (langName.contains('Greek') && item.transcription.isNotEmpty)
        ? item.transcription
        : item.original;
    return [targetScript, item.englishTranslation, targetScript];
  }

  Future<void> toggleAudio(int index) async {
    if (_result == null) return;
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
    final sentence = _result!.sentences[index];
    final langName = _result!.targetLanguage.name;
    final ttsTexts = _getTtsText(sentence, langName);
    final ttsInstruction = getTtsSystemInstruction(langName);

    _playState = PlayState(index: index, status: PlayStatus.playing);
    notifyListeners();

    _ttsService.speak(
      texts: ttsTexts,
      systemInstruction: ttsInstruction,
      apiKey: apiKey,
      onComplete: () {
        _playState = const PlayState(index: null, status: PlayStatus.idle);
        revealSentence(index);
        notifyListeners();
      },
      onError: () {
        _playState = const PlayState(index: null, status: PlayStatus.idle);
        _error = 'Audio generation failed for this sentence.';
        notifyListeners();
      },
    );
  }

  void stopSpeak() {
    _ttsService.stop();
    _playState = const PlayState(index: null, status: PlayStatus.idle);
    notifyListeners();
  }

  void setActiveTab(String tab) {
    _activeTab = tab;
    notifyListeners();
  }

  void setHistorySearch(String q) {
    _historySearch = q;
    notifyListeners();
  }

  void toggleTheme() async {
    _isDarkMode = !_isDarkMode;
    await StorageService.setTheme(_isDarkMode ? 'dark' : 'light');
    notifyListeners();
  }

  Future<void> setLanguage(Language lang) async {
    _selectedLanguage = lang;
    notifyListeners();
    if (_user != null) {
      await FirebaseService.savePrefs(_user!.uid, language: lang.name);
    }
  }

  Future<void> setLevel(String level) async {
    _selectedLevel = level;
    notifyListeners();
    if (_user != null) {
      await FirebaseService.savePrefs(_user!.uid, level: level);
    }
  }

  Future<void> generate(String word) async {
    if (word.trim().isEmpty) return;
    final apiKey = await StorageService.getApiKey();
    if (apiKey == null || apiKey.isEmpty) {
      _error = 'No Gemini API Key found. Please add it in Settings.';
      notifyListeners();
      return;
    }

    _loading = true;
    _error = null;
    _result = null;
    _currentIdx = 0;
    _revealedSentences = {};
    _playState = const PlayState();
    stopSpeak();
    notifyListeners();

    try {
      final res = await GeminiService.generate(
        word: word.trim(),
        language: _selectedLanguage,
        level: _selectedLevel,
        apiKey: apiKey,
      );
      _result = res;

      _history = [
        res,
        ..._history.where(
          (h) =>
              h.word.toLowerCase() != res.word.toLowerCase() ||
              h.targetLanguage.name != res.targetLanguage.name,
        ),
      ].take(40).toList();

      if (_user != null) {
        await FirebaseService.saveHistory(_user!.uid, _history);
      }
      _activeTab = 'main';
    } catch (e, stack) {
      debugPrint('LingoCraft generate error: $e\n$stack');
      _error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void loadHistoryItem(LingoCraftResult item) {
    _result = item;
    _selectedLanguage = kLanguages.firstWhere(
      (l) => l.name == item.targetLanguage.name,
      orElse: () => item.targetLanguage,
    );
    _selectedLevel = item.level;
    _currentIdx = 0;
    _revealedSentences = {0, 1, 2, 3, 4};
    _activeTab = 'main';
    stopSpeak();
    notifyListeners();
  }

  Future<void> deleteHistoryItem(String id) async {
    _history = _history.where((i) => i.id != id).toList();
    if (_result?.id == id) _result = null;
    notifyListeners();
    if (_user != null) {
      await FirebaseService.saveHistory(_user!.uid, _history);
    }
  }

  void setCurrentIdx(int idx) {
    if (_result == null) return;
    stopSpeak();
    _currentIdx = idx.clamp(0, _result!.sentences.length - 1);
    notifyListeners();
  }

  void goNext() {
    if (_result != null && _currentIdx < _result!.sentences.length - 1) {
      stopSpeak();
      _currentIdx++;
      notifyListeners();
    }
  }

  void goPrev() {
    if (_currentIdx > 0) {
      stopSpeak();
      _currentIdx--;
      notifyListeners();
    }
  }

  void revealSentence(int index) {
    _revealedSentences = {..._revealedSentences, index};
    notifyListeners();
  }

  void clearResult() {
    stopSpeak();
    _result = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> signIn() => FirebaseService.signInWithGoogle();
  Future<void> signOut() => FirebaseService.signOut();

  @override
  void dispose() {
    _authSub?.cancel();
    _prefsSub?.cancel();
    _historySub?.cancel();
    _ttsService.stop();
    super.dispose();
  }
}
