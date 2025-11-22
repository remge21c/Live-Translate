import { useState, useEffect, useRef, useCallback } from 'react';

export interface SpeechRecognitionResult {
    transcript: string;
    isFinal: boolean;
    language: string; // 'ko-KR' or 'en-US'
}

export const useSpeechRecognition = (isListening: boolean, language: string) => {
    const [transcript, setTranscript] = useState<string>('');
    const recognitionRef = useRef<any>(null);
    const isListeningRef = useRef<boolean>(isListening);
    const previousLanguageRef = useRef<string>(language);

    // Keep isListening in sync with ref
    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    // Initialize recognition once
    useEffect(() => {
        if (!('webkitSpeechRecognition' in window)) {
            console.error('Web Speech API is not supported in this browser.');
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = language;

        recognitionRef.current.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript || interimTranscript) {
                setTranscript(finalTranscript || interimTranscript);
            }
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error('[SpeechRecognition] Error:', event.error);
            // Don't restart on no-speech or aborted errors
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return;
            }
        };

        // Auto-restart when recognition ends
        recognitionRef.current.onend = () => {
            console.log('[SpeechRecognition] Recognition ended, checking if should restart...');
            if (isListeningRef.current && recognitionRef.current) {
                console.log('[SpeechRecognition] Restarting recognition...');
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.error('[SpeechRecognition] Failed to restart:', e);
                }
            }
        };

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.onend = null; // Remove handler first
                recognitionRef.current.stop();
            }
        };
    }, []); // Only initialize once

    // Update language ONLY when it actually changes
    useEffect(() => {
        if (recognitionRef.current && language !== previousLanguageRef.current) {
            console.log('[SpeechRecognition] Language changed from', previousLanguageRef.current, 'to', language);

            const wasListening = isListening;

            // Stop if currently listening
            if (wasListening) {
                recognitionRef.current.stop();
            }

            // Update language
            recognitionRef.current.lang = language;
            previousLanguageRef.current = language;

            // Restart if was listening
            if (wasListening) {
                setTimeout(() => {
                    if (recognitionRef.current && isListeningRef.current) {
                        try {
                            recognitionRef.current.start();
                            console.log('[SpeechRecognition] Restarted with new language:', language);
                        } catch (e) {
                            console.error('[SpeechRecognition] Failed to restart after language change:', e);
                        }
                    }
                }, 100);
            }
        }
    }, [language, isListening]);

    useEffect(() => {
        if (isListening && recognitionRef.current) {
            try {
                recognitionRef.current.start();
                console.log('[SpeechRecognition] Started');
            } catch (e) {
                console.log('[SpeechRecognition] Already started');
            }
        } else if (!isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            console.log('[SpeechRecognition] Stopped');
        }
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        console.log('[SpeechRecognition] Resetting transcript...');
        setTranscript('');
        // Don't stop and restart, just clear the transcript
        // The continuous recognition will keep running
    }, []);

    return { transcript, resetTranscript };
};
