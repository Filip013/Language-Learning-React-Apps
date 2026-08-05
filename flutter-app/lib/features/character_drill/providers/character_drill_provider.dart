import 'package:flutter/material.dart';

class CharacterDrillProvider extends ChangeNotifier {
  int _currentSlide = 0;
  int _score = 0;
  bool _isAnswered = false;

  int get currentSlide => _currentSlide;
  int get score => _score;
  bool get isAnswered => _isAnswered;

  void answerQuestion(bool isCorrect) {
    if (_isAnswered) return;
    _isAnswered = true;
    if (isCorrect) {
      _score += 10;
    }
    notifyListeners();
  }

  void nextSlide() {
    _currentSlide++;
    _isAnswered = false;
    notifyListeners();
  }

  void reset() {
    _currentSlide = 0;
    _score = 0;
    _isAnswered = false;
    notifyListeners();
  }
}
