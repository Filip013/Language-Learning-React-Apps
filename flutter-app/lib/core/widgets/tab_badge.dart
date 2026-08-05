import 'package:flutter/material.dart';

/// Centered-style tab header badge: amber icon inside a rounded tinted square
/// followed by an uppercase amber label. Consistent across all course tabs
/// (matches the Studio tab reference).
class TabBadge extends StatelessWidget {
  final IconData icon;
  final String label;

  const TabBadge({super.key, required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF27272A) : const Color(0xFFFEF3C7),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: const Color(0xFFD97706)),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
            color: Color(0xFFD97706),
          ),
        ),
      ],
    );
  }
}
