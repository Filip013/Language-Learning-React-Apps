import 'dart:js_interop';

@JS('initTtsAudio')
external void initTtsAudio();

@JS('playPcmChunk')
external void playPcmChunk(JSString base64Data);

@JS('stopTtsAudio')
external void stopTtsAudio();

void initTtsAudioWeb() => initTtsAudio();
void playPcmChunkWeb(String base64Data) => playPcmChunk(base64Data.toJS);
void stopTtsAudioWeb() => stopTtsAudio();
