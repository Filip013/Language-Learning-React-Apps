// src/hooks/useGeminiTTS.js
import { useRef, useCallback } from 'react';

export function useGeminiTTS(systemInstruction) {
    const ws = useRef(null);
    const audioContext = useRef(null);
    const nextAudioTime = useRef(0);
    const activeAudioNodes = useRef([]);
    const currentOnComplete = useRef(null);
    const currentOnError = useRef(null);

    const playPCMChunk = useCallback((base64Data) => {
        if (!audioContext.current) return;
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const int16Array = new Int16Array(bytes.buffer);
        const audioBuffer = audioContext.current.createBuffer(1, int16Array.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < int16Array.length; i++) channelData[i] = int16Array[i] / 32768.0;
        
        const source = audioContext.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.current.destination);
        
        const currentTime = audioContext.current.currentTime;
        if (nextAudioTime.current < currentTime) nextAudioTime.current = currentTime + 0.05;
        
        source.start(nextAudioTime.current);
        nextAudioTime.current += audioBuffer.duration;
        
        activeAudioNodes.current.push(source);
        source.onended = () => {
            activeAudioNodes.current = activeAudioNodes.current.filter(n => n !== source);
        };
    }, []);

    const stopSpeak = useCallback(() => {
        if (ws.current) { ws.current.close(); ws.current = null; }
        
        activeAudioNodes.current.forEach(n => {
            try { n.stop(); } catch(e) {}
            n.onended = null;
        });
        activeAudioNodes.current = [];
        
        if (audioContext.current) nextAudioTime.current = audioContext.current.currentTime; 
        if (currentOnComplete.current) currentOnComplete.current();
        currentOnComplete.current = null;
        currentOnError.current = null;
    }, []);

    const handleSpeak = useCallback((text, onComplete = null, onError = null) => {
        if (!text || !text.trim()) return;
        const myKey = localStorage.getItem('geminiApiKey');
        if (!myKey) {
            alert("API key not found. Please set your Free Gemini API Key in the Hub settings.");
            if (onError) onError();
            return;
        }

        if (!audioContext.current) audioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        if (audioContext.current.state === 'suspended') audioContext.current.resume();
        
        stopSpeak();

        nextAudioTime.current = audioContext.current.currentTime;
        currentOnComplete.current = onComplete;
        currentOnError.current = onError;

        const sendAudioRequest = () => {
            ws.current.send(JSON.stringify({ realtimeInput: { text: text } }));
        };

        const setupMessageHandlers = () => {
            ws.current.onmessage = async (event) => {
                let rawData = event.data;
                if (rawData instanceof Blob) rawData = await rawData.text();
                const msg = JSON.parse(rawData);
                
                if (msg.serverContent) {
                    if (msg.serverContent.modelTurn) {
                        for (const part of msg.serverContent.modelTurn.parts) {
                            if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                                playPCMChunk(part.inlineData.data);
                            }
                        }
                    }
                    if (msg.serverContent.turnComplete) {
                        const checkCompletion = setInterval(() => {
                            if (activeAudioNodes.current.length === 0) {
                                clearInterval(checkCompletion);
                                if (currentOnComplete.current) {
                                    currentOnComplete.current();
                                    currentOnComplete.current = null;
                                }
                            }
                        }, 100);
                    }
                }
            };
            ws.current.onerror = (e) => {
                console.error("TTS WebSocket Error:", e);
                if (currentOnError.current) currentOnError.current();
                alert("Audio connection failed.");
            };
        };

        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            ws.current = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${myKey.trim()}`);
            ws.current.onopen = () => {
                const setupMessage = {
                    setup: {
                        model: "models/gemini-3.1-flash-live-preview",
                        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Leda" } } } },
                        systemInstruction: { parts: [{ text: systemInstruction }] }
                    }
                };
                ws.current.send(JSON.stringify(setupMessage));
                setTimeout(sendAudioRequest, 500);
            };
            setupMessageHandlers();
        } else {
            setupMessageHandlers();
            sendAudioRequest();
        }
    }, [playPCMChunk, stopSpeak, systemInstruction]);

    return { handleSpeak, stopSpeak };
}