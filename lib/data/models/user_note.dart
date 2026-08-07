class UserNote {
  final String id;
  final String text;
  final String note;
  final DateTime? createdAt;

  UserNote({
    required this.id,
    required this.text,
    required this.note,
    this.createdAt,
  });

  factory UserNote.fromMap(String id, Map<String, dynamic> map) {
    return UserNote(
      id: id,
      text: map['text'] ?? map['targetText'] ?? '',
      note: map['note'] ?? map['userNote'] ?? '',
      createdAt: map['createdAt'] != null ? DateTime.tryParse(map['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'text': text,
      'note': note,
      'createdAt': createdAt?.toIso8601String() ?? DateTime.now().toIso8601String(),
    };
  }
}
