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
import '../providers/course_provider.dart';
import '../../home/providers/home_provider.dart';

class ReadingTab extends StatefulWidget {
  const ReadingTab({super.key});

  @override
  State<ReadingTab> createState() => _ReadingTabState();
}

class _ReadingTabState extends State<ReadingTab> {
  String _activeView = '';
  String? _autoNavigatedEpisodeId;

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleGlobalKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleGlobalKey);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Resume at the first un-listened page whenever the active episode changes
    // (mirrors React ReadingTab). Listened marking is deferred to post-frame
    // to avoid notifying providers during the build phase.
    _maybeAutoNavigate(Provider.of<CourseProvider>(context, listen: false));
  }

  void _maybeAutoNavigate(CourseProvider courseProv) {
    final episode = courseProv.activeEpisode;
    if (episode == null) return;
    final epId = episode['id']?.toString() ?? '';
    if (epId.isEmpty || _autoNavigatedEpisodeId == epId) return;

    final pages = _buildPages(courseProv);
    if (pages.isNotEmpty) {
      final listened = courseProv.listenedReading;
      final unlistened = pages.where((p) => !listened.contains(p['id'])).toList();
      final hasDefs = pages.any((p) => p['id'] == 'defs');

      String targetId;
      if (unlistened.isNotEmpty) {
        targetId = unlistened.first['id']!;
      } else if (hasDefs) {
        targetId = 'defs';
      } else {
        targetId = pages.first['id']!;
      }

      _activeView = targetId;

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final listenedNow = courseProv.listenedReading;
        if (!listenedNow.contains(targetId)) {
          courseProv.updateFirebase({
            'listenedReading': [...listenedNow, targetId],
          });
        }
      });
    }

    _autoNavigatedEpisodeId = epId;
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts (mirrors React ReadingTab key map)
  // ---------------------------------------------------------------------------

  bool _handleGlobalKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final primaryFocus = FocusManager.instance.primaryFocus;
    if (primaryFocus != null && primaryFocus.context?.widget is EditableText) {
      return false;
    }

    final courseProv = Provider.of<CourseProvider>(context, listen: false);
    if (courseProv.activeTab != 'reading') {
      return false;
    }

    final pages = _buildPages(courseProv);
    if (pages.isEmpty) return false;

    final effectiveView = _getEffectiveView(pages);
    final currentIdx = pages.indexWhere((p) => p['id'] == effectiveView);
    final key = event.logicalKey;

    if (key == LogicalKeyboardKey.arrowRight ||
        key == LogicalKeyboardKey.keyW ||
        key == LogicalKeyboardKey.keyD) {
      if (currentIdx < pages.length - 1) {
        _setView(courseProv, pages[currentIdx + 1]['id']!);
        return true;
      }
      // At the last sub-view: chain to the next tab (mirrors React's
      // `else if (onTabNext) onTabNext()` in handleNext).
      courseProv.goToNextTab();
      return true;
    }

    if (key == LogicalKeyboardKey.arrowLeft ||
        key == LogicalKeyboardKey.keyQ ||
        key == LogicalKeyboardKey.keyA) {
      if (currentIdx > 0) {
        _setView(courseProv, pages[currentIdx - 1]['id']!);
        return true;
      }
      // At the first sub-view: chain back to the previous tab.
      courseProv.goToPrevTab();
      return true;
    }

    if (key == LogicalKeyboardKey.space) {
      if (courseProv.playingId != null || TTSService.isPlaying) {
        courseProv.speakText('', courseProv.playingId ?? 'stop');
        return true;
      }
      final activePage = pages[currentIdx < 0 ? 0 : currentIdx];
      final textToSpeak = activePage['text'] ?? '';
      if (textToSpeak.toString().isNotEmpty) {
        courseProv.speakText(textToSpeak.toString(), activePage['id']!);
        return true;
      }
    }

    if (key == LogicalKeyboardKey.keyN && effectiveView == 'focus') {
      _openNote(courseProv, 'reading_focus', 'Focus & Grammar Notes');
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /// Navigate to [viewId] and mark it as listened in progress (React behavior).
  void _setView(CourseProvider courseProv, String viewId) {
    if (_activeView == viewId) return;
    setState(() => _activeView = viewId);

    final listened = courseProv.listenedReading;
    if (!listened.contains(viewId)) {
      courseProv.updateFirebase({
        'listenedReading': [...listened, viewId],
      });
    }
  }

  void _playView(CourseProvider courseProv, String viewId) {
    for (final p in _buildPages(courseProv)) {
      if (p['id'] == viewId) {
        final text = p['text'] ?? '';
        if (text.isNotEmpty) {
          courseProv.speakText(text, viewId);
        }
        return;
      }
    }
  }

  void _openNote(CourseProvider courseProv, String id, String title) {
    final existing = courseProv.progressNotes[id]?.toString() ?? '';
    UserNoteModal.show(
      context,
      targetText: title,
      existingNote: existing,
      onSave: (note) {
        final updated = Map<String, dynamic>.from(courseProv.progressNotes);
        updated[id] = note;
        courseProv.updateFirebase({'notes': updated});
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Page building
  // ---------------------------------------------------------------------------

  List<Map<String, String>> _buildPages(CourseProvider courseProv) {
    final activeEpisode = courseProv.activeEpisode;
    if (activeEpisode == null) return [];

    final config = courseProv.config;
    final reading = activeEpisode['reading'] as Map<String, dynamic>?;
    final story = activeEpisode['story'] as Map<String, dynamic>?;

    final pages = <Map<String, String>>[];

    // 1. Definitions
    if (reading != null && reading['definitions'] is List && (reading['definitions'] as List).isNotEmpty) {
      final defsList = reading['definitions'] as List;
      final defsText = defsList.map((d) => "${d['word'] ?? ''}. ${d['text'] ?? ''}").join(' ');
      pages.add({'id': 'defs', 'label': 'Definitions', 'text': defsText});
    }

    // 2. Reading / Target Script
    final targetText = (reading != null ? reading[config.primaryTextKey] : null) ??
        (story != null ? story[config.primaryTextKey] : null);

    if (targetText != null && targetText.toString().isNotEmpty) {
      final label = (config.labels[config.primaryTextKey]) ?? config.name;
      pages.add({'id': 'read', 'label': label, 'text': targetText.toString()});
    }

    // 3. Secondary Script (e.g. Simplified Chinese)
    if (config.secondaryScriptKey != null) {
      final secText = (story != null ? story[config.secondaryScriptKey] : null);
      if (secText != null && secText.toString().isNotEmpty) {
        final label = config.labels[config.secondaryScriptKey] ?? 'Secondary Script';
        pages.add({'id': 'sec', 'label': label, 'text': secText.toString()});
      }
    }

    // 4. Translation
    final engText = (reading != null ? reading['english'] : null) ??
        (story != null ? story['english'] : null);
    if (engText != null && engText.toString().isNotEmpty) {
      pages.add({'id': 'eng', 'label': 'Translation', 'text': engText.toString()});
    }

    // 5. Focus & Grammar
    if (reading != null && reading['focus'] is List && (reading['focus'] as List).isNotEmpty) {
      pages.add({'id': 'focus', 'label': 'Focus & Grammar', 'text': ''});
    }

    return pages;
  }

  String _getEffectiveView(List<Map<String, String>> pages) {
    if (pages.isEmpty) return 'read';
    if (_activeView.isNotEmpty && pages.any((p) => p['id'] == _activeView)) {
      return _activeView;
    }
    return pages.first['id']!;
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

    final activeEpisode = courseProv.activeEpisode;
    if (activeEpisode == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.menu_book_rounded, size: 48, color: textSecondary.withValues(alpha: 0.4)),
              const SizedBox(height: 16),
              Text(
                'No Lesson Available',
                style: TextStyle(fontSize: platformFontSize(18), fontWeight: FontWeight.bold, color: textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                'Please select or generate a lesson from the Studio tab.',
                style: TextStyle(fontSize: platformFontSize(14), color: textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    WebFontService.ensurePreferredFontsLoaded(courseProv.config.name);

    final pages = _buildPages(courseProv);
    final effectiveView = _getEffectiveView(pages);
    final currentIdx = pages.indexWhere((p) => p['id'] == effectiveView);
    final listened = courseProv.listenedReading;
    final footerLabel = pages.isEmpty ? '' : pages[currentIdx < 0 ? 0 : currentIdx]['label'] ?? '';

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragEnd: (details) {
        if (details.primaryVelocity == null) return;
        final v = details.primaryVelocity!;
        if (v < -150) {
          // At the last sub-view: chain to the next tab (mirrors React's
          // `else if (onTabNext) onTabNext()`).
          if (currentIdx < pages.length - 1) {
            _setView(courseProv, pages[currentIdx + 1]['id']!);
          } else {
            courseProv.goToNextTab();
          }
        } else if (v > 150) {
          // At the first sub-view: chain back to the previous tab.
          if (currentIdx > 0) {
            _setView(courseProv, pages[currentIdx - 1]['id']!);
          } else {
            courseProv.goToPrevTab();
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
                    // 1. Tab Badge
                    const TabBadge(icon: Icons.menu_book_rounded, label: 'READING PRACTICE'),
                    SizedBox(height: isMobile ? 6 : 12),

                    // 2. Sub-page Pill Selector Bar (Drill-style pills with states)
                    if (pages.length > 1)
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
                            children: pages.map((p) {
                              final isSelected = p['id'] == effectiveView;
                              final isListened = listened.contains(p['id']);

                              Color pillColor;
                              if (isSelected) {
                                pillColor = isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309);
                              } else if (isListened) {
                                pillColor = isDark ? const Color(0xFF34D399) : const Color(0xFF059669);
                              } else {
                                pillColor = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);
                              }

                              final label = p['label']!;

                              return Padding(
                                padding: EdgeInsets.symmetric(horizontal: isMobile ? 1 : 3),
                                child: InkWell(
                                  onTap: () => _setView(courseProv, p['id']!),
                                  borderRadius: BorderRadius.circular(10),
                                  child: Container(
                                    padding: EdgeInsets.symmetric(
                                      horizontal: isMobile ? 8 : 12,
                                      vertical: isMobile ? 6 : 7,
                                    ),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? (isDark ? const Color(0xFF27272A) : Colors.white)
                                          : Colors.transparent,
                                      borderRadius: BorderRadius.circular(10),
                                      border: isSelected ? Border.all(color: cardBorder) : null,
                                    ),
                                    child: Text(
                                      label,
                                      style: TextStyle(
                                        fontSize: platformFontSize(isMobile ? 11 : 13),
                                        fontWeight: FontWeight.bold,
                                        color: pillColor,
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),

                    if (pages.length > 1) SizedBox(height: isMobile ? 8 : 12),

                    // 3. Main Content Card
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
                            // Scrollable Body Content
                            Expanded(
                              child: SingleChildScrollView(
                                padding: EdgeInsets.all(isMobile ? 16 : 28),
                                child: _buildPageBody(context, courseProv, effectiveView, activeEpisode, isDark, cardBorder, textPrimary, textSecondary),
                              ),
                            ),

                        // Per-view Footer Bar (title + TTS / Note actions)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            border: Border(top: BorderSide(color: cardBorder.withValues(alpha: 0.5))),
                          ),
                          child: _buildViewFooter(
                            context,
                            courseProv,
                            effectiveView,
                            footerLabel,
                            textPrimary,
                            textSecondary,
                          ),
                        ),

                        // Pinned Bottom Nav Bar (Prev / Page / Next)
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
                                onPressed: currentIdx > 0
                                    ? () => _setView(courseProv, pages[currentIdx - 1]['id']!)
                                    : null,
                                icon: const Icon(Icons.chevron_left_rounded, size: 18),
                                label: Text('Prev'),
                                style: TextButton.styleFrom(
                                  foregroundColor: textPrimary,
                                  disabledForegroundColor: textSecondary.withValues(alpha: 0.3),
                                ),
                              ),

                              Text(
                                pages.isNotEmpty ? 'Page ${currentIdx + 1} of ${pages.length}' : '',
                                style: TextStyle(
                                  fontSize: platformFontSize(11),
                                  fontWeight: FontWeight.bold,
                                  color: textSecondary,
                                  letterSpacing: 1.2,
                                ),
                              ),

                              TextButton.icon(
                                onPressed: currentIdx < pages.length - 1
                                    ? () => _setView(courseProv, pages[currentIdx + 1]['id']!)
                                    : null,
                                label: Text('Next'),
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

  /// Footer bar for the active subtab: page title + contextual action
  /// (PlayButton for text pages, Note button for Focus & Grammar).
  Widget _buildViewFooter(
    BuildContext context,
    CourseProvider courseProv,
    String viewId,
    String label,
    Color textPrimary,
    Color textSecondary,
  ) {
    final title = Text(
      label,
      style: TextStyle(fontSize: platformFontSize(14), fontWeight: FontWeight.bold, color: textPrimary),
    );

    // Focus & Grammar: lightbulb title + note button
    if (viewId == 'focus') {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.lightbulb_outline_rounded, size: 18, color: Color(0xFFF59E0B)),
              const SizedBox(width: 6),
              title,
            ],
          ),
          _buildNoteButton(courseProv, 'reading_focus', 'Focus & Grammar Notes', textSecondary),
        ],
      );
    }

    // Text pages: title + TTS play button
    final ttsIds = {'defs', 'read', 'sec', 'eng'};
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        title,
        if (ttsIds.contains(viewId))
          PlayButton(
            size: 36,
            isPlaying: courseProv.playingId == viewId,
            onPressed: () => _playView(courseProv, viewId),
          ),
      ],
    );
  }

  Widget _buildNoteButton(
    CourseProvider courseProv,
    String id,
    String title,
    Color textSecondary,
  ) {
    final hasNote = (courseProv.progressNotes[id]?.toString() ?? '').isNotEmpty;
    return IconButton(
      onPressed: () => _openNote(courseProv, id, title),
      icon: Icon(
        Icons.note_alt_outlined,
        size: 20,
        color: hasNote ? const Color(0xFF2563EB) : textSecondary,
      ),
      tooltip: 'Add Note (N)',
    );
  }

  Widget _buildPageBody(
    BuildContext context,
    CourseProvider courseProv,
    String viewId,
    Map<String, dynamic> activeEpisode,
    bool isDark,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    final reading = activeEpisode['reading'] as Map<String, dynamic>?;
    final story = activeEpisode['story'] as Map<String, dynamic>?;

    // DEFINITIONS VIEW
    if (viewId == 'defs' && reading != null && reading['definitions'] is List) {
      final defs = reading['definitions'] as List;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ...defs.map((d) {
            final word = d['word']?.toString() ?? '';
            final text = d['text']?.toString() ?? '';
            return Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF121215) : const Color(0xFFFAFAF9),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: cardBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    word,
                    style: languageTextStyle(courseProv.config.name, fontSize: 20, color: textPrimary, isBold: true),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    text,
                    style: TextStyle(fontSize: platformFontSize(16), color: textPrimary, height: 1.5),
                  ),
                ],
              ),
            );
          }),
        ],
      );
    }

    // READING / TARGET SCRIPT VIEW
    if (viewId == 'read') {
      final targetText = (reading != null ? reading[courseProv.config.primaryTextKey] : null) ??
          (story != null ? story[courseProv.config.primaryTextKey] : null) ?? '';

      return Text(
        targetText.toString(),
        style: languageTextStyle(courseProv.config.name, fontSize: 18, color: textPrimary),
      );
    }

    // SECONDARY SCRIPT VIEW
    if (viewId == 'sec') {
      final secText = story != null ? story[courseProv.config.secondaryScriptKey] : '';
      return Text(
        secText.toString(),
        style: languageTextStyle(courseProv.config.name, fontSize: 24, color: textPrimary, isSimplified: true),
      );
    }

    // TRANSLATION VIEW
    if (viewId == 'eng') {
      final engText = (reading != null ? reading['english'] : null) ??
          (story != null ? story['english'] : null) ?? '';

      return Text(
        engText.toString(),
        style: TextStyle(fontSize: platformFontSize(16), color: textPrimary, height: 1.5, fontWeight: FontWeight.w500),
      );
    }

    // FOCUS & GRAMMAR VIEW
    if (viewId == 'focus' && reading != null && reading['focus'] is List) {
      final focusItems = reading['focus'] as List;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ...focusItems.asMap().entries.map((entry) {
            final idx = entry.key + 1;
            final item = entry.value;

            String title = '';
            String explanation = '';

            if (item is Map) {
              title = (item['word'] ?? item['title'] ?? item['topic'] ?? item['term'] ?? '').toString();
              explanation = (item['explanation'] ?? item['text'] ?? item['note'] ?? item['meaning'] ?? '').toString();
            } else {
              explanation = item.toString();
            }

            return Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB).withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF2563EB).withValues(alpha: 0.15)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title.isNotEmpty ? '$idx. $title' : '$idx.',
                    style: languageTextStyle(courseProv.config.name, fontSize: 18, color: textPrimary, isBold: true),
                  ),
                  if (explanation.isNotEmpty) const SizedBox(height: 6),
                  if (explanation.isNotEmpty)
                    Text(explanation, style: TextStyle(fontSize: platformFontSize(15), color: textPrimary, height: 1.4)),
                ],
              ),
            );
          }),
        ],
      );
    }

    return const SizedBox.shrink();
  }
}
