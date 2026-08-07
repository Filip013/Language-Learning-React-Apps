import 'dart:math';
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

class QuizTab extends StatefulWidget {
  const QuizTab({super.key});

  @override
  State<QuizTab> createState() => _QuizTabState();
}

class _QuizTabState extends State<QuizTab> {
  final RegExp _blankRegex = RegExp(r'(_{2,}|\.{3,}|(?:_\s*){2,})');

  List<Map<String, dynamic>> _shuffledData = [];
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
  // Data setup & auto-navigation (mirrors React QuizTab effects)
  // ---------------------------------------------------------------------------

  List<dynamic> _shuffle(List<dynamic> list) {
    final arr = List<dynamic>.from(list);
    for (var i = arr.length - 1; i > 0; i--) {
      final j = Random().nextInt(i + 1);
      final tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  void _buildQuizData(CourseProvider prov) {
    final quiz = prov.activeEpisode?['quiz'];
    if (quiz is! List) {
      _shuffledData = [];
      return;
    }

    _shuffledData = quiz.asMap().entries.map((entry) {
      final q = entry.value is Map
          ? Map<String, dynamic>.from(entry.value as Map)
          : <String, dynamic>{};

      final answer = (q['answer'] ?? q['correct'] ?? '').toString();

      List<dynamic> options;
      if (q['options'] is List && (q['options'] as List).isNotEmpty) {
        options = List<dynamic>.from(q['options'] as List);
      } else {
        final distractors = q['distractors'] is List ? q['distractors'] as List : <dynamic>[];
        final combined = <dynamic>{...distractors, answer}.toList();
        options = _shuffle(combined);
      }

      return {
        ...q,
        'id': entry.key,
        'sentence': (q['sentence'] ?? q['text'] ?? '').toString(),
        'transliteration': (q['transliteration'] ?? '').toString(),
        'answer': answer,
        'englishHint': (q['englishHint'] ?? q['translation'] ?? '').toString(),
        'options': options,
      };
    }).toList();
  }

  void _maybeAutoNavigate(CourseProvider prov) {
    final episode = prov.activeEpisode;
    if (episode == null) return;
    final epId = episode['id']?.toString() ?? '';
    if (epId.isEmpty || _autoNavigatedEpisodeId == epId) return;

    _buildQuizData(prov);

    if (_shuffledData.isNotEmpty) {
      final graded = prov.gradedIds;
      final firstUnfinished =
          _shuffledData.indexWhere((q) => !graded.contains('quiz_${q['id']}'));
      _currentIdx = firstUnfinished != -1 ? firstUnfinished : _shuffledData.length - 1;
    } else {
      _currentIdx = 0;
    }

    _autoNavigatedEpisodeId = epId;
  }

  String _qIdOf(Map<String, dynamic> q) => 'quiz_${q['id']}';

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts (mirrors React QuizTab key map)
  // ---------------------------------------------------------------------------

  bool _handleGlobalKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final primaryFocus = FocusManager.instance.primaryFocus;
    if (primaryFocus != null && primaryFocus.context?.widget is EditableText) {
      return false;
    }

    final courseProv = Provider.of<CourseProvider>(context, listen: false);
    if (courseProv.activeTab != 'quiz') return false;

    final q = _currentQuestion;
    if (q == null) return false;
    final qId = _qIdOf(q);

    final isGraded = courseProv.gradedIds.contains(qId);
    final userChoice = courseProv.userSelections[qId]?.toString();

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
        if (isGraded) {
          _playAnswer(courseProv, q, qId);
        } else if (userChoice != null && userChoice.isNotEmpty) {
          _gradeAnswer(courseProv, q, qId);
        }
        return true;
      case LogicalKeyboardKey.keyR:
        _toggleReveal(courseProv, qId);
        return true;
      case LogicalKeyboardKey.keyN:
        _openNote(courseProv, q, qId);
        return true;
      case LogicalKeyboardKey.digit1:
      case LogicalKeyboardKey.digit2:
      case LogicalKeyboardKey.digit3:
      case LogicalKeyboardKey.digit4:
        final optIdx = _digitToIndex(event.logicalKey);
        final options = q['options'];
        if (!isGraded && options is List && optIdx < options.length) {
          _handleSelect(courseProv, qId, options[optIdx].toString());
        }
        return true;
    }
    return false;
  }

  int _digitToIndex(LogicalKeyboardKey key) {
    switch (key) {
      case LogicalKeyboardKey.digit1:
        return 0;
      case LogicalKeyboardKey.digit2:
        return 1;
      case LogicalKeyboardKey.digit3:
        return 2;
      case LogicalKeyboardKey.digit4:
        return 3;
      default:
        return -1;
    }
  }

  Map<String, dynamic>? get _currentQuestion =>
      _shuffledData.isEmpty ? null : _shuffledData[_currentIdx.clamp(0, _shuffledData.length - 1)];

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
    if (_currentIdx < _shuffledData.length - 1) {
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

  void _goToQuestion(int idx) {
    setState(() {
      _slideDirection = idx > _currentIdx ? 'next' : 'prev';
      _currentIdx = idx;
    });
    _scrollToTop();
  }

  void _handleSelect(CourseProvider prov, String qId, String choice) {
    if (prov.gradedIds.contains(qId)) return;
    final selections = Map<String, dynamic>.from(prov.userSelections);
    selections[qId] = choice;
    prov.updateFirebase({'selections': selections});
  }

  void _playAnswer(CourseProvider prov, Map<String, dynamic> q, String qId) {
    final sentence = q['sentence'] as String? ?? '';
    final answer = q['answer'] as String? ?? '';
    final fullText = sentence.replaceFirst(_blankRegex, answer);
    prov.speakText(fullText, 'quiz-audio-$qId');
  }

  void _gradeAnswer(CourseProvider prov, Map<String, dynamic> q, String qId) {
    if (!prov.gradedIds.contains(qId)) {
      prov.updateFirebase({
        'gradedIds': [...prov.gradedIds, qId],
      });
    }
    _playAnswer(prov, q, qId);
  }

  void _toggleReveal(CourseProvider prov, String qId) {
    final revealed = prov.revealedIds;
    if (revealed.contains(qId)) {
      prov.updateFirebase({
        'revealed': revealed.where((id) => id != qId).toList(),
      });
    } else {
      prov.updateFirebase({
        'revealed': [...revealed, qId],
      });
    }
  }

  void _openNote(CourseProvider prov, Map<String, dynamic> q, String qId) {
    final existing = prov.progressNotes[qId]?.toString() ?? '';
    UserNoteModal.show(
      context,
      targetText: 'Quiz: Question ${(q['id'] as int? ?? 0) + 1}',
      existingNote: existing,
      onSave: (note) {
        final updated = Map<String, dynamic>.from(prov.progressNotes);
        updated[qId] = note;
        prov.updateFirebase({'notes': updated});
      },
    );
  }

  void _resetQuiz(CourseProvider prov) {
    setState(() {
      _showConfirmReset = false;
      _currentIdx = 0;
    });
    _scrollToTop();
    prov.updateFirebase({'selections': {}, 'revealed': [], 'gradedIds': []});
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

    if (courseProv.activeEpisode == null || _shuffledData.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle_outline_rounded, size: 48, color: textSecondary.withValues(alpha: 0.4)),
              const SizedBox(height: 16),
              Text(
                'No Quiz Yet',
                style: TextStyle(fontSize: platformFontSize(18), fontWeight: FontWeight.bold, color: textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate a lesson from the Studio tab to create a review quiz.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: platformFontSize(14), color: textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    WebFontService.ensurePreferredFontsLoaded(courseProv.config.name);

    final q = _currentQuestion!;
    final qId = _qIdOf(q);
    final isRevealed = courseProv.revealedIds.contains(qId);
    final isGraded = courseProv.gradedIds.contains(qId);
    final userChoice = courseProv.userSelections[qId]?.toString();
    final isCorrect = userChoice == q['answer'];

    final gradedCount = courseProv.gradedIds
        .where((id) => _shuffledData.any((qt) => 'quiz_${qt['id']}' == id))
        .length;

    int correctCount = 0;
    courseProv.userSelections.forEach((id, val) {
      for (final qt in _shuffledData) {
        if ('quiz_${qt['id']}' == id && qt['answer'] == val && courseProv.gradedIds.contains(id)) {
          correctCount++;
          break;
        }
      }
    });

    final options = q['options'] is List ? q['options'] as List : <dynamic>[];
    final maxOptLength = options.fold<int>(0, (m, o) => max(m, o.toString().length));

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
                          const TabBadge(icon: Icons.check_circle_rounded, label: 'REVIEW QUIZ'),
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
                                            'Reset',
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
                                        const SizedBox(width: 6),
                                        InkWell(
                                          onTap: () => _resetQuiz(courseProv),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFEF4444),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              'Yes',
                                              style: TextStyle(fontSize: platformFontSize(10), fontWeight: FontWeight.bold, color: Colors.white),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 4),
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

                    // 2. Question pills strip (navigation bar)
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
                          children: List.generate(_shuffledData.length, (idx) {
                            final isCurrent = idx == _currentIdx;
                            final isCompleted = courseProv.gradedIds.contains('quiz_${_shuffledData[idx]['id']}');

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
                                onTap: () => _goToQuestion(idx),
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

                // 2. Main Quiz Card
                Expanded(
                  child: Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: cardBorder),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.03),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final contentWidth = constraints.maxWidth - 48;
                        return Column(
                          children: [
                            // Scrollable question body
                            Expanded(
                              child: CustomScrollView(
                                controller: _scrollController,
                                slivers: [
                                  SliverPadding(
                                    padding: const EdgeInsets.all(24),
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
                                        child: _buildQuestionBody(
                                          context,
                                          courseProv,
                                          q,
                                          qId,
                                          isRevealed,
                                          isGraded,
                                          userChoice,
                                          isCorrect,
                                          options,
                                          maxOptLength,
                                          isDark,
                                          textPrimary,
                                          textSecondary,
                                          contentWidth,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                        // 3. Question Footer Bar
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            border: Border(top: BorderSide(color: cardBorder.withValues(alpha: 0.5))),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Question ${_currentIdx + 1}',
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
                                    onPressed: () => _openNote(courseProv, q, qId),
                                    icon: Icon(
                                      Icons.note_alt_outlined,
                                      size: 20,
                                      color: (courseProv.progressNotes[qId]?.toString() ?? '').isNotEmpty
                                          ? const Color(0xFF2563EB)
                                          : textSecondary,
                                    ),
                                    tooltip: 'Add Note (N)',
                                  ),
                                  if (isGraded)
                                    PlayButton(
                                      size: 36,
                                      isPlaying: courseProv.playingId == 'quiz-audio-$qId',
                                      onPressed: () => _playAnswer(courseProv, q, qId),
                                    )
                                  else
                                    IconButton(
                                      onPressed: () => _toggleReveal(courseProv, qId),
                                      icon: Icon(
                                        isRevealed ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                                        size: 20,
                                        color: isRevealed ? const Color(0xFFF59E0B) : textSecondary,
                                      ),
                                      tooltip: isRevealed ? 'Hide Text (R)' : 'Reveal Text (R)',
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        // 4. Bottom Nav Bar (Prev / Graded+Score / Next)
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
                              Row(
                                children: [
                                  Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'GRADED',
                                        style: TextStyle(
                                          fontSize: platformFontSize(9),
                                          fontWeight: FontWeight.bold,
                                          letterSpacing: 1,
                                          color: textSecondary.withValues(alpha: 0.7),
                                        ),
                                      ),
                                      Text(
                                        '$gradedCount / ${_shuffledData.length}',
                                        style: TextStyle(
                                          fontSize: platformFontSize(14),
                                          fontWeight: FontWeight.bold,
                                          color: textPrimary,
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (gradedCount > 0) ...[
                                    Container(
                                      width: 1,
                                      height: 24,
                                      margin: const EdgeInsets.symmetric(horizontal: 12),
                                      color: isDark ? const Color(0xFF3F3F46) : const Color(0xFFE7E5E4),
                                    ),
                                    Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          'SCORE',
                                          style: TextStyle(
                                            fontSize: platformFontSize(9),
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 1,
                                            color: textSecondary.withValues(alpha: 0.7),
                                          ),
                                        ),
                                        Row(
                                          children: [
                                            Text(
                                              '$correctCount',
                                              style: TextStyle(
                                                fontSize: platformFontSize(14),
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFF10B981),
                                              ),
                                            ),
                                            const SizedBox(width: 3),
                                            const Icon(Icons.check_circle_rounded, size: 14, color: Color(0xFF10B981)),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                              TextButton.icon(
                                onPressed: _currentIdx < _shuffledData.length - 1
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
                    );
                      },
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

  Widget _buildQuestionBody(
    BuildContext context,
    CourseProvider courseProv,
    Map<String, dynamic> q,
    String qId,
    bool isRevealed,
    bool isGraded,
    String? userChoice,
    bool isCorrect,
    List<dynamic> options,
    int maxOptLength,
    bool isDark,
    Color textPrimary,
    Color textSecondary,
    double contentWidth,
  ) {
    final langName = courseProv.config.name;

    // Hint (blurred until revealed)
    Widget hint = Container(
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.only(top: 12),
      child: Text(
        'Hint: ${q['englishHint']}',
        style: TextStyle(
          fontSize: platformFontSize(14),
          fontStyle: FontStyle.italic,
          color: isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C),
        ),
      ),
    );

    // Options + Grade area (blurred until revealed, matching React)
    Widget optionsBlock = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 20),
        _buildOptionsGrid(
          courseProv,
          q,
          qId,
          options,
          maxOptLength,
          isGraded,
          userChoice,
          isDark,
          contentWidth,
        ),
        const SizedBox(height: 16),

        // Grade Answer button / result
        if (!isGraded)
          SizedBox(
            height: 42,
            child: FilledButton(
              onPressed: (userChoice == null || userChoice.isEmpty)
                  ? null
                  : () => _gradeAnswer(courseProv, q, qId),
              style: FilledButton.styleFrom(
                backgroundColor: isDark ? const Color(0xFFB45309) : const Color(0xFFFFF7ED),
                foregroundColor: isDark ? const Color(0xFFFDE68A) : const Color(0xFF92400E),
                disabledBackgroundColor: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                disabledForegroundColor: isDark ? const Color(0xFF52525B) : const Color(0xFFA8A29E),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: (userChoice == null || userChoice.isEmpty)
                        ? Colors.transparent
                        : (isDark ? const Color(0xFFF59E0B) : const Color(0xFFFBBF24)),
                  ),
                ),
              ),
              child: Text(
                'Grade Answer',
                style: TextStyle(fontSize: platformFontSize(14), fontWeight: FontWeight.bold),
              ),
            ),
          )
        else
          Row(
            children: [
              Icon(
                isCorrect ? Icons.check_circle_rounded : Icons.cancel_rounded,
                size: 18,
                color: isCorrect ? const Color(0xFF10B981) : const Color(0xFFF43F5E),
              ),
              const SizedBox(width: 6),
              Text(
                isCorrect ? 'Correct!' : 'Incorrect',
                style: TextStyle(
                  fontSize: platformFontSize(15),
                  fontWeight: FontWeight.bold,
                  color: isCorrect ? const Color(0xFF10B981) : const Color(0xFFF43F5E),
                ),
              ),
            ],
          ),
      ],
    );

    if (!isRevealed) {
      hint = ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
        child: Opacity(opacity: 0.4, child: IgnorePointer(child: hint)),
      );
      optionsBlock = ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
        child: Opacity(opacity: 0.4, child: IgnorePointer(child: optionsBlock)),
      );
    }

    return Column(
      key: ValueKey(qId),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSentence(q, userChoice, langName, isDark, textPrimary, textSecondary),
        hint,
        const Spacer(),
        optionsBlock,
      ],
    );
  }

  /// Sentence with the blank replaced by the user's choice chip (or an empty
  /// dashed placeholder), mirroring React's inline blank rendering.
  Widget _buildSentence(
    Map<String, dynamic> q,
    String? userChoice,
    String langName,
    bool isDark,
    Color textPrimary,
    Color textSecondary,
  ) {
    final sentence = q['sentence'] as String? ?? '';
    final match = _blankRegex.firstMatch(sentence);

    if (match == null) {
      return Text(
        sentence,
        style: languageTextStyle(langName, fontSize: 24, color: textPrimary),
      );
    }

    final before = sentence.substring(0, match.start);
    final after = sentence.substring(match.end);

    final chip = WidgetSpan(
      alignment: PlaceholderAlignment.middle,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        constraints: const BoxConstraints(minWidth: 56),
        decoration: BoxDecoration(
          color: userChoice != null
              ? (isDark ? const Color(0xFF451A03).withValues(alpha: 0.4) : const Color(0xFFFFFBEB))
              : (isDark ? const Color(0xFF451A03).withValues(alpha: 0.4) : const Color(0xFFFFF7ED).withValues(alpha: 0.6)),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            width: 2,
            color: userChoice != null
                ? (isDark ? const Color(0xFFF59E0B).withValues(alpha: 0.5) : const Color(0xFFFBBF24))
                : (isDark ? const Color(0xFFB45309).withValues(alpha: 0.5) : const Color(0xFFFCD34D).withValues(alpha: 0.8)),
            style: BorderStyle.solid,
          ),
        ),
        child: Text(
          userChoice ?? ' ',
          textAlign: TextAlign.center,
          style: languageTextStyle(
            langName,
            fontSize: 24,
            color: userChoice != null
                ? (isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309))
                : Colors.transparent,
            isBold: true,
          ),
        ),
      ),
    );

    return Text.rich(
      TextSpan(
        style: languageTextStyle(langName, fontSize: 24, color: textPrimary),
        children: [
          TextSpan(text: before),
          chip,
          TextSpan(text: after),
        ],
      ),
    );
  }

  Widget _buildOptionsGrid(
    CourseProvider courseProv,
    Map<String, dynamic> q,
    String qId,
    List<dynamic> options,
    int maxOptLength,
    bool isGraded,
    String? userChoice,
    bool isDark,
    double width,
  ) {
    final int cols;
    if (maxOptLength > 35) {
      cols = 1;
    } else if (maxOptLength > 14) {
      cols = width >= 640 ? 2 : 1;
    } else {
      cols = width >= 640 ? 4 : 2;
    }
    const gap = 8.0;
    final itemWidth = (width - gap * (cols - 1)) / cols;

    return Wrap(
      spacing: gap,
      runSpacing: gap,
      children: options.asMap().entries.map((entry) {
        return SizedBox(
          width: itemWidth,
          child: _buildOptionButton(
            courseProv,
            q,
            qId,
            entry.value.toString(),
            isGraded,
            userChoice,
            isDark,
          ),
        );
      }).toList(),
    );
  }

  Widget _buildOptionButton(
    CourseProvider courseProv,
    Map<String, dynamic> q,
    String qId,
    String option,
    bool isGraded,
    String? userChoice,
    bool isDark,
  ) {
    final langName = courseProv.config.name;
    final isSelected = userChoice == option;
    final isCorrectOpt = option == q['answer'];

    Color borderColor;
    Color bg;
    Color textColor;
    TextDecoration? decoration;

    if (!isGraded) {
      if (isSelected) {
        borderColor = const Color(0xFFF59E0B);
        bg = isDark ? const Color(0xFF451A03).withValues(alpha: 0.4) : const Color(0xFFFFFBEB);
        textColor = isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309);
      } else {
        borderColor = isDark ? const Color(0xFF3F3F46) : const Color(0xFFE7E5E4);
        bg = isDark ? const Color(0xFF121215) : Colors.white;
        textColor = isDark ? const Color(0xFFE4E4E7) : const Color(0xFF44403C);
      }
    } else {
      if (isCorrectOpt) {
        borderColor = const Color(0xFF10B981);
        bg = isDark ? const Color(0xFF064E3B).withValues(alpha: 0.5) : const Color(0xFFECFDF5);
        textColor = isDark ? const Color(0xFF6EE7B7) : const Color(0xFF065F46);
      } else if (isSelected) {
        borderColor = const Color(0xFFE11D48);
        bg = isDark ? const Color(0xFF4C0519).withValues(alpha: 0.3) : const Color(0xFFFFF1F2);
        textColor = isDark ? const Color(0xFFFB7185) : const Color(0xFF9F1239);
        decoration = TextDecoration.lineThrough;
      } else {
        borderColor = isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4);
        bg = isDark ? const Color(0xFF121215) : const Color(0xFFFAFAF9);
        textColor = isDark ? const Color(0xFF71717A) : const Color(0xFFA8A29E);
      }
    }

    return GestureDetector(
      onTap: isGraded ? null : () => _handleSelect(courseProv, qId, option),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor, width: 2),
        ),
        child: Text(
          option,
          textAlign: TextAlign.center,
          style: languageTextStyle(
            langName,
            fontSize: 24,
            color: textColor,
          ).copyWith(
            fontWeight: FontWeight.w600,
            decoration: decoration,
            decorationColor: textColor,
          ),
        ),
      ),
    );
  }
}