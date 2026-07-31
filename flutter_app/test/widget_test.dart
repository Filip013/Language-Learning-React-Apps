// test/widget_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:lingocraft_flutter/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const LanguageApp());
  });
}
