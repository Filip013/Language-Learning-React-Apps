import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/services/tts_service.dart';
import '../../../data/configs/languages_config.dart';
import '../../../data/models/language.dart';
import '../providers/lingocraft_provider.dart';

class LingoCraftScreen extends StatefulWidget {
  const LingoCraftScreen({super.key});

  @override
  State<LingoCraftScreen> createState() => _LingoCraftScreenState();
}

class _LingoCraftScreenState extends State<LingoCraftScreen> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _overlaySearchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleGlobalKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleGlobalKey);
    _searchController.dispose();
    _overlaySearchController.dispose();
    super.dispose();
  }

  bool _handleGlobalKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final prov = Provider.of<LingoCraftProvider>(context, listen: false);

    // If user is actively typing in a text field, do not capture shortcuts
    final primaryFocus = FocusManager.instance.primaryFocus;
    final isTyping = primaryFocus != null &&
        primaryFocus.context?.widget is EditableText;

    final key = event.logicalKey;

    if (key == LogicalKeyboardKey.escape) {
      if (prov.showSearchOverlay) {
        prov.toggleSearchOverlay();
        return true;
      }
    }

    if (isTyping) return false;

    if (key == LogicalKeyboardKey.space) {
      if (prov.playingId != null || TTSService.isPlaying) {
        prov.stopAudio();
        return true;
      }
      if (prov.result != null && prov.currentIdx < prov.result!.sentences.length) {
        final sentence = prov.result!.sentences[prov.currentIdx];
        prov.toggleAudio(sentence, prov.currentIdx);
        return true;
      }
    }

    if (key == LogicalKeyboardKey.keyR) {
      if (prov.result != null) {
        prov.revealSentence(prov.currentIdx);
        return true;
      }
    }

    if (key == LogicalKeyboardKey.keyS) {
      prov.toggleSearchOverlay();
      return true;
    }

    if (key == LogicalKeyboardKey.arrowRight ||
        key == LogicalKeyboardKey.keyW ||
        key == LogicalKeyboardKey.keyD) {
      if (prov.result != null && prov.currentIdx < prov.result!.sentences.length - 1) {
        prov.setCurrentIdx(prov.currentIdx + 1);
        return true;
      }
    }

    if (key == LogicalKeyboardKey.arrowLeft ||
        key == LogicalKeyboardKey.keyQ ||
        key == LogicalKeyboardKey.keyA) {
      if (prov.result != null && prov.currentIdx > 0) {
        prov.setCurrentIdx(prov.currentIdx - 1);
        return true;
      }
    }

    return false;
  }

  TextStyle _getLanguageTextStyle(String langName, {required double fontSize, required Color color, bool isBold = false}) {
    if (langName.contains('Chinese') || langName.contains('Mandarin')) {
      return TextStyle(
        fontFamily: 'DFKai-SB',
        fontFamilyFallback: const ['STKaiti', 'sans-serif'],
        fontSize: fontSize,
        color: color,
        fontWeight: FontWeight.normal,
      );
    } else if (langName.contains('Japanese')) {
      return TextStyle(
        fontFamily: 'KyoKaSho',
        fontFamilyFallback: const ['HGSKyokashotai', 'STKaiti', 'DFKai-SB', 'sans-serif'],
        fontSize: fontSize,
        color: color,
        fontWeight: FontWeight.normal,
      );
    } else {
      return TextStyle(
        fontSize: fontSize,
        color: color,
        fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<LingoCraftProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bg = isDark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9);
    final cardBg = isDark ? const Color(0xFF18181B) : Colors.white;
    final cardBorder = isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4);
    final textPrimary = isDark ? Colors.white : const Color(0xFF18181B);
    final textSecondary = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);

    final showCardLayout = prov.activeTab == 'main' && prov.result != null && !prov.loading;
    final showLaunchSearch = prov.activeTab == 'main' && prov.result == null && !prov.loading;

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                // Top Navigation Bar
                _buildTopNav(context, prov, isDark, cardBg, cardBorder, textPrimary, textSecondary),

                // Launch Persistent Search Bar
                if (showLaunchSearch)
                  _buildLaunchSearchBar(context, prov, isDark, cardBg, cardBorder, textPrimary, textSecondary),

                // Main Content Body
                Expanded(
                  child: prov.loading
                      ? _buildLoadingState(isDark, textPrimary, textSecondary)
                      : prov.activeTab == 'history'
                          ? _buildHistoryTab(context, prov, isDark, cardBg, cardBorder, textPrimary, textSecondary)
                          : showCardLayout
                              ? _buildCardLayout(context, prov, isDark, cardBg, cardBorder, textPrimary, textSecondary)
                              : _buildEmptyState(context, prov, isDark, textPrimary, textSecondary),
                ),
              ],
            ),

            // Floating Search Overlay Modal
            if (prov.showSearchOverlay)
              _buildSearchOverlayModal(context, prov, isDark, cardBg, cardBorder, textPrimary, textSecondary),
          ],
        ),
      ),
    );
  }

  Widget _buildTopNav(
    BuildContext context,
    LingoCraftProvider prov,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF09090B) : Colors.white,
        border: Border(bottom: BorderSide(color: cardBorder)),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1040),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.arrow_back_rounded, size: 20),
                    tooltip: 'Back to Hub',
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () {
                      prov.resetToMainScreen();
                      _searchController.clear();
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.public_rounded, color: Color(0xFF2563EB), size: 20),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'LingoCraft',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  if (prov.result != null || prov.loading)
                    Container(
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        color: prov.showSearchOverlay
                            ? const Color(0xFF2563EB).withValues(alpha: 0.1)
                            : (isDark ? const Color(0xFF18181B) : const Color(0xFFFAFAF9)),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: cardBorder),
                      ),
                      child: IconButton(
                        onPressed: () => prov.toggleSearchOverlay(),
                        icon: Icon(
                          Icons.search_rounded,
                          size: 18,
                          color: prov.showSearchOverlay ? const Color(0xFF2563EB) : textPrimary,
                        ),
                        tooltip: 'Search Word',
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                        padding: EdgeInsets.zero,
                      ),
                    ),
                  Container(
                    decoration: BoxDecoration(
                      color: prov.activeTab == 'history'
                          ? const Color(0xFF2563EB)
                          : (isDark ? const Color(0xFF18181B) : const Color(0xFFFAFAF9)),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: prov.activeTab == 'history' ? const Color(0xFF2563EB) : cardBorder,
                      ),
                    ),
                    child: IconButton(
                      onPressed: () => prov.setActiveTab(prov.activeTab == 'history' ? 'main' : 'history'),
                      icon: Icon(
                        Icons.history_rounded,
                        size: 18,
                        color: prov.activeTab == 'history' ? Colors.white : textPrimary,
                      ),
                      tooltip: 'History',
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLaunchSearchBar(
    BuildContext context,
    LingoCraftProvider prov,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF121215) : const Color(0xFFF5F5F4),
        border: Border(bottom: BorderSide(color: cardBorder)),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1040),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: (val) => prov.setWord(val),
                      onSubmitted: (_) => prov.generateContext(),
                      style: TextStyle(color: textPrimary, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Enter target word (e.g. alma, 草叢, book)...',
                        hintStyle: TextStyle(color: textSecondary),
                        prefixIcon: Icon(Icons.search_rounded, color: textSecondary, size: 20),
                        filled: true,
                        fillColor: cardBg,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide(color: cardBorder),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  // Language Dropdown
                  Expanded(
                    flex: 2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: cardBorder),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<Language>(
                          value: prov.selectedLanguage,
                          isExpanded: true,
                          dropdownColor: cardBg,
                          items: LanguagesConfig.allCourses.map((lang) {
                            return DropdownMenuItem<Language>(
                              value: lang,
                              child: Text('${lang.flag} ${lang.name}', style: TextStyle(color: textPrimary, fontSize: 13)),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) prov.setSelectedLanguage(val);
                          },
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Level Dropdown
                  Expanded(
                    flex: 1,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: cardBorder),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: prov.levels.contains(prov.selectedLevel) ? prov.selectedLevel : 'B1–B2',
                          isExpanded: true,
                          dropdownColor: cardBg,
                          items: prov.levels.map((lvl) {
                            return DropdownMenuItem<String>(
                              value: lvl,
                              child: Text(lvl, style: TextStyle(color: textPrimary, fontSize: 13, fontWeight: FontWeight.bold)),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) prov.setSelectedLevel(val);
                          },
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Generate Button
                  Builder(
                    builder: (context) {
                      final isMobile = MediaQuery.of(context).size.width < 640;
                      return ElevatedButton(
                        onPressed: prov.word.trim().isEmpty ? null : () => prov.generateContext(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          padding: EdgeInsets.symmetric(horizontal: isMobile ? 12 : 16, vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.auto_awesome_rounded, size: 18),
                            if (!isMobile) ...[
                              const SizedBox(width: 6),
                              const Text('Generate'),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCardLayout(
    BuildContext context,
    LingoCraftProvider prov,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    final result = prov.result!;
    final sentence = result.sentences[prov.currentIdx];
    final isRevealed = prov.revealedSentences.contains(prov.currentIdx);
    final isPlaying = prov.playingId == prov.currentIdx;
    final isCjkLang = result.targetLanguageName.contains('Chinese') ||
        result.targetLanguageName.contains('Japanese') ||
        result.targetLanguageName.contains('Mandarin');

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragEnd: (details) {
        if (details.primaryVelocity != null) {
          if (details.primaryVelocity! < -150) {
            // Swiped Left -> Next Card
            if (prov.currentIdx < result.sentences.length - 1) {
              prov.setCurrentIdx(prov.currentIdx + 1);
            }
          } else if (details.primaryVelocity! > 150) {
            // Swiped Right -> Prev Card
            if (prov.currentIdx > 0) {
              prov.setCurrentIdx(prov.currentIdx - 1);
            }
          }
        }
      },
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1040),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: MediaQuery.of(context).size.width < 640 ? 14 : 24,
              vertical: 12,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. TOP HEADER CARD (Compact & Refined)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: cardBorder),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            result.word,
                            style: _getLanguageTextStyle(
                              result.targetLanguageName,
                              fontSize: isCjkLang ? 36 : 22,
                              color: textPrimary,
                              isBold: !isCjkLang,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFF2563EB).withValues(alpha: 0.2)),
                            ),
                            child: Text(
                              result.partOfSpeech.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF2563EB),
                              ),
                            ),
                          ),
                          if (result.ipa.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF27272A) : const Color(0xFFF5F5F4),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: cardBorder),
                              ),
                              child: Text(
                                '[ ${result.ipa} ]',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: textSecondary,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        result.definitionEnglish,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: textSecondary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Divider(height: 1, color: cardBorder.withValues(alpha: 0.6)),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Text(result.targetLanguageFlag, style: const TextStyle(fontSize: 14)),
                              const SizedBox(width: 6),
                              Text(
                                result.targetLanguageName,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: textPrimary,
                                ),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              const Text('• ', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                              Text(
                                result.level,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2563EB),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // 2. SUB-NAV PAGINATOR BAR (Prev / Next & Pills)
                Builder(
                  builder: (context) {
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: cardBorder),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                            onPressed: prov.currentIdx > 0
                                ? () => prov.setCurrentIdx(prov.currentIdx - 1)
                                : null,
                            icon: const Icon(Icons.chevron_left_rounded, size: 20),
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                            padding: EdgeInsets.zero,
                            tooltip: 'Previous',
                          ),

                          // Number Pills
                          Flexible(
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: List.generate(result.sentences.length, (idx) {
                                  final isCurrent = idx == prov.currentIdx;
                                  return InkWell(
                                    onTap: () => prov.setCurrentIdx(idx),
                                    borderRadius: BorderRadius.circular(8),
                                    child: Container(
                                      width: 28,
                                      height: 28,
                                      margin: const EdgeInsets.symmetric(horizontal: 2),
                                      decoration: BoxDecoration(
                                        color: isCurrent
                                            ? const Color(0xFF2563EB)
                                            : (isDark ? const Color(0xFF27272A) : const Color(0xFFFAFAF9)),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: isCurrent ? const Color(0xFF2563EB) : cardBorder,
                                        ),
                                      ),
                                      child: Center(
                                        child: Text(
                                          '${idx + 1}',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: isCurrent ? Colors.white : textSecondary,
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                }),
                              ),
                            ),
                          ),

                          IconButton(
                            onPressed: prov.currentIdx < result.sentences.length - 1
                                ? () => prov.setCurrentIdx(prov.currentIdx + 1)
                                : null,
                            icon: const Icon(Icons.chevron_right_rounded, size: 20),
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                            padding: EdgeInsets.zero,
                            tooltip: 'Next',
                          ),
                        ],
                      ),
                    );
                  },
                ),

                const SizedBox(height: 12),

                // 3. MAIN FLASHCARD BOX (EXPANDED TO FIT REMAINING HEIGHT)
                Expanded(
                  child: SelectionArea(
                    child: Container(
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
                      child: Stack(
                        children: [
                          // Content Block (Blurred when unrevealed matching React Image 2)
                          ImageFiltered(
                            imageFilter: isRevealed
                                ? ImageFilter.blur(sigmaX: 0, sigmaY: 0)
                                : ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                            child: Opacity(
                              opacity: isRevealed ? 1.0 : 0.3,
                              child: Column(
                                children: [
                                  Expanded(
                                    child: SingleChildScrollView(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          // Original Target Sentence with User's Preferred Fonts
                                          Text(
                                            sentence.original,
                                            style: _getLanguageTextStyle(
                                              result.targetLanguageName,
                                              fontSize: isCjkLang ? 30 : 20,
                                              color: textPrimary,
                                            ),
                                          ),
                                          if (sentence.transcription.isNotEmpty &&
                                              sentence.transcription != sentence.original) ...[
                                            const SizedBox(height: 6),
                                            Text(
                                              sentence.transcription,
                                              style: TextStyle(
                                                fontSize: 14,
                                                fontStyle: FontStyle.italic,
                                                fontWeight: FontWeight.w500,
                                                color: textSecondary,
                                              ),
                                            ),
                                          ],

                                          const SizedBox(height: 20),

                                          // TRANSLATION Box (Matching React Image 2)
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
                                                Text(
                                                  'TRANSLATION',
                                                  style: TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                    color: textSecondary,
                                                    letterSpacing: 1.2,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  sentence.englishTranslation,
                                                  style: TextStyle(
                                                    fontSize: 15,
                                                    fontWeight: FontWeight.w600,
                                                    color: textPrimary,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),

                                          const SizedBox(height: 12),

                                          // EXPLANATION Box (Matching React Image 2)
                                          Container(
                                            width: double.infinity,
                                            padding: const EdgeInsets.all(16),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF2563EB).withValues(alpha: 0.05),
                                              borderRadius: BorderRadius.circular(16),
                                              border: Border.all(color: const Color(0xFF2563EB).withValues(alpha: 0.15)),
                                            ),
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Row(
                                                  children: [
                                                    Icon(Icons.auto_awesome_rounded, size: 14, color: Color(0xFF2563EB)),
                                                    SizedBox(width: 6),
                                                    Text(
                                                      'EXPLANATION',
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.bold,
                                                        color: Color(0xFF2563EB),
                                                        letterSpacing: 1.2,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  sentence.explanation,
                                                  style: TextStyle(
                                                    fontSize: 14,
                                                    color: textPrimary,
                                                    height: 1.4,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),

                                  // Pinned Bottom Footer Bar (Ultra-Compact height, larger icons, wide spacing)
                                  Container(
                                    padding: const EdgeInsets.only(top: 0, bottom: 0),
                                    decoration: BoxDecoration(
                                      border: Border(top: BorderSide(color: cardBorder.withValues(alpha: 0.5))),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          'CONTEXT 0${prov.currentIdx + 1}',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: textSecondary,
                                            letterSpacing: 1.0,
                                          ),
                                        ),
                                        Row(
                                          children: [
                                            IconButton(
                                              onPressed: () => prov.revealSentence(prov.currentIdx),
                                              icon: Icon(
                                                Icons.visibility_rounded,
                                                size: 21,
                                                color: isRevealed ? textSecondary.withValues(alpha: 0.3) : textPrimary,
                                              ),
                                              constraints: const BoxConstraints(minWidth: 28, minHeight: 24),
                                              padding: EdgeInsets.zero,
                                              tooltip: 'Reveal Text',
                                            ),
                                            const SizedBox(width: 12),
                                            IconButton(
                                              onPressed: () => prov.toggleAudio(sentence, prov.currentIdx),
                                              icon: Icon(
                                                isPlaying ? Icons.pause_circle_filled_rounded : Icons.volume_up_rounded,
                                                size: 23,
                                                color: const Color(0xFF2563EB),
                                              ),
                                              constraints: const BoxConstraints(minWidth: 28, minHeight: 24),
                                              padding: EdgeInsets.zero,
                                              tooltip: isPlaying ? 'Pause Audio' : 'Play Audio',
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

                          // Centered Unreveal Action Buttons Overlay (Matching React Image 2 1-to-1)
                          if (!isRevealed)
                            Positioned.fill(
                              child: Center(
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    ElevatedButton.icon(
                                      onPressed: () => prov.toggleAudio(sentence, prov.currentIdx),
                                      icon: Icon(
                                        isPlaying ? Icons.pause_rounded : Icons.volume_up_rounded,
                                        size: 18,
                                      ),
                                      label: Text(isPlaying ? 'Pause' : 'Play to Reveal'),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF2563EB),
                                        foregroundColor: Colors.white,
                                        elevation: 6,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    OutlinedButton.icon(
                                      onPressed: () => prov.revealSentence(prov.currentIdx),
                                      icon: const Icon(Icons.visibility_rounded, size: 18),
                                      label: const Text('Reveal Text (R)'),
                                      style: OutlinedButton.styleFrom(
                                        backgroundColor: cardBg,
                                        foregroundColor: textPrimary,
                                        side: BorderSide(color: cardBorder),
                                        elevation: 4,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
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
                ),
              ],
            ),
        ),
      ),
    ),
    );
  }

  Widget _buildHistoryTab(
    BuildContext context,
    LingoCraftProvider prov,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    final filtered = prov.history.where((i) {
      final q = prov.historySearch.toLowerCase();
      return i.word.toLowerCase().contains(q) || i.targetLanguageName.toLowerCase().contains(q);
    }).toList();

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1040),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                onChanged: (val) => prov.setHistorySearch(val),
                style: TextStyle(color: textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Filter history by word or language...',
                  hintStyle: TextStyle(color: textSecondary),
                  prefixIcon: Icon(Icons.search_rounded, color: textSecondary, size: 20),
                  filled: true,
                  fillColor: cardBg,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: cardBorder),
                  ),
                ),
              ),
            ),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text('No matching history found.', style: TextStyle(color: textSecondary)),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final item = filtered[index];
                        final isItemCjk = item.targetLanguageName.contains('Chinese') ||
                            item.targetLanguageName.contains('Japanese') ||
                            item.targetLanguageName.contains('Mandarin');

                        return Card(
                          color: cardBg,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: BorderSide(color: cardBorder),
                          ),
                          margin: const EdgeInsets.only(bottom: 10),
                          child: ListTile(
                            onTap: () => prov.loadHistoryItem(item),
                            title: Row(
                              children: [
                                Text(item.targetLanguageFlag, style: const TextStyle(fontSize: 18)),
                                const SizedBox(width: 8),
                                Text(
                                  item.word,
                                  style: _getLanguageTextStyle(
                                    item.targetLanguageName,
                                    fontSize: isItemCjk ? 24 : 16,
                                    color: textPrimary,
                                    isBold: !isItemCjk,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    item.level,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF2563EB),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            subtitle: Text(
                              item.definitionEnglish,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: textSecondary, fontSize: 12),
                            ),
                            trailing: IconButton(
                              onPressed: () => prov.deleteHistoryItem(item.id),
                              icon: const Icon(Icons.delete_outline_rounded, size: 20, color: Color(0xFFEF4444)),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchOverlayModal(
    BuildContext context,
    LingoCraftProvider prov,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    return Positioned.fill(
      child: GestureDetector(
        onTap: () => prov.toggleSearchOverlay(),
        child: Container(
          color: Colors.black.withValues(alpha: 0.5),
          alignment: Alignment.topCenter,
          padding: const EdgeInsets.only(top: 80, left: 16, right: 16),
          child: GestureDetector(
            onTap: () {},
            child: Material(
              color: Colors.transparent,
              child: Container(
                constraints: const BoxConstraints(maxWidth: 500),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: cardBorder),
                  boxShadow: const [
                    BoxShadow(color: Colors.black26, blurRadius: 16, offset: Offset(0, 8)),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Search Target Word',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: textPrimary),
                        ),
                        IconButton(
                          onPressed: () => prov.toggleSearchOverlay(),
                          icon: const Icon(Icons.close_rounded, size: 20),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _overlaySearchController,
                      onSubmitted: (val) {
                        prov.setWord(val);
                        prov.toggleSearchOverlay();
                        prov.generateContext();
                      },
                      style: TextStyle(color: textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Type a target word...',
                        filled: true,
                        fillColor: isDark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: cardBorder),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Align(
                      alignment: Alignment.centerRight,
                      child: ElevatedButton(
                        onPressed: () {
                          prov.setWord(_overlaySearchController.text);
                          prov.toggleSearchOverlay();
                          prov.generateContext();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Generate Context'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingState(bool isDark, Color textPrimary, Color textSecondary) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: Color(0xFF2563EB)),
          const SizedBox(height: 16),
          Text(
            'Assembling linguistic context...',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: textPrimary),
          ),
          const SizedBox(height: 4),
          Text(
            'Powered by Gemini AI',
            style: TextStyle(fontSize: 12, color: textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(
    BuildContext context,
    LingoCraftProvider prov,
    bool isDark,
    Color textPrimary,
    Color textSecondary,
  ) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.auto_awesome_rounded, size: 48, color: Color(0xFF2563EB)),
            ),
            const SizedBox(height: 16),
            Text(
              'No Context Active',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              'Enter a word in the toolbar above, configure your target language and difficulty, and map it into distinct grammatical structures.',
              style: TextStyle(fontSize: 13, color: textSecondary),
              textAlign: TextAlign.center,
            ),
            if (prov.error != null) ...[
              const SizedBox(height: 16),
              Text(
                prov.error!,
                style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
