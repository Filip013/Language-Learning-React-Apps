// src/hooks/useGeminiTTS.js
import { useRef, useCallback } from 'react';

const MAX_RETRIES = 2; // Initial try + 2 retries = 3 attempts total

export function useGeminiTTS(systemInstruction) {
    const ws = useRef(null);
    const audioContext = useRef(null);
    const nextAudioTime = useRef(0);
    const activeAudioNodes = useRef([]);
    const textQueue = useRef([]); // Queue for sequential TTS requests
    const currentTurnData = useRef(null); // Tracks the current text and its retry count
    const audioReceivedForCurrentTurn = useRef(false); // Flags if audio was successfully received
    const currentOnComplete = useRef(null);
    const currentOnError = useRef(null);
    
    // Ref to hold our silent HTML5 audio player
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
        textQueue.current = []; 
        currentTurnData.current = null;
        audioReceivedForCurrentTurn.current = false;
        
        // Pause the background silent audio
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

        // Initialize and play the silent audio element to keep mobile JS alive
        if (!silentAudioRef.current) {
            silentAudioRef.current = new Audio('data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
            silentAudioRef.current.loop = true;
        }
        
        silentAudioRef.current.play().catch(e => {
            // console.warn("Background audio hack failed:", e);
        });

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
        
        // Map strings into objects to track retry attempts
        textQueue.current = texts.map(t => ({ text: t, retries: 0 }));

        const sendNextText = () => {
            while (textQueue.current.length > 0) {
                const nextItem = textQueue.current.shift();
                
                if (nextItem && nextItem.text.trim()) {
                    currentTurnData.current = nextItem;
                    audioReceivedForCurrentTurn.current = false; // Reset flag for this turn

                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        ws.current.send(JSON.stringify({
                            clientContent: {
                                turns: [{ 
                                    role: "user", 
                                    parts: [{ 
                                        // Wrap the text in a direct command
                                        text: `Read the following text aloud exactly as written: "${nextItem.text}"` 
                                    }] 
                                }],
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
            ws.current.onclose = (event) => {};

            ws.current.onmessage = async (event) => {
                let rawData = event.data;
                if (rawData instanceof Blob) rawData = await rawData.text();
                const msg = JSON.parse(rawData);
                
                if (msg.setupComplete) {
                    sendNextText(); 
                }

                if (msg.serverContent) {
                    if (msg.serverContent.modelTurn) {
                        for (const part of msg.serverContent.modelTurn.parts) {
                            if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                                audioReceivedForCurrentTurn.current = true; // Mark that we got audio
                                playPCMChunk(part.inlineData.data);
                            }
                        }
                    }
                    
                    if (msg.serverContent.turnComplete) {
                        // REPLAY/RETRY LOGIC: If the turn completed but the model gave us no audio
                        if (!audioReceivedForCurrentTurn.current && currentTurnData.current) {
                            if (currentTurnData.current.retries < MAX_RETRIES) {
                                console.warn(`TTS empty response detected. Retrying... (${currentTurnData.current.retries + 1}/${MAX_RETRIES})`);
                                
                                // Put it back at the front of the queue with an incremented retry counter
                                textQueue.current.unshift({
                                    text: currentTurnData.current.text,
                                    retries: currentTurnData.current.retries + 1
                                });
                                
                                sendNextText(); // Fire it off immediately
                                return; // Skip the completion check block below for this failed turn
                            } else {
                                console.warn("Max TTS retries reached. Skipping to next text segment.");
                                // Fall through to allow the interval below to move to the next item
                            }
                        }

                        // Normal completion check
                        const checkCompletion = setInterval(() => {
                            if (activeAudioNodes.current.length === 0) {
                                clearInterval(checkCompletion);
                                
                                const hasMore = sendNextText();
                                if (!hasMore) {
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
