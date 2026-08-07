import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../data/configs/languages_config.dart';
import '../../../data/models/language.dart';
import '../../course/providers/course_provider.dart';
import '../providers/home_provider.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final homeProv = context.watch<HomeProvider>();
    final isDark = homeProv.isDarkMode;

    final scaffoldBg = isDark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9);
    final cardBg = isDark ? const Color(0xFF18181B) : Colors.white;
    final cardBorder = isDark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4);
    final textPrimary = isDark ? Colors.white : const Color(0xFF18181B);
    final textSecondary = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF78716C);

    final pinnedCourses = LanguagesConfig.pinnedOrder
        .map((id) => LanguagesConfig.allCourses.firstWhere((c) => c.id == id, orElse: () => LanguagesConfig.allCourses.first))
        .toList();

    final otherCourses = LanguagesConfig.allCourses
        .where((c) => !LanguagesConfig.pinnedOrder.contains(c.id))
        .toList();

    otherCourses.sort((a, b) {
      final timeA = homeProv.recentAccess[a.id] ?? 0;
      final timeB = homeProv.recentAccess[b.id] ?? 0;
      return timeB.compareTo(timeA);
    });

    return Scaffold(
      backgroundColor: scaffoldBg,
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1040),
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Nav Header
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final isCompact = constraints.maxWidth < 420;
                      return Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF18181B),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.public_rounded,
                                  color: Colors.white,
                                  size: 18,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Cloud Hub',
                                style: TextStyle(
                                  fontSize: isCompact ? 16 : 18,
                                  fontWeight: FontWeight.bold,
                                  color: textPrimary,
                                ),
                              ),
                            ],
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                onPressed: () => homeProv.toggleTheme(),
                                icon: Icon(
                                  isDark ? Icons.wb_sunny_outlined : Icons.nightlight_round_outlined,
                                  color: textSecondary,
                                  size: 18,
                                ),
                              ),
                              const SizedBox(width: 2),
                              if (homeProv.isSigningIn)
                                const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              else if (homeProv.isSignedIn)
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (homeProv.user?.photoURL != null && homeProv.user!.photoURL!.isNotEmpty)
                                      CircleAvatar(
                                        radius: 12,
                                        backgroundImage: NetworkImage(homeProv.user!.photoURL!),
                                      )
                                    else
                                      CircleAvatar(
                                        radius: 12,
                                        backgroundColor: const Color(0xFF2563EB),
                                        child: Text(
                                          (homeProv.user?.email ?? 'U')[0].toUpperCase(),
                                          style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                    if (!isCompact) ...[
                                      const SizedBox(width: 6),
                                      ConstrainedBox(
                                        constraints: const BoxConstraints(maxWidth: 100),
                                        child: Text(
                                          homeProv.user?.displayName ?? homeProv.user?.email ?? 'Signed in',
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: textPrimary,
                                          ),
                                        ),
                                      ),
                                    ],
                                    IconButton(
                                      onPressed: () async {
                                        await homeProv.signOut();
                                        if (context.mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(content: Text('Signed out successfully.')),
                                          );
                                        }
                                      },
                                      icon: const Icon(
                                        Icons.logout_rounded,
                                        color: Color(0xFFEF4444),
                                        size: 18,
                                      ),
                                      tooltip: 'Sign out',
                                    ),
                                  ],
                                )
                              else
                                OutlinedButton.icon(
                                  onPressed: () async {
                                    try {
                                      final success = await homeProv.signInWithGoogle();
                                      if (success && context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text('Signed in with Google!')),
                                        );
                                      }
                                    } catch (e) {
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Sign-in notice: $e')),
                                        );
                                      }
                                    }
                                  },
                                  icon: const Icon(Icons.login_rounded, size: 15),
                                  label: Text(
                                    isCompact ? 'Sign In' : 'Sign in with Google',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: textPrimary,
                                    side: BorderSide(color: cardBorder),
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 36),

                  // Hero Section with Welcome Text & Action Pills
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final isMobile = constraints.maxWidth < 650;
                      return Flex(
                        direction: isMobile ? Axis.vertical : Axis.horizontal,
                        crossAxisAlignment: isMobile ? CrossAxisAlignment.start : CrossAxisAlignment.center,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Welcome back.',
                                style: TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.w900,
                                  color: textPrimary,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Select a master database to continue.',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                          if (isMobile) const SizedBox(height: 16),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              PopupMenuButton<String>(
                                onSelected: (route) {
                                  Navigator.pushNamed(context, route);
                                },
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                itemBuilder: (context) => [
                                  const PopupMenuItem(
                                    value: '/character-drill',
                                    child: Row(
                                      children: [
                                        Icon(Icons.edit_note_rounded, size: 18),
                                        SizedBox(width: 8),
                                        Text('Character Drills'),
                                      ],
                                    ),
                                  ),
                                  const PopupMenuItem(
                                    value: '/lingocraft',
                                    child: Row(
                                      children: [
                                        Icon(Icons.auto_awesome_rounded, size: 18),
                                        SizedBox(width: 8),
                                        Text('LingoCraft AI Studio'),
                                      ],
                                    ),
                                  ),
                                  const PopupMenuItem(
                                    value: '/batch-updater',
                                    child: Row(
                                      children: [
                                        Icon(Icons.storage_rounded, size: 18),
                                        SizedBox(width: 8),
                                        Text('Batch Updater'),
                                      ],
                                    ),
                                  ),
                                  const PopupMenuItem(
                                    value: '/migration-tool',
                                    child: Row(
                                      children: [
                                        Icon(Icons.swap_horiz_rounded, size: 18),
                                        SizedBox(width: 8),
                                        Text('Migration Tool'),
                                      ],
                                    ),
                                  ),
                                ],
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: cardBg,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: cardBorder),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.sports_esports_outlined, size: 16),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Games & Tools',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: textPrimary,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: textSecondary),
                                    ],
                                  ),
                                ),
                              ),
                              InkWell(
                                onTap: () {
                                  final current = homeProv.activePanel;
                                  homeProv.setActivePanel(current == 'settings' ? null : 'settings');
                                },
                                borderRadius: BorderRadius.circular(20),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: homeProv.activePanel == 'settings'
                                        ? (isDark ? const Color(0xFF27272A) : const Color(0xFF18181B))
                                        : cardBg,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: cardBorder),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.settings_outlined,
                                        size: 16,
                                        color: homeProv.activePanel == 'settings' ? Colors.white : textPrimary,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        'API & Config',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: homeProv.activePanel == 'settings' ? Colors.white : textPrimary,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Icon(
                                        homeProv.activePanel == 'settings'
                                            ? Icons.keyboard_arrow_up_rounded
                                            : Icons.keyboard_arrow_down_rounded,
                                        size: 16,
                                        color: homeProv.activePanel == 'settings' ? Colors.white : textSecondary,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 28),

                  // API & Config Drawer Panel if active
                  if (homeProv.activePanel == 'settings') ...[
                    _buildSettingsPanel(context, homeProv, isDark, cardBg, cardBorder, textPrimary, textSecondary),
                    const SizedBox(height: 28),
                  ],

                  // PINNED COURSES Section
                  Text(
                    'PINNED COURSES',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: textSecondary,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 12),

                  _buildCourseGrid(context, pinnedCourses, isDark, cardBg, cardBorder, textPrimary, textSecondary, isPinnedSection: true),

                  const SizedBox(height: 32),

                  // OTHER LANGUAGES Section
                  Text(
                    'OTHER LANGUAGES',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: textSecondary,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 12),

                  _buildCourseGrid(context, otherCourses, isDark, cardBg, cardBorder, textPrimary, textSecondary, isPinnedSection: false),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSettingsPanel(
    BuildContext context,
    HomeProvider homeProv,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF121215) : const Color(0xFFF9F9F8),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row of 2 API Key Manager Cards
          LayoutBuilder(
            builder: (context, constraints) {
              final isNarrow = constraints.maxWidth < 650;
              return Flex(
                direction: isNarrow ? Axis.vertical : Axis.horizontal,
                children: [
                  Expanded(
                    flex: isNarrow ? 0 : 1,
                    child: _ApiKeyCard(
                      title: 'Free Gemini Key',
                      subtitle: 'Powers TTS dictation and voice.',
                      storageKey: 'geminiApiKey',
                      savedKey: homeProv.freeGeminiKey,
                      onSave: (val) => homeProv.saveApiKey('geminiApiKey', val),
                      onRemove: () => homeProv.removeApiKey('geminiApiKey'),
                      isDark: isDark,
                      cardBorder: cardBorder,
                      textPrimary: textPrimary,
                      textSecondary: textSecondary,
                    ),
                  ),
                  SizedBox(width: isNarrow ? 0 : 16, height: isNarrow ? 16 : 0),
                  Expanded(
                    flex: isNarrow ? 0 : 1,
                    child: _ApiKeyCard(
                      title: 'Paid Gemini Key',
                      subtitle: 'Powers LLM context generation.',
                      storageKey: 'geminiPaidApiKey',
                      savedKey: homeProv.paidGeminiKey,
                      onSave: (val) => homeProv.saveApiKey('geminiPaidApiKey', val),
                      onRemove: () => homeProv.removeApiKey('geminiPaidApiKey'),
                      isDark: isDark,
                      cardBorder: cardBorder,
                      textPrimary: textPrimary,
                      textSecondary: textSecondary,
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 24),

          // Service Apps Section
          Text(
            'Service Apps',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'Tools for managing internal master data.',
            style: TextStyle(
              fontSize: 11,
              color: textSecondary,
            ),
          ),
          const SizedBox(height: 12),

          // 3 Pill Shortcuts
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _buildServiceAppPill(
                context,
                icon: Icons.history_rounded,
                label: 'Activity Log',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Activity Log modal shortcut')),
                  );
                },
                isDark: isDark,
                cardBorder: cardBorder,
                textPrimary: textPrimary,
              ),
              _buildServiceAppPill(
                context,
                icon: Icons.build_outlined,
                label: 'Batch Updater',
                onTap: () => Navigator.pushNamed(context, '/batch-updater'),
                isDark: isDark,
                cardBorder: cardBorder,
                textPrimary: textPrimary,
              ),
              _buildServiceAppPill(
                context,
                icon: Icons.dataset_outlined,
                label: 'Data Migration',
                onTap: () => Navigator.pushNamed(context, '/migration-tool'),
                isDark: isDark,
                cardBorder: cardBorder,
                textPrimary: textPrimary,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildServiceAppPill(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    required bool isDark,
    required Color cardBorder,
    required Color textPrimary,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF18181B) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: cardBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: textPrimary),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCourseGrid(
    BuildContext context,
    List<Language> courses,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary, {
    required bool isPinnedSection,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        int crossAxisCount = 3;
        if (constraints.maxWidth < 600) {
          crossAxisCount = 1;
        } else if (constraints.maxWidth < 900) {
          crossAxisCount = 2;
        }

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: 14,
            mainAxisSpacing: 14,
            mainAxisExtent: 64,
          ),
          itemCount: courses.length,
          itemBuilder: (context, index) {
            final course = courses[index];
            final isHungarianRecent = course.id == 'hungarian';

            return Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  context.read<HomeProvider>().touchCourseAccess(course.id);
                  if (course.id == 'lingocraft') {
                    Navigator.pushNamed(context, '/lingocraft');
                  } else {
                    context.read<CourseProvider>().setCourse(course.id);
                    Navigator.pushNamed(context, '/course', arguments: course.id);
                  }
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: cardBorder),
                    boxShadow: isDark
                        ? []
                        : [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text(
                            course.flag,
                            style: const TextStyle(fontSize: 22),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            course.name,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: textPrimary,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          if (isHungarianRecent)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              margin: const EdgeInsets.only(right: 8),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF27272A) : const Color(0xFFF5F5F4),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'RECENT',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: textSecondary,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          Icon(
                            Icons.arrow_forward_rounded,
                            size: 16,
                            color: textSecondary.withValues(alpha: 0.5),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _ApiKeyCard extends StatefulWidget {
  final String title;
  final String subtitle;
  final String storageKey;
  final String savedKey;
  final Function(String) onSave;
  final VoidCallback onRemove;
  final bool isDark;
  final Color cardBorder;
  final Color textPrimary;
  final Color textSecondary;

  const _ApiKeyCard({
    required this.title,
    required this.subtitle,
    required this.storageKey,
    required this.savedKey,
    required this.onSave,
    required this.onRemove,
    required this.isDark,
    required this.cardBorder,
    required this.textPrimary,
    required this.textSecondary,
  });

  @override
  State<_ApiKeyCard> createState() => _ApiKeyCardState();
}

class _ApiKeyCardState extends State<_ApiKeyCard> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasKey = widget.savedKey.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: widget.isDark ? const Color(0xFF18181B) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: widget.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: widget.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            widget.subtitle,
            style: TextStyle(fontSize: 11, color: widget.textSecondary),
          ),
          const SizedBox(height: 12),
          if (hasKey)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: widget.isDark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: widget.cardBorder),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Text(
                        '✓ Synced',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF10B981),
                        ),
                      ),
                    ],
                  ),
                  TextButton(
                    onPressed: widget.onRemove,
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      'Remove',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: widget.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    obscureText: true,
                    style: TextStyle(color: widget.textPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'AIzaSy...',
                      hintStyle: TextStyle(color: widget.textSecondary),
                      filled: true,
                      fillColor: widget.isDark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: widget.cardBorder),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () {
                    widget.onSave(_controller.text);
                    _controller.clear();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                  child: const Text('Save'),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
