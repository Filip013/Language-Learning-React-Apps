import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../features/course/providers/course_provider.dart';
import '../../features/home/providers/home_provider.dart';
import '../services/web_font_service.dart';
import 'language_text_style.dart';
import 'play_button.dart';

/// Opens the Google-Translate-style AI Translate panel for the given selected
/// [text] (mirrors React AiTranslatePopup's panel).
Future<void> showAiTranslatePanel(
  BuildContext context, {
  required CourseProvider prov,
  required String text,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    constraints: const BoxConstraints(maxWidth: 560),
    builder: (ctx) => AiTranslatePanel(prov: prov, text: text),
  );
}

class AiTranslatePanel extends StatefulWidget {
  final CourseProvider prov;
  final String text;

  const AiTranslatePanel({super.key, required this.prov, required this.text});

  @override
  State<AiTranslatePanel> createState() => _AiTranslatePanelState();
}

class _AiTranslatePanelState extends State<AiTranslatePanel> {
  String _translation = '';
  String _transliteration = '';
  bool _isLoading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _translate();
  }

  Future<void> _translate() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final result = await widget.prov.aiTranslate(widget.text);
      if (!mounted) return;
      setState(() {
        _translation = result['translation'] ?? '';
        _transliteration = result['transliteration'] ?? '';
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<CourseProvider>();
    final homeProv = context.watch<HomeProvider>();
    final isDark = homeProv.isDarkMode;

    final textPrimary = isDark ? Colors.white : const Color(0xFF1C1917);
    final textSecondary = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);

    WebFontService.ensurePreferredFontsLoaded(prov.config.name);
    final config = prov.config;
    final translitLabel = config.transliterationKey.isNotEmpty
        ? (config.labels[config.transliterationKey] ?? config.transliterationKey)
        : null;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF18181B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(
          color: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
        ),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.auto_awesome_rounded, size: 18, color: Color(0xFFF59E0B)),
                    SizedBox(width: 8),
                    Text(
                      'AI Translate',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(Icons.close_rounded, size: 20, color: textSecondary),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            Container(
              height: 1,
              margin: const EdgeInsets.only(top: 8, bottom: 16),
              color: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
            ),

            // Selected text + audio
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'TARGET',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                          color: textSecondary.withValues(alpha: 0.7),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.text,
                        style: languageTextStyle(
                          config.name,
                          fontSize: 18,
                          color: textPrimary,
                          isBold: true,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                PlayButton(
                  size: 36,
                  isPlaying: prov.playingId == 'ai_translate',
                  onPressed: () => prov.speakText(widget.text, 'ai_translate'),
                ),
              ],
            ),

            const SizedBox(height: 20),

            if (_isLoading)
              Row(
                children: [
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFF59E0B)),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Translating...',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: textSecondary),
                  ),
                ],
              )
            else if (_error.isNotEmpty)
              Text(
                _error,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFFEF4444)),
              )
            else ...[
              // Transliteration
              if (_transliteration.isNotEmpty) ...[
                Text(
                  (translitLabel ?? 'Transliteration').toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                    color: textSecondary.withValues(alpha: 0.7),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _transliteration,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: isDark ? const Color(0xFFD4D4D8) : const Color(0xFF44403C),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              // English translation
              Text(
                'ENGLISH',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: textSecondary.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _translation,
                style: TextStyle(
                  fontSize: 17,
                  height: 1.4,
                  color: textPrimary,
                ),
              ),
            ],

            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}
