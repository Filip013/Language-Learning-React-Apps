import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/widgets/ai_translate_popup.dart';
import '../../../data/configs/languages_config.dart';
import '../../../features/home/providers/home_provider.dart';
import '../providers/course_provider.dart';
import '../tabs/drill_tab.dart';
import '../tabs/lexicon_tab.dart';
import '../tabs/quiz_tab.dart';
import '../tabs/reading_tab.dart';
import '../tabs/story_tab.dart';
import '../tabs/studio_tab.dart';
import '../tabs/sweep_tab.dart';
import '../tabs/test_tab.dart';

class LanguageCourseScreen extends StatefulWidget {
  const LanguageCourseScreen({super.key});

  @override
  State<LanguageCourseScreen> createState() => _LanguageCourseScreenState();
}

class _LanguageCourseScreenState extends State<LanguageCourseScreen> {
  String _lastSelectedText = '';

  @override
  Widget build(BuildContext context) {
    final courseProv = context.watch<CourseProvider>();
    final homeProv = context.watch<HomeProvider>();
    final config = courseProv.config;
    final isDark = homeProv.isDarkMode;

    final scaffoldBg = isDark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9);
    final textSecondary = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);

    // Course flag
    final langMatch = LanguagesConfig.allCourses.firstWhere(
      (l) => l.id == courseProv.courseId,
      orElse: () => LanguagesConfig.allCourses.first,
    );

    // Tab navigation items (mirrors React navItems order & icons; the
    // Reading tab doubles as the story audio companion, so 'episode' is gone)
    final navItems = <Map<String, dynamic>>[
      {'id': 'studio', 'label': 'Studio', 'icon': Icons.chat_bubble_outline_rounded},
      if (config.hasReading || config.hasStories)
        {'id': 'reading', 'label': 'Reading', 'icon': Icons.auto_stories_outlined},
      {'id': 'drill', 'label': 'Drills', 'icon': Icons.bookmark_outline_rounded},
      {'id': 'quiz', 'label': 'Quiz', 'icon': Icons.check_circle_outline_rounded},
      if (config.hasTestTab) {'id': 'test', 'label': 'Test', 'icon': Icons.edit_outlined},
      if (config.hasSweepTab) {'id': 'sweep', 'label': 'Sweep', 'icon': Icons.monitor_heart_outlined},
      {'id': 'lexicon', 'label': 'Lexicon', 'icon': Icons.search_rounded},
      if (config.hasStories) {'id': 'story', 'label': 'Story', 'icon': Icons.book_rounded},
    ];

    return Scaffold(
      backgroundColor: scaffoldBg,
      body: SafeArea(
        child: Column(
          children: [
            // Top Header Bar: back | flag | tab icons (icon-only on mobile) | theme
            LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 768;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      IconButton(
                        constraints: compact ? const BoxConstraints() : null,
                        padding: compact ? const EdgeInsets.all(4) : const EdgeInsets.all(8),
                        icon: Icon(Icons.arrow_back_ios_new_rounded, size: compact ? 18 : 20),
                        onPressed: () => Navigator.pop(context),
                      ),
                      SizedBox(width: compact ? 4 : 6),
                      Text(langMatch.flag, style: TextStyle(fontSize: compact ? 20 : 24)),
                      SizedBox(width: compact ? 4 : 8),
                      Expanded(
                        child: LayoutBuilder(
                          builder: (context, navConstraints) {
                            return SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: ConstrainedBox(
                                constraints: BoxConstraints(minWidth: navConstraints.maxWidth),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: navItems.map((item) {
                                    final isSelected = courseProv.activeTab == item['id'];
                                    return _buildTabButton(
                                      context,
                                      icon: item['icon'] as IconData,
                                      label: item['label'] as String,
                                      isSelected: isSelected,
                                      showLabel: !compact,
                                      isDark: isDark,
                                      textSecondary: textSecondary,
                                      onTap: () => courseProv.setActiveTab(item['id'] as String),
                                    );
                                  }).toList(),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          isDark ? Icons.wb_sunny_rounded : Icons.nightlight_round,
                          color: isDark ? Colors.amber : const Color(0xFF475569),
                        ),
                        onPressed: () => homeProv.toggleTheme(),
                      ),
                    ],
                  ),
                );
              },
            ),

            const SizedBox(height: 4),

            // Active Tab Content View (selectable — right-click / long-press
            // selection menu includes AI Translate)
            Expanded(
              child: SelectionArea(
                onSelectionChanged: (selection) {
                  _lastSelectedText = selection?.plainText.trim() ?? '';
                },
                contextMenuBuilder: (context, selectableRegionState) {
                  return AdaptiveTextSelectionToolbar.buttonItems(
                    buttonItems: [
                      ...selectableRegionState.contextMenuButtonItems,
                      if (_lastSelectedText.isNotEmpty)
                        ContextMenuButtonItem(
                          type: ContextMenuButtonType.custom,
                          label: 'AI Translate',
                          onPressed: () => _openAiTranslate(context, _lastSelectedText),
                        ),
                    ],
                    anchors: selectableRegionState.contextMenuAnchors,
                  );
                },
                child: _buildActiveTabContent(courseProv.activeTab),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openAiTranslate(BuildContext context, String text) {
    final prov = Provider.of<CourseProvider>(context, listen: false);
    showAiTranslatePanel(context, prov: prov, text: text);
  }

  Widget _buildTabButton(
    BuildContext context, {
    required IconData icon,
    required String label,
    required bool isSelected,
    required bool showLabel,
    required bool isDark,
    required Color textSecondary,
    required VoidCallback onTap,
  }) {
    final selectedBg = isDark ? const Color(0xFF3F3F46) : const Color(0xFF1C1917);
    final selectedFg = isDark ? const Color(0xFFFBBF24) : Colors.white;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: isSelected ? selectedBg : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: isSelected ? selectedFg : textSecondary),
              if (showLabel) ...[
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? selectedFg : textSecondary,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActiveTabContent(String tabId) {
    switch (tabId) {
      case 'story':
        return const StoryTab();
      case 'lexicon':
        return const LexiconTab();
      case 'reading':
        return const ReadingTab();
      case 'drill':
        return const DrillTab();
      case 'quiz':
        return const QuizTab();
      case 'test':
        return const TestTab();
      case 'studio':
        return const StudioTab();
      case 'sweep':
        return const SweepTab();
      default:
        return const ReadingTab();
    }
  }
}
