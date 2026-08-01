// lib/screens/lingocraft_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:lingocraft_flutter/constants/languages.dart';
import 'package:lingocraft_flutter/providers/lingocraft_provider.dart';
import 'package:lingocraft_flutter/screens/settings_screen.dart';
import 'package:lingocraft_flutter/widgets/history_list.dart';
import 'package:lingocraft_flutter/widgets/sentence_card.dart';

class LingoCraftScreen extends StatefulWidget {
  const LingoCraftScreen({super.key});

  @override
  State<LingoCraftScreen> createState() => _LingoCraftScreenState();
}

class _LingoCraftScreenState extends State<LingoCraftScreen> {
  final _wordController = TextEditingController();
  bool _showSearchOverlay = false;

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_onGlobalKeyEvent);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_onGlobalKeyEvent);
    _wordController.dispose();
    super.dispose();
  }

  void _handleGenerate(LingoCraftProvider prov) {
    final word = _wordController.text.trim();
    if (word.isEmpty) return;
    _wordController.clear();
    FocusScope.of(context).unfocus();
    setState(() => _showSearchOverlay = false);
    prov.generate(word);
  }

  bool _onGlobalKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return false;
    final prov = context.read<LingoCraftProvider>();
    final key = event.logicalKey;

    if (key == LogicalKeyboardKey.escape) {
      if (_showSearchOverlay) {
        setState(() => _showSearchOverlay = false);
        return true;
      }
    }

    if (FocusManager.instance.primaryFocus?.context?.widget is EditableText) {
      return false;
    }

    if (key == LogicalKeyboardKey.arrowRight ||
        key == LogicalKeyboardKey.keyW ||
        key == LogicalKeyboardKey.keyD) {
      if (prov.result != null) {
        prov.goNext();
        return true;
      }
    } else if (key == LogicalKeyboardKey.arrowLeft ||
        key == LogicalKeyboardKey.keyQ ||
        key == LogicalKeyboardKey.keyA) {
      if (prov.result != null) {
        prov.goPrev();
        return true;
      }
    } else if (key == LogicalKeyboardKey.keyR) {
      if (prov.result != null) {
        prov.revealSentence(prov.currentIdx);
        return true;
      }
    } else if (key == LogicalKeyboardKey.space) {
      if (prov.result != null) {
        prov.toggleAudio(prov.currentIdx);
        return true;
      }
    } else if (key == LogicalKeyboardKey.keyS) {
      setState(() => _showSearchOverlay = !_showSearchOverlay);
      return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<LingoCraftProvider>();
    final dark = prov.isDarkMode;

    final bg = dark ? const Color(0xFF09090B) : const Color(0xFFFAFAF9);
    final surface = dark ? const Color(0xFF18181B) : Colors.white;
    final border = dark ? const Color(0xFF27272A) : const Color(0xFFE7E5E4);
    final textPrimary = dark
        ? const Color(0xFFF4F4F5)
        : const Color(0xFF1C1917);
    final textMuted = dark ? const Color(0xFF71717A) : const Color(0xFF78716C);

    return Scaffold(
      backgroundColor: bg,
      body: Stack(
          children: [
            Column(
              children: [
                _NavBar(
                  dark: dark,
                  surface: surface,
                  border: border,
                  textPrimary: textPrimary,
                  textMuted: textMuted,
                  prov: prov,
                  onSearchTap: () =>
                      setState(() => _showSearchOverlay = !_showSearchOverlay),
                ),
                if (prov.activeTab == 'main' &&
                    prov.result == null &&
                    !prov.loading)
                  _SearchBar(
                    dark: dark,
                    surface: surface,
                    border: border,
                    textPrimary: textPrimary,
                    textMuted: textMuted,
                    controller: _wordController,
                    prov: prov,
                    onGenerate: () => _handleGenerate(prov),
                  ),
                Expanded(
                  child: prov.activeTab == 'history'
                      ? HistoryList(
                          dark: dark,
                          surface: surface,
                          border: border,
                          textPrimary: textPrimary,
                          textMuted: textMuted,
                        )
                      : GestureDetector(
                          onHorizontalDragEnd: (details) {
                            if (details.primaryVelocity != null) {
                              if (details.primaryVelocity! < -200) {
                                prov.goNext();
                              } else if (details.primaryVelocity! > 200) {
                                prov.goPrev();
                              }
                            }
                          },
                          child: _MainTab(
                            dark: dark,
                            surface: surface,
                            border: border,
                            textPrimary: textPrimary,
                            textMuted: textMuted,
                            wordController: _wordController,
                            onGenerate: () => _handleGenerate(prov),
                          ),
                        ),
                ),
              ],
            ),
            if (_showSearchOverlay)
              Positioned.fill(
                child: GestureDetector(
                  onTap: () => setState(() => _showSearchOverlay = false),
                  child: Container(
                    color: Colors.black.withValues(alpha: 0.5),
                    alignment: Alignment.topCenter,
                    padding: const EdgeInsets.only(
                      top: 80,
                      left: 16,
                      right: 16,
                    ),
                    child: GestureDetector(
                      onTap: () {},
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 480),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: border),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.3),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            TextField(
                              controller: _wordController,
                              autofocus: true,
                              style: GoogleFonts.inter(
                                color: textPrimary,
                                fontSize: 14,
                              ),
                              decoration: InputDecoration(
                                hintText: 'Enter target word...',
                                hintStyle: GoogleFonts.inter(color: textMuted),
                                prefixIcon: Icon(
                                  Icons.search_rounded,
                                  color: textMuted,
                                ),
                                filled: true,
                                fillColor: dark
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
                                  borderSide: const BorderSide(
                                    color: Color(0xFF2563EB),
                                  ),
                                ),
                              ),
                              onSubmitted: (_) => _handleGenerate(prov),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: _DropdownField<Language>(
                                    dark: dark,
                                    border: border,
                                    textPrimary: textPrimary,
                                    value: kLanguages.firstWhere(
                                      (l) =>
                                          l.name == prov.selectedLanguage.name,
                                      orElse: () => kLanguages.first,
                                    ),
                                    items: kLanguages,
                                    labelBuilder: (l) => '${l.flag} ${l.name}',
                                    onChanged: (l) {
                                      if (l != null) prov.setLanguage(l);
                                    },
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _DropdownField<String>(
                                    dark: dark,
                                    border: border,
                                    textPrimary: textPrimary,
                                    value:
                                        kLevels.any(
                                          (l) => l['id'] == prov.selectedLevel,
                                        )
                                        ? prov.selectedLevel
                                        : kLevels.first['id']!,
                                    items: kLevels
                                        .map((l) => l['id']!)
                                        .toList(),
                                    labelBuilder: (l) => l,
                                    onChanged: (l) {
                                      if (l != null) prov.setLevel(l);
                                    },
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                onPressed: () => _handleGenerate(prov),
                                icon: const Icon(
                                  Icons.auto_awesome_rounded,
                                  size: 16,
                                ),
                                label: Text(
                                  'Generate Context',
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF2563EB),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
    );
  }
}

class _NavBar extends StatelessWidget {
  final bool dark;
  final Color surface, border, textPrimary, textMuted;
  final LingoCraftProvider prov;
  final VoidCallback onSearchTap;

  const _NavBar({
    required this.dark,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textMuted,
    required this.prov,
    required this.onSearchTap,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Container(
        decoration: BoxDecoration(
          color: surface.withValues(alpha: 0.92),
          border: Border(bottom: BorderSide(color: border)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            GestureDetector(
              onTap: () {
                prov.setActiveTab('main');
                prov.clearResult();
              },
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: dark
                          ? const Color(0xFF1D4ED8).withValues(alpha: 0.1)
                          : const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: dark
                            ? const Color(0xFF1D4ED8).withValues(alpha: 0.2)
                            : const Color(0xFFBFDBFE),
                      ),
                    ),
                    child: Icon(
                      Icons.language,
                      color: dark
                          ? const Color(0xFF60A5FA)
                          : const Color(0xFF2563EB),
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'LingoCraft',
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            if (prov.result != null || prov.loading)
              _NavIconButton(
                dark: dark,
                border: border,
                icon: Icons.search_rounded,
                active: false,
                onTap: onSearchTap,
              ),
            const SizedBox(width: 8),
            _NavIconButton(
              dark: dark,
              border: border,
              icon: Icons.history_rounded,
              active: prov.activeTab == 'history',
              onTap: () => prov.setActiveTab(
                prov.activeTab == 'history' ? 'main' : 'history',
              ),
            ),
            const SizedBox(width: 8),
            _NavIconButton(
              dark: dark,
              border: border,
              icon: dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
              active: false,
              onTap: prov.toggleTheme,
            ),
            const SizedBox(width: 8),
            _NavIconButton(
              dark: dark,
              border: border,
              icon: Icons.settings_rounded,
              active: false,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              ),
            ),
            const SizedBox(width: 8),
            if (prov.user == null)
              TextButton.icon(
                onPressed: prov.signIn,
                icon: const Icon(Icons.login_rounded, size: 16),
                label: Text(
                  'Sign In',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF3B82F6),
                ),
              )
            else
              GestureDetector(
                onTap: prov.signOut,
                child: CircleAvatar(
                  radius: 15,
                  backgroundImage: prov.user!.photoURL != null
                      ? NetworkImage(prov.user!.photoURL!)
                      : null,
                  backgroundColor: const Color(
                    0xFF3B82F6,
                  ).withValues(alpha: 0.2),
                  child: prov.user!.photoURL == null
                      ? Text(
                          prov.user!.displayName?.substring(0, 1) ?? '?',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF3B82F6),
                          ),
                        )
                      : null,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavIconButton extends StatelessWidget {
  final bool dark, active;
  final Color border;
  final IconData icon;
  final VoidCallback onTap;

  const _NavIconButton({
    required this.dark,
    required this.border,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: active
              ? const Color(0xFF2563EB)
              : (dark ? const Color(0xFF18181B) : Colors.white),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: active ? const Color(0xFF2563EB) : border),
        ),
        child: Icon(
          icon,
          size: 16,
          color: active
              ? Colors.white
              : (dark ? const Color(0xFF60A5FA) : const Color(0xFF2563EB)),
        ),
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  final bool dark;
  final Color surface, border, textPrimary, textMuted;
  final TextEditingController controller;
  final LingoCraftProvider prov;
  final VoidCallback onGenerate;

  const _SearchBar({
    required this.dark,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textMuted,
    required this.controller,
    required this.prov,
    required this.onGenerate,
  });

  @override
  Widget build(BuildContext context) {
    final currentLang = kLanguages.firstWhere(
      (l) => l.name == prov.selectedLanguage.name,
      orElse: () => kLanguages.first,
    );

    final currentLevel = kLevels.any((l) => l['id'] == prov.selectedLevel)
        ? prov.selectedLevel
        : kLevels.first['id']!;

    return Container(
      decoration: BoxDecoration(
        color: dark
            ? const Color(0xFF18181B).withValues(alpha: 0.3)
            : const Color(0xFFFAFAF9).withValues(alpha: 0.5),
        border: Border(bottom: BorderSide(color: border)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Column(
        children: [
          TextField(
            controller: controller,
            style: GoogleFonts.inter(color: textPrimary, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Enter target word...',
              hintStyle: GoogleFonts.inter(color: textMuted, fontSize: 14),
              prefixIcon: Icon(
                Icons.search_rounded,
                color: textMuted,
                size: 18,
              ),
              filled: true,
              fillColor: dark ? const Color(0xFF09090B) : Colors.white,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
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
                borderSide: const BorderSide(
                  color: Color(0xFF3B82F6),
                  width: 1.5,
                ),
              ),
            ),
            onSubmitted: (_) => onGenerate(),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _DropdownField<Language>(
                  dark: dark,
                  border: border,
                  textPrimary: textPrimary,
                  value: currentLang,
                  items: kLanguages,
                  labelBuilder: (l) => '${l.flag} ${l.name}',
                  onChanged: (l) {
                    if (l != null) prov.setLanguage(l);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _DropdownField<String>(
                  dark: dark,
                  border: border,
                  textPrimary: textPrimary,
                  value: currentLevel,
                  items: kLevels.map((l) => l['id']!).toList(),
                  labelBuilder: (l) => l,
                  onChanged: (l) {
                    if (l != null) prov.setLevel(l);
                  },
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: prov.loading ? null : onGenerate,
                icon: prov.loading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.auto_awesome_rounded, size: 16),
                label: Text(
                  'Generate',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  final bool dark;
  final Color border, textPrimary;
  final T value;
  final List<T> items;
  final String Function(T) labelBuilder;
  final ValueChanged<T?> onChanged;

  const _DropdownField({
    required this.dark,
    required this.border,
    required this.textPrimary,
    required this.value,
    required this.items,
    required this.labelBuilder,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF09090B) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          dropdownColor: dark ? const Color(0xFF18181B) : Colors.white,
          style: GoogleFonts.inter(
            color: textPrimary,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
          items: items
              .map(
                (item) => DropdownMenuItem<T>(
                  value: item,
                  child: Text(
                    labelBuilder(item),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _MainTab extends StatelessWidget {
  final bool dark;
  final Color surface, border, textPrimary, textMuted;
  final TextEditingController wordController;
  final VoidCallback onGenerate;

  const _MainTab({
    required this.dark,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textMuted,
    required this.wordController,
    required this.onGenerate,
  });

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<LingoCraftProvider>();

    Widget? errorWidget;
    if (prov.error != null) {
      errorWidget = Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.red.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: Colors.red,
              size: 18,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                prov.error!,
                style: GoogleFonts.inter(color: Colors.red, fontSize: 13),
              ),
            ),
            GestureDetector(
              onTap: prov.clearError,
              child: const Icon(Icons.close, color: Colors.red, size: 16),
            ),
          ],
        ),
      );
    }

    if (prov.loading) {
      return Column(
        children: [
          ?errorWidget,
          const Expanded(child: _LoadingView()),
        ],
      );
    }

    if (prov.result == null) {
      return Column(
        children: [
          ?errorWidget,
          Expanded(
            child: _EmptyState(
              dark: dark,
              surface: surface,
              border: border,
              textPrimary: textPrimary,
              textMuted: textMuted,
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        ?errorWidget,
        Expanded(
          child: _CardLayout(
            dark: dark,
            surface: surface,
            border: border,
            textPrimary: textPrimary,
            textMuted: textMuted,
            wordController: wordController,
            onGenerate: onGenerate,
          ),
        ),
      ],
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(
            color: Color(0xFF3B82F6),
            strokeWidth: 3,
          ),
          const SizedBox(height: 20),
          Text(
            'Assembling linguistic context...',
            style: GoogleFonts.inter(
              color: const Color(0xFF71717A),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool dark;
  final Color surface, border, textPrimary, textMuted;

  const _EmptyState({
    required this.dark,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textMuted,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(48),
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: border, style: BorderStyle.solid),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.menu_book_rounded,
              size: 64,
              color: textMuted.withValues(alpha: 0.3),
            ),
            const SizedBox(height: 16),
            Text(
              'No Context Active',
              style: GoogleFonts.inter(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Enter a word in the toolbar above, configure your target language and difficulty, and map it into distinct grammatical structures.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: textMuted,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardLayout extends StatelessWidget {
  final bool dark;
  final Color surface, border, textPrimary, textMuted;
  final TextEditingController wordController;
  final VoidCallback onGenerate;

  const _CardLayout({
    required this.dark,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textMuted,
    required this.wordController,
    required this.onGenerate,
  });

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<LingoCraftProvider>();
    final result = prov.result!;
    final isCjk = isCjkLanguage(result.targetLanguage.name);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 8,
                        children: [
                          Text(
                            result.word,
                            style: getTargetLanguageTextStyle(
                              result.targetLanguage.name,
                              fontSize: isCjk ? 36 : 26,
                              fontWeight: isCjk
                                  ? FontWeight.w400
                                  : FontWeight.w800,
                              color: textPrimary,
                            ),
                          ),
                          _Chip(
                            label: result.partOfSpeech,
                            dark: dark,
                            accent: true,
                          ),
                          _Chip(label: result.ipa, dark: dark, mono: true),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        result.definitionEnglish,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: textMuted,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${result.targetLanguage.flag} ${result.targetLanguage.name}',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: textPrimary,
                      ),
                    ),
                    Text(
                      result.level,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF3B82F6),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: border),
            ),
            child: Row(
              children: [
                _PaginatorButton(
                  icon: Icons.chevron_left_rounded,
                  enabled: prov.currentIdx > 0,
                  dark: dark,
                  onTap: prov.goPrev,
                ),
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(result.sentences.length, (i) {
                        final active = prov.currentIdx == i;
                        return GestureDetector(
                          onTap: () => prov.setCurrentIdx(i),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            margin: const EdgeInsets.symmetric(horizontal: 2),
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: active
                                  ? (dark
                                        ? const Color(0xFF2563EB)
                                        : const Color(0xFFEFF6FF))
                                  : (dark
                                        ? const Color(0xFF18181B)
                                        : Colors.white),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: active
                                    ? (dark
                                          ? const Color(0xFF3B82F6)
                                          : const Color(0xFF93C5FD))
                                    : border,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '${i + 1}',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: active
                                    ? (dark
                                          ? Colors.white
                                          : const Color(0xFF1D4ED8))
                                    : textMuted,
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                ),
                _PaginatorButton(
                  icon: Icons.chevron_right_rounded,
                  enabled: prov.currentIdx < result.sentences.length - 1,
                  dark: dark,
                  onTap: prov.goNext,
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: SentenceCard(
              dark: dark,
              surface: surface,
              border: border,
              textPrimary: textPrimary,
              textMuted: textMuted,
            ),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool dark, accent, mono;

  const _Chip({
    required this.label,
    required this.dark,
    this.accent = false,
    this.mono = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: accent
            ? (dark
                  ? const Color(0xFF1D4ED8).withValues(alpha: 0.1)
                  : const Color(0xFFEFF6FF))
            : (dark ? const Color(0xFF27272A) : const Color(0xFFF5F5F4)),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: accent
              ? (dark
                    ? const Color(0xFF1D4ED8).withValues(alpha: 0.2)
                    : const Color(0xFFBFDBFE))
              : (dark ? const Color(0xFF3F3F46) : const Color(0xFFE7E5E4)),
        ),
      ),
      child: Text(
        label,
        style: (mono ? GoogleFonts.robotoMono : GoogleFonts.inter)(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: accent
              ? (dark ? const Color(0xFF60A5FA) : const Color(0xFF1D4ED8))
              : (dark ? const Color(0xFFD4D4D8) : const Color(0xFF57534E)),
        ),
      ),
    );
  }
}

class _PaginatorButton extends StatelessWidget {
  final IconData icon;
  final bool enabled, dark;
  final VoidCallback onTap;

  const _PaginatorButton({
    required this.icon,
    required this.enabled,
    required this.dark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Icon(
          icon,
          size: 20,
          color: enabled
              ? (dark ? const Color(0xFFD4D4D8) : const Color(0xFF1C1917))
              : (dark ? const Color(0xFF3F3F46) : const Color(0xFFD6D3D1)),
        ),
      ),
    );
  }
}
