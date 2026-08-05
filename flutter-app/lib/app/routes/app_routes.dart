import 'package:flutter/material.dart';
import '../../features/admin/screens/batch_updater_screen.dart';
import '../../features/admin/screens/migration_tool_screen.dart';
import '../../features/character_drill/screens/character_drill_screen.dart';
import '../../features/course/screens/language_course_screen.dart';
import '../../features/home/screens/home_screen.dart';
import '../../features/lingocraft/screens/lingocraft_screen.dart';

class AppRoutes {
  static const String home = '/';
  static const String course = '/course';
  static const String characterDrill = '/character-drill';
  static const String lingoCraft = '/lingocraft';
  static const String batchUpdater = '/batch-updater';
  static const String migrationTool = '/migration-tool';

  static Map<String, WidgetBuilder> get routes => {
        home: (context) => const HomeScreen(),
        course: (context) => const LanguageCourseScreen(),
        characterDrill: (context) => const CharacterDrillScreen(),
        lingoCraft: (context) => const LingoCraftScreen(),
        batchUpdater: (context) => const BatchUpdaterScreen(),
        migrationTool: (context) => const MigrationToolScreen(),
      };
}
