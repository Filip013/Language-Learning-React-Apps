import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../core/widgets/tab_badge.dart';
import '../providers/course_provider.dart';
import '../../home/providers/home_provider.dart';

class StudioTab extends StatefulWidget {
  const StudioTab({super.key});

  @override
  State<StudioTab> createState() => _StudioTabState();
}

class _StudioTabState extends State<StudioTab> {
  final TextEditingController _topicController = TextEditingController();

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleGlobalKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleGlobalKey);
    _topicController.dispose();
    super.dispose();
  }

  // Cross-tab keyboard nav (mirrors React's global keydown for studio):
  // ArrowRight/w → next tab, ArrowLeft/q → prev tab.
  bool _handleGlobalKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final primaryFocus = FocusManager.instance.primaryFocus;
    if (primaryFocus != null && primaryFocus.context?.widget is EditableText) {
      return false;
    }

    final courseProv = Provider.of<CourseProvider>(context, listen: false);
    if (courseProv.activeTab != 'studio') return false;

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
    final episodes = courseProv.episodesList;

    // Cross-tab swipe (mirrors React's studioSwipeHandlers: swipe left → next tab).
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
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1040),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // 1. Sub-header: STUDIO CONTROL Badge
                const TabBadge(
                  icon: Icons.chat_bubble_outline_rounded,
                label: 'STUDIO CONTROL',
              ),

              const SizedBox(height: 12),

              // 2. Episode Dropdown Selector
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
                      onTap: () => courseProv.setDropdownOpen(!courseProv.dropdownOpen),
                      borderRadius: BorderRadius.circular(16),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          children: [
                            const Icon(Icons.list_rounded, color: Color(0xFFD97706), size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                activeEpisode != null ? (activeEpisode['title'] ?? 'Archive') : 'Archive',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: textPrimary,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Icon(
                              courseProv.dropdownOpen
                                  ? Icons.keyboard_arrow_up_rounded
                                  : Icons.keyboard_arrow_down_rounded,
                              color: textSecondary,
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Expanded Dropdown List
                    if (courseProv.dropdownOpen) ...[
                      Divider(height: 1, color: cardBorder),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 220),
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: episodes.length,
                          itemBuilder: (context, idx) {
                            final ep = episodes[idx];
                            final isSelected = ep['id'] == courseProv.activeEpisodeId;
                            return InkWell(
                              onTap: () {
                                courseProv.setActiveEpisodeId(ep['id'] as String);
                                courseProv.setDropdownOpen(false);
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? (isDark ? const Color(0xFF78350F).withValues(alpha: 0.2) : const Color(0xFFFEF3C7))
                                      : Colors.transparent,
                                  border: Border(bottom: BorderSide(color: cardBorder.withValues(alpha: 0.4))),
                                ),
                                child: Text(
                                  ep['title'] ?? 'Untitled Lesson',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                    color: isSelected ? const Color(0xFFD97706) : textPrimary,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // 3. Prompt the AI Section Box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Prompt the AI',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Topic Textarea
                    TextField(
                      controller: _topicController,
                      onChanged: (val) => courseProv.setTopicInput(val),
                      maxLines: 3,
                      enabled: !courseProv.isGenerating,
                      decoration: InputDecoration(
                        hintText: 'e.g., Focus on grammar. Review words: table, sky.',
                        hintStyle: TextStyle(color: textSecondary.withValues(alpha: 0.6), fontSize: 14),
                        filled: true,
                        fillColor: isDark ? const Color(0xFF09090B) : const Color(0xFFF5F5F4),
                        contentPadding: const EdgeInsets.all(16),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(color: cardBorder),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(color: cardBorder),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: Color(0xFFD97706)),
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // 4 Action Buttons Grid Row (2 rows on mobile, 1 row on desktop)
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final isCompact = constraints.maxWidth < 640;

                        final btnGenerate = Expanded(
                          child: courseProv.showGenerateConfirm
                              ? Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: isDark ? const Color(0xFF78350F).withValues(alpha: 0.3) : const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: const Color(0xFFD97706)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                                    children: [
                                      const Text('Sure?', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
                                      ElevatedButton(
                                        onPressed: () => courseProv.handleGenerateLLM(),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFFD97706),
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                          minimumSize: Size.zero,
                                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                        ),
                                        child: const Text('Yes', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                      ),
                                      TextButton(
                                        onPressed: () => courseProv.setShowGenerateConfirm(false),
                                        style: TextButton.styleFrom(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                                          minimumSize: Size.zero,
                                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                        ),
                                        child: Text('No', style: TextStyle(fontSize: 11, color: textSecondary)),
                                      ),
                                    ],
                                  ),
                                )
                              : ElevatedButton.icon(
                                  onPressed: courseProv.topicInput.trim().isEmpty || courseProv.isGenerating
                                      ? null
                                      : () => courseProv.setShowGenerateConfirm(true),
                                  icon: courseProv.isGenerating
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFD97706)),
                                        )
                                      : const Icon(Icons.auto_awesome_rounded, size: 16),
                                  label: Text(courseProv.isGenerating ? 'Generating...' : 'Generate'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: isDark ? const Color(0xFF78350F).withValues(alpha: 0.3) : const Color(0xFFFEF3C7),
                                    foregroundColor: const Color(0xFFD97706),
                                    elevation: 0,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    side: BorderSide(color: const Color(0xFFD97706).withValues(alpha: 0.3)),
                                  ),
                                ),
                        );

                        final btnExport = Expanded(
                          child: OutlinedButton.icon(
                            onPressed: courseProv.topicInput.trim().isEmpty || courseProv.isExporting
                                ? null
                                : () => courseProv.handleExportPrompt(),
                            icon: Icon(
                              courseProv.isCopied ? Icons.check_rounded : Icons.download_rounded,
                              size: 16,
                              color: courseProv.isCopied ? const Color(0xFF10B981) : textSecondary,
                            ),
                            label: Text(courseProv.isCopied ? 'Copied!' : 'Export Prompt'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: textPrimary,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              side: BorderSide(color: cardBorder),
                            ),
                          ),
                        );

                        final btnPasteJson = Expanded(
                          child: OutlinedButton.icon(
                            onPressed: courseProv.isGenerating
                                ? null
                                : () async {
                                    final data = await Clipboard.getData('text/plain');
                                    if (data?.text != null && data!.text!.isNotEmpty) {
                                      courseProv.processImportedJSON(data.text!);
                                    }
                                  },
                            icon: Icon(Icons.assignment_returned_rounded, size: 16, color: textSecondary),
                            label: const Text('Paste JSON'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: textPrimary,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              side: BorderSide(color: cardBorder),
                            ),
                          ),
                        );

                        final btnImportFile = Expanded(
                          child: OutlinedButton.icon(
                            onPressed: courseProv.isGenerating
                                ? null
                                : () async {
                                    _showImportDialog(context, courseProv, textPrimary, textSecondary, cardBg, cardBorder);
                                  },
                            icon: Icon(Icons.upload_rounded, size: 16, color: textSecondary),
                            label: const Text('Import File'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: textPrimary,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              side: BorderSide(color: cardBorder),
                            ),
                          ),
                        );

                        if (isCompact) {
                          return Column(
                            children: [
                              Row(
                                children: [
                                  btnGenerate,
                                  const SizedBox(width: 8),
                                  btnExport,
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  btnPasteJson,
                                  const SizedBox(width: 8),
                                  btnImportFile,
                                ],
                              ),
                            ],
                          );
                        }

                        return Row(
                          children: [
                            btnGenerate,
                            const SizedBox(width: 10),
                            btnExport,
                            const SizedBox(width: 10),
                            btnPasteJson,
                            const SizedBox(width: 10),
                            btnImportFile,
                          ],
                        );
                      },
                    ),

                    // Error Message Banner
                    if (courseProv.genError.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          courseProv.genError,
                          style: const TextStyle(fontSize: 13, color: Colors.red, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // 4. Chat Messages Flow (You & Tutor)
              if (activeEpisode != null) ...[
                // USER Speech Bubble ("YOU")
                if (activeEpisode['userPrompt'] != null)
                  Align(
                    alignment: Alignment.centerRight,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'YOU',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: textSecondary,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.all(18),
                          constraints: const BoxConstraints(maxWidth: 600),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(20),
                              bottomLeft: Radius.circular(20),
                              bottomRight: Radius.circular(20),
                              topRight: Radius.circular(4),
                            ),
                            border: Border.all(color: cardBorder),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.02),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Text(
                            activeEpisode['userPrompt'].toString(),
                            style: TextStyle(fontSize: 15, color: textPrimary, height: 1.5),
                          ),
                        ),
                      ],
                    ),
                  ),

                const SizedBox(height: 20),

                // TUTOR Speech Bubble ("TUTOR")
                if (activeEpisode['tutorIntroduction'] != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TUTOR',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFD97706),
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.all(22),
                          constraints: const BoxConstraints(maxWidth: 700),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(4),
                              topRight: Radius.circular(20),
                              bottomLeft: Radius.circular(20),
                              bottomRight: Radius.circular(20),
                            ),
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
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                activeEpisode['tutorIntroduction'].toString(),
                                style: TextStyle(fontSize: 15, color: textPrimary, height: 1.5),
                              ),

                              const SizedBox(height: 20),
                              Divider(color: cardBorder.withValues(alpha: 0.5)),
                              const SizedBox(height: 12),

                              // Bottom Actions: Go to Audio & Delete Lesson
                              Row(
                                children: [
                                  ElevatedButton(
                                    onPressed: () {
                                      courseProv.setActiveTab('reading');
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                                      foregroundColor: textPrimary,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                                    ),
                                    child: const Text('Go to Audio', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                  ),

                                  const SizedBox(width: 12),

                                  // Delete Lesson with Confirmation
                                  courseProv.deletingEpisodeId == activeEpisode['id']
                                      ? Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: Colors.red.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                                          ),
                                          child: Row(
                                            children: [
                                              const Text('Are you sure?', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.red)),
                                              const SizedBox(width: 6),
                                              ElevatedButton(
                                                onPressed: () => courseProv.handleDeleteEpisode(),
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: Colors.red,
                                                  foregroundColor: Colors.white,
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                  minimumSize: Size.zero,
                                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                ),
                                                child: const Text('Yes, Delete', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                              ),
                                              TextButton(
                                                onPressed: () => courseProv.setDeletingEpisodeId(null),
                                                style: TextButton.styleFrom(
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                                  minimumSize: Size.zero,
                                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                ),
                                                child: Text('Cancel', style: TextStyle(fontSize: 11, color: textSecondary)),
                                              ),
                                            ],
                                          ),
                                        )
                                      : OutlinedButton.icon(
                                          onPressed: () => courseProv.setDeletingEpisodeId(activeEpisode['id'] as String),
                                          icon: const Icon(Icons.delete_outline_rounded, size: 16, color: Colors.red),
                                          label: const Text('Delete Lesson'),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: Colors.red,
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                            side: BorderSide(color: cardBorder),
                                          ),
                                        ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
      ),
    );
  }

  void _showImportDialog(
    BuildContext context,
    CourseProvider courseProv,
    Color textPrimary,
    Color textSecondary,
    Color cardBg,
    Color cardBorder,
  ) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Import Lesson JSON', style: TextStyle(color: textPrimary, fontWeight: FontWeight.bold)),
        content: SizedBox(
          width: 500,
          child: TextField(
            controller: controller,
            maxLines: 8,
            style: TextStyle(color: textPrimary, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Paste raw JSON contents here...',
              hintStyle: TextStyle(color: textSecondary),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: cardBorder)),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                courseProv.processImportedJSON(controller.text.trim());
                Navigator.pop(ctx);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              foregroundColor: Colors.white,
            ),
            child: const Text('Import'),
          ),
        ],
      ),
    );
  }
}

