// lib/widgets/history_list.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:lingocraft_flutter/constants/languages.dart';
import 'package:lingocraft_flutter/providers/lingocraft_provider.dart';

class HistoryList extends StatelessWidget {
  final bool dark;
  final Color surface, border, textPrimary, textMuted;

  const HistoryList({
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
    final items = prov.filteredHistory;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            style: GoogleFonts.inter(color: textPrimary, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Search history...',
              hintStyle: GoogleFonts.inter(color: textMuted),
              prefixIcon: Icon(
                Icons.search_rounded,
                color: textMuted,
                size: 18,
              ),
              filled: true,
              fillColor: surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: border),
              ),
            ),
            onChanged: prov.setHistorySearch,
          ),
        ),
        Expanded(
          child: items.isEmpty
              ? Center(
                  child: Text(
                    'Your generated vocabulary will appear here.',
                    style: GoogleFonts.inter(color: textMuted, fontSize: 13),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: items.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final item = items[index];
                    final isCjk = isCjkLanguage(item.targetLanguage.name);

                    return GestureDetector(
                      onTap: () => prov.loadHistoryItem(item),
                      child: Container(
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
                                    item.word,
                                    style: isCjk
                                        ? TextStyle(
                                            fontSize: 22,
                                            color: textPrimary,
                                          )
                                        : GoogleFonts.inter(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w800,
                                            color: textPrimary,
                                          ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${item.targetLanguage.flag} ${item.targetLanguage.name} • ${item.level}',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      color: textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: const Icon(
                                Icons.delete_outline_rounded,
                                size: 18,
                                color: Colors.red,
                              ),
                              onPressed: () => prov.deleteHistoryItem(item.id),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
