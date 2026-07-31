// lib/models/language.dart

class Language {
  final String name;
  final String code;
  final String flag;

  const Language({required this.name, required this.code, required this.flag});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Language &&
          runtimeType == other.runtimeType &&
          name == other.name;

  @override
  int get hashCode => name.hashCode;

  factory Language.fromMap(Map<String, dynamic> m) => Language(
    name: m['name'] as String? ?? '',
    code: m['code'] as String? ?? '',
    flag: m['flag'] as String? ?? '',
  );

  Map<String, dynamic> toMap() => {'name': name, 'code': code, 'flag': flag};
}
