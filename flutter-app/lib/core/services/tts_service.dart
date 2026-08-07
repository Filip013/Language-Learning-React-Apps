import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:audioplayers/audioplayers.dart';

import 'helpers/tts_web_stub.dart' if (dart.library.js_interop) 'helpers/tts_web_real.dart';
import 'storage_service.dart';

class TTSService {
  static final AudioPlayer _audioPlayer = AudioPlayer();
  static final AudioPlayer _audioPlayerB = AudioPlayer();
  static WebSocketChannel? _channel;
  static bool _isPlaying = false;

  static bool get isPlaying => _isPlaying;

  static String? get _ttsApiKey {
    final key = StorageService.getString('geminiApiKey') ?? StorageService.getString('geminiPaidApiKey');
    return (key != null && key.trim().isNotEmpty) ? key.trim() : null;
  }

  // Single-phrase wrapper
  static Future<void> speak({
    required String text,
    String? voiceName,
    String? systemInstruction,
    VoidCallback? onComplete,
    VoidCallback? onError,
  }) =>
      speakList(
        texts: [text],
        voiceName: voiceName,
        systemInstruction: systemInstruction,
        onComplete: onComplete,
        onError: onError,
      );

  /// Speak a sequence of texts sequentially (Target, English, Target).
  ///
  /// Native (Windows/Android): PCM chunks are flushed to the player as they
  /// stream in (~0.29s of audio per chunk) instead of waiting for the whole
  /// utterance, so speech starts almost immediately — mirroring React's
  /// schedule-as-it-arrives behavior. Completion is detected by polling the
  /// player state rather than racing on broadcast `onPlayerComplete` events.
  static Future<void> speakList({
    required List<String> texts,
    String? voiceName,
    String? systemInstruction,
    VoidCallback? onComplete,
    VoidCallback? onError,
  }) async {
    if (texts.isEmpty) return;

    final apiKey = _ttsApiKey;
    if (apiKey == null || apiKey.isEmpty) {
      debugPrint("No Gemini API Key found for TTS.");
      onError?.call();
      return;
    }

    try {
      await stop();
      _isPlaying = true;

      if (kIsWeb) {
        try {
          initTtsAudioWeb();
        } catch (_) {}
      } else {
        // Chunked playback: keep the native players alive between chunks.
        try {
          await _audioPlayer.setReleaseMode(ReleaseMode.stop);
          await _audioPlayerB.setReleaseMode(ReleaseMode.stop);
        } catch (_) {}
      }

      final queue = List<String>.from(texts);

      void processNext() async {
        if (!_isPlaying || queue.isEmpty) {
          _isPlaying = false;
          onComplete?.call();
          return;
        }

        final currentText = queue.removeAt(0);

        final url = Uri.parse(
            'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=$apiKey');

        _channel = WebSocketChannel.connect(url);

        final setupMessage = {
          "setup": {
            "model": "models/gemini-3.1-flash-live-preview",
            "generationConfig": {
              "responseModalities": ["AUDIO"],
              "speechConfig": {
                "voiceConfig": {
                  "prebuiltVoiceConfig": {"voiceName": voiceName ?? "Leda"}
                }
              }
            },
            "systemInstruction": {
              "parts": [
                {
                  "text": systemInstruction ??
                      "Read the exact text provided aloud immediately."
                }
              ]
            }
          }
        };

        _channel!.sink.add(jsonEncode(setupMessage));

        final pcmBuffer = BytesBuilder();
        final wavQueue = Queue<Uint8List>();
        final Completer<void> turnCompleter = Completer<void>();
        // ~0.29s of 24kHz mono 16-bit PCM — flush granularity for native.
        const int flushThreshold = 14000;
        bool turnCompleted = false;
        bool chainRunning = false;

        void maybeCompleteTurn() {
          if (turnCompleted && wavQueue.isEmpty && !chainRunning) {
            if (!turnCompleter.isCompleted) turnCompleter.complete();
          }
        }

        // Plays queued WAV chunks with two alternating players so the next
        // chunk is preloaded (setSourceBytes) while the current one is still
        // audible — no gap between chunks. Completion is detected by polling
        // player state (immune to stale broadcast completion events).
        Future<void> playChunkChain() async {
          if (chainRunning) return;
          chainRunning = true;
          try {
            if (kIsWeb) return; // Web streams straight to AudioContext (JS).
            final players = [_audioPlayer, _audioPlayerB];
            int cur = 0;
            bool playing = false;
            bool standbyLoaded = false;

            while (_isPlaying &&
                (wavQueue.isNotEmpty || !turnCompleted || playing || standbyLoaded)) {
              if (!playing) {
                // Nothing audible right now: bring up the next chunk.
                if (wavQueue.isEmpty) {
                  await Future.delayed(const Duration(milliseconds: 20));
                  continue;
                }
                final wav = wavQueue.removeFirst();
                try {
                  await players[cur].setSourceBytes(wav, mimeType: 'audio/wav');
                  await players[cur].resume();
                  playing = true;
                } catch (e) {
                  debugPrint('TTS chunk start error: $e');
                  await Future.delayed(const Duration(milliseconds: 30));
                }
                continue;
              }

              // Audible: preload the next chunk on the standby player, then
              // wait for the current chunk to finish.
              if (wavQueue.isNotEmpty) {
                final standby = 1 - cur;
                final wav = wavQueue.removeFirst();
                try {
                  await players[standby].setSourceBytes(wav, mimeType: 'audio/wav');
                  standbyLoaded = true;
                } catch (e) {
                  debugPrint('TTS chunk preload error: $e');
                  standbyLoaded = false;
                }
              }
              final deadline = DateTime.now().add(const Duration(seconds: 10));
              // Wait until it is actually playing (very short chunks may
              // already be done by the time the first poll runs).
              while (_isPlaying &&
                  DateTime.now().isBefore(deadline) &&
                  players[cur].state != PlayerState.playing &&
                  players[cur].state != PlayerState.completed) {
                await Future.delayed(const Duration(milliseconds: 20));
              }
              // Then wait for natural completion (or stop).
              while (_isPlaying &&
                  DateTime.now().isBefore(deadline) &&
                  players[cur].state != PlayerState.completed &&
                  players[cur].state != PlayerState.stopped) {
                await Future.delayed(const Duration(milliseconds: 20));
              }
              if (!_isPlaying) break;
              playing = false;

              // Switch to the standby player; it starts instantly because its
              // source was already set (gapless handoff).
              if (standbyLoaded) {
                final next = 1 - cur;
                try {
                  await players[next].resume();
                  playing = true;
                } catch (e) {
                  debugPrint('TTS chunk switch error: $e');
                  playing = false;
                }
                standbyLoaded = false;
                cur = next;
              }
              // else: stay on `cur`; the loop top loads the next chunk onto it.
            }
          } finally {
            chainRunning = false;
            maybeCompleteTurn();
          }
        }

        void flushPcm({bool force = false}) {
          if (kIsWeb) return;
          final bytes = pcmBuffer.toBytes();
          if (bytes.isEmpty) return;
          if (!force && bytes.length < flushThreshold) return;
          wavQueue.add(_pcmToWav(bytes, 24000));
          pcmBuffer.clear();
          // ignore: unawaited_futures
          playChunkChain();
        }

        _channel!.stream.listen(
          (data) async {
            try {
              final Map<String, dynamic> msg = jsonDecode(data is String ? data : String.fromCharCodes(data));
              if (msg.containsKey('setupComplete')) {
                final textPrompt = {
                  "realtimeInput": {
                    "text": "Read the following text aloud exactly as written: \"$currentText\""
                  }
                };
                _channel?.sink.add(jsonEncode(textPrompt));
              } else if (msg.containsKey('serverContent')) {
                final serverContent = msg['serverContent'];
                if (serverContent.containsKey('modelTurn')) {
                  final parts = serverContent['modelTurn']['parts'] as List?;
                  if (parts != null) {
                    for (var part in parts) {
                      if (part is Map && part.containsKey('inlineData')) {
                        final inline = part['inlineData'];
                        final base64Data = inline['data'] as String;

                        if (kIsWeb) {
                          // INSTANT ZERO-LATENCY STREAMING ON WEB! (<50ms)
                          try {
                            playPcmChunkWeb(base64Data);
                          } catch (e) {
                            debugPrint("JS playPcmChunk error: $e");
                          }
                        } else {
                          // Native: stream the PCM to the player in small
                          // chunks so audio starts before the turn ends.
                          final chunkBytes = base64Decode(base64Data);
                          pcmBuffer.add(chunkBytes);
                          if (pcmBuffer.length >= flushThreshold) {
                            flushPcm();
                          }
                        }
                      }
                    }
                  }
                }
                if (serverContent['turnComplete'] == true) {
                  if (kIsWeb) {
                    await _channel?.sink.close();
                    _channel = null;
                    if (!turnCompleter.isCompleted) {
                      turnCompleter.complete();
                    }
                  } else {
                    turnCompleted = true;
                    flushPcm(force: true);
                    maybeCompleteTurn();
                    await turnCompleter.future;
                    await _channel?.sink.close();
                    _channel = null;
                  }
                }
              }
            } catch (e) {
              debugPrint("TTS stream parse error: $e");
            }
          },
          onError: (err) {
            debugPrint("TTS WebSocket error: $err");
            _isPlaying = false;
            if (!turnCompleter.isCompleted) turnCompleter.complete();
            onError?.call();
          },
          onDone: () {
            // A normal turn closes the channel after turnComplete; only treat
            // an early close as an error. Always release the turn awaiter so
            // stop() mid-turn doesn't leak a pending speakList future.
            if (_isPlaying && !turnCompleted) {
              debugPrint("TTS WebSocket closed before turnComplete");
              _isPlaying = false;
              onError?.call();
            }
            if (!turnCompleter.isCompleted) {
              turnCompleter.complete();
            }
          },
        );

        await turnCompleter.future;

        // Brief 250ms pause between sequential phrases
        await Future.delayed(const Duration(milliseconds: 250));
        processNext();
      }

      processNext();
    } catch (e) {
      debugPrint("TTS connection exception: $e");
      _isPlaying = false;
      onError?.call();
    }
  }

  // Convert raw 24kHz 16-bit mono PCM bytes to valid WAV buffer (Native fallback)
  static Uint8List _pcmToWav(Uint8List pcmBytes, int sampleRate) {
    final byteLength = pcmBytes.length;
    final wav = Uint8List(44 + byteLength);
    final bd = ByteData.sublistView(wav);

    wav.setRange(0, 4, ascii.encode('RIFF'));
    bd.setUint32(4, 36 + byteLength, Endian.little);
    wav.setRange(8, 12, ascii.encode('WAVE'));

    wav.setRange(12, 16, ascii.encode('fmt '));
    bd.setUint32(16, 16, Endian.little);
    bd.setUint16(20, 1, Endian.little);
    bd.setUint16(22, 1, Endian.little);
    bd.setUint32(24, sampleRate, Endian.little);
    bd.setUint32(28, sampleRate * 2, Endian.little);
    bd.setUint16(32, 2, Endian.little);
    bd.setUint16(34, 16, Endian.little);

    wav.setRange(36, 40, ascii.encode('data'));
    bd.setUint32(40, byteLength, Endian.little);

    wav.setRange(44, 44 + byteLength, pcmBytes);
    return wav;
  }

  static Future<void> stop() async {
    _isPlaying = false;
    if (kIsWeb) {
      try {
        stopTtsAudioWeb();
      } catch (_) {}
    }
    try {
      await _channel?.sink.close();
    } catch (_) {}
    _channel = null;
    try {
      await _audioPlayer.stop();
      await _audioPlayerB.stop();
    } catch (_) {}
  }
}
