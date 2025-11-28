import { useState, useEffect, useRef, useCallback } from 'react';

const RECOVERABLE_ERRORS = new Set(['no-speech', 'aborted', 'audio-capture', 'network']);

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
    const restartTimeoutRef = useRef<number | null>(null);
    const lastFinalResultRef = useRef<string>(''); // 마지막 final 결과 추적 (중복 방지)

    const clearRestartTimeout = useCallback(() => {
        if (restartTimeoutRef.current !== null) {
            if (typeof window !== 'undefined') {
                window.clearTimeout(restartTimeoutRef.current);
            }
            restartTimeoutRef.current = null;
        }
    }, []);

    const scheduleRestart = useCallback(
        (reason: string, delay = 50) => { // 350ms → 50ms로 단축 (음성 손실 최소화)
            if (typeof window === 'undefined') return;
            clearRestartTimeout();
            restartTimeoutRef.current = window.setTimeout(() => {
                restartTimeoutRef.current = null;

                if (!isListeningRef.current || !recognitionRef.current) {
                    return;
                }

                try {
                    recognitionRef.current.start();
                    console.log(`[SpeechRecognition] Restarted (${reason})`);
                } catch (error) {
                    const domError = error as DOMException;
                    if (domError?.name === 'InvalidStateError') {
                        console.log('[SpeechRecognition] Restart skipped - already running');
                        return;
                    }

                    console.error(`[SpeechRecognition] Restart failed (${reason})`, error);
                    if (isListeningRef.current) {
                        scheduleRestart(reason, Math.min(delay + 100, 1000)); // 재시도 간격도 단축
                    }
                }
            }, delay);
        },
        [clearRestartTimeout],
    );

    // Keep isListening in sync with ref
    useEffect(() => {
        isListeningRef.current = isListening;
        if (!isListening) {
            clearRestartTimeout();
        }
    }, [isListening, clearRestartTimeout]);

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

            // final 결과가 있으면 우선 사용
            if (finalTranscript) {
                // 이전 final 결과와 같으면 무시 (중복 방지)
                if (finalTranscript.trim() === lastFinalResultRef.current) {
                    console.log('[SpeechRecognition] Skipping duplicate final result');
                    return;
                }
                lastFinalResultRef.current = finalTranscript.trim();
                setTranscript(finalTranscript);
            } else if (interimTranscript) {
                // interim 결과는 항상 업데이트 (실시간 표시용)
                setTranscript(interimTranscript);
            }
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error('[SpeechRecognition] Error:', event.error);

            if (!isListeningRef.current) {
                return;
            }

            if (RECOVERABLE_ERRORS.has(event.error)) {
                const delay = event.error === 'network' ? 1200 : 400;
                scheduleRestart(`error:${event.error}`, delay);
                return;
            }

            console.error('[SpeechRecognition] Fatal error - stopping recognition');
            try {
                recognitionRef.current?.stop();
            } catch (stopError) {
                console.error('[SpeechRecognition] Failed to stop after fatal error', stopError);
            }
        };

        // Auto-restart when recognition ends
        recognitionRef.current.onend = () => {
            console.log('[SpeechRecognition] Recognition ended, checking if should restart...');
            if (isListeningRef.current && recognitionRef.current) {
                scheduleRestart('onend');
            } else {
                clearRestartTimeout();
            }
        };

        return () => {
            clearRestartTimeout();
            if (recognitionRef.current) {
                recognitionRef.current.onend = null; // Remove handler first
                recognitionRef.current.onerror = null;
                recognitionRef.current.stop();
            }
        };
    }, [clearRestartTimeout, scheduleRestart]); // Only initialize once

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
                scheduleRestart('language-change', 200);
            }
        }
    }, [language, isListening, scheduleRestart]);

    useEffect(() => {
        if (isListening && recognitionRef.current) {
            try {
                recognitionRef.current.start();
                console.log('[SpeechRecognition] Started');
                clearRestartTimeout();
            } catch (e) {
                console.log('[SpeechRecognition] Already started');
            }
        } else if (!isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            clearRestartTimeout();
            console.log('[SpeechRecognition] Stopped');
        }
    }, [isListening, clearRestartTimeout]);

    const resetTranscript = useCallback(() => {
        console.log('[SpeechRecognition] Resetting transcript...');
        setTranscript('');
        lastFinalResultRef.current = '';
    }, []);

    // 번역 완료 후 음성인식 세션 재시작 (버퍼 완전 초기화, 빠른 재시작)
    const restartSession = useCallback(() => {
        console.log('[SpeechRecognition] Restarting session to clear buffer...');
        setTranscript('');
        lastFinalResultRef.current = '';
        
        if (recognitionRef.current && isListeningRef.current) {
            try {
                // 현재 세션 중지
                recognitionRef.current.stop();
                
                // onend 핸들러 대기 없이 즉시 재시작 시도 (음성 손실 최소화)
                setTimeout(() => {
                    if (isListeningRef.current && recognitionRef.current) {
                        try {
                            recognitionRef.current.start();
                            console.log('[SpeechRecognition] Session restarted immediately');
                        } catch (e) {
                            // InvalidStateError면 onend에서 재시작됨
                            console.log('[SpeechRecognition] Immediate restart skipped, will use onend');
                        }
                    }
                }, 30); // 30ms 후 즉시 재시작 시도
            } catch (e) {
                console.log('[SpeechRecognition] Error stopping session:', e);
            }
        }
    }, []);

    return { transcript, resetTranscript, restartSession };
};
