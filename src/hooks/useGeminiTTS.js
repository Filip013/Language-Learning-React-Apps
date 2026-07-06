// src/hooks/useGeminiTTS.js
import { useRef, useCallback } from 'react';

export function useGeminiTTS(systemInstruction) {
    const ws = useRef(null);
    const audioContext = useRef(null);
    const nextAudioTime = useRef(0);
    const activeAudioNodes = useRef([]);
    const textQueue = useRef([]); // Queue for sequential TTS requests
    const currentOnComplete = useRef(null);
    const currentOnError = useRef(null);
    
    // NEW: Ref to hold our silent HTML5 audio player
    const silentAudioRef = useRef(null);

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
        textQueue.current = []; // Clear the sequence queue
        
        // NEW: Pause the background silent audio
        if (silentAudioRef.current) {
            silentAudioRef.current.pause();
        }

        if (audioContext.current) nextAudioTime.current = audioContext.current.currentTime; 
        if (currentOnComplete.current) currentOnComplete.current();
        currentOnComplete.current = null;
        currentOnError.current = null;
    }, []);

    const handleSpeak = useCallback((input, onComplete = null, onError = null) => {
        const texts = Array.isArray(input) ? [...input] : [input];
        if (texts.length === 0 || !texts[0].trim()) return;

        const myKey = localStorage.getItem('geminiApiKey');
        if (!myKey) {
            alert("API key not found. Please set your Free Gemini API Key in the Hub settings.");
            if (onError) onError();
            return;
        }

        if (!audioContext.current) audioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        if (audioContext.current.state === 'suspended') audioContext.current.resume();
        
        stopSpeak();

        // NEW: Initialize and play the silent audio element to keep mobile JS alive
        if (!silentAudioRef.current) {
            // This is a tiny, valid silent MP3 file encoded in base64
            silentAudioRef.current = new Audio('data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
            silentAudioRef.current.loop = true;
        }
        
        // Browsers require user interaction to play audio. 
        // Because handleSpeak is triggered by clicking a play button, this is allowed.
        silentAudioRef.current.play().catch(e => console.warn("Background audio hack failed:", e));

        // NEW: Tell the OS that media is playing so it shows on the lock screen
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Reading Text...',
                artist: 'AI Tutor',
            });
            navigator.mediaSession.setActionHandler('pause', () => stopSpeak());
        }

        nextAudioTime.current = audioContext.current.currentTime;
        currentOnComplete.current = onComplete;
        currentOnError.current = onError;
        
        textQueue.current = texts;

        const sendNextText = () => {
            while (textQueue.current.length > 0) {
                const nextText = textQueue.current.shift();
                if (nextText && nextText.trim()) {
                    console.log("📤 Sending text to Gemini:", nextText);
                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        ws.current.send(JSON.stringify({
                            clientContent: {
                                turns: [{ role: "user", parts: [{ text: nextText }] }],
                                turnComplete: true
                            }
                        }));
                    }
                    return true;
                }
            }
            return false;
        };

        const setupMessageHandlers = () => {
            ws.current.onclose = (event) => {
                console.log(`🔴 Gemini TTS WebSocket Closed. Code: ${event.code}, Reason: ${event.reason || 'None'}`);
            };

            ws.current.onmessage = async (event) => {
                let rawData = event.data;
                if (rawData instanceof Blob) rawData = await rawData.text();
                const msg = JSON.parse(rawData);
                
                if (msg.setupComplete) {
                    console.log("🟢 Gemini TTS Setup Complete");
                    sendNextText(); 
                }

                if (msg.error) console.error("❌ Gemini TTS Error:", msg.error);
                if (msg.serverContent && msg.serverContent.interrupted) console.warn("⚠️ Gemini TTS Interrupted (Likely Safety Filter):", msg);

                if (msg.serverContent) {
                    if (msg.serverContent.modelTurn) {
                        for (const part of msg.serverContent.modelTurn.parts) {
                            if (part.text) console.info("🤖 Gemini Text Output (Should be audio!):", part.text);
                            if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                                playPCMChunk(part.inlineData.data);
                            }
                        }
                    }
                    
                    if (msg.serverContent.turnComplete) {
                        console.log("✅ Gemini TTS Turn Complete");
                        const checkCompletion = setInterval(() => {
                            if (activeAudioNodes.current.length === 0) {
                                clearInterval(checkCompletion);
                                
                                const hasMore = sendNextText();
                                if (!hasMore) {
                                    // NEW: Pause the silent background audio when all TTS is finished
                                    if (silentAudioRef.current) silentAudioRef.current.pause();

                                    if (currentOnComplete.current) {
                                        currentOnComplete.current();
                                        currentOnComplete.current = null;
                                    }
                                }
                            }
                        }, 100);
                    }
                }
            };

            ws.current.onerror = (e) => {
                console.error("💥 TTS WebSocket Error:", e);
                if (currentOnError.current) currentOnError.current();
                alert("Audio connection failed. Check console for details.");
            };
        };

        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            ws.current = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${myKey.trim()}`);
            ws.current.onopen = () => {
                const setupMessage = {
                    setup: {
                        model: "models/gemini-3.1-flash-live-preview",
                        generationConfig: { 
                            responseModalities: ["AUDIO"], 
                            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Leda" } } } 
                        },
                        systemInstruction: { parts: [{ text: systemInstruction }] }
                    }
                };
                ws.current.send(JSON.stringify(setupMessage));
            };
            setupMessageHandlers();
        } else {
            setupMessageHandlers();
            sendNextText();
        }
    }, [playPCMChunk, stopSpeak, systemInstruction]);

    return { handleSpeak, stopSpeak };
}