import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/services/web_font_service.dart';
import '../../../core/widgets/language_text_style.dart';
import '../../../core/widgets/tab_badge.dart';
import '../../home/providers/home_provider.dart';
import '../providers/course_provider.dart';

// ---------------------------------------------------------------------------
// Data helpers (mirror React LexiconTab logic)
// ---------------------------------------------------------------------------

/// Lowercases and strips common Latin diacritics so search is accent-insensitive
/// (React uses NFD normalization; this covers the app's language set).
const Map<String, String> _diacriticsMap = {
  'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'ā': 'a', 'ă': 'a', 'ą': 'a', 'å': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ĕ': 'e', 'ę': 'e', 'ě': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'į': 'i', 'ı': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ō': 'o', 'ő': 'o', 'ø': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ű': 'u', 'ů': 'u',
  'ý': 'y', 'ÿ': 'y', 'ỳ': 'y', 'ŷ': 'y', 'ȳ': 'y',
  'ç': 'c', 'ć': 'c', 'č': 'c', 'ĉ': 'c',
  'ñ': 'n', 'ń': 'n', 'ň': 'n',
  'š': 's', 'ś': 's', 'ş': 's', 'ș': 's',
  'ž': 'z', 'ź': 'z', 'ż': 'z',
  'ğ': 'g', 'ĝ': 'g',
  'ț': 't', 'ţ': 't',
  'đ': 'd',
  'æ': 'ae', 'œ': 'oe', 'ß': 'ss',
};

String _removeDiacritics(String? str) {
  if (str == null || str.isEmpty) return '';
  final lower = str.toLowerCase();
  var needsReplace = false;
  for (var i = 0; i < lower.length; i++) {
    if (_diacriticsMap.containsKey(lower[i])) {
      needsReplace = true;
      break;
    }
  }
  if (!needsReplace) return lower;

  final sb = StringBuffer();
  for (var i = 0; i < lower.length; i++) {
    final ch = lower[i];
    sb.write(_diacriticsMap[ch] ?? ch);
  }
  return sb.toString();
}

String _uniqueId(dynamic w, String primaryKey) {
  if (w is Map) {
    final id = w['id'];
    if (id != null) return id.toString();
    final word = w['word'] ?? w[primaryKey];
    return word?.toString() ?? '';
  }
  return w.toString();
}

List<dynamic> _dedupeWords(List<dynamic> words, String primaryKey) {
  final map = <String, dynamic>{};
  for (final w in words) {
    final id = _uniqueId(w, primaryKey);
    if (id.isNotEmpty) map[id] = w;
  }
  return map.values.toList();
}

String _wordText(dynamic w, String primaryKey) {
  if (w is Map) return (w['word'] ?? w[primaryKey] ?? '').toString();
  return w.toString();
}

bool _isMatch(dynamic w, Map<String, dynamic> original, String primaryKey) {
  if (w is Map && original['id'] != null && w['id'] != null) {
    return w['id'] == original['id'];
  }
  final tw = w is Map ? (w['word'] ?? w[primaryKey]) : w;
  final te = original['word'] ?? original[primaryKey];
  return tw != null && te != null && tw.toString() == te.toString();
}

RegExp? _compileSearch(String query) {
  final pattern = '^${query.replaceAll('.', '.*')}\$';
  try {
    return RegExp(pattern, caseSensitive: false);
  } catch (_) {
    return null;
  }
}

bool _searchMatchCached(RegExp? re, String query, String text) {
  if (query.isEmpty) return true;
  return re != null ? re.hasMatch(text) : text.contains(query);
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

class LexiconTab extends StatefulWidget {
  const LexiconTab({super.key});

  @override
  State<LexiconTab> createState() => _LexiconTabState();
}

typedef _LexEntry = ({
  dynamic word,
  String listKey,
  String normTarget,
  String normTranslit,
  String normEnglish,
  String normRaw,
});

class _LexiconTabState extends State<LexiconTab> {
  String _searchTerm = '';
  String _activeFilter = 'all';
  int _displayLimit = 80;
  bool _showAddForm = false;
  bool _isSubmitting = false;

  final TextEditingController _addTargetCtrl = TextEditingController();
  final TextEditingController _addTranslitCtrl = TextEditingController();
  final TextEditingController _addEnglishCtrl = TextEditingController();
  final TextEditingController _addPosCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleGlobalKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleGlobalKey);
    _addTargetCtrl.dispose();
    _addTranslitCtrl.dispose();
    _addEnglishCtrl.dispose();
    _addPosCtrl.dispose();
    super.dispose();
  }

  // Cross-tab keyboard nav (mirrors React's global keydown for lexicon):
  // ArrowRight/w → next tab, ArrowLeft/q → prev tab.
  bool _handleGlobalKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final primaryFocus = FocusManager.instance.primaryFocus;
    if (primaryFocus != null && primaryFocus.context?.widget is EditableText) {
      return false;
    }

    final courseProv = Provider.of<CourseProvider>(context, listen: false);
    if (courseProv.activeTab != 'lexicon') return false;

    switch (event.logicalKey) {
      case LogicalKeyboardKey.arrowRight:
      case LogicalKeyboardKey.keyW:
        courseProv.goToNextTab();
        return true;
      case LogicalKeyboardKey.arrowLeft:
      case LogicalKeyboardKey.keyQ:
        courseProv.goToPrevTab();
        return true;
      default:
        return false;
    }
  }

  // ---- Memoized derived data (mirrors React useMemo chain) ----
  // Recomputed only when the lexicon document, search term, or filter changes,
  // so typing / provider notifies stay cheap.

  Map<String, dynamic>? _cacheLex;
  String _cacheSearch = '';
  String _cacheFilter = 'all';
  List<_LexEntry> _cacheIndex = const [];
  Set<String> _cacheDupes = {};
  List<({String id, String label})> _cacheFilterOptions = const [];

  void _ensureCache(CourseProvider prov) {
    final lex = prov.globalLexicon;
    if (identical(lex, _cacheLex) &&
        _searchTerm == _cacheSearch &&
        _activeFilter == _cacheFilter) {
      return;
    }
    _cacheLex = lex;
    _cacheSearch = _searchTerm;
    _cacheFilter = _activeFilter;
    _rebuildCache(prov, lex ?? {});
  }

  void _rebuildCache(CourseProvider prov, Map<String, dynamic> lex) {
    final isObjectArray = prov.courseId != 'mandarin';
    final primaryKey = prov.config.primaryTextKey;
    final translitKey = prov.config.transliterationKey;
    final entriesList = lex['entries'] is List ? lex['entries'] as List : const <dynamic>[];
    final accList = lex['accumulated'] is List ? lex['accumulated'] as List : const <dynamic>[];

    final index = <_LexEntry>[];

    void addWords(Iterable<dynamic> words, String listKey) {
      for (final w in words) {
        final target = _wordText(w, primaryKey);
        index.add((
          word: w,
          listKey: listKey,
          normTarget: _removeDiacritics(target),
          normTranslit: (w is Map && translitKey.isNotEmpty)
              ? _removeDiacritics((w[translitKey] ?? '').toString())
              : '',
          normEnglish: w is Map
              ? _removeDiacritics(
                  (w['english'] ?? w['meaning'] ?? w['translation'] ?? '').toString())
              : '',
          normRaw: target.toLowerCase().trim(),
        ));
      }
    }

    if (isObjectArray) {
      addWords(_dedupeWords([...entriesList, ...accList], primaryKey), 'entries');
    } else {
      addWords(_dedupeWords([...accList, ...entriesList], primaryKey), 'accumulated');
      for (final key in const ['hsk4', 'hsk3', 'hsk2', 'hsk1']) {
        final l = lex[key];
        if (l is List) addWords(l, key);
      }
    }

    // Duplicates (raw text, matching React)
    final counts = <String, int>{};
    final dupes = <String>{};
    for (final t in index) {
      if (t.normRaw.isEmpty) continue;
      counts[t.normRaw] = (counts[t.normRaw] ?? 0) + 1;
      if (counts[t.normRaw]! > 1) dupes.add(t.normRaw);
    }

    // Filter options
    final options = <({String id, String label})>[(id: 'all', label: 'All Words')];
    if (!isObjectArray) {
      options.addAll(const [
        (id: 'accumulated', label: 'Accumulated'),
        (id: 'hsk4', label: 'HSK 4'),
        (id: 'hsk3', label: 'HSK 3'),
        (id: 'hsk2', label: 'HSK 2'),
        (id: 'hsk1', label: 'HSK 1'),
      ]);
    } else {
      const posLabels = {
        'n': 'Nouns', 'v': 'Verbs', 'adj': 'Adjectives', 'adv': 'Adverbs',
        'pron': 'Pronouns', 'prep': 'Prepositions', 'conj': 'Conjunctions',
        'part': 'Particles', 'mw': 'Measure Words', 'num': 'Numeral',
        'post': 'Postposition', 'suf': 'Suffix', 'noun': 'Nouns', 'verb': 'Verbs',
      };
      final posTags = <String>{};
      for (final t in index) {
        final w = t.word;
        if (w is Map && w['pos'] != null) {
          posTags.add(w['pos'].toString().toLowerCase().trim());
        }
      }
      final sorted = posTags.toList()..sort();
      for (final pos in sorted) {
        if (pos.isNotEmpty) {
          options.add((id: 'pos_$pos', label: posLabels[pos] ?? 'POS: $pos'));
        }
      }
    }
    options.add((id: 'duplicates', label: 'Duplicates'));

    _cacheIndex = index;
    _cacheDupes = dupes;
    _cacheFilterOptions = options;
  }

  List<({dynamic word, String listKey})> _displayedFromCache() {
    var filtered = _cacheIndex;

    if (_activeFilter == 'duplicates') {
      filtered = filtered.where((t) => _cacheDupes.contains(t.normRaw)).toList();
    } else if (_activeFilter.startsWith('pos_')) {
      final targetPos = _activeFilter.substring(4);
      filtered = filtered
          .where((t) =>
              t.word is Map &&
              (t.word as Map)['pos']?.toString().toLowerCase().trim() == targetPos)
          .toList();
    } else if (_activeFilter != 'all') {
      filtered = filtered.where((t) => t.listKey == _activeFilter).toList();
    }

    final q = _removeDiacritics(_searchTerm);
    if (q.isNotEmpty) {
      final re = _compileSearch(q);
      filtered = filtered.where((t) =>
          _searchMatchCached(re, q, t.normTarget) ||
          _searchMatchCached(re, q, t.normTranslit) ||
          _searchMatchCached(re, q, t.normEnglish)).toList();
    }

    return filtered.map((t) => (word: t.word, listKey: t.listKey)).toList();
  }

  // ---- CRUD actions (mirror React Firestore writes) ----

  Future<void> _handleManualAdd(CourseProvider prov) async {
    final target = _addTargetCtrl.text.trim();
    if (target.isEmpty) return;
    setState(() => _isSubmitting = true);
    try {
      final config = prov.config;
      final newEntry = <String, dynamic>{
        'id':
            'dict_manual_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(1 << 32).toRadixString(36)}',
        config.primaryTextKey: target,
        'word': target,
        if (config.transliterationKey.isNotEmpty)
          config.transliterationKey: _addTranslitCtrl.text.trim(),
        'english': _addEnglishCtrl.text.trim(),
        'pos': _addPosCtrl.text.trim(),
      };

      final lex = prov.globalLexicon ?? {};
      final entriesList = lex['entries'] is List ? lex['entries'] as List : const <dynamic>[];
      final accList = lex['accumulated'] is List ? lex['accumulated'] as List : const <dynamic>[];
      final isObjectArray = prov.courseId != 'mandarin';

      if (isObjectArray) {
        await prov.updateLexicon({
          'entries': [newEntry, ..._dedupeWords([...entriesList, ...accList], config.primaryTextKey)],
        });
      } else {
        await prov.updateLexicon({
          'accumulated': [newEntry, ..._dedupeWords([...accList, ...entriesList], config.primaryTextKey)],
        });
      }

      _addTargetCtrl.clear();
      _addTranslitCtrl.clear();
      _addEnglishCtrl.clear();
      _addPosCtrl.clear();
      setState(() => _showAddForm = false);
    } catch (e) {
      debugPrint('Add word error: $e');
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  void _openEdit(CourseProvider prov, dynamic word, String listKey) {
    final config = prov.config;
    final isMap = word is Map;
    final target = isMap ? (word['word'] ?? word[config.primaryTextKey] ?? '').toString() : word.toString();
    final translit = isMap && config.transliterationKey.isNotEmpty
        ? (word[config.transliterationKey] ?? '').toString()
        : '';
    final english = isMap ? (word['english'] ?? word['meaning'] ?? word['translation'] ?? '').toString() : '';
    final pos = isMap ? (word['pos'] ?? '').toString() : '';

    showDialog(
      context: context,
      builder: (ctx) => _EditWordDialog(
        prov: prov,
        original: isMap ? Map<String, dynamic>.from(word) : null,
        listKey: listKey,
        initialTarget: target,
        initialTranslit: translit,
        initialEnglish: english,
        initialPos: pos,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final courseProv = context.watch<CourseProvider>();
    final homeProv = context.watch<HomeProvider>();
    final isDark = homeProv.isDarkMode;

    final cardBg = isDark ? const Color(0xFF18181B) : Colors.white;
    final cardBorder = isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4);
    final textPrimary = isDark ? Colors.white : const Color(0xFF1C1917);
    final textSecondary = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);

    WebFontService.ensurePreferredFontsLoaded(courseProv.config.name);

    final config = courseProv.config;
    final lex = courseProv.globalLexicon;
    final hasLexicon = lex != null && lex.isNotEmpty;

    _ensureCache(courseProv);
    if (!_cacheFilterOptions.any((o) => o.id == _activeFilter)) {
      _activeFilter = 'all';
      _ensureCache(courseProv);
    }
    final filterOptions = _cacheFilterOptions;
    final dupes = _cacheDupes;
    final displayed = _displayedFromCache();

    // Group by section title (mandarin: list name; others: active filter label).
    final groups = <String, List<({dynamic word, String listKey})>>{};
    for (final item in displayed) {
      String title;
      if (courseProv.courseId == 'mandarin') {
        title = item.listKey == 'accumulated'
            ? 'Accumulated Words'
            : item.listKey.toUpperCase();
      } else {
        title = filterOptions.firstWhere((o) => o.id == _activeFilter,
            orElse: () => const (id: 'all', label: 'All Words')).label;
      }
      groups.putIfAbsent(title, () => []).add(item);
    }

    // Cross-tab swipe (mirrors React's lexiconSwipeHandlers: left → next, right → prev).
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragEnd: (details) {
        if (details.primaryVelocity == null) return;
        if (details.primaryVelocity! < -150) {
          courseProv.goToNextTab();
        } else if (details.primaryVelocity! > 150) {
          courseProv.goToPrevTab();
        }
      },
      child: SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1040),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Badge + Add Word (standalone)
              SizedBox(
                width: double.infinity,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    TabBadge(icon: Icons.search_rounded, label: 'LEXICON'),
                    Positioned(
                      right: 0,
                      child: InkWell(
                        onTap: () => setState(() => _showAddForm = !_showAddForm),
                        borderRadius: BorderRadius.circular(8),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          child: Row(
                            children: [
                              const Icon(Icons.add_rounded, size: 14, color: Color(0xFFA1A1AA)),
                              const SizedBox(width: 4),
                              Text(
                                'ADD WORD',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1,
                                  color: _showAddForm
                                      ? const Color(0xFFF59E0B)
                                      : const Color(0xFFA1A1AA),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // 2. Search + Filter bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: cardBorder),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        onChanged: (v) => setState(() => _searchTerm = v),
                        style: TextStyle(fontSize: 14, color: textPrimary),
                        decoration: InputDecoration(
                          hintText: 'Search vocabulary...',
                          hintStyle: TextStyle(fontSize: 14, color: textSecondary),
                          prefixIcon: Icon(Icons.search_rounded, size: 20, color: textSecondary),
                          isDense: true,
                          border: InputBorder.none,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF121215) : const Color(0xFFFAFAF9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: cardBorder),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _activeFilter,
                          isDense: true,
                          dropdownColor: isDark ? const Color(0xFF18181B) : Colors.white,
                          icon: Icon(Icons.expand_more_rounded, size: 18, color: textSecondary),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                          ),
                          items: filterOptions
                              .map((o) => DropdownMenuItem(
                                    value: o.id,
                                    child: Text(o.label),
                                  ))
                              .toList(),
                          onChanged: (v) {
                            if (v != null) setState(() => _activeFilter = v);
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // 3. Add Word form
              if (_showAddForm) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF121215) : const Color(0xFFFAFAF9),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: cardBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          SizedBox(
                            width: 200,
                            child: _buildAddField(_addTargetCtrl, 'Target Word (${config.name})'),
                          ),
                          if (config.transliterationKey.isNotEmpty)
                            SizedBox(
                              width: 160,
                              child: _buildAddField(
                                _addTranslitCtrl,
                                config.labels[config.transliterationKey] ?? config.transliterationKey,
                              ),
                            ),
                          SizedBox(
                            width: 180,
                            child: _buildAddField(_addEnglishCtrl, 'English Translation'),
                          ),
                          SizedBox(
                            width: 140,
                            child: _buildAddField(_addPosCtrl, 'Part of Speech'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => setState(() => _showAddForm = false),
                            child: Text(
                              'Cancel',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: textSecondary),
                            ),
                          ),
                          const SizedBox(width: 8),
                          FilledButton(
                            onPressed: (_isSubmitting || _addTargetCtrl.text.trim().isEmpty)
                                ? null
                                : () => _handleManualAdd(courseProv),
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                              disabledForegroundColor: textSecondary.withValues(alpha: 0.5),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (_isSubmitting)
                                  const SizedBox(
                                    width: 12,
                                    height: 12,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                else
                                  const Icon(Icons.add_rounded, size: 14),
                                const SizedBox(width: 4),
                                const Text('Save Word', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 20),

              // 4. Vocabulary sections
              if (!hasLexicon)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 60),
                    child: Column(
                      children: [
                        Icon(Icons.menu_book_rounded, size: 44, color: textSecondary.withValues(alpha: 0.4)),
                        const SizedBox(height: 12),
                        Text(
                          'Loading master lexicon...',
                          style: TextStyle(fontSize: 14, color: textSecondary),
                        ),
                      ],
                    ),
                  ),
                )
              else if (groups.isEmpty)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 60),
                    child: Text(
                      'No matching words.',
                      style: TextStyle(fontSize: 14, color: textSecondary),
                    ),
                  ),
                )
              else
                ...groups.entries.map((entry) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              entry.key,
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: textPrimary,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '(${entry.value.length})',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: textSecondary),
                            ),
                          ],
                        ),
                        Container(
                          height: 2,
                          margin: const EdgeInsets.only(top: 8, bottom: 16),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF3F3F46) : const Color(0xFFE7E5E4),
                            borderRadius: BorderRadius.circular(1),
                          ),
                        ),
                        LayoutBuilder(
                          builder: (context, constraints) {
                            const minCard = 240.0;
                            const gap = 12.0;
                            final cols =
                                (constraints.maxWidth / (minCard + gap)).floor().clamp(1, 8);
                            final itemWidth =
                                (constraints.maxWidth - gap * (cols - 1)) / cols;

                            final totalCount = entry.value.length;
                            final visibleItems = entry.value.take(_displayLimit).toList();
                            final remainingCount = totalCount - visibleItems.length;

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  spacing: gap,
                                  runSpacing: gap,
                                  children: visibleItems.map((item) {
                                    return SizedBox(
                                      width: itemWidth,
                                      child: _buildWordCard(
                                        courseProv,
                                        item.word,
                                        item.listKey,
                                        dupes,
                                        isDark,
                                        textPrimary,
                                        textSecondary,
                                        cardBorder,
                                      ),
                                    );
                                  }).toList(),
                                ),
                                if (remainingCount > 0) ...[
                                  const SizedBox(height: 16),
                                  Center(
                                    child: OutlinedButton.icon(
                                      onPressed: () => setState(() => _displayLimit += 100),
                                      icon: const Icon(Icons.expand_more_rounded, size: 18),
                                      label: Text('Load More ($remainingCount remaining)'),
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: const Color(0xFF2563EB),
                                        side: const BorderSide(color: Color(0xFF2563EB)),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            );
                          },
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    ),
  );
  }

  Widget _buildAddField(TextEditingController controller, String hint) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = isDark ? Colors.white : const Color(0xFF1C1917);
    return TextField(
      controller: controller,
      onChanged: (_) => setState(() {}),
      style: TextStyle(fontSize: 13, color: textPrimary),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          fontSize: 12,
          color: isDark ? const Color(0xFF71717A) : const Color(0xFFA8A29E),
        ),
        isDense: true,
        filled: true,
        fillColor: isDark ? const Color(0xFF09090B) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF2563EB)),
        ),
      ),
    );
  }

  Widget _buildWordCard(
    CourseProvider prov,
    dynamic word,
    String listKey,
    Set<String> dupes,
    bool isDark,
    Color textPrimary,
    Color textSecondary,
    Color cardBorder,
  ) {
    final config = prov.config;
    final isMap = word is Map;
    final displayWord = isMap ? (word['word'] ?? word[config.primaryTextKey] ?? '').toString() : word.toString();
    final displayTranslit = isMap && config.transliterationKey.isNotEmpty
        ? (word[config.transliterationKey] ?? '').toString()
        : '';
    final displayEn = isMap ? (word['english'] ?? word['meaning'] ?? word['translation'] ?? '').toString() : '';
    final pos = isMap ? (word['pos'] ?? '').toString() : '';
    final isDuplicate = dupes.contains(displayWord.toLowerCase().trim());

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDuplicate
            ? (isDark ? const Color(0xFF451A03).withValues(alpha: 0.3) : const Color(0xFFFFFBEB))
            : (isDark ? const Color(0xFF1F1F23) : Colors.white),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDuplicate
              ? (isDark ? const Color(0xFFB45309).withValues(alpha: 0.5) : const Color(0xFFFCD34D))
              : cardBorder,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayWord,
                      style: languageTextStyle(
                        config.name,
                        fontSize: 17,
                        color: textPrimary,
                      ),
                    ),
                    if (displayTranslit.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          displayTranslit,
                          style: TextStyle(fontSize: 11, color: textSecondary),
                        ),
                      ),
                  ],
                ),
              ),
              InkWell(
                onTap: () => _openEdit(prov, word, listKey),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Icon(Icons.edit_outlined, size: 16, color: textSecondary),
                ),
              ),
            ],
          ),
          if (displayEn.isNotEmpty || pos.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 10),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: isDark ? const Color(0xFF3F3F46) : const Color(0xFFE7E5E4),
                  ),
                ),
              ),
              child: Row(
                children: [
                  if (pos.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(5),
                        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        pos,
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                          color: Color(0xFF10B981),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(
                      displayEn,
                      style: TextStyle(fontSize: 13, color: textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Edit Word dialog
// ---------------------------------------------------------------------------

class _EditWordDialog extends StatefulWidget {
  final CourseProvider prov;
  final Map<String, dynamic>? original;
  final String listKey;
  final String initialTarget;
  final String initialTranslit;
  final String initialEnglish;
  final String initialPos;

  const _EditWordDialog({
    required this.prov,
    required this.original,
    required this.listKey,
    required this.initialTarget,
    required this.initialTranslit,
    required this.initialEnglish,
    required this.initialPos,
  });

  @override
  State<_EditWordDialog> createState() => _EditWordDialogState();
}

class _EditWordDialogState extends State<_EditWordDialog> {
  late final TextEditingController _targetCtrl =
      TextEditingController(text: widget.initialTarget);
  late final TextEditingController _translitCtrl =
      TextEditingController(text: widget.initialTranslit);
  late final TextEditingController _englishCtrl =
      TextEditingController(text: widget.initialEnglish);
  late final TextEditingController _posCtrl =
      TextEditingController(text: widget.initialPos);
  bool _isSubmitting = false;

  @override
  void dispose() {
    _targetCtrl.dispose();
    _translitCtrl.dispose();
    _englishCtrl.dispose();
    _posCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final target = _targetCtrl.text.trim();
    if (target.isEmpty || widget.original == null) return;
    setState(() => _isSubmitting = true);
    try {
      final config = widget.prov.config;
      final updatedWord = <String, dynamic>{
        ...widget.original!,
        config.primaryTextKey: target,
        'word': target,
        if (config.transliterationKey.isNotEmpty)
          config.transliterationKey: _translitCtrl.text.trim(),
        'english': _englishCtrl.text.trim(),
        'pos': _posCtrl.text.trim(),
      };

      final lex = widget.prov.globalLexicon ?? {};
      final entriesList = lex['entries'] is List ? lex['entries'] as List : const <dynamic>[];
      final accList = lex['accumulated'] is List ? lex['accumulated'] as List : const <dynamic>[];
      final isObjectArray = widget.prov.courseId != 'mandarin';

      if (isObjectArray) {
        final unique = _dedupeWords([...entriesList, ...accList], config.primaryTextKey);
        await widget.prov.updateLexicon({
          'entries': unique
              .map((w) => _isMatch(w, widget.original!, config.primaryTextKey) ? updatedWord : w)
              .toList(),
        });
      } else {
        if (widget.listKey == 'accumulated' || widget.listKey == 'entries') {
          final unique = _dedupeWords([...accList, ...entriesList], config.primaryTextKey);
          await widget.prov.updateLexicon({
            'accumulated': unique
                .map((w) => _isMatch(w, widget.original!, config.primaryTextKey) ? updatedWord : w)
                .toList(),
          });
        } else {
          final list = lex[widget.listKey] is List ? lex[widget.listKey] as List : const <dynamic>[];
          await widget.prov.updateLexicon({
            widget.listKey: list
                .map((w) => _isMatch(w, widget.original!, config.primaryTextKey) ? updatedWord : w)
                .toList(),
          });
        }
      }

      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      debugPrint('Save edit error: $e');
      setState(() => _isSubmitting = false);
    }
  }

  Future<void> _delete() async {
    final original = widget.original;
    if (original == null) return;
    setState(() => _isSubmitting = true);
    try {
      final config = widget.prov.config;
      final lex = widget.prov.globalLexicon ?? {};
      final entriesList = lex['entries'] is List ? lex['entries'] as List : const <dynamic>[];
      final accList = lex['accumulated'] is List ? lex['accumulated'] as List : const <dynamic>[];
      final isObjectArray = widget.prov.courseId != 'mandarin';

      if (isObjectArray) {
        final unique = _dedupeWords([...entriesList, ...accList], config.primaryTextKey);
        await widget.prov.updateLexicon({
          'entries': unique
              .where((w) => !_isMatch(w, original, config.primaryTextKey))
              .toList(),
        });
      } else {
        if (widget.listKey == 'accumulated' || widget.listKey == 'entries') {
          final unique = _dedupeWords([...accList, ...entriesList], config.primaryTextKey);
          await widget.prov.updateLexicon({
            'accumulated': unique
                .where((w) => !_isMatch(w, original, config.primaryTextKey))
                .toList(),
          });
        } else {
          final list = lex[widget.listKey] is List ? lex[widget.listKey] as List : const <dynamic>[];
          await widget.prov.updateLexicon({
            widget.listKey: list.where((w) => !_isMatch(w, original, config.primaryTextKey)).toList(),
          });
        }
      }

      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      debugPrint('Delete word error: $e');
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = isDark ? Colors.white : const Color(0xFF1C1917);
    final textSecondary = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);
    final config = widget.prov.config;

    InputDecoration deco(String label) => InputDecoration(
          labelText: label,
          labelStyle: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
            color: textSecondary,
          ),
          isDense: true,
          filled: true,
          fillColor: isDark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF2563EB)),
          ),
        );

    return AlertDialog(
      backgroundColor: isDark ? const Color(0xFF18181B) : Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Text(
        'Edit Word',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: textPrimary),
      ),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _targetCtrl,
              style: TextStyle(fontSize: 14, color: textPrimary),
              decoration: deco('Target Language'),
            ),
            const SizedBox(height: 12),
            if (config.transliterationKey.isNotEmpty) ...[
              TextField(
                controller: _translitCtrl,
                style: TextStyle(fontSize: 14, color: textPrimary),
                decoration: deco(config.labels[config.transliterationKey] ?? 'Transliteration'),
              ),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: _englishCtrl,
              style: TextStyle(fontSize: 14, color: textPrimary),
              decoration: deco('English Translation'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _posCtrl,
              style: TextStyle(fontSize: 14, color: textPrimary),
              decoration: deco('Part of Speech'),
            ),
          ],
        ),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
      actions: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton.icon(
              onPressed: _isSubmitting ? null : _delete,
              icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFFEF4444)),
              label: const Text(
                'Delete Word',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFEF4444)),
              ),
            ),
            Row(
              children: [
                TextButton(
                  onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                  child: Text(
                    'Cancel',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: textSecondary),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: (_isSubmitting || _targetCtrl.text.trim().isEmpty)
                      ? null
                      : _save,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                    disabledForegroundColor: textSecondary.withValues(alpha: 0.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_isSubmitting)
                        const SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      else
                        const SizedBox.shrink(),
                      const SizedBox(width: 4),
                      const Text('Save', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}
