import 'package:flutter/material.dart';

class UserNoteModal extends StatefulWidget {
  final String targetText;
  final String existingNote;
  final Function(String note) onSave;

  const UserNoteModal({
    super.key,
    required this.targetText,
    required this.existingNote,
    required this.onSave,
  });

  static Future<void> show(
    BuildContext context, {
    required String targetText,
    required String existingNote,
    required Function(String note) onSave,
  }) {
    return showDialog(
      context: context,
      builder: (ctx) => UserNoteModal(
        targetText: targetText,
        existingNote: existingNote,
        onSave: onSave,
      ),
    );
  }

  @override
  State<UserNoteModal> createState() => _UserNoteModalState();
}

class _UserNoteModalState extends State<UserNoteModal> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.existingNote);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AlertDialog(
      backgroundColor: isDark ? const Color(0xFF18181B) : Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.note_alt_outlined, color: Color(0xFF2563EB), size: 22),
              const SizedBox(width: 8),
              Text(
                'Personal Note',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : const Color(0xFF1C1917),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF27272A) : const Color(0xFFF5F5F4),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              widget.targetText,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C),
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
      content: TextField(
        controller: _controller,
        maxLines: 4,
        style: TextStyle(
          fontSize: 14,
          color: isDark ? Colors.white : const Color(0xFF1C1917),
        ),
        decoration: InputDecoration(
          hintText: 'Type your custom note or reminder here...',
          hintStyle: TextStyle(
            color: isDark ? const Color(0xFF71717A) : const Color(0xFFA8A29E),
          ),
          filled: true,
          fillColor: isDark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(
              color: isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(
            'Cancel',
            style: TextStyle(
              color: isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C),
            ),
          ),
        ),
        ElevatedButton(
          onPressed: () {
            widget.onSave(_controller.text.trim());
            Navigator.of(context).pop();
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2563EB),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: const Text('Save Note'),
        ),
      ],
    );
  }
}
