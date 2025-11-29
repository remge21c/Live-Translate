import { useState, useEffect, useRef, useCallback } from 'react';

const RECOVERABLE_ERRORS = new Set(['no-speech', 'aborted', 'audio-capture', 'network']);

export interface SpeechRecognitionResult {
    transcript: string;
    isFinal: boolean;
    language: string; // 'ko-KR' or 'en-US'
}

export const useSpeechRecognition = (
    isListening: boolean, 
    language: string,
    onAutoStop?: () => void // 자동 정지 콜백
) => {
    const [transcript, setTranscript] = useState<string>('');
    const recognitionRef = useRef<any>(null);
    const isListeningRef = useRef<boolean>(isListening);
    const previousLanguageRef = useRef<string>(language);
    const restartTimeoutRef = useRef<number | null>(null);
    const lastFinalResultRef = useRef<string>(''); // 마지막 final 결과 추적 (중복 방지)
    const lastActivityRef = useRef<number>(Date.now()); // 마지막 활동 시간 (watchdog용)
    const watchdogIntervalRef = useRef<number | null>(null); // watchdog 타이머
    const autoStopCallbackRef = useRef<(() => void) | undefined>(onAutoStop);
    
    // 콜백 ref 업데이트
    useEffect(() => {
        autoStopCallbackRef.current = onAutoStop;
    }, [onAutoStop]);

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

    // 화면 보호 모드에서 돌아왔을 때 음성인식 재시작
    const wasHiddenRef = useRef<boolean>(false);
    
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const handleVisibilityChange = () => {
            const isNowVisible = document.visibilityState === 'visible';
            const isNowHidden = document.visibilityState === 'hidden';
            
            // hidden 상태로 전환되면 기록
            if (isNowHidden) {
                wasHiddenRef.current = true;
                console.log('[SpeechRecognition] Page became hidden');
                return;
            }
            
            // visible로 전환되었고, 이전에 hidden이었을 때만 재시작
            if (isNowVisible && wasHiddenRef.current && isListeningRef.current && recognitionRef.current) {
                wasHiddenRef.current = false;
                console.log('[SpeechRecognition] Page became visible after being hidden, checking recognition state...');
                
                // 약간의 딜레이 후 재시작 시도 (브라우저가 완전히 활성화될 시간 확보)
                setTimeout(() => {
                    if (isListeningRef.current && recognitionRef.current) {
                        // 음성인식이 이미 실행 중인지 확인하기 위해 start 시도
                        // InvalidStateError가 발생하면 이미 실행 중이므로 무시
                        try {
                            recognitionRef.current.start();
                            console.log('[SpeechRecognition] Restarted after visibility change');
                        } catch (e) {
                            const domError = e as DOMException;
                            if (domError?.name === 'InvalidStateError') {
                                console.log('[SpeechRecognition] Already running after visibility change');
                            } else {
                                console.log('[SpeechRecognition] Restart after visibility failed, scheduling retry');
                                scheduleRestart('visibility-change', 200);
                            }
                        }
                    }
                }, 500);
            } else if (isNowVisible) {
                wasHiddenRef.current = false;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [scheduleRestart]);

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
            // 활동 시간 업데이트 (watchdog용)
            lastActivityRef.current = Date.now();
            
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
                lastActivityRef.current = Date.now();
            } catch (e) {
                console.log('[SpeechRecognition] Already started');
            }
        } else if (!isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            clearRestartTimeout();
            console.log('[SpeechRecognition] Stopped');
        }
    }, [isListening, clearRestartTimeout]);

    // Watchdog: 주기적으로 음성인식 상태 확인 및 10초 무음시 자동 정지
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const WATCHDOG_INTERVAL = 1000; // 1초마다 체크
        const AUTO_STOP_THRESHOLD = 10000; // 10초 이상 무응답이면 마이크 자동 정지

        const checkAndAutoStop = () => {
            if (!isListeningRef.current || !recognitionRef.current) {
                return;
            }

            const now = Date.now();
            const timeSinceLastActivity = now - lastActivityRef.current;

            // 5초 이상 활동이 없으면 마이크 자동 정지
            if (timeSinceLastActivity > AUTO_STOP_THRESHOLD) {
                console.log(`[SpeechRecognition] Watchdog: No activity for ${timeSinceLastActivity}ms, auto-stopping mic...`);
                
                // 자동 정지 콜백 호출 (마이크 끄기)
                if (autoStopCallbackRef.current) {
                    autoStopCallbackRef.current();
                }
            }
        };

        if (isListening) {
            // watchdog 시작
            lastActivityRef.current = Date.now(); // 시작 시 활동 시간 초기화
            watchdogIntervalRef.current = window.setInterval(checkAndAutoStop, WATCHDOG_INTERVAL);
            console.log('[SpeechRecognition] Watchdog started (auto-stop after 5s silence)');
        }

        return () => {
            if (watchdogIntervalRef.current !== null) {
                window.clearInterval(watchdogIntervalRef.current);
                watchdogIntervalRef.current = null;
                console.log('[SpeechRecognition] Watchdog stopped');
            }
        };
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        console.log('[SpeechRecognition] Resetting transcript...');
        setTranscript('');
        lastFinalResultRef.current = '';
    }, []);

    // 번역 완료 후 음성인식 세션 재시작 (버퍼 완전 초기화, 안정적인 재시작)
    const restartSession = useCallback(() => {
        console.log('[SpeechRecognition] Restarting session to clear buffer...');
        setTranscript('');
        lastFinalResultRef.current = '';
        lastActivityRef.current = Date.now(); // 활동 시간 업데이트
        
        if (recognitionRef.current && isListeningRef.current) {
            try {
                // 현재 세션 중지
                recognitionRef.current.stop();
                
                // 충분한 딜레이 후 재시작 시도 (Web Speech API가 완전히 종료될 시간 확보)
                setTimeout(() => {
                    if (isListeningRef.current && recognitionRef.current) {
                        try {
                            recognitionRef.current.start();
                            lastActivityRef.current = Date.now();
                            console.log('[SpeechRecognition] Session restarted after delay');
                        } catch (e) {
                            const domError = e as DOMException;
                            if (domError?.name === 'InvalidStateError') {
                                console.log('[SpeechRecognition] Already running after restart attempt');
                            } else {
                                // 실패하면 onend에서 재시작됨
                                console.log('[SpeechRecognition] Restart failed, will retry via onend');
                            }
                        }
                    }
                }, 150); // 150ms 후 재시작 시도 (더 안정적)
            } catch (e) {
                console.log('[SpeechRecognition] Error stopping session:', e);
            }
        }
    }, []);

    return { transcript, resetTranscript, restartSession };
};
