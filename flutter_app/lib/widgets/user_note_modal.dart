// lib/widgets/user_note_modal.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class UserNoteModal extends StatefulWidget {
  final bool dark;
  final String noteTitle;
  final String initialText;
  final Function(String) onSave;

  const UserNoteModal({
    super.key,
    required this.dark,
    required this.noteTitle,
    required this.initialText,
    required this.onSave,
  });

  static Future<void> show({
    required BuildContext context,
    required bool dark,
    required String noteTitle,
    required String initialText,
    required Function(String) onSave,
  }) {
    return showDialog(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.6),
      builder: (context) => UserNoteModal(
        dark: dark,
        noteTitle: noteTitle,
        initialText: initialText,
        onSave: onSave,
      ),
    );
  }

  @override
  State<UserNoteModal> createState() => _UserNoteModalState();
}

class _UserNoteModalState extends State<UserNoteModal> {
  late TextEditingController _textController;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.initialText);
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  void _handleSave() {
    widget.onSave(_textController.text);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final surface = widget.dark ? const Color(0xFF18181B) : Colors.white;
    final border = widget.dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4);
    final textPrimary = widget.dark ? const Color(0xFFF4F4F5) : const Color(0xFF1C1917);
    final textMuted = widget.dark ? const Color(0xFF71717A) : const Color(0xFF78716C);

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(16),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.description_rounded,
                      color: Color(0xFFF59E0B),
                      size: 22,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'User Note',
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: textPrimary,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: Icon(Icons.close_rounded, color: textMuted, size: 20),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              widget.noteTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(fontSize: 13, color: textMuted),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _textController,
              autofocus: true,
              maxLines: 4,
              style: GoogleFonts.inter(fontSize: 14, color: textPrimary),
              decoration: InputDecoration(
                hintText:
                    'Log your mistake, note, or mnemonic here...',
                hintStyle: GoogleFonts.inter(color: textMuted),
                filled: true,
                fillColor: widget.dark
                    ? const Color(0xFF09090B)
                    : const Color(0xFFFAFAF9),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(
                    'Cancel',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.bold,
                      color: textMuted,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _handleSave,
                  icon: const Icon(Icons.check_rounded, size: 18),
                  label: Text(
                    'Save Note',
                    style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
