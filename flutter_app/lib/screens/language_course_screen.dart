// lib/screens/language_course_screen.dart
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:lingocraft_flutter/constants/course_configs.dart';
import 'package:lingocraft_flutter/constants/languages.dart';
import 'package:lingocraft_flutter/models/course_models.dart';
import 'package:lingocraft_flutter/providers/app_provider.dart';
import 'package:lingocraft_flutter/providers/course_provider.dart';
import 'package:lingocraft_flutter/widgets/user_note_modal.dart';

class LanguageCourseScreen extends StatefulWidget {
  const LanguageCourseScreen({super.key});

  @override
  State<LanguageCourseScreen> createState() => _LanguageCourseScreenState();
}

class _LanguageCourseScreenState extends State<LanguageCourseScreen> {
  final TextEditingController _promptController = TextEditingController();
  final TextEditingController _importJsonController = TextEditingController();
  bool _showImportBox = false;
  String _audioSubTab = 'primary';
  String _readingSubTab = 'defs';
  int _drillWordIdx = 0;
  int _drillExIdx = 0;
  int _quizIdx = 0;
  int _testIdx = 0;
  int _sweepIdx = 0;

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_onGlobalKeyEvent);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_onGlobalKeyEvent);
    _promptController.dispose();
    _importJsonController.dispose();
    super.dispose();
  }

  int _getSafeIndex(int currentIdx, int length) {
    if (length <= 0) return 0;
    if (currentIdx < 0) return 0;
    if (currentIdx >= length) return length - 1;
    return currentIdx;
  }

  bool _onGlobalKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return false;
    final prov = context.read<CourseProvider>();
    final ep = prov.currentEpisode;
    final key = event.logicalKey;

    if (FocusManager.instance.primaryFocus?.context?.widget is EditableText) {
      return false;
    }

    final isNext = key == LogicalKeyboardKey.arrowRight ||
        key == LogicalKeyboardKey.keyW ||
        key == LogicalKeyboardKey.keyD;
    final isPrev = key == LogicalKeyboardKey.arrowLeft ||
        key == LogicalKeyboardKey.keyQ ||
        key == LogicalKeyboardKey.keyA;

    if (isNext) {
      if (prov.activeTab == 'vocab' && ep != null && ep.drills.isNotEmpty) {
        final safeWIdx = _getSafeIndex(_drillWordIdx, ep.drills.length);
        final currentWord = ep.drills[safeWIdx];
        if (_drillExIdx < currentWord.examples.length - 1) {
          setState(() => _drillExIdx += 1);
        } else if (_drillWordIdx < ep.drills.length - 1) {
          setState(() {
            _drillWordIdx += 1;
            _drillExIdx = 0;
          });
        }
        return true;
      } else if (prov.activeTab == 'quiz' && ep != null && ep.quiz.isNotEmpty) {
        setState(() => _quizIdx = _getSafeIndex(_quizIdx + 1, ep.quiz.length));
        return true;
      } else if (prov.activeTab == 'test' && ep != null && ep.test.isNotEmpty) {
        setState(() => _testIdx = _getSafeIndex(_testIdx + 1, ep.test.length));
        return true;
      } else if (prov.activeTab == 'sweep' && ep != null && ep.sweep.isNotEmpty) {
        setState(() => _sweepIdx = _getSafeIndex(_sweepIdx + 1, ep.sweep.length));
        return true;
      }
    } else if (isPrev) {
      if (prov.activeTab == 'vocab' && ep != null && ep.drills.isNotEmpty) {
        if (_drillExIdx > 0) {
          setState(() => _drillExIdx -= 1);
        } else if (_drillWordIdx > 0) {
          setState(() {
            _drillWordIdx -= 1;
            final prevWord = ep.drills[_drillWordIdx];
            _drillExIdx = (prevWord.examples.length - 1).clamp(0, 9999);
          });
        }
        return true;
      } else if (prov.activeTab == 'quiz' && ep != null && ep.quiz.isNotEmpty) {
        setState(() => _quizIdx = _getSafeIndex(_quizIdx - 1, ep.quiz.length));
        return true;
      } else if (prov.activeTab == 'test' && ep != null && ep.test.isNotEmpty) {
        setState(() => _testIdx = _getSafeIndex(_testIdx - 1, ep.test.length));
        return true;
      } else if (prov.activeTab == 'sweep' && ep != null && ep.sweep.isNotEmpty) {
        setState(() => _sweepIdx = _getSafeIndex(_sweepIdx - 1, ep.sweep.length));
        return true;
      }
    }
    return false;
  }

  List<Map<String, dynamic>> _getAvailableTabs(CourseConfig config, Episode? ep) {
    return [
      {'id': 'studio', 'label': 'Studio', 'icon': Icons.tune_rounded},
      if (config.hasStories && (ep?.storyScripts.isNotEmpty ?? false))
        {'id': 'episode', 'label': 'Audio', 'icon': Icons.volume_up_rounded},
      if (config.hasReading && ep?.reading != null)
        {'id': 'reading', 'label': 'Reading', 'icon': Icons.menu_book_rounded},
      if (ep != null && ep.drills.isNotEmpty)
        {'id': 'vocab', 'label': 'Drills', 'icon': Icons.translate_rounded},
      if (ep != null && ep.quiz.isNotEmpty)
        {'id': 'quiz', 'label': 'Quiz', 'icon': Icons.quiz_rounded},
      if (config.hasTestTab && ep != null && ep.test.isNotEmpty)
        {'id': 'test', 'label': 'Test', 'icon': Icons.edit_note_rounded},
      if (config.hasSweepTab && ep != null && ep.sweep.isNotEmpty)
        {'id': 'sweep', 'label': 'Sweep', 'icon': Icons.bolt_rounded},
    ];
  }

  @override
  Widget build(BuildContext context) {
    final appProv = context.watch<AppProvider>();
    final courseProv = context.watch<CourseProvider>();
    final dark = appProv.isDarkMode;
    final cfg = courseProv.selectedConfig;

    final bg = dark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9);
    final surface = dark ? const Color(0xFF18181B) : Colors.white;
    final border = dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4);
    final textPrimary = dark ? const Color(0xFFF4F4F5) : const Color(0xFF1C1917);
    final textMuted = dark ? const Color(0xFF71717A) : const Color(0xFF78716C);

    final availableTabs = _getAvailableTabs(cfg, courseProv.currentEpisode);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: surface,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Row(
          children: [
            DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: cfg.id,
                dropdownColor: surface,
                style: GoogleFonts.inter(
                  color: textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
                items: kCourseConfigs.values.map((c) {
                  return DropdownMenuItem<String>(
                    value: c.id,
                    child: Text('${c.flag} ${c.name}'),
                  );
                }).toList(),
                onChanged: (id) {
                  if (id != null) courseProv.selectCourse(id);
                },
              ),
            ),
            if (courseProv.episodes.isNotEmpty) ...[
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    value: courseProv.selectedEpisodeIdx,
                    dropdownColor: surface,
                    isExpanded: true,
                    style: GoogleFonts.inter(
                      color: const Color(0xFF2563EB),
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                    items: List.generate(courseProv.episodes.length, (index) {
                      final ep = courseProv.episodes[index];
                      return DropdownMenuItem<int>(
                        value: index,
                        child: Text(
                          ep.title.isNotEmpty ? ep.title : 'Episode ${index + 1}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }),
                    onChanged: (idx) {
                      if (idx != null) courseProv.setEpisodeIndex(idx);
                    },
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              dark ? Icons.wb_sunny_rounded : Icons.nightlight_round,
              color: dark ? const Color(0xFFF59E0B) : const Color(0xFF475569),
            ),
            onPressed: appProv.toggleTheme,
            tooltip: 'Toggle Theme',
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          // Sub-Header: Modular Tab Navigator
          Container(
            color: surface,
            width: double.infinity,
            alignment: Alignment.center,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 900),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: availableTabs.map((tab) {
                    return _TabButton(
                      label: tab['label'] as String,
                      icon: tab['icon'] as IconData,
                      active: courseProv.activeTab == tab['id'],
                      dark: dark,
                      onTap: () => courseProv.setActiveTab(tab['id'] as String),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
          Divider(height: 1, color: border),

          // Main Tab Body Content
          Expanded(
            child: _buildActiveTabContent(
              context,
              courseProv,
              dark,
              surface,
              border,
              textPrimary,
              textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveTabContent(
    BuildContext context,
    CourseProvider prov,
    bool dark,
    Color surface,
    Color border,
    Color textPrimary,
    Color textMuted,
  ) {
    if (prov.activeTab == 'studio') {
      return _buildStudioView(prov, dark, surface, border, textPrimary, textMuted);
    }

    if (prov.loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF2563EB)),
      );
    }

    final ep = prov.currentEpisode;

    if (ep == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.menu_book_rounded, size: 48, color: textMuted),
              const SizedBox(height: 16),
              Text(
                'No episode content loaded for ${prov.selectedConfig.name}.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              ElevatedButton.icon(
                onPressed: () => prov.setActiveTab('studio'),
                icon: const Icon(Icons.tune_rounded, size: 16),
                label: const Text('Open Studio Control'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final availableTabs = _getAvailableTabs(prov.selectedConfig, ep);
    final availableIds = availableTabs.map((t) => t['id'] as String).toSet();

    final activeTab = availableIds.contains(prov.activeTab)
        ? prov.activeTab
        : (availableIds.contains('episode')
            ? 'episode'
            : (availableIds.contains('reading') ? 'reading' : 'studio'));

    Widget content;
    switch (activeTab) {
      case 'studio':
        content = _buildStudioView(prov, dark, surface, border, textPrimary, textMuted);
        break;
      case 'episode':
        content = _buildEpisodeView(ep, prov, dark, surface, border, textPrimary, textMuted);
        break;
      case 'reading':
        content = _buildReadingView(ep, prov, dark, surface, border, textPrimary, textMuted);
        break;
      case 'vocab':
        content = _buildVocabListView(ep, prov, dark, surface, border, textPrimary, textMuted);
        break;
      case 'quiz':
        content = _buildQuizView(ep, prov, dark, surface, border, textPrimary, textMuted);
        break;
      case 'test':
        content = _buildTestView(ep, prov, dark, surface, border, textPrimary, textMuted);
        break;
      case 'sweep':
        content = _buildSweepView(ep, prov, dark, surface, border, textPrimary, textMuted);
        break;
      default:
        content = _buildStudioView(prov, dark, surface, border, textPrimary, textMuted);
        break;
    }

    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 900),
        width: double.infinity,
        height: double.infinity,
        child: content,
      ),
    );
  }

  Widget _buildStudioView(
    CourseProvider prov,
    bool dark,
    Color surface,
    Color border,
    Color textPrimary,
    Color textMuted,
  ) {
    final ep = prov.currentEpisode;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: border),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.tune_rounded, color: Color(0xFF2563EB), size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Studio Control',
                        style: GoogleFonts.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: textPrimary,
                        ),
                      ),
                      Text(
                        '${prov.selectedConfig.name} • ${prov.episodes.length} Episodes Loaded',
                        style: GoogleFonts.inter(fontSize: 12, color: textMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Tutor Response & User Prompt Section in Studio Tab
          if (ep != null) ...[
            if (ep.userPrompt.isNotEmpty) ...[
              Align(
                alignment: Alignment.centerRight,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 600),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(16),
                      topRight: Radius.circular(4),
                      bottomLeft: Radius.circular(16),
                      bottomRight: Radius.circular(16),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('YOU', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: textMuted)),
                      const SizedBox(height: 4),
                      Text(ep.userPrompt, style: GoogleFonts.inter(fontSize: 14, color: textPrimary)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (ep.tutorIntroduction.isNotEmpty) ...[
              Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 600),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: dark ? const Color(0xFF1E293B) : const Color(0xFFEFF6FF),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(4),
                      topRight: Radius.circular(16),
                      bottomLeft: Radius.circular(16),
                      bottomRight: Radius.circular(16),
                    ),
                    border: Border.all(color: const Color(0xFF2563EB).withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('TUTOR', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: const Color(0xFF2563EB))),
                      const SizedBox(height: 4),
                      Text(ep.tutorIntroduction, style: GoogleFonts.inter(fontSize: 14, color: textPrimary, height: 1.5)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ],

          // Prompt AI Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Prompt the AI',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Specify a topic, context, or target vocabulary to generate the next lesson.',
                  style: GoogleFonts.inter(fontSize: 12, color: textMuted),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _promptController,
                  enabled: !prov.isGenerating,
                  maxLines: 3,
                  style: GoogleFonts.inter(fontSize: 14, color: textPrimary),
                  decoration: InputDecoration(
                    hintText: 'e.g., Focus on restaurant vocabulary and past tense verbs...',
                    hintStyle: GoogleFonts.inter(fontSize: 13, color: textMuted),
                    filled: true,
                    fillColor: dark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: border),
                    ),
                  ),
                ),
                if (prov.genError != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    prov.genError!,
                    style: GoogleFonts.inter(fontSize: 12, color: Colors.red),
                  ),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: prov.isGenerating
                        ? null
                        : () {
                            if (_promptController.text.trim().isNotEmpty) {
                              prov.generateNextEpisode(_promptController.text.trim());
                            }
                          },
                    icon: prov.isGenerating
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.auto_awesome_rounded, size: 18),
                    label: Text(
                      prov.isGenerating ? 'Generating Episode...' : 'Generate Episode with AI',
                      style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Import JSON Section
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Import Lesson JSON',
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: textPrimary,
                      ),
                    ),
                    TextButton(
                      onPressed: () => setState(() => _showImportBox = !_showImportBox),
                      child: Text(
                        _showImportBox ? 'Hide' : 'Paste Payload',
                        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                if (_showImportBox) ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _importJsonController,
                    maxLines: 5,
                    style: TextStyle(fontFamily: 'monospace', fontSize: 12, color: textPrimary),
                    decoration: InputDecoration(
                      hintText: 'Paste raw lesson JSON here...',
                      hintStyle: GoogleFonts.inter(fontSize: 12, color: textMuted),
                      filled: true,
                      fillColor: dark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: border),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () {
                      if (_importJsonController.text.trim().isNotEmpty) {
                        prov.importEpisodeJSON(_importJsonController.text.trim());
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                      foregroundColor: textPrimary,
                    ),
                    child: const Text('Import JSON'),
                  ),
                ],
              ],
            ),
          ),

          if (prov.episodes.isNotEmpty && ep != null) ...[
            const SizedBox(height: 32),
            Center(
              child: ElevatedButton.icon(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      backgroundColor: dark ? const Color(0xFF18181B) : Colors.white,
                      title: Text('Delete Episode?', style: GoogleFonts.inter(color: textPrimary)),
                      content: Text(
                        'Are you sure you want to delete "${ep.title}"?',
                        style: GoogleFonts.inter(color: textMuted),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: Text('Cancel', style: GoogleFonts.inter(color: textMuted)),
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.pop(ctx);
                            prov.deleteEpisode(ep.id);
                          },
                          child: Text('Delete', style: GoogleFonts.inter(color: Colors.red)),
                        ),
                      ],
                    ),
                  );
                },
                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                label: const Text('Delete Current Episode'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: dark ? const Color(0xFF7F1D1D).withValues(alpha: 0.2) : const Color(0xFFFEF2F2),
                  foregroundColor: Colors.red,
                  elevation: 0,
                  side: const BorderSide(color: Colors.red),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEpisodeView(
    Episode ep,
    CourseProvider prov,
    bool dark,
    Color surface,
    Color border,
    Color textPrimary,
    Color textMuted,
  ) {
    final cfg = prov.selectedConfig;

    final List<Map<String, String>> versions = [];
    if (ep.storyScripts.containsKey(cfg.primaryTextKey) && ep.storyScripts[cfg.primaryTextKey]!.isNotEmpty) {
      versions.add({'id': cfg.primaryTextKey, 'label': cfg.labels[cfg.primaryTextKey] ?? cfg.primaryTextKey.toUpperCase()});
    }
    if (ep.storyScripts.containsKey('english') && ep.storyScripts['english']!.isNotEmpty) {
      versions.add({'id': 'english', 'label': 'English'});
    }
    if (cfg.secondaryScriptKey != null && ep.storyScripts.containsKey(cfg.secondaryScriptKey) && ep.storyScripts[cfg.secondaryScriptKey]!.isNotEmpty) {
      versions.add({'id': cfg.secondaryScriptKey!, 'label': cfg.labels[cfg.secondaryScriptKey] ?? cfg.secondaryScriptKey!.toUpperCase()});
    }
    if (cfg.transliterationKey != null && ep.storyScripts.containsKey(cfg.transliterationKey) && ep.storyScripts[cfg.transliterationKey]!.isNotEmpty) {
      versions.add({'id': cfg.transliterationKey!, 'label': cfg.labels[cfg.transliterationKey] ?? cfg.transliterationKey!.toUpperCase()});
    }

    if (versions.isEmpty) {
      return Center(child: Text('No story content available.', style: GoogleFonts.inter(color: textMuted)));
    }

    final activeSub = versions.any((v) => v['id'] == _audioSubTab) ? _audioSubTab : versions.first['id']!;
    final activeText = ep.storyScripts[activeSub] ?? '';

    return Column(
      children: [
        // Sub-tabs bar
        Container(
          color: surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: versions.map((v) {
              final active = v['id'] == activeSub;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(v['label']!),
                  selected: active,
                  onSelected: (selected) {
                    if (selected) setState(() => _audioSubTab = v['id']!);
                  },
                  selectedColor: const Color(0xFF2563EB),
                  backgroundColor: dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                  labelStyle: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: active ? Colors.white : textMuted,
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        Divider(height: 1, color: border),

        // Body content
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        ep.title,
                        style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold, color: textPrimary),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF2563EB), size: 28),
                      onPressed: () => prov.toggleAudio(0, [activeText]),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  activeText,
                  style: getTargetLanguageTextStyle(
                    cfg.name,
                    fontSize: 22,
                    color: textPrimary,
                    height: 1.6,
                    scriptKey: _audioSubTab,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildReadingView(
    Episode ep,
    CourseProvider prov,
    bool dark,
    Color surface,
    Color border,
    Color textPrimary,
    Color textMuted,
  ) {
    final cfg = prov.selectedConfig;
    final r = ep.reading;

    final List<Map<String, String>> pages = [];
    if (r != null && r.definitions.isNotEmpty) pages.add({'id': 'defs', 'label': 'Definitions'});
    if (r != null && r.targetText.isNotEmpty) pages.add({'id': 'read', 'label': 'Reading'});
    if (cfg.transliterationKey != null && r != null && r.transliterationText.isNotEmpty) {
      pages.add({'id': 'transliteration', 'label': cfg.labels[cfg.transliterationKey] ?? 'Transliteration'});
    }
    if (r != null && r.englishText.isNotEmpty) pages.add({'id': 'eng', 'label': 'Translation'});
    if ((r != null && r.focus.isNotEmpty) || ep.grammar.isNotEmpty) {
      pages.add({'id': 'focus', 'label': 'Focus & Grammar'});
    }

    if (pages.isEmpty) {
      return Center(child: Text('No reading practice content available.', style: GoogleFonts.inter(color: textMuted)));
    }

    final activeSub = pages.any((p) => p['id'] == _readingSubTab) ? _readingSubTab : pages.first['id']!;

    return Column(
      children: [
        // Sub-tabs bar
        Container(
          color: surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: pages.map((p) {
                final active = p['id'] == activeSub;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(p['label']!),
                    selected: active,
                    onSelected: (selected) {
                      if (selected) setState(() => _readingSubTab = p['id']!);
                    },
                    selectedColor: const Color(0xFF2563EB),
                    backgroundColor: dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                    labelStyle: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: active ? Colors.white : textMuted,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
        Divider(height: 1, color: border),

        // Body content based on subtab
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Builder(
              builder: (context) {
                if (activeSub == 'defs' && r != null) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: r.definitions.map((def) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: border),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    def.word,
                                    style: getTargetLanguageTextStyle(
                                      cfg.name,
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    def.text,
                                    style: GoogleFonts.inter(fontSize: 14, color: textMuted),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF2563EB)),
                              onPressed: () => prov.toggleAudio(0, [def.word, def.text]),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  );
                } else if (activeSub == 'read' && r != null) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('READING PRACTICE', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: textMuted, letterSpacing: 1.1)),
                          IconButton(
                            icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF2563EB), size: 28),
                            onPressed: () => prov.toggleAudio(0, [r.targetText]),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        r.targetText,
                        style: getTargetLanguageTextStyle(cfg.name, fontSize: 18, color: textPrimary, height: 1.6),
                      ),
                    ],
                  );
                } else if (activeSub == 'transliteration' && r != null) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('TRANSLITERATION', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: textMuted, letterSpacing: 1.1)),
                      const SizedBox(height: 12),
                      Text(
                        r.transliterationText,
                        style: GoogleFonts.inter(fontSize: 16, fontStyle: FontStyle.italic, color: textPrimary, height: 1.6),
                      ),
                    ],
                  );
                } else if (activeSub == 'eng' && r != null) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('ENGLISH TRANSLATION', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: textMuted, letterSpacing: 1.1)),
                      const SizedBox(height: 12),
                      Text(
                        r.englishText,
                        style: GoogleFonts.inter(fontSize: 16, color: textPrimary, height: 1.6),
                      ),
                    ],
                  );
                } else if (activeSub == 'focus') {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (r != null && r.focus.isNotEmpty) ...[
                        Text('READING FOCUS POINTS', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: textMuted, letterSpacing: 1.1)),
                        const SizedBox(height: 12),
                        ...r.focus.map((f) => Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: surface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(f.word, style: getTargetLanguageTextStyle(cfg.name, fontSize: 18, fontWeight: FontWeight.bold, color: textPrimary)),
                                  const SizedBox(height: 4),
                                  Text(f.explanation, style: GoogleFonts.inter(fontSize: 14, color: textMuted, height: 1.5)),
                                ],
                              ),
                            )),
                        const SizedBox(height: 16),
                      ],
                      if (ep.grammar.isNotEmpty) ...[
                        Text('GRAMMAR RULES', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: textMuted, letterSpacing: 1.1)),
                        const SizedBox(height: 12),
                        ...ep.grammar.map((g) => Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: surface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(g.title, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold, color: textPrimary)),
                                  const SizedBox(height: 4),
                                  Text(g.explanation, style: GoogleFonts.inter(fontSize: 14, color: textPrimary, height: 1.5)),
                                ],
                              ),
                            )),
                      ],
                    ],
                  );
                }
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildVocabListView(
    Episode ep,
    CourseProvider prov,
    bool dark,
    Color surface,
    Color border,
    Color textPrimary,
    Color textMuted,
  ) {
    if (ep.drills.isEmpty) {
      return Center(
        child: Text(
          'No vocabulary items for this episode.',
          style: GoogleFonts.inter(color: textMuted),
        ),
      );
    }

    final safeWordIdx = _getSafeIndex(_drillWordIdx, ep.drills.length);
    final currentWord = ep.drills[safeWordIdx];
    final examples = currentWord.examples;
    final safeExIdx = examples.isNotEmpty ? _getSafeIndex(_drillExIdx, examples.length) : 0;
    final currentExample = examples.isNotEmpty ? examples[safeExIdx] : null;

    final noteKey = 'vocab_${currentWord.word}';
    final userNote = prov.userNotes[noteKey];

    return Column(
      children: [
        // 1. Top Horizontal Word Navigation Chips
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: surface,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: List.generate(ep.drills.length, (idx) {
                final d = ep.drills[idx];
                final isSelected = idx == safeWordIdx;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(
                      d.word,
                      style: getTargetLanguageTextStyle(
                        prov.selectedConfig.name,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: isSelected ? Colors.white : textPrimary,
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: const Color(0xFFD97706),
                    backgroundColor: dark ? const Color(0xFF27272A) : const Color(0xFFF5F5F4),
                    onSelected: (_) {
                      setState(() {
                        _drillWordIdx = idx;
                        _drillExIdx = 0;
                      });
                    },
                  ),
                );
              }),
            ),
          ),
        ),
        Divider(height: 1, color: border),

        // 2. Main Drill Card Area
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Word Title & Definition
                  Text(
                    currentWord.word,
                    style: getTargetLanguageTextStyle(
                      prov.selectedConfig.name,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: textPrimary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (currentWord.transliteration.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      currentWord.transliteration,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontStyle: FontStyle.italic,
                        color: textMuted,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 8),
                  Text(
                    currentWord.definition,
                    style: GoogleFonts.inter(fontSize: 16, color: textMuted),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 24),
                  Divider(color: border),
                  const SizedBox(height: 16),

                  // Example Sentence Display (One Example Card at a time)
                  if (currentExample != null) ...[
                    Builder(builder: (context) {
                      final drillId = 'drill_${safeWordIdx}_$safeExIdx';
                      final isLatestEpisode = prov.selectedEpisodeIdx == (prov.episodes.length - 1);
                      final isRevealed = !isLatestEpisode || prov.listenedDrills.contains(drillId);

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'EXAMPLE ${safeExIdx + 1} OF ${examples.length}',
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.1,
                                  color: const Color(0xFFD97706),
                                ),
                              ),
                              Row(
                                children: [
                                  IconButton(
                                    icon: Icon(
                                      userNote != null ? Icons.edit_note_rounded : Icons.note_add_outlined,
                                      color: userNote != null ? const Color(0xFFF59E0B) : textMuted,
                                    ),
                                    onPressed: () {
                                      UserNoteModal.show(
                                        context: context,
                                        dark: dark,
                                        noteTitle: '${currentWord.word}: ${currentExample.primaryText}',
                                        initialText: userNote?.content ?? '',
                                        onSave: (txt) => prov.saveUserNote(noteKey, currentWord.word, txt),
                                      );
                                    },
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF2563EB)),
                                    onPressed: () {
                                      prov.revealDrill(drillId);
                                      prov.toggleAudio(
                                        safeExIdx,
                                        [currentExample.primaryText, currentExample.englishTranslation, currentExample.primaryText],
                                      );
                                    },
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Stack(
                            alignment: Alignment.center,
                            children: [
                              ImageFiltered(
                                imageFilter: ImageFilter.blur(
                                  sigmaX: isRevealed ? 0.0 : 6.0,
                                  sigmaY: isRevealed ? 0.0 : 6.0,
                                ),
                                child: Opacity(
                                  opacity: isRevealed ? 1.0 : 0.4,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        currentExample.primaryText,
                                        style: getTargetLanguageTextStyle(
                                          prov.selectedConfig.name,
                                          fontSize: 22,
                                          color: textPrimary,
                                        ),
                                      ),
                                      if (prov.showTranslation && currentExample.englishTranslation.isNotEmpty) ...[
                                        const SizedBox(height: 8),
                                        Text(
                                          currentExample.englishTranslation,
                                          style: GoogleFonts.inter(
                                            fontSize: 16,
                                            color: textMuted,
                                            height: 1.4,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                              if (!isRevealed)
                                ElevatedButton.icon(
                                  onPressed: () {
                                    prov.revealDrill(drillId);
                                    prov.toggleAudio(
                                      safeExIdx,
                                      [currentExample.primaryText, currentExample.englishTranslation, currentExample.primaryText],
                                    );
                                  },
                                  icon: const Icon(Icons.headphones_rounded, size: 18),
                                  label: const Text('Play to Reveal'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFD97706),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                    elevation: 2,
                                  ),
                                ),
                            ],
                          ),
                        ],
                      );
                    }),
                  ] else ...[
                    Text(
                      'No example sentences for this drill.',
                      style: GoogleFonts.inter(color: textMuted),
                    ),
                  ],

                  if (userNote != null && userNote.content.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        'Note: ${userNote.content}',
                        style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFFD97706)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),

        // 3. Navigation Footer
        Container(
          padding: const EdgeInsets.all(12),
          color: surface,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ElevatedButton.icon(
                onPressed: (safeExIdx > 0 || safeWordIdx > 0)
                    ? () {
                        setState(() {
                          if (safeExIdx > 0) {
                            _drillExIdx = safeExIdx - 1;
                          } else if (safeWordIdx > 0) {
                            _drillWordIdx = safeWordIdx - 1;
                            _drillExIdx = (ep.drills[_drillWordIdx].examples.length - 1).clamp(0, 9999);
                          }
                        });
                      }
                    : null,
                icon: const Icon(Icons.chevron_left_rounded, size: 20),
                label: const Text('Prev'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                  foregroundColor: textPrimary,
                  elevation: 0,
                ),
              ),
              Text(
                'Word ${safeWordIdx + 1}/${ep.drills.length} • Ex ${examples.isNotEmpty ? safeExIdx + 1 : 0}/${examples.length}',
                style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: textMuted),
              ),
              ElevatedButton.icon(
                onPressed: (safeExIdx < examples.length - 1 || safeWordIdx < ep.drills.length - 1)
                    ? () {
                        setState(() {
                          if (safeExIdx < examples.length - 1) {
                            _drillExIdx = safeExIdx + 1;
                          } else if (safeWordIdx < ep.drills.length - 1) {
                            _drillWordIdx = safeWordIdx + 1;
                            _drillExIdx = 0;
                          }
                        });
                      }
                    : null,
                icon: const Icon(Icons.chevron_right_rounded, size: 20),
                label: const Text('Next'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  foregroundColor: Colors.white,
                  elevation: 0,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildQuizView(
    Episode ep,
    CourseProvider prov,
    bool dark,
    Color surface,
    Color border,
    Color textPrimary,
    Color textMuted,
  ) {
    if (ep.quiz.isEmpty) {
      return Center(
        child: Text(
          'No quiz questions for this episode.',
          style: GoogleFonts.inter(color: textMuted),
        ),
      );
    }

    final safeIdx = _getSafeIndex(_quizIdx, ep.quiz.length);
    final q = ep.quiz[safeIdx];
    final isAnswered = prov.quizRevealed.contains(safeIdx);
    final userSelection = prov.quizSelections[safeIdx];
    final allOptions = [q.answer, ...q.distractors]..sort();

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'QUESTION ${safeIdx + 1} OF ${ep.quiz.length}',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                          color: const Color(0xFF2563EB),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: prov.resetQuiz,
                        icon: const Icon(Icons.refresh_rounded, size: 16),
                        label: Text(
                          'Retake Quiz',
                          style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    q.sentence,
                    style: getTargetLanguageTextStyle(
                      prov.selectedConfig.name,
                      fontSize: 22,
                      color: textPrimary,
                    ),
                  ),
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      ImageFiltered(
                        imageFilter: ImageFilter.blur(
                          sigmaX: isAnswered ? 0.0 : 6.0,
                          sigmaY: isAnswered ? 0.0 : 6.0,
                        ),
                        child: Opacity(
                          opacity: isAnswered ? 1.0 : 0.4,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (q.englishHint.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  'Hint: ${q.englishHint}',
                                  style: GoogleFonts.inter(fontSize: 14, color: textMuted),
                                ),
                              ],
                              const SizedBox(height: 20),
                              ...allOptions.map((opt) {
                                final isSelected = userSelection == opt;
                                final isCorrectAnswer = opt == q.answer;

                                Color btnBg = dark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9);
                                Color btnBorder = border;
                                Color btnText = textPrimary;

                                if (isAnswered) {
                                  if (isCorrectAnswer) {
                                    btnBg = const Color(0xFF10B981).withValues(alpha: 0.15);
                                    btnBorder = const Color(0xFF10B981);
                                    btnText = const Color(0xFF059669);
                                  } else if (isSelected) {
                                    btnBg = Colors.red.withValues(alpha: 0.15);
                                    btnBorder = Colors.red;
                                    btnText = Colors.red;
                                  }
                                }

                                return GestureDetector(
                                  onTap: () => prov.selectQuizOption(safeIdx, opt),
                                  child: Container(
                                    width: double.infinity,
                                    margin: const EdgeInsets.only(bottom: 10),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                    decoration: BoxDecoration(
                                      color: btnBg,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: btnBorder),
                                    ),
                                    child: Text(
                                      opt,
                                      style: GoogleFonts.inter(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600,
                                        color: btnText,
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
                      ),
                      if (!isAnswered)
                        ElevatedButton.icon(
                          onPressed: () {
                            prov.selectQuizOption(safeIdx, ''); // unblurs options
                          },
                          icon: const Icon(Icons.visibility_rounded, size: 18),
                          label: const Text('Reveal Answers'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                            elevation: 2,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),

        // Navigation Footer
        Container(
          padding: const EdgeInsets.all(12),
          color: surface,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ElevatedButton.icon(
                onPressed: safeIdx > 0 ? () => setState(() => _quizIdx = safeIdx - 1) : null,
                icon: const Icon(Icons.chevron_left_rounded, size: 20),
                label: const Text('Prev'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                  foregroundColor: textPrimary,
                  elevation: 0,
                ),
              ),
              Text(
                '${safeIdx + 1} / ${ep.quiz.length}',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: textMuted),
              ),
              ElevatedButton.icon(
                onPressed: safeIdx < ep.quiz.length - 1 ? () => setState(() => _quizIdx = safeIdx + 1) : null,
                icon: const Icon(Icons.chevron_right_rounded, size: 20),
                label: const Text('Next'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  elevation: 0,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTestView(
    Episode ep,
    CourseProvider prov,
    bool dark,
    Color surface,
    Color border,
    Color textPrimary,
    Color textMuted,
  ) {
    if (ep.test.isEmpty) {
      return Center(
        child: Text(
          'No test sentences for this episode.',
          style: GoogleFonts.inter(color: textMuted),
        ),
      );
    }

    final safeIdx = _getSafeIndex(_testIdx, ep.test.length);
    final item = ep.test[safeIdx];
    final isRevealed = prov.testRevealed.contains(safeIdx);

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'SENTENCE ${safeIdx + 1} OF ${ep.test.length}',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                          color: const Color(0xFF2563EB),
                        ),
                      ),
                      if (isRevealed)
                        IconButton(
                          icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF2563EB)),
                          onPressed: () => prov.toggleAudio(safeIdx, [item.primaryText]),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    item.englishTranslation,
                    style: GoogleFonts.inter(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: textPrimary,
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (!isRevealed)
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          prov.revealTestItem(safeIdx);
                          prov.toggleAudio(safeIdx, [item.primaryText]);
                        },
                        icon: const Icon(Icons.visibility_rounded, size: 18),
                        label: const Text('Reveal Translation'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB).withValues(alpha: 0.1),
                          foregroundColor: const Color(0xFF2563EB),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          elevation: 0,
                        ),
                      ),
                    )
                  else
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: dark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: border),
                      ),
                      child: Text(
                        item.primaryText,
                        style: getTargetLanguageTextStyle(
                          prov.selectedConfig.name,
                          fontSize: 22,
                          color: const Color(0xFF10B981),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),

        // Navigation Footer
        Container(
          padding: const EdgeInsets.all(12),
          color: surface,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ElevatedButton.icon(
                onPressed: safeIdx > 0 ? () => setState(() => _testIdx = safeIdx - 1) : null,
                icon: const Icon(Icons.chevron_left_rounded, size: 20),
                label: const Text('Prev'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                  foregroundColor: textPrimary,
                  elevation: 0,
                ),
              ),
              Text(
                '${safeIdx + 1} / ${ep.test.length}',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: textMuted),
              ),
              ElevatedButton.icon(
                onPressed: safeIdx < ep.test.length - 1 ? () => setState(() => _testIdx = safeIdx + 1) : null,
                icon: const Icon(Icons.chevron_right_rounded, size: 20),
                label: const Text('Next'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  elevation: 0,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSweepView(
    Episode ep,
    CourseProvider prov,
    bool dark,
    Color surface,
    Color border,
    Color textPrimary,
    Color textMuted,
  ) {
    if (ep.sweep.isEmpty) {
      return Center(
        child: Text(
          'No sweep items for this episode.',
          style: GoogleFonts.inter(color: textMuted),
        ),
      );
    }

    final safeIdx = _getSafeIndex(_sweepIdx, ep.sweep.length);
    final item = ep.sweep[safeIdx];
    final isRevealed = prov.sweepRevealed.contains(safeIdx);

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'SWEEP ITEM ${safeIdx + 1} OF ${ep.sweep.length}',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                          color: const Color(0xFF2563EB),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF2563EB)),
                        onPressed: () {
                          prov.revealSweepItem(safeIdx);
                          prov.toggleAudio(safeIdx, [item.primaryText, item.englishTranslation, item.primaryText]);
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (!isRevealed)
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          prov.revealSweepItem(safeIdx);
                          prov.toggleAudio(safeIdx, [item.primaryText, item.englishTranslation, item.primaryText]);
                        },
                        icon: const Icon(Icons.headphones_rounded, size: 18),
                        label: const Text('Listen to Reveal'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB).withValues(alpha: 0.1),
                          foregroundColor: const Color(0xFF2563EB),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          elevation: 0,
                        ),
                      ),
                    )
                  else
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: dark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.primaryText,
                            style: getTargetLanguageTextStyle(
                              prov.selectedConfig.name,
                              fontSize: 22,
                              color: textPrimary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            item.englishTranslation,
                            style: GoogleFonts.inter(
                              fontSize: 15,
                              color: textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),

        // Navigation Footer
        Container(
          padding: const EdgeInsets.all(12),
          color: surface,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ElevatedButton.icon(
                onPressed: safeIdx > 0 ? () => setState(() => _sweepIdx = safeIdx - 1) : null,
                icon: const Icon(Icons.chevron_left_rounded, size: 20),
                label: const Text('Prev'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                  foregroundColor: textPrimary,
                  elevation: 0,
                ),
              ),
              Text(
                '${safeIdx + 1} / ${ep.sweep.length}',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: textMuted),
              ),
              ElevatedButton.icon(
                onPressed: safeIdx < ep.sweep.length - 1 ? () => setState(() => _sweepIdx = safeIdx + 1) : null,
                icon: const Icon(Icons.chevron_right_rounded, size: 20),
                label: const Text('Next'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  elevation: 0,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

}

class _TabButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool active, dark;
  final VoidCallback onTap;

  const _TabButton({
    required this.label,
    required this.icon,
    required this.active,
    required this.dark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final activeBg = const Color(0xFF2563EB);
    final inactiveText = dark ? const Color(0xFFA1A1AA) : const Color(0xFF57534E);

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: active ? activeBg : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: active ? Colors.white : inactiveText,
                ),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: active ? Colors.white : inactiveText,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
