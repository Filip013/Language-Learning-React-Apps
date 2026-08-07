import '../models/language.dart';

class LanguagesConfig {
  static const List<Language> allCourses = [
    Language(id: "ancient_greek", name: "Ancient Greek", url: "/ancient-greek", colorHex: "#D97706", flag: "📜"),
    Language(id: "greek", name: "Modern Greek", url: "/greek", colorHex: "#06B6D4", flag: "🇬🇷"),
    Language(id: "hungarian", name: "Hungarian", url: "/hungarian", colorHex: "#3B82F6", flag: "🇭🇺"),
    Language(id: "japanese", name: "Japanese", url: "/japanese", colorHex: "#F43F5E", flag: "🇯🇵"),
    Language(id: "latin", name: "Latin", url: "/latin", colorHex: "#F59E0B", flag: "🏛️"),
    Language(id: "lingocraft", name: "LingoCraft", url: "/lingocraft", colorHex: "#10B981", flag: "🌍"),
    Language(id: "mandarin", name: "Mandarin", url: "/mandarin", colorHex: "#EF4444", flag: "🇹🇼"),
    Language(id: "portuguese", name: "Portuguese", url: "/portuguese", colorHex: "#059669", flag: "🇵🇹"),
    Language(id: "romanian", name: "Romanian", url: "/romanian", colorHex: "#6366F1", flag: "🇷🇴"),
    Language(id: "russian", name: "Russian", url: "/russian", colorHex: "#0284C7", flag: "🇷🇺"),
  ];

  static const List<String> pinnedOrder = ["hungarian", "lingocraft", "mandarin"];
}
