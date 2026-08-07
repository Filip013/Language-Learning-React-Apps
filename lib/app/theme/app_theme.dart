import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.lightScaffold,
      colorScheme: const ColorScheme.light(
        primary: AppColors.primaryBlue,
        surface: AppColors.lightSurface,
        outline: AppColors.lightBorder,
      ),
      textTheme: ThemeData.light().textTheme,
      cardTheme: CardThemeData(
        color: AppColors.lightSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: AppColors.lightBorder),
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      useMaterial3: true,
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.darkScaffold,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primaryBlue,
        surface: AppColors.darkSurface,
        outline: AppColors.darkBorder,
      ),
      textTheme: ThemeData.dark().textTheme,
      cardTheme: CardThemeData(
        color: AppColors.darkSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: AppColors.darkBorder),
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      useMaterial3: true,
    );
  }
}
