// lib/widgets/sentence_card.dart
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:lingocraft_flutter/constants/languages.dart';
import 'package:lingocraft_flutter/providers/lingocraft_provider.dart';

class SentenceCard extends StatelessWidget {
  final bool dark;
  final Color surface, border, textPrimary, textMuted;

  const SentenceCard({
    super.key,
    required this.dark,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textMuted,
  });

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<LingoCraftProvider>();
    final result = prov.result;
    if (result == null) return const SizedBox.shrink();

    final sentence = result.sentences[prov.currentIdx];
    final langName = result.targetLanguage.name;
    final isNoBlur = isNoBlurLanguage(langName);
    final isRevealed =
        isNoBlur || prov.revealedSentences.contains(prov.currentIdx);
    final isEnglishTarget = langName == 'English';
    final isPlaying =
        prov.playState.index == prov.currentIdx &&
        prov.playState.status == PlayStatus.playing;
    final isLoadingAudio =
        prov.playState.index == prov.currentIdx &&
        prov.playState.status == PlayStatus.loading;

    final targetTextStyle = getTargetLanguageTextStyle(
      langName,
      fontSize: langName.contains('Chinese') || langName.contains('Japanese')
          ? 26
          : 20,
      fontWeight: langName.contains('Chinese')
          ? FontWeight.w400
          : FontWeight.w700,
      color: textPrimary,
      height: 1.4,
    );

    return Container(
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: ImageFilterWidget(
                      blur: !isRevealed,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Original Target Sentence with WebFont support
                          Text(sentence.original, style: targetTextStyle),

                          // Transliteration / Pinyin / Romaji if available
                          if (sentence.transcription.isNotEmpty &&
                              sentence.transcription != sentence.original) ...[
                            const SizedBox(height: 6),
                            Text(
                              sentence.transcription,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontStyle: FontStyle.italic,
                                color: textMuted,
                              ),
                            ),
                          ],

                          // English Translation Block
                          if (!isEnglishTarget) ...[
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: dark
                                    ? const Color(
                                        0xFF09090B,
                                      ).withValues(alpha: 0.5)
                                    : const Color(0xFFFAFAF9),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'TRANSLATION',
                                    style: GoogleFonts.inter(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1.0,
                                      color: textMuted,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    sentence.englishTranslation,
                                    style: GoogleFonts.inter(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          // Explanation Block
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: dark
                                  ? const Color(
                                      0xFF1D4ED8,
                                    ).withValues(alpha: 0.08)
                                  : const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: dark
                                    ? const Color(
                                        0xFF1D4ED8,
                                      ).withValues(alpha: 0.15)
                                    : const Color(0xFFBFDBFE),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      Icons.auto_awesome_rounded,
                                      size: 14,
                                      color: dark
                                          ? const Color(0xFF60A5FA)
                                          : const Color(0xFF2563EB),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'EXPLANATION',
                                      style: GoogleFonts.inter(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 1.0,
                                        color: const Color(0xFF2563EB),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  sentence.explanation,
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    height: 1.5,
                                    color: textPrimary,
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

                // Bottom Controller Bar
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: dark
                        ? const Color(0xFF09090B).withValues(alpha: 0.4)
                        : const Color(0xFFFAFAF9).withValues(alpha: 0.6),
                    border: Border(top: BorderSide(color: border)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'CONTEXT 0${prov.currentIdx + 1}',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2,
                          color: textMuted,
                        ),
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: Icon(
                              Icons.remove_red_eye_rounded,
                              size: 20,
                              color: isRevealed
                                  ? textMuted.withValues(alpha: 0.4)
                                  : textPrimary,
                            ),
                            onPressed: isRevealed
                                ? null
                                : () => prov.revealSentence(prov.currentIdx),
                            tooltip: 'Reveal text',
                          ),
                          const SizedBox(width: 4),
                          IconButton(
                            icon: isLoadingAudio
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Color(0xFF2563EB),
                                    ),
                                  )
                                : Icon(
                                    isPlaying
                                        ? Icons.pause_rounded
                                        : Icons.volume_up_rounded,
                                    size: 20,
                                    color: const Color(0xFF2563EB),
                                  ),
                            onPressed: isLoadingAudio
                                ? null
                                : () => prov.toggleAudio(prov.currentIdx),
                            tooltip: isPlaying ? 'Pause Audio' : 'Play Audio',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Reveal overlay when text is blurred
            if (!isRevealed)
              Positioned.fill(
                child: Container(
                  color: (dark ? const Color(0xFF09090B) : Colors.white)
                      .withValues(alpha: 0.6),
                  child: Center(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ElevatedButton.icon(
                          onPressed: isLoadingAudio
                              ? null
                              : () => prov.toggleAudio(prov.currentIdx),
                          icon: isLoadingAudio
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.volume_up_rounded, size: 18),
                          label: Text(
                            'Play to Reveal',
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24),
                            ),
                            elevation: 4,
                          ),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton.icon(
                          onPressed: () => prov.revealSentence(prov.currentIdx),
                          icon: const Icon(
                            Icons.remove_red_eye_rounded,
                            size: 18,
                          ),
                          label: Text(
                            'Reveal Text',
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: textPrimary,
                            side: BorderSide(color: border),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24),
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
    );
  }
}

class ImageFilterWidget extends StatelessWidget {
  final bool blur;
  final Widget child;

  const ImageFilterWidget({super.key, required this.blur, required this.child});

  @override
  Widget build(BuildContext context) {
    if (!blur) return child;
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
      child: child,
    );
  }
}
