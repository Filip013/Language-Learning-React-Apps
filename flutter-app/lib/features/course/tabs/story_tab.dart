import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/services/web_font_service.dart';
import '../../../core/widgets/language_text_style.dart';
import '../../../core/widgets/tab_badge.dart';
import '../../home/providers/home_provider.dart';
import '../providers/course_provider.dart';

class StoryTab extends StatefulWidget {
  const StoryTab({super.key});

  @override
  State<StoryTab> createState() => _StoryTabState();
}

class _StoryTabState extends State<StoryTab> {
  int _currentEpIdx = 0;
  bool _dropdownOpen = false;
  String? _lastStoryId;
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
    // Reset to episode 1 when the active story changes (React behavior).
    final prov = Provider.of<CourseProvider>(context, listen: false);
    final stories = prov.storyList;
    if (stories.isEmpty) return;
    final activeId = prov.activeStoryId ?? stories.first['id']?.toString();
    if (_lastStoryId != activeId) {
      _lastStoryId = activeId;
      _currentEpIdx = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts (mirrors React StoryTab key map)
  // ---------------------------------------------------------------------------

  bool _handleGlobalKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final primaryFocus = FocusManager.instance.primaryFocus;
    if (primaryFocus != null && primaryFocus.context?.widget is EditableText) {
      return false;
    }

    final courseProv = Provider.of<CourseProvider>(context, listen: false);
    if (courseProv.activeTab != 'story') return false;

    final episodes = _episodesOf(courseProv);
    if (episodes.isEmpty) return false;

    switch (event.logicalKey) {
      case LogicalKeyboardKey.arrowRight:
      case LogicalKeyboardKey.keyW:
        _handleNext(courseProv, episodes.length);
        return true;
      case LogicalKeyboardKey.arrowLeft:
      case LogicalKeyboardKey.keyQ:
        _handlePrev(courseProv);
        return true;
      case LogicalKeyboardKey.arrowDown:
      case LogicalKeyboardKey.keyS:
        _scrollBy(120);
        return true;
      case LogicalKeyboardKey.arrowUp:
      case LogicalKeyboardKey.keyA:
        _scrollBy(-120);
        return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  List<dynamic> _episodesOf(CourseProvider prov) {
    final stories = prov.storyList;
    if (stories.isEmpty) return const [];
    final active = stories.firstWhere(
      (s) => s['id'] == prov.activeStoryId,
      orElse: () => stories.first,
    );
    final episodes = active['episodes'];
    if (episodes is List) return episodes;
    return const [];
  }

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

  void _handleNext(CourseProvider prov, int total) {
    if (_currentEpIdx < total - 1) {
      setState(() => _currentEpIdx++);
      _scrollToTop();
    } else {
      prov.goToNextTab();
    }
  }

  void _handlePrev(CourseProvider prov) {
    if (_currentEpIdx > 0) {
      setState(() => _currentEpIdx--);
      _scrollToTop();
    } else {
      prov.goToPrevTab();
    }
  }

  void _goToEpisode(int idx) {
    setState(() => _currentEpIdx = idx);
    _scrollToTop();
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

    final stories = courseProv.storyList;

    if (stories.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.book_rounded, size: 48, color: textSecondary.withValues(alpha: 0.4)),
              const SizedBox(height: 16),
              Text(
                'No Stories Yet',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate a story from the Studio tab to start your story library.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    WebFontService.ensurePreferredFontsLoaded(courseProv.config.name);

    final activeStory = stories.firstWhere(
      (s) => s['id'] == courseProv.activeStoryId,
      orElse: () => stories.first,
    );
    final episodes = activeStory['episodes'] is List
        ? activeStory['episodes'] as List
        : const <dynamic>[];
    final currentEpisode = episodes.isEmpty
        ? null
        : episodes[_currentEpIdx.clamp(0, episodes.length - 1)];

    String storyTitle(Map<String, dynamic> s) {
      final t = s['currentTitle']?.toString();
      if (t != null && t.isNotEmpty) return t;
      return s['id'].toString().replaceAll('_', ' ').toUpperCase();
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1200),
          child: Column(
            children: [
              // 1. Tab badge
              const TabBadge(icon: Icons.book_rounded, label: 'STORY LIBRARY'),
              const SizedBox(height: 12),

              // 2. Story selector dropdown
              if (stories.length > 1) ...[
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: cardBorder),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      InkWell(
                        onTap: () => setState(() => _dropdownOpen = !_dropdownOpen),
                        borderRadius: BorderRadius.circular(16),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          child: Row(
                            children: [
                              Icon(
                                Icons.list_rounded,
                                size: 18,
                                color: isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  storyTitle(activeStory),
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: textPrimary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              AnimatedRotation(
                                turns: _dropdownOpen ? 0.5 : 0,
                                duration: const Duration(milliseconds: 200),
                                child: Icon(Icons.expand_more_rounded, size: 20, color: textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (_dropdownOpen)
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 240),
                          child: SingleChildScrollView(
                            child: Column(
                              children: stories.map((s) {
                                final isSelected = s['id'] == activeStory['id'];
                                return InkWell(
                                  onTap: () {
                                    courseProv.setActiveStoryId(s['id']?.toString());
                                    setState(() => _dropdownOpen = false);
                                  },
                                  child: Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? (isDark
                                              ? const Color(0xFF451A03).withValues(alpha: 0.4)
                                              : const Color(0xFFFFFBEB))
                                          : Colors.transparent,
                                      border: Border(
                                        top: BorderSide(
                                          color: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      storyTitle(s),
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                        color: isSelected
                                            ? (isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309))
                                            : textPrimary,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // 3. Main Story Card
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
                  child: Column(
                    children: [
                      // Scrollable episode body
                      Expanded(
                        child: GestureDetector(
                          behavior: HitTestBehavior.translucent,
                          onHorizontalDragEnd: (details) {
                            if (details.primaryVelocity != null) {
                              if (details.primaryVelocity! < -150) {
                                _handleNext(courseProv, episodes.length);
                              } else if (details.primaryVelocity! > 150) {
                                _handlePrev(courseProv);
                              }
                            }
                          },
                          child: SingleChildScrollView(
                            controller: _scrollController,
                            padding: const EdgeInsets.all(28),
                            child: currentEpisode == null
                                ? Center(
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 60),
                                      child: Text(
                                        'No chapters inside this story book yet.',
                                        style: TextStyle(fontSize: 14, color: textSecondary),
                                      ),
                                    ),
                                  )
                                : Column(
                                    key: ValueKey(currentEpisode['id'] ?? _currentEpIdx),
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        currentEpisode['title']?.toString() ?? 'Chapter ${_currentEpIdx + 1}',
                                        style: languageTextStyle(
                                          courseProv.config.name,
                                          fontSize: 18,
                                          color: textPrimary,
                                          isBold: true,
                                        ),
                                      ),
                                      Container(
                                        height: 2,
                                        margin: const EdgeInsets.only(top: 8, bottom: 20),
                                        decoration: BoxDecoration(
                                          color: isDark ? const Color(0xFF3F3F46) : const Color(0xFFE7E5E4),
                                          borderRadius: BorderRadius.circular(1),
                                        ),
                                      ),
                                      ...(currentEpisode['text']?.toString() ?? '')
                                          .split('\n\n')
                                          .where((p) => p.trim().isNotEmpty)
                                          .map((p) => Padding(
                                                padding: const EdgeInsets.only(bottom: 16),
                                                child: Text(
                                                  p,
                                                  style: languageTextStyle(
                                                    courseProv.config.name,
                                                    fontSize: 20,
                                                    color: textPrimary,
                                                  ),
                                                ),
                                              )),
                                    ],
                                  ),
                          ),
                        ),
                      ),

                      // 4. Story title footer
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          border: Border(top: BorderSide(color: cardBorder.withValues(alpha: 0.5))),
                        ),
                        child: Text(
                          storyTitle(activeStory),
                          textAlign: TextAlign.center,
                          style: languageTextStyle(
                            courseProv.config.name,
                            fontSize: 18,
                            color: textPrimary,
                            isBold: true,
                          ),
                        ),
                      ),

                      // 5. Episode nav bar
                      if (episodes.length > 1)
                        Container(
                          padding: const EdgeInsets.only(top: 8),
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
                                onPressed: _currentEpIdx > 0
                                    ? () => _handlePrev(courseProv)
                                    : null,
                                icon: const Icon(Icons.chevron_left_rounded, size: 18),
                                label: const Text('Prev'),
                                style: TextButton.styleFrom(
                                  foregroundColor: textPrimary,
                                  disabledForegroundColor: textSecondary.withValues(alpha: 0.3),
                                ),
                              ),
                              SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(
                                  children: List.generate(episodes.length, (idx) {
                                    final isCurrent = idx == _currentEpIdx;
                                    return Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 3),
                                      child: InkWell(
                                        onTap: () => _goToEpisode(idx),
                                        borderRadius: BorderRadius.circular(10),
                                        child: Container(
                                          width: 34,
                                          height: 34,
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: isCurrent
                                                ? (isDark ? const Color(0xFFD97706) : const Color(0xFFFFF7ED))
                                                : cardBg,
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(
                                              color: isCurrent
                                                  ? (isDark ? const Color(0xFFF59E0B) : const Color(0xFFFBBF24))
                                                  : cardBorder,
                                            ),
                                          ),
                                          child: Text(
                                            '${idx + 1}',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: isCurrent
                                                  ? (isDark ? const Color(0xFF1C1917) : const Color(0xFF92400E))
                                                  : textSecondary,
                                            ),
                                          ),
                                        ),
                                      ),
                                    );
                                  }),
                                ),
                              ),
                              TextButton.icon(
                                onPressed: _currentEpIdx < episodes.length - 1
                                    ? () => _handleNext(courseProv, episodes.length)
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
  }
}
