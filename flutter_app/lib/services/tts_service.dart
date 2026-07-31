// lib/services/tts_service.dart
import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:web/web.dart' as web;
import 'package:web_socket_channel/web_socket_channel.dart';

class TtsItem {
  final String text;
  int retries;
  TtsItem({required this.text, this.retries = 0});
}

class WebAudioChunkPlayer {
  web.AudioContext? _ctx;
  double _nextAudioTime = 0.0;

  void init() {
    if (_ctx == null) {
      _ctx = web.AudioContext(web.AudioContextOptions(sampleRate: 24000));
    }
    if (_ctx!.state == 'suspended') {
      _ctx!.resume();
    }
  }

  void playChunk(Uint8List pcmBytes) {
    if (pcmBytes.isEmpty) return;
    init();
    if (_ctx == null) return;

    final int16List = Int16List.view(
      pcmBytes.buffer,
      pcmBytes.offsetInBytes,
      pcmBytes.length ~/ 2,
    );
    final sampleCount = int16List.length;

    final audioBuffer = _ctx!.createBuffer(1, sampleCount, 24000);
    final Float32List channelData = audioBuffer.getChannelData(0).toDart;

    for (int i = 0; i < sampleCount; i++) {
      channelData[i] = int16List[i] / 32768.0;
    }

    final source = _ctx!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(_ctx!.destination);

    final currentTime = _ctx!.currentTime.toDouble();
    if (_nextAudioTime < currentTime) {
      _nextAudioTime = currentTime + 0.05;
    }

    source.start(_nextAudioTime);
    _nextAudioTime += audioBuffer.duration.toDouble();
  }

  void stop() {
    _nextAudioTime = 0.0;
  }
}

class TtsService {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  bool _audioReceived = false;
  TtsItem? _currentTurn;
  List<TtsItem> _queue = [];
  VoidCallback? _onComplete;
  VoidCallback? _onError;
  bool _isSpeaking = false;
  final WebAudioChunkPlayer _webPlayer = WebAudioChunkPlayer();

  bool get isSpeaking => _isSpeaking;

  Future<void> speak({
    required List<String> texts,
    required String systemInstruction,
    required String apiKey,
    VoidCallback? onComplete,
    VoidCallback? onError,
  }) async {
    stop();

    if (texts.isEmpty || apiKey.trim().isEmpty) {
      debugPrint('[TTS] Error: Empty texts or API key');
      onError?.call();
      return;
    }

    _isSpeaking = true;
    _onComplete = onComplete;
    _onError = onError;
    _queue = texts.map((t) => TtsItem(text: t)).toList();

    debugPrint('[TTS] Streaming Gemini Audio via WebSocket...');

    try {
      final uri = Uri.parse(
        'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey.trim()}',
      );

      _channel = WebSocketChannel.connect(uri);

      final setupMessage = jsonEncode({
        'setup': {
          'model': 'models/gemini-3.1-flash-live-preview',
          'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {
              'voiceConfig': {
                'prebuiltVoiceConfig': {'voiceName': 'Leda'},
              },
            },
          },
          'systemInstruction': {
            'parts': [
              {'text': systemInstruction},
            ],
          },
        },
      });

      _channel!.sink.add(setupMessage);

      _subscription = _channel!.stream.listen(
        (data) => _handleIncomingMessage(data),
        onError: (err) {
          debugPrint('[TTS] WebSocket Error: $err');
          stop();
          _onError?.call();
        },
        onDone: () {
          _isSpeaking = false;
        },
      );
    } catch (e) {
      debugPrint('[TTS] Exception: $e');
      stop();
      _onError?.call();
    }
  }

  void _sendNextText() {
    if (_queue.isEmpty) {
      debugPrint('[TTS] All queue items spoken successfully');
      _isSpeaking = false;
      _onComplete?.call();
      stop();
      return;
    }

    _currentTurn = _queue.removeAt(0);
    _audioReceived = false;

    debugPrint('[TTS] Sending text to model: "${_currentTurn!.text}"');

    final inputMsg = jsonEncode({
      'realtimeInput': {
        'text':
            'Read the following text aloud exactly as written: "${_currentTurn!.text}"',
      },
    });

    _channel?.sink.add(inputMsg);
  }

  void _handleIncomingMessage(dynamic rawData) {
    try {
      final text = rawData is String
          ? rawData
          : utf8.decode(rawData as List<int>);
      final msg = jsonDecode(text) as Map<String, dynamic>;

      if (msg['setupComplete'] != null) {
        _sendNextText();
      }

      if (msg['serverContent'] != null) {
        final serverContent = msg['serverContent'] as Map<String, dynamic>;
        final modelTurn = serverContent['modelTurn'] as Map<String, dynamic>?;

        if (modelTurn != null) {
          final parts = modelTurn['parts'] as List<dynamic>? ?? [];
          for (final part in parts) {
            final inlineData = part['inlineData'] as Map<String, dynamic>?;
            if (inlineData != null) {
              final mime = inlineData['mimeType'] as String? ?? '';
              if (mime.startsWith('audio/pcm')) {
                final base64Str = inlineData['data'] as String;
                final pcmBytes = base64Decode(base64Str);
                _audioReceived = true;

                // Stream chunk immediately as it arrives!
                if (kIsWeb) {
                  _webPlayer.playChunk(pcmBytes);
                }
              }
            }
          }
        }

        if (serverContent['turnComplete'] == true) {
          if (!_audioReceived && _currentTurn != null) {
            if (_currentTurn!.retries < 4) {
              debugPrint(
                '[TTS] Empty turn detected, retrying (${_currentTurn!.retries + 1}/4)...',
              );
              _currentTurn!.retries++;
              _queue.insert(0, _currentTurn!);
              _sendNextText();
              return;
            } else {
              debugPrint('[TTS] Max retries reached.');
              _onError?.call();
              stop();
              return;
            }
          }

          // Delay slightly before sending next text item to allow current chunks to finish
          Future.delayed(const Duration(milliseconds: 300), () {
            if (_isSpeaking) _sendNextText();
          });
        }
      }
    } catch (e) {
      debugPrint('[TTS] Error handling msg: $e');
    }
  }

  void stop() {
    _isSpeaking = false;
    _webPlayer.stop();
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
    _queue.clear();
    _currentTurn = null;
  }
}
