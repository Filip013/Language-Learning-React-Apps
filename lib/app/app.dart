import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../features/home/providers/home_provider.dart';
import 'routes/app_routes.dart';
import 'theme/app_theme.dart';

class LanguageHubApp extends StatelessWidget {
  const LanguageHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    final homeProv = context.watch<HomeProvider>();

    return MaterialApp(
      title: 'Language Hub',
      debugShowCheckedModeBanner: false,
      themeMode: homeProv.isDarkMode ? ThemeMode.dark : ThemeMode.light,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      initialRoute: AppRoutes.home,
      routes: AppRoutes.routes,
    );
  }
}
