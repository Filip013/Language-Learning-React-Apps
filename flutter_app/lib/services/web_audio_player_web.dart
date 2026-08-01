// lib/services/web_audio_player_web.dart
import 'dart:js_interop';
import 'dart:typed_data';
import 'package:web/web.dart' as web;

class WebAudioChunkPlayer {
  web.AudioContext? _ctx;
  double _nextAudioTime = 0.0;

  void init() {
    _ctx ??= web.AudioContext(web.AudioContextOptions(sampleRate: 24000));
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
