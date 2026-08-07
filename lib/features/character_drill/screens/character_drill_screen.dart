import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/widgets/glass_card.dart';
import '../providers/character_drill_provider.dart';

class CharacterDrillScreen extends StatelessWidget {
  const CharacterDrillScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final drillProv = context.watch<CharacterDrillProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9);
    final textPrimary = isDark ? Colors.white : const Color(0xFF1C1917);
    final textSecondary = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Character Drills'),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1040),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GlassCard(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Text(
                      'Score: ${drillProv.score}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2563EB),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      '學',
                      style: TextStyle(
                        fontSize: 64,
                        fontWeight: FontWeight.bold,
                        color: textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'xué • to learn / study',
                      style: TextStyle(
                        fontSize: 15,
                        color: textSecondary,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => drillProv.answerQuestion(true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      ),
                      child: const Text('Practice Stroke'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  ),
);
  }
}
