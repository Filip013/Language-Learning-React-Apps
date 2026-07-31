// lib/screens/course_screen.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:lingocraft_flutter/models/course_config.dart';
import 'package:lingocraft_flutter/providers/app_provider.dart';

class CourseScreen extends StatefulWidget {
  final CourseConfig config;
  const CourseScreen({super.key, required this.config});

  @override
  State<CourseScreen> createState() => _CourseScreenState();
}

class _CourseScreenState extends State<CourseScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    final tabCount = 2 + (widget.config.hasReading ? 1 : 0);
    _tabController = TabController(length: tabCount, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appProv = context.watch<AppProvider>();
    final dark = appProv.isDarkMode;
    final cfg = widget.config;

    final bg = dark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9);
    final surface = dark ? const Color(0xFF18181B) : Colors.white;
    final border = dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4);
    final textPrimary = dark
        ? const Color(0xFFF4F4F5)
        : const Color(0xFF1C1917);
    final textMuted = dark ? const Color(0xFF71717A) : const Color(0xFF78716C);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: surface,
        elevation: 0,
        iconTheme: IconThemeData(color: textPrimary),
        title: Row(
          children: [
            Text(cfg.flag, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 8),
            Text(
              cfg.name,
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: textPrimary,
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF2563EB),
          unselectedLabelColor: textMuted,
          indicatorColor: const Color(0xFF2563EB),
          labelStyle: GoogleFonts.inter(
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
          tabs: [
            const Tab(text: 'Vocabulary'),
            const Tab(text: 'Stories'),
            if (cfg.hasReading) const Tab(text: 'Reading'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _VocabularyTab(
            cfg: cfg,
            dark: dark,
            surface: surface,
            border: border,
            textPrimary: textPrimary,
            textMuted: textMuted,
            uid: appProv.user?.uid,
          ),
          _StoriesTab(
            cfg: cfg,
            dark: dark,
            surface: surface,
            border: border,
            textPrimary: textPrimary,
            textMuted: textMuted,
          ),
          if (cfg.hasReading)
            _ReadingTab(
              cfg: cfg,
              dark: dark,
              surface: surface,
              border: border,
              textPrimary: textPrimary,
              textMuted: textMuted,
            ),
        ],
      ),
    );
  }
}

class _VocabularyTab extends StatelessWidget {
  final CourseConfig cfg;
  final bool dark;
  final Color surface, border, textPrimary, textMuted;
  final String? uid;

  const _VocabularyTab({
    required this.cfg,
    required this.dark,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textMuted,
    this.uid,
  });

  @override
  Widget build(BuildContext context) {
    if (uid == null) {
      return Center(
        child: Text(
          'Sign in to view your vocabulary progress.',
          style: GoogleFonts.inter(color: textMuted, fontSize: 14),
        ),
      );
    }

    final docRef = FirebaseFirestore.instance
        .collection('artifacts')
        .doc(cfg.dbAppId)
        .collection('users')
        .doc(uid)
        .collection('data')
        .doc('vocab');

    return StreamBuilder<DocumentSnapshot>(
      stream: docRef.snapshots(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFF2563EB)),
          );
        }

        final data = snap.data?.data() as Map<String, dynamic>?;
        final items = (data?['items'] as List<dynamic>? ?? []);

        if (items.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.book_rounded,
                  size: 48,
                  color: textMuted.withValues(alpha: 0.3),
                ),
                const SizedBox(height: 12),
                Text(
                  'No Vocabulary Found',
                  style: GoogleFonts.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Items added in the web app will sync here.',
                  style: GoogleFonts.inter(fontSize: 12, color: textMuted),
                ),
              ],
            ),
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (context, index) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final item = Map<String, dynamic>.from(items[index] as Map);
            final primary = item[cfg.primaryTextKey] as String? ?? '';
            final trans = cfg.transliterationKey != null
                ? item[cfg.transliterationKey!] as String?
                : null;
            final english = item['english'] as String? ?? '';

            return Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          primary,
                          style: GoogleFonts.inter(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: textPrimary,
                          ),
                        ),
                        if (trans != null && trans.isNotEmpty)
                          Text(
                            trans,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontStyle: FontStyle.italic,
                              color: textMuted,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    english,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF2563EB),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _StoriesTab extends StatelessWidget {
  final CourseConfig cfg;
  final bool dark;
  final Color surface, border, textPrimary, textMuted;

  const _StoriesTab({
    required this.cfg,
    required this.dark,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textMuted,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.auto_stories_rounded,
            size: 56,
            color: const Color(0xFF2563EB).withValues(alpha: 0.4),
          ),
          const SizedBox(height: 16),
          Text(
            'Interactive AI Stories',
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              'Generate 30+ episode learning sagas in ${cfg.name} tailored to your vocabulary.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontSize: 13, color: textMuted),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReadingTab extends StatelessWidget {
  final CourseConfig cfg;
  final bool dark;
  final Color surface, border, textPrimary, textMuted;

  const _ReadingTab({
    required this.cfg,
    required this.dark,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textMuted,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.chrome_reader_mode_rounded,
            size: 56,
            color: const Color(0xFF10B981).withValues(alpha: 0.4),
          ),
          const SizedBox(height: 16),
          Text(
            'Graded Reader Mode',
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              'Read authentic ${cfg.name} texts with tap-to-translate definitions.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontSize: 13, color: textMuted),
            ),
          ),
        ],
      ),
    );
  }
}
