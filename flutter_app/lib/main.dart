// lib/main.dart
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:lingocraft_flutter/providers/app_provider.dart';
import 'package:lingocraft_flutter/providers/course_provider.dart';
import 'package:lingocraft_flutter/providers/lingocraft_provider.dart';
import 'package:lingocraft_flutter/screens/home_screen.dart';

const kFirebaseOptions = FirebaseOptions(
  apiKey: "AIzaSyC4FcjFosdCMxWnPAeMe_ObZPDShnHZy2E",
  authDomain: "gen-lang-client-0142372615.firebaseapp.com",
  projectId: "gen-lang-client-0142372615",
  storageBucket: "gen-lang-client-0142372615.firebasestorage.app",
  messagingSenderId: "115950049911",
  appId: "1:115950049911:web:72954612553e4cf3c78472",
);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    if (kIsWeb) {
      await Firebase.initializeApp(options: kFirebaseOptions);
    } else {
      try {
        await Firebase.initializeApp(options: kFirebaseOptions);
      } catch (_) {
        await Firebase.initializeApp();
      }
    }
  } catch (e) {
    debugPrint('Firebase init note: $e');
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppProvider()),
        ChangeNotifierProvider(create: (_) => LingoCraftProvider()),
        ChangeNotifierProvider(create: (_) => CourseProvider()),
      ],
      child: const LanguageApp(),
    ),
  );
}

class LanguageApp extends StatelessWidget {
  const LanguageApp({super.key});

  @override
  Widget build(BuildContext context) {
    final appProv = context.watch<AppProvider>();
    final dark = appProv.isDarkMode;

    return MaterialApp(
      title: 'Language Hub',
      debugShowCheckedModeBanner: false,
      themeMode: dark ? ThemeMode.dark : ThemeMode.light,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFFAFAF9),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF2563EB),
          surface: Colors.white,
        ),
        textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF09090B),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF3B82F6),
          surface: Color(0xFF18181B),
        ),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}
