
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Icon } from './shared/Icon';
import { Spinner } from './shared/Spinner';
import { encode, decode, decodeAudioData, createBlob } from '../utils/audio';

// Define a type for the transcript entry
type TranscriptEntry = {
    speaker: 'user' | 'model';
    text: string;
};

export const VoiceConversation: React.FC = () => {
    const [isConversing, setIsConversing] = useState<boolean>(false);
    const [isConnecting, setIsConnecting] = useState<boolean>(false);
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

    const stopConversation = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => {
                session.close();
            }).catch(console.error);
            sessionPromiseRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if(inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(console.error);
        }
        if(outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(console.error);
        }
        
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;

        setIsConversing(false);
        setIsConnecting(false);
    }, []);


    const startConversation = useCallback(async () => {
        setIsConnecting(true);
        setError(null);
        setTranscript([]);
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';

        try {
            if (!process.env.API_KEY) {
                throw new Error("API_KEY environment variable not set.");
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false);
                        setIsConversing(true);

                        const source = inputAudioContextRef.current!.createMediaStreamSource(streamRef.current!);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            nextStartTimeRef.current = Math.max(
                                nextStartTimeRef.current,
                                outputAudioContextRef.current.currentTime,
                            );
                            const audioBuffer = await decodeAudioData(
                                decode(base64Audio),
                                outputAudioContextRef.current,
                                24000, 1
                            );
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        
                        if (message.serverContent?.interrupted) {
                            for (const source of audioSourcesRef.current.values()) {
                              source.stop();
                              audioSourcesRef.current.delete(source);
                            }
                            nextStartTimeRef.current = 0;
                        }

                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscriptionRef.current.trim();
                            const fullOutput = currentOutputTranscriptionRef.current.trim();
                            
                            setTranscript(prev => {
                                const newTranscript = [...prev];
                                if (fullInput) newTranscript.push({ speaker: 'user', text: fullInput });
                                if (fullOutput) newTranscript.push({ speaker: 'model', text: fullOutput });
                                return newTranscript;
                            });

                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        const message = e.message || 'An unknown error occurred during the session.';
                        setError(`Conversation error: ${message} Please try again.`);
                        stopConversation();
                    },
                    onclose: () => {
                        console.log('Session closed.');
                        stopConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: 'You are a helpful and friendly AI assistant. Be concise and clear in your responses.',
                },
            });

        } catch (err) {
            console.error('Failed to start conversation:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to start conversation: ${errorMessage}`);
            setIsConnecting(false);
            stopConversation();
        }
    }, [stopConversation]);

    return (
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 transition-all duration-300">
            <div className="flex flex-col items-center text-center">
                <h2 className="text-2xl font-bold text-cyan-400 mb-2">Live Conversation</h2>
                <p className="text-gray-400 mb-6">Talk to Gemini in real-time. Start the conversation below.</p>

                <div className="mb-6">
                    {!isConversing && !isConnecting && (
                        <button
                            onClick={startConversation}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full flex items-center justify-center transition-transform transform hover:scale-105"
                        >
                            <Icon name="mic" className="w-6 h-6 mr-2" />
                            Start Conversation
                        </button>
                    )}
                    {isConnecting && (
                        <div className="flex flex-col items-center text-yellow-400">
                            <Spinner />
                            <span className="mt-2">Connecting...</span>
                        </div>
                    )}
                    {isConversing && (
                        <button
                            onClick={stopConversation}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full flex items-center justify-center transition-transform transform hover:scale-105 animate-pulse"
                        >
                            <Icon name="stop" className="w-6 h-6 mr-2" />
                            Stop Conversation
                        </button>
                    )}
                </div>

                {error && <p className="text-red-400 mb-4">{error}</p>}
                
                <div className="w-full h-80 bg-gray-900 rounded-lg p-4 overflow-y-auto flex flex-col space-y-4">
                    {transcript.length === 0 && !isConversing && (
                         <div className="flex-grow flex items-center justify-center text-gray-500">
                            Your conversation will appear here...
                        </div>
                    )}
                    {transcript.map((entry, index) => (
                        <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {entry.speaker === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center"><Icon name="spark" className="w-5 h-5 text-white" /></div>}
                            <div className={`max-w-md p-3 rounded-lg ${entry.speaker === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                                <p>{entry.text}</p>
                            </div>
                            {entry.speaker === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center"><Icon name="user" className="w-5 h-5 text-white" /></div>}
                        </div>
                    ))}
                    {isConversing && transcript.length === 0 && (
                        <div className="flex-grow flex items-center justify-center text-gray-400">
                            <Icon name="mic" className="w-5 h-5 mr-2 animate-pulse" /> Listening...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
