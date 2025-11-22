import { useState, useEffect, useRef, useCallback } from 'react';

export interface DualSpeechResult {
    transcript: string;
    language: string; // 'ko-KR' or 'en-US'
    isFinal: boolean;
}

export const useDualSpeechRecognition = (isListening: boolean, lang1: string, lang2: string) => {
    const [result, setResult] = useState<DualSpeechResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('idle');

    // We need refs for both recognizers
    const recognition1Ref = useRef<any>(null);
    const recognition2Ref = useRef<any>(null);

    // Track which one is currently "active" or if we are in a race
    const activeRecognizerRef = useRef<string | null>(null);

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window)) {
            setError('Web Speech API not supported');
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition;

        // Setup Recognizer 1
        const r1 = new SpeechRecognition();
        r1.continuous = true;
        r1.interimResults = true;
        r1.lang = lang1;

        r1.onresult = (event: any) => handleResult(event, lang1);
        r1.onstart = () => setStatus(`listening-${lang1}`);
        r1.onerror = (e: any) => {
            console.error(`${lang1} error`, e);
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
                setError(`${lang1}: ${e.error}`);
            }
        };
        r1.onend = () => {
            // Only restart if we are still "listening" globally and not switching to the other lang
            if (isListening && activeRecognizerRef.current !== lang2) {
                try { r1.start(); } catch (e) { }
            }
        };
        recognition1Ref.current = r1;

        // Setup Recognizer 2
        const r2 = new SpeechRecognition();
        r2.continuous = true;
        r2.interimResults = true;
        r2.lang = lang2;

        r2.onresult = (event: any) => handleResult(event, lang2);
        r2.onstart = () => setStatus(`listening-${lang2}`);
        r2.onerror = (e: any) => {
            console.error(`${lang2} error`, e);
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
                setError(`${lang2}: ${e.error}`);
            }
        };
        r2.onend = () => {
            if (isListening && activeRecognizerRef.current !== lang1) {
                try { r2.start(); } catch (e) { }
            }
        };
        recognition2Ref.current = r2;

        return () => {
            r1.stop();
            r2.stop();
        };
    }, [lang1, lang2, isListening]);

    const handleResult = (event: any, lang: string) => {
        // If we get a result from one, we consider that the "active" language
        activeRecognizerRef.current = lang;

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
            setResult({
                transcript: finalTranscript || interimTranscript,
                language: lang,
                isFinal: !!finalTranscript
            });
        }

        // If final, maybe reset active recognizer to allow switching?
        if (finalTranscript) {
            setTimeout(() => {
                activeRecognizerRef.current = null;
            }, 500);
        }
    };

    useEffect(() => {
        if (isListening) {
            setError(null);
            try { recognition1Ref.current?.start(); } catch (e) { }
            try { recognition2Ref.current?.start(); } catch (e) { }
        } else {
            setStatus('idle');
            recognition1Ref.current?.stop();
            recognition2Ref.current?.stop();
        }
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        setResult(null);
    }, []);

    return { result, resetTranscript, error, status };
};
