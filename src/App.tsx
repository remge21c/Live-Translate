import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Sun, Moon, RotateCcw } from 'lucide-react';
import { useAudio } from './hooks/useAudio';
import { AudioVisualizer } from './components/AudioVisualizer';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { LanguageSelector } from './components/LanguageSelector';
import { ChatHistory } from './components/ChatHistory';
import type { Message, LanguageCode } from './types';

import { translate } from './utils/translation';

const getInitialLayoutMode = (): 'portrait' | 'landscape' => {
  if (typeof window === 'undefined') return 'portrait';
  return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
};

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem('theme');
  return stored === 'light' ? 'light' : 'dark';
};

const SILENCE_TIMEOUT_MS = 1200; // 1.8초 → 1.2초로 단축하여 응답성 향상
const SENTENCE_END_TIMEOUT_MS = 400; // 문장 끝 감지 후 빠른 전송을 위한 짧은 타임아웃
const NOTICE_DURATION_MS = 2000;

// 문장 끝 패턴 감지 (마침표, 물음표, 느낌표, 일본어 마침표 등)
const SENTENCE_END_PATTERN = /[.?!。？！]$/;

function App() {
  const [myLanguage, setMyLanguage] = useState<LanguageCode>('ko-KR');
  const [partnerLanguage, setPartnerLanguage] = useState<LanguageCode>('en-US');
  const [messages, setMessages] = useState<Message[]>([]);
  const [layoutMode, setLayoutMode] = useState<'portrait' | 'landscape'>(getInitialLayoutMode);
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [landscapeLayout, setLandscapeLayout] = useState<'partner-left' | 'me-left'>(() => {
    if (typeof window === 'undefined') return 'partner-left';
    const stored = window.localStorage.getItem('landscapeLayout');
    return stored === 'me-left' ? 'me-left' : 'partner-left';
  });
  
  const isDark = theme === 'dark';

  // Track which mic is active: 'me', 'partner', or null
  const [activeMic, setActiveMic] = useState<'me' | 'partner' | null>(null);

  // Determine current listening language based on active mic
  const currentLanguage = activeMic === 'me' ? myLanguage : activeMic === 'partner' ? partnerLanguage : myLanguage;
  const isListening = activeMic !== null;

  const { volume } = useAudio(isListening);
  const { transcript, restartSession } = useSpeechRecognition(isListening, currentLanguage);
  const isLandscape = layoutMode === 'landscape';
  const containerWidthClasses = isLandscape
    ? 'max-w-none px-4'
    : 'max-w-[480px] sm:max-w-[640px] md:max-w-[768px] lg:max-w-[1024px]';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(orientation: portrait)');
    const updateMode = () => {
      setLayoutMode(mediaQuery.matches ? 'portrait' : 'landscape');
    };
    updateMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMode);
      return () => mediaQuery.removeEventListener('change', updateMode);
    }

    mediaQuery.addListener(updateMode);
    return () => mediaQuery.removeListener(updateMode);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('landscapeLayout', landscapeLayout);
    }
  }, [landscapeLayout]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Track last processed transcript to avoid duplicates
  const lastProcessedRef = useRef<string>('');
  const lastProcessedAtRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousActiveMicRef = useRef<'me' | 'partner' | null>(null);
  const transcriptRef = useRef<string>('');

  const [systemNotice, setSystemNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string) => {
    if (typeof window === 'undefined') return;
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }

    setSystemNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      setSystemNotice(null);
      noticeTimerRef.current = null;
    }, NOTICE_DURATION_MS);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // 메시지 삭제 함수 - 양쪽 화면에서 동시에 삭제됨
  const handleDeleteMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
    console.log('[handleDeleteMessage] Deleted message:', id);
  }, []);

  // 전체 메시지 초기화 함수
  const handleClearAllMessages = useCallback(() => {
    setMessages([]);
    console.log('[handleClearAllMessages] All messages cleared');
  }, []);

  // 언어별 "번역 중..." 메시지
  const getPendingText = (lang: LanguageCode): string => {
    const pendingTexts: Record<LanguageCode, string> = {
      'ko-KR': '번역 중...',
      'en-US': 'Translating...',
      'ja-JP': '翻訳中...',
      'zh-CN': '翻译中...',
      'de-DE': 'Übersetzen...',
    };
    return pendingTexts[lang] || 'Translating...';
  };

  const addMockMessage = useCallback(async (text: string, sender: 'me' | 'partner') => {
    const sourceLang = sender === 'me' ? myLanguage : partnerLanguage;
    const targetLang = sender === 'me' ? partnerLanguage : myLanguage;

    console.log('[addMockMessage] ===================================');
    console.log('[addMockMessage] Sender:', sender);
    console.log('[addMockMessage] Text:', text);
    console.log('[addMockMessage] Source Lang:', sourceLang);
    console.log('[addMockMessage] Target Lang:', targetLang);

    // 번역 중 미리보기 메시지 즉시 표시 (체감 지연 감소)
    // 상대방 언어로 "번역 중..." 표시
    const tempId = Date.now().toString();
    const pendingMessage: Message = {
      id: tempId,
      text: text,
      translatedText: getPendingText(targetLang),
      translationSource: 'pending',
      sender,
      timestamp: Date.now(),
      language: sourceLang,
    };
    setMessages(prev => [...prev, pendingMessage]);

    console.log('[addMockMessage] Using serverless function for translation');

    const { text: translatedText, source: translationSource } = await translate(text, targetLang);

    console.log('[addMockMessage] Translated:', translatedText, 'Source:', translationSource);

    // 번역 완료 후 미리보기 메시지를 실제 결과로 교체
    setMessages(prev => prev.map(msg => 
      msg.id === tempId 
        ? { ...msg, translatedText, translationSource }
        : msg
    ));
  }, [myLanguage, partnerLanguage]);

  const commitTranscript = useCallback(async (rawText: string, sender: 'me' | 'partner', reason: 'silence' | 'mic-off') => {
    let text = rawText.trim();
    if (!text) return;

    const now = Date.now();
    
    if (lastProcessedRef.current) {
      const isRecent = now - lastProcessedAtRef.current < 3000;
      if (isRecent && text === lastProcessedRef.current) {
        console.log('[commitTranscript] Skipping exact duplicate');
        return;
      }
      if (text.startsWith(lastProcessedRef.current)) {
        const newSegment = text.slice(lastProcessedRef.current.length).trim();
        if (!newSegment) {
          console.log('[commitTranscript] Only duplicate content detected, skipping');
          return;
        }
        console.log('[commitTranscript] Detected merged transcript, using new segment:', newSegment);
        text = newSegment;
      }
    }

    lastProcessedRef.current = text;
    lastProcessedAtRef.current = now;
    
    // 음성인식 세션 빠른 재시작 (버퍼 초기화 + 30ms 후 즉시 재시작)
    restartSession();
    
    // 번역 진행
    await addMockMessage(text, sender);

    if (reason === 'silence') {
      showNotice('자동 정지 감지: 번역을 전송했습니다');
    }
  }, [addMockMessage, restartSession, showNotice]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    const previous = previousActiveMicRef.current;
    if (previous && previous !== activeMic) {
      clearSilenceTimer();
      void commitTranscript(transcriptRef.current, previous, 'mic-off');
    }
    previousActiveMicRef.current = activeMic;
  }, [activeMic, commitTranscript, clearSilenceTimer]);

  // Auto-commit on silence (timer-based) + 문장 끝 패턴 감지
  useEffect(() => {
    if (!isListening || !activeMic) {
      clearSilenceTimer();
      return;
    }

    const trimmed = transcript.trim();
    const now = Date.now();
    if (
      !trimmed ||
      (trimmed === lastProcessedRef.current && now - lastProcessedAtRef.current < 2000)
    ) {
      return;
    }

    if (typeof window === 'undefined') return;

    clearSilenceTimer();
    const sender = activeMic;
    
    // 문장 끝 패턴(. ? ! 。 등) 감지 시 더 짧은 타임아웃 사용
    const hasSentenceEnd = SENTENCE_END_PATTERN.test(trimmed);
    const timeoutMs = hasSentenceEnd ? SENTENCE_END_TIMEOUT_MS : SILENCE_TIMEOUT_MS;
    
    silenceTimerRef.current = window.setTimeout(() => {
      if (!sender) return;
      void commitTranscript(trimmed, sender, 'silence');
    }, timeoutMs);

    return () => {
      clearSilenceTimer();
    };
  }, [transcript, isListening, activeMic, commitTranscript, clearSilenceTimer]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (typeof window !== 'undefined' && noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, [clearSilenceTimer]);

  const renderPartnerSection = (variant: 'portrait' | 'landscape', isLeftPanel?: boolean) => (
    <div
      className={`flex-1 flex flex-col min-w-0 transition-colors duration-300 relative overflow-hidden ${
        variant === 'portrait'
          ? isDark 
            ? 'bg-slate-800 rotate-180 border-b-2 border-cyan-400'
            : 'bg-gray-100 rotate-180 border-b-2 border-blue-400'
          : isDark
            ? 'bg-slate-800/90 rounded-3xl border border-slate-700/60'
            : 'bg-gray-100/90 rounded-3xl border border-gray-300/60'
      }`}
    >
      {/* 세로모드에서만 언어 선택기 표시 (가로모드는 외부에서 고정 위치로 표시) */}
      {variant === 'portrait' && (
        <div className="absolute top-4 left-4 z-20">
          <LanguageSelector
            label="Partner"
            selectedLanguage={partnerLanguage}
            onSelectLanguage={setPartnerLanguage}
            isDark={isDark}
          />
        </div>
      )}

      <div className={`flex-1 overflow-hidden px-4 ${variant === 'portrait' ? 'pt-10 pb-12' : 'pt-10 pb-10'}`}>
        <div className={`h-full rounded-2xl border overflow-y-auto shadow-inner backdrop-blur-sm ${
          isDark 
            ? 'bg-slate-700/40 border-slate-600/50' 
            : 'bg-white/60 border-gray-200'
        }`}>
          <ChatHistory 
            messages={messages} 
            viewer="partner" 
            onDeleteMessage={handleDeleteMessage} 
            isDark={isDark} 
            alignLeft={variant === 'landscape' ? isLeftPanel : undefined}
          />
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
        <button
          onClick={() => {
            if (activeMic === 'partner') {
              setActiveMic(null);
            } else {
              setActiveMic('partner');
            }
          }}
          className={`p-4 rounded-full shadow-2xl transition-all duration-300 border-4 ${
            activeMic === 'partner'
              ? 'bg-red-500 animate-pulse scale-110 border-red-400'
              : isDark 
                ? 'bg-slate-600 hover:bg-slate-500 border-slate-700'
                : 'bg-gray-400 hover:bg-gray-500 border-gray-300'
          }`}
        >
          {activeMic === 'partner' ? <Mic size={28} color="white" /> : <MicOff size={28} color="white" />}
        </button>
      </div>
    </div>
  );

  const renderMeSection = (variant: 'portrait' | 'landscape', isLeftPanel?: boolean) => (
    <div
      className={`flex-1 flex flex-col min-w-0 transition-colors duration-300 relative overflow-hidden ${
        variant === 'portrait' 
          ? isDark ? 'bg-slate-900' : 'bg-white'
          : isDark 
            ? 'bg-slate-900/90 rounded-3xl border border-slate-800/60'
            : 'bg-white/90 rounded-3xl border border-gray-200/60'
      }`}
    >
      <div className={`flex-1 overflow-hidden px-4 ${variant === 'portrait' ? 'pt-12 pb-12' : 'pt-10 pb-10'}`}>
        <div className={`h-full rounded-2xl border overflow-y-auto shadow-inner backdrop-blur-sm ${
          isDark 
            ? 'bg-slate-800/60 border-slate-700' 
            : 'bg-gray-50/80 border-gray-200'
        }`}>
          <ChatHistory 
            messages={messages} 
            viewer="me" 
            onDeleteMessage={handleDeleteMessage} 
            isDark={isDark} 
            alignLeft={variant === 'landscape' ? isLeftPanel : undefined}
          />
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
        <button
          onClick={() => {
            if (activeMic === 'me') {
              setActiveMic(null);
            } else {
              setActiveMic('me');
            }
          }}
          className={`p-4 rounded-full shadow-2xl transition-all duration-300 border-4 ${
            activeMic === 'me'
              ? 'bg-red-500 animate-pulse scale-110 border-red-400'
              : isDark 
                ? 'bg-cyan-600 hover:bg-cyan-500 border-slate-800'
                : 'bg-blue-500 hover:bg-blue-600 border-gray-200'
          }`}
        >
          {activeMic === 'me' ? <Mic size={28} color="white" /> : <MicOff size={28} color="white" />}
        </button>
      </div>

      {/* 세로모드에서만 언어 선택기 표시 (가로모드는 외부에서 고정 위치로 표시) */}
      {variant === 'portrait' && (
        <div className="absolute top-4 right-4 z-20">
          <LanguageSelector
            label="Me"
            selectedLanguage={myLanguage}
            onSelectLanguage={setMyLanguage}
            isInverted
            isDark={isDark}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className={`h-full w-full overflow-hidden flex justify-center items-center transition-colors duration-300 ${
      isDark ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <div
        className={`h-full w-full ${containerWidthClasses} flex ${isLandscape ? 'flex-row gap-4' : 'flex-col'} relative overflow-hidden transition-colors duration-300 ${
          isDark ? 'bg-slate-900' : 'bg-gray-50'
        }`}
      >
        {/* 테마 전환 버튼 + 초기화 버튼 - 세로모드: 중앙 왼쪽, 가로모드: 상단 중앙 */}
        <div className={`absolute z-50 flex gap-2 ${
          isLandscape 
            ? 'top-4 left-1/2 -translate-x-1/2 flex-row' 
            : 'top-1/2 left-4 -translate-y-1/2 flex-col'
        }`}>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full shadow-lg transition-all duration-300 ${
              isDark 
                ? 'bg-slate-700 hover:bg-slate-600 text-yellow-400' 
                : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
            title={isDark ? '라이트 모드' : '다크 모드'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={handleClearAllMessages}
            className={`p-2 rounded-full shadow-lg transition-all duration-300 ${
              isDark 
                ? 'bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white' 
                : 'bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-700 border border-gray-200'
            }`}
            title="전체 초기화"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* 가로모드 언어 선택기 - 위치 변경에 따라 좌우 이동 */}
        {isLandscape && (
          <>
            <div className={`absolute top-4 z-50 ${landscapeLayout === 'partner-left' ? 'left-4' : 'right-4'}`}>
              <LanguageSelector
                label="Partner"
                selectedLanguage={partnerLanguage}
                onSelectLanguage={setPartnerLanguage}
                isDark={isDark}
              />
            </div>
            <div className={`absolute top-4 z-50 ${landscapeLayout === 'partner-left' ? 'right-4' : 'left-4'}`}>
              <LanguageSelector
                label="Me"
                selectedLanguage={myLanguage}
                onSelectLanguage={setMyLanguage}
                isInverted
                isDark={isDark}
              />
            </div>
          </>
        )}

        {isLandscape ? (
          landscapeLayout === 'partner-left' ? (
            <>
              {renderPartnerSection('landscape', true)}
              {renderMeSection('landscape', false)}
            </>
          ) : (
            <>
              {renderMeSection('landscape', true)}
              {renderPartnerSection('landscape', false)}
            </>
          )
        ) : (
          <>
            {renderPartnerSection('portrait')}
            {renderMeSection('portrait')}
          </>
        )}

        {systemNotice && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40">
            <div className={`rounded-full px-4 py-1 text-xs font-medium shadow-lg ${
              isDark ? 'bg-black/70 text-white' : 'bg-white/90 text-gray-800 border border-gray-200'
            }`}>
              {systemNotice}
            </div>
          </div>
        )}

        {isLandscape && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
            <button
              onClick={() =>
                setLandscapeLayout(prev => (prev === 'partner-left' ? 'me-left' : 'partner-left'))
              }
              className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-colors ${
                isDark 
                  ? 'bg-slate-800/80 border border-cyan-400 hover:bg-slate-700' 
                  : 'bg-white/80 border border-blue-400 hover:bg-gray-100 text-gray-700'
              }`}
            >
              기본 위치 교체
            </button>
          </div>
        )}

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-8 flex justify-center items-center pointer-events-none z-30">
          <AudioVisualizer isListening={isListening} volume={volume} />
        </div>
      </div>
    </div>
  );

}

export default App;
