import 'package:flutter/material.dart';

class PlayButton extends StatelessWidget {
  final bool isPlaying;
  final VoidCallback onPressed;
  final double size;

  const PlayButton({
    super.key,
    required this.isPlaying,
    required this.onPressed,
    this.size = 40,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(size / 2),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isPlaying
                ? const Color(0xFF2563EB)
                : (isDark ? const Color(0xFF27272A) : const Color(0xFFF5F5F4)),
            border: Border.all(
              color: isPlaying
                  ? const Color(0xFF3B82F6)
                  : (isDark ? const Color(0xFF3F3F46) : const Color(0xFFE7E5E4)),
            ),
          ),
          child: Icon(
            isPlaying ? Icons.stop_rounded : Icons.volume_up_rounded,
            size: size * 0.5,
            color: isPlaying
                ? Colors.white
                : (isDark ? const Color(0xFFD4D4D8) : const Color(0xFF57534E)),
          ),
        ),
      ),
    );
  }
}
