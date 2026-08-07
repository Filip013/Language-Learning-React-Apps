import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/services/tts_service.dart';
import '../../../core/services/web_font_service.dart';
import '../../../core/widgets/language_text_style.dart';
import '../../../core/widgets/platform_font.dart';
import '../../../core/widgets/play_button.dart';
import '../../../core/widgets/tab_badge.dart';
import '../../../core/widgets/user_note_modal.dart';
import '../../home/providers/home_provider.dart';
import '../providers/course_provider.dart';

class TestTab extends StatefulWidget {
  const TestTab({super.key});

  @override
  State<TestTab> createState() => _TestTabState();
}

class _TestTabState extends State<TestTab> {
  int _currentIdx = 0;
  bool _showConfirmReset = false;
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
    _maybeAutoNavigate(Provider.of<CourseProvider>(context, listen: false));
  }

  // ---------------------------------------------------------------------------
  // Data & auto-navigation (mirrors React TestTab)
  // ---------------------------------------------------------------------------

  List<dynamic> _testItems(CourseProvider prov) {
    final test = prov.activeEpisode?['test'];
    if (test is List) return test;
    return const [];
  }

  Map<String, dynamic> _itemAt(List<dynamic> items, int idx) {
    if (idx < 0 || idx >= items.length) return const {};
    final item = items[idx];
    if (item is Map) return Map<String, dynamic>.from(item);
    return const {};
  }

  void _maybeAutoNavigate(CourseProvider prov) {
    final episode = prov.activeEpisode;
    if (episode == null) return;
    final epId = episode['id']?.toString() ?? '';
    if (epId.isEmpty || _autoNavigatedEpisodeId == epId) return;

    final items = _testItems(prov);
    if (items.isNotEmpty) {
      final rev = prov.testRevealed;
      var firstUnfinished = -1;
      for (var i = 0; i < items.length; i++) {
        if (rev['test_$i'] != true) {
          firstUnfinished = i;
          break;
        }
      }
      _currentIdx = firstUnfinished != -1 ? firstUnfinished : items.length - 1;
    } else {
      _currentIdx = 0;
    }

    _autoNavigatedEpisodeId = epId;
  }

  String get _qId => 'test_$_currentIdx';

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts (mirrors React TestTab key map)
  // ---------------------------------------------------------------------------

  bool _handleGlobalKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final primaryFocus = FocusManager.instance.primaryFocus;
    if (primaryFocus != null && primaryFocus.context?.widget is EditableText) {
      return false;
    }

    final courseProv = Provider.of<CourseProvider>(context, listen: false);
    if (courseProv.activeTab != 'test') return false;
    if (_testItems(courseProv).isEmpty) return false;

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
        _scrollBy(100);
        return true;
      case LogicalKeyboardKey.arrowUp:
      case LogicalKeyboardKey.keyA:
        _scrollBy(-100);
        return true;
      case LogicalKeyboardKey.space:
        if (courseProv.playingId != null || TTSService.isPlaying) {
          courseProv.stopSpeaking();
          return true;
        }
        _playAnswer(courseProv, _qId);
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

  void _scrollBy(double delta) {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      (_scrollController.offset + delta).clamp(0, _scrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOut,
    );
  }

  void _scrollToTop() {
    if (_scrollController.hasClients) {
      _scrollController.jumpTo(0);
    }
  }

  void _handleNext(CourseProvider prov) {
    final total = _testItems(prov).length;
    if (_currentIdx < total - 1) {
      setState(() {
        _slideDirection = 'next';
        _currentIdx++;
      });
      _scrollToTop();
    } else {
      prov.goToNextTab();
    }
  }

  void _handlePrev(CourseProvider prov) {
    if (_currentIdx > 0) {
      setState(() {
        _slideDirection = 'prev';
        _currentIdx--;
      });
      _scrollToTop();
    } else {
      prov.goToPrevTab();
    }
  }

  void _goToItem(int idx) {
    setState(() {
      _slideDirection = idx > _currentIdx ? 'next' : 'prev';
      _currentIdx = idx;
    });
    _scrollToTop();
  }

  /// Speak the target text; on completion mark the item as revealed + mastered
  /// (React behavior).
  void _playAnswer(CourseProvider prov, String qId) {
    final item = _itemAt(_testItems(prov), _currentIdx);
    final text = item[prov.config.primaryTextKey]?.toString() ?? '';
    if (text.isEmpty) return;

    prov.speakText(text, qId).then((_) {
      prov.updateFirebase({
        'testMastered': {...prov.testMastered, qId: true},
        'testRevealed': {...prov.testRevealed, qId: true},
      });
    });
  }

  void _openNote(CourseProvider prov) {
    final item = _itemAt(_testItems(prov), _currentIdx);
    final english = item['english']?.toString() ?? '';
    final existing = prov.progressNotes[_qId]?.toString() ?? '';

    UserNoteModal.show(
      context,
      targetText: 'Translate: $english',
      existingNote: existing,
      onSave: (note) {
        final updated = Map<String, dynamic>.from(prov.progressNotes);
        updated[_qId] = note;
        prov.updateFirebase({'notes': updated});
      },
    );
  }

  void _resetTest(CourseProvider prov) {
    setState(() {
      _showConfirmReset = false;
      _currentIdx = 0;
    });
    _scrollToTop();
    prov.updateFirebase({'testMastered': {}, 'testRevealed': {}});
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

    final items = _testItems(courseProv);
    if (courseProv.activeEpisode == null || items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.edit_outlined, size: 48, color: textSecondary.withValues(alpha: 0.4)),
              const SizedBox(height: 16),
              Text(
                'No Test Yet',
                style: TextStyle(fontSize: platformFontSize(18), fontWeight: FontWeight.bold, color: textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate a lesson from the Studio tab to create an active translation test.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: platformFontSize(14), color: textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    WebFontService.ensurePreferredFontsLoaded(courseProv.config.name);

    final item = _itemAt(items, _currentIdx);
    final qId = _qId;
    final isRevealed = courseProv.testRevealed[qId] == true;

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
                constraints: const BoxConstraints(maxWidth: 1040),
                child: Column(
                  children: [
                    // 1. Tab badge + reset (standalone, separate from the nav bar)
                    SizedBox(
                      width: double.infinity,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          const TabBadge(icon: Icons.edit_rounded, label: 'ACTIVE TRANSLATION'),
                          Positioned(
                            right: 0,
                            child: !_showConfirmReset
                                ? InkWell(
                                    onTap: () => setState(() => _showConfirmReset = true),
                                    borderRadius: BorderRadius.circular(8),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.refresh_rounded, size: 12, color: Color(0xFFA1A1AA)),
                                          SizedBox(width: 4),
                                          Text(
                                            'RESET',
                                            style: TextStyle(
                                              fontSize: platformFontSize(10),
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 1,
                                              color: Color(0xFFA1A1AA),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )
                                : Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: isDark
                                          ? const Color(0xFF450A0A).withValues(alpha: 0.4)
                                          : const Color(0xFFFEF2F2),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: isDark ? const Color(0xFF7F1D1D).withValues(alpha: 0.5) : const Color(0xFFFECACA),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Text(
                          'Reset?',
                          style: TextStyle(fontSize: platformFontSize(10), fontWeight: FontWeight.bold, color: Color(0xFFEF4444)),
                                        ),
                                        const SizedBox(width: 8),
                                        InkWell(
                                          onTap: () => _resetTest(courseProv),
                                          child: Text(
                                            'Yes',
                                            style: TextStyle(fontSize: platformFontSize(10), fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        InkWell(
                                          onTap: () => setState(() => _showConfirmReset = false),
                                          child: Text(
                                            'No',
                                            style: TextStyle(fontSize: platformFontSize(10), fontWeight: FontWeight.bold, color: Color(0xFF78716C)),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: isMobile ? 6 : 12),

                    // 2. Sentence pills strip (navigation bar)
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
                          children: List.generate(items.length, (idx) {
                            final isCurrent = idx == _currentIdx;
                            final isCompleted = courseProv.testRevealed['test_$idx'] == true;

                            Color pillColor;
                            if (isCurrent) {
                              pillColor = isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309);
                            } else if (isCompleted) {
                              pillColor = isDark ? const Color(0xFF34D399) : const Color(0xFF059669);
                            } else {
                              pillColor = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);
                            }

                            return Padding(
                              padding: EdgeInsets.symmetric(horizontal: isMobile ? 0.5 : 3),
                              child: InkWell(
                                onTap: () => _goToItem(idx),
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  padding: EdgeInsets.symmetric(
                                    horizontal: isMobile ? 5.5 : 12,
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
                                    '${idx + 1}',
                                    style: TextStyle(
                                      fontSize: platformFontSize(isMobile ? 11 : 13),
                                      fontWeight: FontWeight.bold,
                                      color: pillColor,
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

                    // 3. Main Test Card
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
                            // Scrollable body
                            Expanded(
                              child: SingleChildScrollView(
                                controller: _scrollController,
                                padding: EdgeInsets.all(isMobile ? 16 : 24),
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
                                  child: _buildItemBody(
                                    context,
                                    courseProv,
                                    item,
                                    qId,
                                    isRevealed,
                                    isDark,
                                    textPrimary,
                                    textSecondary,
                                  ),
                                ),
                              ),
                            ),

                        // 4. Footer Bar
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            border: Border(top: BorderSide(color: cardBorder.withValues(alpha: 0.5))),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Sentence ${_currentIdx + 1}',
                                style: TextStyle(
                                  fontSize: platformFontSize(11),
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.2,
                                  color: textSecondary,
                                ),
                              ),
                              Row(
                                children: [
                                  IconButton(
                                    onPressed: () => _openNote(courseProv),
                                    icon: Icon(
                                      Icons.note_alt_outlined,
                                      size: 20,
                                      color: (courseProv.progressNotes[qId]?.toString() ?? '').isNotEmpty
                                          ? const Color(0xFF2563EB)
                                          : textSecondary,
                                    ),
                                    tooltip: 'Add Note (N)',
                                  ),
                                  PlayButton(
                                    size: 36,
                                    isPlaying: courseProv.playingId == qId,
                                    onPressed: () => _playAnswer(courseProv, qId),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        // 5. Bottom Nav Bar
                        Container(
                          padding: const EdgeInsets.only(top: 6),
                          decoration: BoxDecoration(
                            color: isDark
                                ? const Color(0xFF09090B).withValues(alpha: 0.4)
                                : const Color(0xFFFAFAF9).withValues(alpha: 0.6),
                            border: Border(top: BorderSide(color: cardBorder.withValues(alpha: 0.5))),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              TextButton.icon(
                                onPressed: _currentIdx > 0
                                    ? () => _handlePrev(courseProv)
                                    : null,
                                icon: const Icon(Icons.chevron_left_rounded, size: 18),
                                label: const Text('Prev'),
                                style: TextButton.styleFrom(
                                  foregroundColor: textPrimary,
                                  disabledForegroundColor: textSecondary.withValues(alpha: 0.3),
                                ),
                              ),
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    'SENTENCE',
                                    style: TextStyle(
                                      fontSize: platformFontSize(9),
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1,
                                      color: textSecondary.withValues(alpha: 0.7),
                                    ),
                                  ),
                                  Text(
                                    '${_currentIdx + 1} / ${items.length}',
                                    style: TextStyle(
                                      fontSize: platformFontSize(13),
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1,
                                      color: textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                              TextButton.icon(
                                onPressed: _currentIdx < items.length - 1
                                    ? () => _handleNext(courseProv)
                                    : null,
                                label: const Text('Next'),
                                icon: const Icon(Icons.chevron_right_rounded, size: 18),
                                style: TextButton.styleFrom(
                                  foregroundColor: textPrimary,
                                  disabledForegroundColor: textSecondary.withValues(alpha: 0.3),
                                ),
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

  Widget _buildItemBody(
    BuildContext context,
    CourseProvider courseProv,
    Map<String, dynamic> item,
    String qId,
    bool isRevealed,
    bool isDark,
    Color textPrimary,
    Color textSecondary,
  ) {
    final langName = courseProv.config.name;
    final english = item['english']?.toString() ?? '';
    final targetText = item[courseProv.config.primaryTextKey]?.toString() ?? '';
    final isPlaying = courseProv.playingId == qId;

    Widget targetBlock = Text(
      targetText,
      style: languageTextStyle(langName, fontSize: 24, color: textPrimary),
    );

    if (!isRevealed) {
      targetBlock = ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
        child: Opacity(
          opacity: 0.4,
          child: IgnorePointer(child: targetBlock),
        ),
      );
    }

    return Column(
      key: ValueKey(qId),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // English sentence prompt
        Text(
          english,
          style: TextStyle(
            fontSize: platformFontSize(16),
            height: 1.5,
            color: isDark ? const Color(0xFFA1A1AA) : const Color(0xFF57534E),
          ),
        ),
        const SizedBox(height: 20),

        // Target translation (blurred until revealed)
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 88),
          child: Stack(
            children: [
              SizedBox(width: double.infinity, child: targetBlock),
            if (!isRevealed)
              Positioned.fill(
                child: Center(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => _playAnswer(courseProv, qId),
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
                                fontSize: platformFontSize(13),
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
      ],
    );
  }
}