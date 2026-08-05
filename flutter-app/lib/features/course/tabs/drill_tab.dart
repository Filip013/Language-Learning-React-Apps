import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/services/tts_service.dart';
import '../../../core/services/web_font_service.dart';
import '../../../core/widgets/language_text_style.dart';
import '../../../core/widgets/play_button.dart';
import '../../../core/widgets/tab_badge.dart';
import '../../../core/widgets/user_note_modal.dart';
import '../../home/providers/home_provider.dart';
import '../providers/course_provider.dart';

class DrillTab extends StatefulWidget {
  const DrillTab({super.key});

  @override
  State<DrillTab> createState() => _DrillTabState();
}

class _DrillTabState extends State<DrillTab> {
  int _currentWordIdx = 0;
  int _currentExIdx = 0;
  bool _showLexicalNote = false;
  String _slideDirection = 'next'; // 'next' | 'prev'
  String? _autoNavigatedEpisodeId;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleGlobalKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleGlobalKey);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Provider changes trigger this; auto-resume to the first un-listened
    // drill whenever the active episode changes (mirrors React's effect).
    _maybeAutoNavigate(Provider.of<CourseProvider>(context, listen: false));
  }

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------

  List<dynamic> _drills(CourseProvider prov) {
    final drills = prov.activeEpisode?['drills'];
    if (drills is List) return drills;
    return const [];
  }

  List<dynamic> _examplesOf(List<dynamic> drills, int wordIdx) {
    if (wordIdx < 0 || wordIdx >= drills.length) return const [];
    final section = drills[wordIdx];
    if (section is Map && section['examples'] is List) {
      return section['examples'] as List;
    }
    return const [];
  }

  Map<String, dynamic> _sectionAt(List<dynamic> drills, int wordIdx) {
    if (wordIdx < 0 || wordIdx >= drills.length) return const {};
    final section = drills[wordIdx];
    if (section is Map) return Map<String, dynamic>.from(section);
    return const {};
  }

  String get _exId => 'drill_${_currentWordIdx}_$_currentExIdx';

  // ---------------------------------------------------------------------------
  // Auto-navigation (resume where you left off)
  // ---------------------------------------------------------------------------

  void _maybeAutoNavigate(CourseProvider prov) {
    final episode = prov.activeEpisode;
    if (episode == null) return;
    final epId = episode['id']?.toString() ?? '';
    if (epId.isEmpty || _autoNavigatedEpisodeId == epId) return;

    final drills = _drills(prov);
    if (drills.isEmpty) return;

    final listened = prov.listenedDrills;
    var foundWord = -1;
    var foundEx = -1;
    for (var w = 0; w < drills.length; w++) {
      final examples = _examplesOf(drills, w);
      for (var e = 0; e < examples.length; e++) {
        if (!listened.contains('drill_${w}_$e')) {
          foundWord = w;
          foundEx = e;
          break;
        }
      }
      if (foundWord != -1) break;
    }

    if (foundWord != -1) {
      _currentWordIdx = foundWord;
      _currentExIdx = foundEx;
    } else {
      // Everything listened: land on the very last example.
      final lastWord = drills.length - 1;
      final lastEx = _examplesOf(drills, lastWord).length - 1;
      _currentWordIdx = lastWord;
      _currentExIdx = lastEx < 0 ? 0 : lastEx;
    }

    _autoNavigatedEpisodeId = epId;
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts (mirrors React DrillTab key map)
  // ---------------------------------------------------------------------------

  bool _handleGlobalKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final primaryFocus = FocusManager.instance.primaryFocus;
    if (primaryFocus != null && primaryFocus.context?.widget is EditableText) {
      return false;
    }

    final courseProv = Provider.of<CourseProvider>(context, listen: false);
    if (courseProv.activeTab != 'drill' || courseProv.activeEpisode == null) {
      return false;
    }

    switch (event.logicalKey) {
      case LogicalKeyboardKey.arrowRight:
      case LogicalKeyboardKey.keyW:
        _handleNext(courseProv);
        return true;
      case LogicalKeyboardKey.arrowLeft:
      case LogicalKeyboardKey.keyQ:
        _handlePrev(courseProv);
        return true;
      case LogicalKeyboardKey.arrowDown:
      case LogicalKeyboardKey.keyS:
        _goToWord(courseProv, _currentWordIdx + 1, 'next');
        return true;
      case LogicalKeyboardKey.arrowUp:
      case LogicalKeyboardKey.keyA:
        _goToWord(courseProv, _currentWordIdx - 1, 'prev');
        return true;
      case LogicalKeyboardKey.space:
        _togglePlay(courseProv);
        return true;
      case LogicalKeyboardKey.keyR:
        _toggleReveal(courseProv);
        return true;
      case LogicalKeyboardKey.keyL:
        _toggleLexicalNote(courseProv);
        return true;
      case LogicalKeyboardKey.keyN:
        _openNote(courseProv);
        return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  void _scrollToTop() {
    if (_scrollController.hasClients) {
      _scrollController.jumpTo(0);
    }
  }

  void _handleNext(CourseProvider prov) {
    final drills = _drills(prov);
    if (drills.isEmpty) return;

    final totalWords = drills.length;
    final totalExamples = _examplesOf(drills, _currentWordIdx).length;
    _showLexicalNote = false;
    _slideDirection = 'next';

    if (_currentExIdx < totalExamples - 1) {
      setState(() => _currentExIdx++);
    } else if (_currentWordIdx < totalWords - 1) {
      setState(() {
        _currentWordIdx++;
        _currentExIdx = 0;
      });
    } else {
      prov.goToNextTab();
      return;
    }
    _scrollToTop();
  }

  void _handlePrev(CourseProvider prov) {
    final drills = _drills(prov);
    if (drills.isEmpty) return;

    _showLexicalNote = false;
    _slideDirection = 'prev';

    if (_currentExIdx > 0) {
      setState(() => _currentExIdx--);
    } else if (_currentWordIdx > 0) {
      final prevEx = _examplesOf(drills, _currentWordIdx - 1).length - 1;
      setState(() {
        _currentWordIdx--;
        _currentExIdx = prevEx < 0 ? 0 : prevEx;
      });
    } else {
      prov.goToPrevTab();
      return;
    }
    _scrollToTop();
  }

  void _goToWord(CourseProvider prov, int wordIdx, String direction) {
    final drills = _drills(prov);
    if (wordIdx < 0 || wordIdx >= drills.length) return;

    setState(() {
      _currentWordIdx = wordIdx;
      _currentExIdx = 0;
      _showLexicalNote = false;
      _slideDirection = direction;
    });
    _scrollToTop();
  }

  void _togglePlay(CourseProvider prov) {
    final drills = _drills(prov);
    if (drills.isEmpty) return;

    final examples = _examplesOf(drills, _currentWordIdx);
    if (_currentExIdx >= examples.length) return;

    // Stop any ongoing playback.
    if (prov.playingId != null || TTSService.isPlaying) {
      prov.stopSpeaking();
      return;
    }

    _playExample(prov, examples[_currentExIdx] as Map<String, dynamic>, _exId);
  }

  void _playExample(CourseProvider prov, Map<String, dynamic> example, String exId) {
    final config = prov.config;
    final targetText = example[config.primaryTextKey]?.toString() ?? '';
    final english =
        example['english']?.toString() ?? example['translation']?.toString() ?? '';

    final alreadyListened = prov.listenedDrills.contains(exId);

    prov.speakListTexts([targetText, english, targetText], exId).then((_) {
      if (!alreadyListened) {
        prov.updateFirebase({
          'listenedDrills': [...prov.listenedDrills, exId],
        });
      }
    });
  }

  void _toggleReveal(CourseProvider prov) {
    final revealed = prov.drillRevealed;
    if (revealed.contains(_exId)) {
      prov.updateFirebase({
        'drillRevealed': revealed.where((id) => id != _exId).toList(),
      });
    } else {
      prov.updateFirebase({
        'drillRevealed': [...revealed, _exId],
      });
    }
  }

  void _toggleLexicalNote(CourseProvider prov) {
    final drills = _drills(prov);
    if (drills.isEmpty) return;
    final section = _sectionAt(drills, _currentWordIdx);
    final notes = section['notes'];
    if (notes is! List || notes.isEmpty) return;
    setState(() => _showLexicalNote = !_showLexicalNote);
  }

  void _openNote(CourseProvider prov) {
    final drills = _drills(prov);
    if (drills.isEmpty) return;

    final examples = _examplesOf(drills, _currentWordIdx);
    if (_currentExIdx >= examples.length) return;

    final targetText =
        (examples[_currentExIdx] as Map<String, dynamic>)[prov.config.primaryTextKey]?.toString() ?? '';
    final existing = prov.progressNotes[_exId]?.toString() ?? '';

    UserNoteModal.show(
      context,
      targetText: 'Drill: $targetText',
      existingNote: existing,
      onSave: (note) {
        final updated = Map<String, dynamic>.from(prov.progressNotes);
        updated[_exId] = note;
        prov.updateFirebase({'notes': updated});
      },
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

    final drills = _drills(courseProv);

    if (courseProv.activeEpisode == null || drills.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.menu_book_rounded, size: 48, color: textSecondary.withValues(alpha: 0.4)),
              const SizedBox(height: 16),
              Text(
                'No Drills Yet',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate a lesson from the Studio tab to create interactive drills.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    WebFontService.ensurePreferredFontsLoaded(courseProv.config.name);

    final config = courseProv.config;
    final langName = config.name;
    final isLatestEpisode = courseProv.isLatestEpisode;

    final section = _sectionAt(drills, _currentWordIdx);
    final examples = _examplesOf(drills, _currentWordIdx);
    if (_currentExIdx >= examples.length) _currentExIdx = examples.length - 1;
    final currentExample = _currentExIdx >= 0 && examples.isNotEmpty
        ? examples[_currentExIdx] as Map<String, dynamic>
        : null;

    final exId = _exId;
    final isActuallyListened = !isLatestEpisode || courseProv.listenedDrills.contains(exId);
    final isManuallyRevealed = courseProv.drillRevealed.contains(exId);
    final isRevealed = isActuallyListened || isManuallyRevealed;

    final sectionNotes = section['notes'];
    final hasNotes = sectionNotes is List && sectionNotes.isNotEmpty;

    bool isWordCompleted(int wordIdx) {
      if (!isLatestEpisode) return true;
      final wordExamples = _examplesOf(drills, wordIdx);
      if (wordExamples.isEmpty) return false;
      for (var i = 0; i < wordExamples.length; i++) {
        if (!courseProv.listenedDrills.contains('drill_${wordIdx}_$i')) return false;
      }
      return true;
    }

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragEnd: (details) {
        if (details.primaryVelocity != null) {
          if (details.primaryVelocity! < -150) {
            _handleNext(courseProv);
          } else if (details.primaryVelocity! > 150) {
            _handlePrev(courseProv);
          }
        }
      },
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isMobile = constraints.maxWidth < 640;
          return Padding(
            padding: EdgeInsets.symmetric(
              horizontal: isMobile ? 12 : 24,
              vertical: isMobile ? 8 : 16,
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: Column(
                  children: [
                    // 1. Tab Badge
                    const TabBadge(icon: Icons.bookmark_rounded, label: 'INTERACTIVE DRILLS'),
                    SizedBox(height: isMobile ? 6 : 12),

                    // 2. Word Pills Strip
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: isMobile ? 2 : 8,
                        vertical: isMobile ? 4 : 6,
                      ),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: cardBorder),
                      ),
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: List.generate(drills.length, (idx) {
                            final word = _sectionAt(drills, idx)['word']?.toString() ?? '?';
                            final isCurrent = idx == _currentWordIdx;
                            final isCompleted = isWordCompleted(idx);

                            Color pillColor;
                            if (isCurrent) {
                              pillColor = isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309);
                            } else if (isCompleted) {
                              pillColor = isDark ? const Color(0xFF34D399) : const Color(0xFF059669);
                            } else {
                              pillColor = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);
                            }

                            return Padding(
                              padding: EdgeInsets.symmetric(horizontal: isMobile ? 1 : 3),
                              child: InkWell(
                                onTap: () => _goToWord(courseProv, idx, idx > _currentWordIdx ? 'next' : 'prev'),
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  padding: EdgeInsets.symmetric(
                                    horizontal: isMobile ? 8 : 12,
                                    vertical: isMobile ? 6 : 7,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isCurrent
                                        ? (isDark ? const Color(0xFF27272A) : Colors.white)
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(10),
                                    border: isCurrent ? Border.all(color: cardBorder) : null,
                                  ),
                                  child: Text(
                                    word,
                                    style: languageTextStyle(
                                      langName,
                                      fontSize: isMobile ? 11 : 13,
                                      color: pillColor,
                                      isBold: true,
                                      minCjkSize: false,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }),
                        ),
                      ),
                    ),

                    SizedBox(height: isMobile ? 8 : 12),

                    // 3. Main Drill Card
                    Expanded(
                      child: Container(
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: cardBg,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: cardBorder),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            // Scrollable example body
                            Expanded(
                              child: CustomScrollView(
                                controller: _scrollController,
                                slivers: [
                                  SliverPadding(
                                    padding: EdgeInsets.all(isMobile ? 16 : 24),
                                sliver: SliverFillRemaining(
                                  hasScrollBody: false,
                                  child: AnimatedSwitcher(
                                    duration: const Duration(milliseconds: 250),
                                    switchInCurve: Curves.easeOut,
                                    switchOutCurve: Curves.easeIn,
                                    transitionBuilder: (child, animation) {
                                      final begin = _slideDirection == 'next'
                                          ? const Offset(0.06, 0)
                                          : const Offset(-0.06, 0);
                                      return FadeTransition(
                                        opacity: animation,
                                        child: SlideTransition(
                                          position: Tween<Offset>(begin: begin, end: Offset.zero)
                                              .animate(animation),
                                          child: child,
                                        ),
                                      );
                                    },
                                    child: currentExample == null
                                        ? const SizedBox.shrink()
                                        : _buildExampleBody(
                                            context,
                                            courseProv,
                                            section,
                                            currentExample,
                                            exId,
                                            isRevealed,
                                            hasNotes,
                                            isDark,
                                            cardBorder,
                                            textPrimary,
                                            textSecondary,
                                          ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        // 3. Example Footer Bar
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            border: Border(top: BorderSide(color: cardBorder.withValues(alpha: 0.5))),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    'Example ${_currentExIdx + 1}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.2,
                                      color: textSecondary,
                                    ),
                                  ),
                                  if (isActuallyListened) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF10B981).withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: const Color(0xFF10B981).withValues(alpha: 0.25),
                                        ),
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.check_rounded, size: 12, color: Color(0xFF10B981)),
                                          SizedBox(width: 3),
                                          Text(
                                            'Listened',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 0.8,
                                              color: Color(0xFF10B981),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              Row(
                                children: [
                                  IconButton(
                                    onPressed: () => _openNote(courseProv),
                                    icon: Icon(
                                      Icons.note_alt_outlined,
                                      size: 20,
                                      color: (courseProv.progressNotes[exId]?.toString() ?? '').isNotEmpty
                                          ? const Color(0xFF2563EB)
                                          : textSecondary,
                                    ),
                                    tooltip: 'Add Note (N)',
                                  ),
                                  IconButton(
                                    onPressed: () => _toggleReveal(courseProv),
                                    icon: Icon(
                                      isManuallyRevealed ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                                      size: 20,
                                      color: isManuallyRevealed
                                          ? const Color(0xFFF59E0B)
                                          : textSecondary,
                                    ),
                                    tooltip: isManuallyRevealed ? 'Hide Text (R)' : 'Reveal Text (R)',
                                  ),
                                  PlayButton(
                                    size: 36,
                                    isPlaying: courseProv.playingId == exId,
                                    onPressed: () => _togglePlay(courseProv),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  ),
);
}

  Widget _buildExampleBody(
    BuildContext context,
    CourseProvider courseProv,
    Map<String, dynamic> section,
    Map<String, dynamic> currentExample,
    String exId,
    bool isRevealed,
    bool hasNotes,
    bool isDark,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    final config = courseProv.config;
    final langName = config.name;
    final isCjk = langName.contains('Chinese') ||
        langName.contains('Japanese') ||
        langName.contains('Mandarin');
    final isPlaying = courseProv.playingId == exId;

    final word = section['word']?.toString() ?? '';
    final wordTranslit = config.transliterationKey.isNotEmpty
        ? section[config.transliterationKey]?.toString() ?? ''
        : '';
    final targetText = currentExample[config.primaryTextKey]?.toString() ?? '';
    final english =
        currentExample['english']?.toString() ?? currentExample['translation']?.toString() ?? '';
    final secondaryText = config.secondaryScriptKey != null
        ? currentExample[config.secondaryScriptKey]?.toString() ?? ''
        : '';
    final translit = config.transliterationKey.isNotEmpty
        ? currentExample[config.transliterationKey]?.toString() ?? ''
        : '';
    final sectionNotes = section['notes'];
    final notes = sectionNotes is List ? sectionNotes : const [];

    Widget exampleContent = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          targetText,
          style: languageTextStyle(langName, fontSize: 24, color: textPrimary),
        ),
        const SizedBox(height: 10),
        Text(
          english,
          style: TextStyle(fontSize: 16, height: 1.5, color: textPrimary),
        ),
        if (secondaryText.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            secondaryText,
            style: languageTextStyle(
              langName,
              fontSize: 24,
              color: textPrimary,
              isSimplified: true,
            ),
          ),
        ],
        if (translit.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            translit,
            style: TextStyle(
              fontSize: 16,
              height: 1.5,
              color: isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C),
            ),
          ),
        ],
      ],
    );

    if (!isRevealed) {
      exampleContent = ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
        child: Opacity(
          opacity: 0.4,
          child: AbsorbPointer(child: exampleContent),
        ),
      );
    }

    return Column(
      key: ValueKey(exId),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Word header + transliteration
        Center(
          child: Column(
            children: [
              Text(
                word,
                textAlign: TextAlign.center,
                style: languageTextStyle(
                  langName,
                  fontSize: isCjk ? 64 : 24,
                  color: textPrimary,
                  isBold: !isCjk,
                  minCjkSize: false,
                ),
              ),
              if (wordTranslit.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    wordTranslit,
                    style: TextStyle(
                      fontSize: 15,
                      color: isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Example content (blurred until revealed) — expands to fill the card
        Expanded(
          child: Stack(
            children: [
              SizedBox(width: double.infinity, child: exampleContent),
            if (!isRevealed)
              Positioned.fill(
                child: Center(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => _togglePlay(courseProv),
                      borderRadius: BorderRadius.circular(30),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFFB45309) : const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(30),
                          border: Border.all(
                            color: isDark ? const Color(0xFFF59E0B) : const Color(0xFFFBBF24),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.15),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (isPlaying)
                              const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFFFBBF24),
                                ),
                              )
                            else
                              Icon(
                                Icons.volume_up_rounded,
                                size: 16,
                                color: isDark ? const Color(0xFFFDE68A) : const Color(0xFFB45309),
                              ),
                            const SizedBox(width: 8),
                            Text(
                              'Play to Reveal',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: isDark ? const Color(0xFFFDE68A) : const Color(0xFF92400E),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // Lexical note section (pinned to the bottom, popup opens upward)
        if (hasNotes) ...[
          const SizedBox(height: 24),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_showLexicalNote) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF121215) : const Color(0xFFFAFAF9),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: cardBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.lightbulb_outline_rounded, size: 16, color: Color(0xFFF59E0B)),
                              SizedBox(width: 6),
                              Text(
                                'LEXICAL NOTE',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.2,
                                  color: Color(0xFFF59E0B),
                                ),
                              ),
                            ],
                          ),
                          InkWell(
                            onTap: () => setState(() => _showLexicalNote = false),
                            borderRadius: BorderRadius.circular(20),
                            child: const Padding(
                              padding: EdgeInsets.all(2),
                              child: Icon(Icons.close_rounded, size: 18, color: Color(0xFFA1A1AA)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      ...notes.map((n) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              n.toString(),
                              style: TextStyle(
                                fontSize: 14,
                                height: 1.5,
                                color: isDark ? const Color(0xFFD4D4D8) : const Color(0xFF57534E),
                              ),
                            ),
                          )),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
              ],
              InkWell(
                onTap: () => setState(() => _showLexicalNote = !_showLexicalNote),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF121215) : const Color(0xFFFAFAF9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: cardBorder),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.lightbulb_outline_rounded, size: 14, color: Color(0xFFF59E0B)),
                          SizedBox(width: 6),
                          Text(
                            'Lexical Note',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.8,
                              color: Color(0xFFA1A1AA),
                            ),
                          ),
                        ],
                      ),
                      AnimatedRotation(
                        turns: _showLexicalNote ? 0 : 0.5,
                        duration: const Duration(milliseconds: 200),
                        child: const Icon(Icons.expand_more_rounded, size: 16, color: Color(0xFFA1A1AA)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
