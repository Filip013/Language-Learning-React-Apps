// src/hooks/useGeminiTTS.js
import { useRef, useCallback } from 'react';

const MAX_RETRIES = 4; // Initial try + 2 retries = 3 attempts total

export function useGeminiTTS(systemInstruction) {
    const ws = useRef(null);
    const audioContext = useRef(null);
    const nextAudioTime = useRef(0);
    const activeAudioNodes = useRef([]);
    const textQueue = useRef([]); // Queue for sequential TTS requests
    const currentTurnData = useRef(null); // Tracks the current text and its retry count
    const audioReceivedForCurrentTurn = useRef(false); // Flags if audio was successfully received
    const currentTurnTranscript = useRef(''); // Accumulates outputTranscription for verification
    const currentTurnInterrupted = useRef(false); // Tracks server-side interruption
    const currentTurnAudioDuration = useRef(0); // Tracks total seconds of audio received for current turn
    const completionIntervalRef = useRef(null); // Ref for audio completion polling
    const currentOnComplete = useRef(null);
    const currentOnError = useRef(null);
    
    // Ref to hold our silent HTML5 audio player
    const silentAudioRef = useRef(null);

    const playPCMChunk = useCallback((base64Data) => {
        if (!audioContext.current) return;
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const sampleCount = Math.floor(bytes.length / 2);
        const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, sampleCount);
        const audioBuffer = audioContext.current.createBuffer(1, int16Array.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < int16Array.length; i++) channelData[i] = int16Array[i] / 32768.0;
        
        currentTurnAudioDuration.current += audioBuffer.duration;

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
        if (completionIntervalRef.current) {
            clearInterval(completionIntervalRef.current);
            completionIntervalRef.current = null;
        }

        if (ws.current) { ws.current.close(); ws.current = null; }
        
        activeAudioNodes.current.forEach(n => {
            n.onended = null;
            try { n.stop(); } catch(e) {}
        });
        activeAudioNodes.current = [];
        textQueue.current = []; 
        currentTurnData.current = null;
        audioReceivedForCurrentTurn.current = false;
        currentTurnTranscript.current = '';
        currentTurnInterrupted.current = false;
        currentTurnAudioDuration.current = 0;
        
        // Pause the background silent audio
        if (silentAudioRef.current) {
            silentAudioRef.current.pause();
        }

        if (audioContext.current) nextAudioTime.current = audioContext.current.currentTime; 
        currentOnComplete.current = null;
        currentOnError.current = null;
    }, []);

    const handleSpeak = useCallback((input, onComplete = null, onError = null, options = null) => {
        const texts = Array.isArray(input) ? [...input] : [input];
        if (texts.length === 0 || !texts[0].trim()) return;

        // Support flexible arguments: handleSpeak(text, { language: '...' })
        let actualOnComplete = onComplete;
        let actualOnError = onError;
        let actualOptions = options;
        if (typeof onComplete === 'object' && onComplete !== null && !options) {
            actualOptions = onComplete;
            actualOnComplete = null;
        }

        const myKey = localStorage.getItem('geminiApiKey') || localStorage.getItem('geminiPaidApiKey');
        if (!myKey) {
            alert("API key not found. Please set your Gemini API Key in the Hub settings.");
            if (actualOnError) actualOnError();
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
        currentOnComplete.current = actualOnComplete;
        currentOnError.current = actualOnError;
        
        // Map strings into objects to track retry attempts and language context
        textQueue.current = texts.map(t => ({ 
            text: t, 
            retries: 0,
            language: actualOptions?.language || null 
        }));

        const sendNextText = () => {
            while (textQueue.current.length > 0) {
                const nextItem = textQueue.current.shift();
                
                if (nextItem && nextItem.text.trim()) {
                    currentTurnData.current = nextItem;
                    audioReceivedForCurrentTurn.current = false; // Reset flag for this turn
                    currentTurnTranscript.current = ''; // Reset accumulated transcript
                    currentTurnInterrupted.current = false; // Reset interrupted flag
                    currentTurnAudioDuration.current = 0; // Reset audio duration accumulator for this turn

                    const promptText = nextItem.language 
                        ? `Read the following ${nextItem.language} text aloud exactly as written: "${nextItem.text}"`
                        : `Read the following text aloud exactly as written: "${nextItem.text}"`;

                    const clientMsg = JSON.stringify({
                        clientContent: {
                            turns: [{
                                role: "user",
                                parts: [{
                                    text: promptText
                                }]
                            }],
                            turnComplete: true
                        }
                    });

                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        ws.current.send(clientMsg);
                    } else {
                        // If WebSocket is not open, put the item back and trigger connection
                        textQueue.current.unshift(nextItem);
                        currentTurnData.current = null;
                        connectWebSocket();
                    }
                    return true;
                }
            }
            return false;
        };

        const setupMessageHandlers = () => {
            ws.current.onclose = (event) => {
                if (event.code !== 1000 && event.code !== 1005) {
                    console.warn(`Gemini TTS WebSocket Closed. Code: ${event.code}, Reason: ${event.reason || 'None'}`);
                }
            };

            ws.current.onmessage = async (event) => {
                let rawData = event.data;
                if (rawData instanceof Blob) rawData = await rawData.text();
                const msg = JSON.parse(rawData);
                
                if (msg.setupComplete) {
                    sendNextText(); 
                }

                if (msg.serverContent) {
                    if (msg.serverContent.interrupted) {
                        currentTurnInterrupted.current = true;
                    }

                    if (msg.serverContent.outputTranscription && msg.serverContent.outputTranscription.text) {
                        currentTurnTranscript.current += msg.serverContent.outputTranscription.text;
                    }

                    if (msg.serverContent.modelTurn) {
                        for (const part of msg.serverContent.modelTurn.parts) {
                            if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                                audioReceivedForCurrentTurn.current = true; // Mark that we got audio
                                playPCMChunk(part.inlineData.data);
                            }
                        }
                    }
                    
                    if (msg.serverContent.turnComplete) {
                        // CLIENT-SIDE VERIFICATION:
                        // Verify that the speech was not truncated or interrupted before accepting completion
                        const targetText = currentTurnData.current?.text || "";
                        const spokenText = currentTurnTranscript.current || "";
                        const duration = currentTurnAudioDuration.current;
                        
                        const cleanedText = targetText.trim();
                        const charCount = cleanedText.length;
                        const words = cleanedText.split(/\s+/).filter(Boolean);
                        const wordCount = words.length;

                        // Check if text is CJK (Japanese, Chinese, Korean)
                        const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(cleanedText);

                        // Calculate minimum physical duration:
                        // Fastest plausible speech: CJK ~7 chars/sec; Non-CJK ~24 chars/sec or ~4.5 words/sec.
                        let minExpectedDuration = 0;
                        if (charCount >= 8 || wordCount >= 2) {
                            if (isCJK) {
                                minExpectedDuration = (charCount / 7.0) * 0.65;
                            } else {
                                minExpectedDuration = Math.min(charCount / 24.0, wordCount / 4.5) * 0.65;
                            }
                        } else {
                            minExpectedDuration = 0.2; // Very short phrases just need audible audio
                        }

                        const isDurationShort = duration < minExpectedDuration;

                        // Secondary check if transcript was received
                        const normalize = (s) => (s || "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
                        const normTarget = normalize(targetText);
                        const normSpoken = normalize(spokenText);
                        const isTranscriptShort = (normSpoken.length > 0 && normTarget.length > 0)
                            ? (normSpoken.length / normTarget.length < 0.65)
                            : false;

                        const isInterrupted = currentTurnInterrupted.current;
                        const isEmpty = !audioReceivedForCurrentTurn.current || duration < 0.15;
                        const isTruncated = isDurationShort || isTranscriptShort;

                        const needsRetry = isEmpty || isInterrupted || isTruncated;

                        console.log(
                            `[Gemini TTS Turn] Duration: ${duration.toFixed(2)}s (min: ${minExpectedDuration.toFixed(2)}s) | ` +
                            `Transcript: "${spokenText}" | needsRetry: ${needsRetry}`
                        );

                        // REPLAY/RETRY LOGIC: If the turn was empty, interrupted, or truncated early
                        if (needsRetry && currentTurnData.current) {
                            if (currentTurnData.current.retries < MAX_RETRIES) {
                                const reason = isEmpty 
                                    ? "empty response" 
                                    : (isInterrupted 
                                        ? "interrupted by server" 
                                        : (isDurationShort 
                                            ? `speech cut off early (${duration.toFixed(2)}s, expected >= ${minExpectedDuration.toFixed(2)}s)`
                                            : `incomplete transcript (${normSpoken.length}/${normTarget.length} chars)`));
                                console.warn(`[Gemini TTS] ${reason} detected. Retrying... (${currentTurnData.current.retries + 1}/${MAX_RETRIES})`);
                                
                                // Stop any partial audio from the incomplete turn immediately
                                activeAudioNodes.current.forEach(n => {
                                    n.onended = null;
                                    try { n.stop(); } catch(e) {}
                                });
                                activeAudioNodes.current = [];
                                if (audioContext.current) nextAudioTime.current = audioContext.current.currentTime + 0.05;

                                // Put it back at the front of the queue with an incremented retry counter
                                textQueue.current.unshift({
                                    text: currentTurnData.current.text,
                                    retries: currentTurnData.current.retries + 1,
                                    language: currentTurnData.current.language
                                });
                                
                                // Small pause to allow WebSocket pipeline to settle before retry
                                setTimeout(() => {
                                    sendNextText();
                                }, 50);
                                return; // Skip completion check block below for this failed turn
                            } else {
                                console.warn("[Gemini TTS] Max retries reached. Aborting playback.");
                                
                                const errorCb = currentOnError.current;
                                currentOnComplete.current = null; 
                                currentOnError.current = null;
                                
                                stopSpeak();
                                
                                if (errorCb) errorCb();
                                return;
                            }
                        }

                        // Normal completion check
                        if (completionIntervalRef.current) {
                            clearInterval(completionIntervalRef.current);
                            completionIntervalRef.current = null;
                        }

                        completionIntervalRef.current = setInterval(() => {
                            if (activeAudioNodes.current.length === 0) {
                                clearInterval(completionIntervalRef.current);
                                completionIntervalRef.current = null;
                                
                                const hasMore = sendNextText();
                                if (!hasMore) {
                                    if (silentAudioRef.current) silentAudioRef.current.pause();

                                    if (currentOnComplete.current) {
                                        const cb = currentOnComplete.current;
                                        currentOnComplete.current = null;
                                        cb();
                                    }
                                    currentOnError.current = null;
                                }
                            }
                        }, 100);
                    }
                }
            };

            ws.current.onerror = (e) => {
                console.warn("Audio connection failed.", e);
                if (currentOnError.current) currentOnError.current();
            };
        };

        const connectWebSocket = () => {
            ws.current = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${myKey.trim()}`);
            ws.current.onopen = () => {
                const setupMessage = {
                    setup: {
                        model: "models/gemini-3.8-live",
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
        };

        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            connectWebSocket();
        } else {
            setupMessageHandlers();
            sendNextText();
        }
    }, [playPCMChunk, stopSpeak, systemInstruction]);

    return { handleSpeak, stopSpeak };
}