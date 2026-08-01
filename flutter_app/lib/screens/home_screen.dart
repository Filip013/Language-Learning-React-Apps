// lib/screens/home_screen.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:lingocraft_flutter/constants/course_configs.dart';
import 'package:lingocraft_flutter/models/course_models.dart';
import 'package:lingocraft_flutter/providers/app_provider.dart';
import 'package:lingocraft_flutter/providers/course_provider.dart';
import 'package:lingocraft_flutter/screens/language_course_screen.dart';
import 'package:lingocraft_flutter/screens/lingocraft_screen.dart';
import 'package:lingocraft_flutter/screens/settings_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appProv = context.watch<AppProvider>();
    final dark = appProv.isDarkMode;

    final bg = dark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9);
    final surface = dark ? const Color(0xFF18181B) : Colors.white;
    final border = dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4);
    final textPrimary = dark
        ? const Color(0xFFF4F4F5)
        : const Color(0xFF1C1917);
    final textMuted = dark ? const Color(0xFF71717A) : const Color(0xFF78716C);

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Top Header Bar ───────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 16,
                ),
                decoration: BoxDecoration(
                  color: surface,
                  border: Border(bottom: BorderSide(color: border)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: dark
                            ? const Color(0xFF1D4ED8).withValues(alpha: 0.15)
                            : const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: dark
                              ? const Color(0xFF1D4ED8).withValues(alpha: 0.3)
                              : const Color(0xFFBFDBFE),
                        ),
                      ),
                      child: Icon(
                        Icons.auto_stories_rounded,
                        color: dark
                            ? const Color(0xFF60A5FA)
                            : const Color(0xFF2563EB),
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Language Hub',
                          style: GoogleFonts.inter(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: textPrimary,
                          ),
                        ),
                        Text(
                          'Interactive Learning Platform',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: textMuted,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),

                    // Theme toggle
                    IconButton(
                      icon: Icon(
                        dark
                            ? Icons.light_mode_rounded
                            : Icons.dark_mode_rounded,
                        color: dark
                            ? const Color(0xFF60A5FA)
                            : const Color(0xFF2563EB),
                      ),
                      onPressed: appProv.toggleTheme,
                    ),

                    // Settings button
                    IconButton(
                      icon: Icon(Icons.settings_rounded, color: textMuted),
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const SettingsScreen(),
                        ),
                      ),
                    ),

                    // User Auth avatar
                    if (appProv.user != null)
                      GestureDetector(
                        onTap: appProv.signOut,
                        child: CircleAvatar(
                          radius: 16,
                          backgroundImage: appProv.user!.photoURL != null
                              ? NetworkImage(appProv.user!.photoURL!)
                              : null,
                          backgroundColor: const Color(
                            0xFF3B82F6,
                          ).withValues(alpha: 0.2),
                          child: appProv.user!.photoURL == null
                              ? Text(
                                  appProv.user!.displayName?.substring(0, 1) ??
                                      '?',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: Color(0xFF3B82F6),
                                  ),
                                )
                              : null,
                        ),
                      )
                    else
                      ElevatedButton.icon(
                        onPressed: appProv.signIn,
                        icon: const Icon(Icons.login_rounded, size: 16),
                        label: Text(
                          'Sign In',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          elevation: 0,
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // ── Section 1: Pinned Courses ─────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                child: Text(
                  'PINNED COURSES',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: textMuted,
                  ),
                ),
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 280,
                  mainAxisExtent: 84,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                delegate: SliverChildListDelegate([
                  // 1. Hungarian Master
                  if (kCourseConfigs.containsKey('hungarian'))
                    _buildCourseCard(
                      context,
                      kCourseConfigs['hungarian']!,
                      surface,
                      border,
                      textPrimary,
                      textMuted,
                      dark,
                      isMostRecent: 'hungarian' == appProv.mostRecentCourseId,
                    ),

                  // 2. LingoCraft
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const LingoCraftScreen(),
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: dark ? const Color(0xFF27272A) : const Color(0xFFF5F5F4),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text('🌍', style: TextStyle(fontSize: 22)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'LingoCraft',
                                  style: GoogleFonts.inter(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: textPrimary,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  'Context Generator',
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: textMuted,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.arrow_forward_rounded, size: 18, color: textMuted),
                        ],
                      ),
                    ),
                  ),

                  // 3. Mandarin Master
                  if (kCourseConfigs.containsKey('mandarin'))
                    _buildCourseCard(
                      context,
                      kCourseConfigs['mandarin']!,
                      surface,
                      border,
                      textPrimary,
                      textMuted,
                      dark,
                      isMostRecent: 'mandarin' == appProv.mostRecentCourseId,
                    ),
                ]),
              ),
            ),

            // ── Section 2: Other Languages ────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                child: Text(
                  'OTHER LANGUAGES',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: textMuted,
                  ),
                ),
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 280,
                  mainAxisExtent: 84,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                delegate: SliverChildListDelegate(() {
                  const pinnedIds = ['hungarian', 'mandarin'];
                  final recentMap = appProv.recentAccess;
                  final mostRecentId = appProv.mostRecentCourseId;

                  final otherCourses = kCourseConfigs.values
                      .where((c) => !pinnedIds.contains(c.id))
                      .toList()
                    ..sort((a, b) =>
                        (recentMap[b.id] ?? 0).compareTo(recentMap[a.id] ?? 0));

                  return otherCourses.map((c) => _buildCourseCard(
                        context,
                        c,
                        surface,
                        border,
                        textPrimary,
                        textMuted,
                        dark,
                        isMostRecent: c.id == mostRecentId,
                      )).toList();
                }()),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCourseCard(
    BuildContext context,
    CourseConfig course,
    Color surface,
    Color border,
    Color textPrimary,
    Color textMuted,
    bool dark, {
    bool isMostRecent = false,
  }) {
    return GestureDetector(
      onTap: () {
        context.read<AppProvider>().selectCourse(course.id);
        context.read<CourseProvider>().selectCourse(course.id);
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const LanguageCourseScreen(),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: dark ? const Color(0xFF27272A) : const Color(0xFFF5F5F4),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(course.flag, style: const TextStyle(fontSize: 22)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                course.name,
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: textPrimary,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isMostRecent) ...[
              Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Recent',
                  style: GoogleFonts.inter(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: textMuted,
                  ),
                ),
              ),
            ],
            Icon(Icons.arrow_forward_rounded, size: 18, color: textMuted),
          ],
        ),
      ),
    );
  }
}
