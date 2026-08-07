import 'package:flutter_test/flutter_test.dart';
import 'package:lingocraft_flutter/app/app.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const LanguageHubApp());
    expect(find.text('Language Hub'), findsOneWidget);
  });
}
