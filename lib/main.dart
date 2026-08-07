import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'app/app.dart';
import 'core/services/firebase_service.dart';
import 'core/services/storage_service.dart';
import 'features/character_drill/providers/character_drill_provider.dart';
import 'features/course/providers/course_provider.dart';
import 'features/home/providers/home_provider.dart';
import 'features/lingocraft/providers/lingocraft_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Show Flutter's own selection context menu (with custom items like
  // AI Translate) instead of the native browser menu on web.
  if (kIsWeb) {
    await BrowserContextMenu.disableContextMenu();
  }

  await StorageService.init();
  await FirebaseService.init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => HomeProvider()),
        ChangeNotifierProvider(create: (_) => CourseProvider()),
        ChangeNotifierProvider(create: (_) => CharacterDrillProvider()),
        ChangeNotifierProvider(create: (_) => LingoCraftProvider()),
      ],
      child: const LanguageHubApp(),
    ),
  );
}
