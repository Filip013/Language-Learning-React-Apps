// test/widget_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:lingocraft_flutter/main.dart';
import 'package:lingocraft_flutter/providers/app_provider.dart';
import 'package:lingocraft_flutter/providers/course_provider.dart';
import 'package:lingocraft_flutter/providers/lingocraft_provider.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AppProvider()),
          ChangeNotifierProvider(create: (_) => LingoCraftProvider()),
          ChangeNotifierProvider(create: (_) => CourseProvider()),
        ],
        child: const LanguageApp(),
      ),
    );
  });
}

