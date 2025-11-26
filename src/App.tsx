import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Sun, Moon } from 'lucide-react';
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

const SILENCE_TIMEOUT_MS = 1800;
const NOTICE_DURATION_MS = 2000;

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
  const { transcript, resetTranscript } = useSpeechRecognition(isListening, currentLanguage);
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

  const addMockMessage = useCallback(async (text: string, sender: 'me' | 'partner') => {
    const sourceLang = sender === 'me' ? myLanguage : partnerLanguage;
    const targetLang = sender === 'me' ? partnerLanguage : myLanguage;

    console.log('[addMockMessage] ===================================');
    console.log('[addMockMessage] Sender:', sender);
    console.log('[addMockMessage] Text:', text);
    console.log('[addMockMessage] Source Lang:', sourceLang);
    console.log('[addMockMessage] Target Lang:', targetLang);
    console.log('[addMockMessage] Using serverless function for translation');

    const { text: translatedText, source: translationSource } = await translate(text, targetLang);

    console.log('[addMockMessage] Translated:', translatedText, 'Source:', translationSource);

    const newMessage: Message = {
      id: Date.now().toString(),
      text: text,
      translatedText,
      translationSource,
      sender,
      timestamp: Date.now(),
      language: sourceLang,
    };

    console.log('[addMockMessage] Message object:', newMessage);
    setMessages(prev => [...prev, newMessage]);
  }, [myLanguage, partnerLanguage]);

  const commitTranscript = useCallback(async (rawText: string, sender: 'me' | 'partner', reason: 'silence' | 'mic-off') => {
    const text = rawText.trim();
    if (!text) return;

    const now = Date.now();
    if (text === lastProcessedRef.current && now - lastProcessedAtRef.current < 2000) {
      console.log('[commitTranscript] Skipping duplicate commit');
      return;
    }

    lastProcessedRef.current = text;
    lastProcessedAtRef.current = now;
    
    // 번역 전에 먼저 transcript 초기화 (새 음성 인식 준비)
    // 번역 API 호출 중에도 새로운 음성을 놓치지 않도록 함
    resetTranscript();
    
    // 번역은 비동기로 진행 (새 음성 인식과 병렬 처리)
    await addMockMessage(text, sender);

    if (reason === 'silence') {
      showNotice('자동 정지 감지: 번역을 전송했습니다');
    }
  }, [addMockMessage, resetTranscript, showNotice]);

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

  // Auto-commit on silence (timer-based)
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
    silenceTimerRef.current = window.setTimeout(() => {
      if (!sender) return;
      void commitTranscript(trimmed, sender, 'silence');
    }, SILENCE_TIMEOUT_MS);

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

  const renderPartnerSection = (variant: 'portrait' | 'landscape') => (
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
      <div className="absolute top-4 left-4 z-20">
        <LanguageSelector
          label="Partner"
          selectedLanguage={partnerLanguage}
          onSelectLanguage={setPartnerLanguage}
          isDark={isDark}
        />
      </div>

      <div className={`flex-1 overflow-hidden px-4 ${variant === 'portrait' ? 'pt-10 pb-12' : 'pt-10 pb-10'}`}>
        <div className={`h-full rounded-2xl border overflow-y-auto shadow-inner backdrop-blur-sm ${
          isDark 
            ? 'bg-slate-700/40 border-slate-600/50' 
            : 'bg-white/60 border-gray-200'
        }`}>
          <ChatHistory messages={messages} viewer="partner" onDeleteMessage={handleDeleteMessage} isDark={isDark} />
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

  const renderMeSection = (variant: 'portrait' | 'landscape') => (
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
          <ChatHistory messages={messages} viewer="me" onDeleteMessage={handleDeleteMessage} isDark={isDark} />
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

      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector
          label="Me"
          selectedLanguage={myLanguage}
          onSelectLanguage={setMyLanguage}
          isInverted
          isDark={isDark}
        />
      </div>
    </div>
  );

  // Effect to simulate adding message when transcript updates (debounce or wait for pause would be better)
  // For this demo, let's just show the transcript in the "Live" box and not auto-add to history to avoid spam.
  // We will add a "Send" button or just rely on the "Live" view for now, 
  // BUT the user asked for history. 
  // Let's Auto-add to history if the transcript is long enough and stable? 
  // No, let's just add a "Simulate Conversation" button for the user to see the UI, 
  // OR better: Modify the STT hook to return 'finalTranscript' separately.

  // For now, let's keep the UI structure ready.

  return (
    <div className={`h-full w-full overflow-hidden flex justify-center items-center transition-colors duration-300 ${
      isDark ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <div
        className={`h-full w-full ${containerWidthClasses} flex ${isLandscape ? 'flex-row gap-4' : 'flex-col'} relative overflow-hidden transition-colors duration-300 ${
          isDark ? 'bg-slate-900' : 'bg-gray-50'
        }`}
      >
        {/* 테마 전환 버튼 - 세로모드: 중앙 왼쪽, 가로모드: 상단 중앙 */}
        <button
          onClick={toggleTheme}
          className={`absolute z-50 p-2 rounded-full shadow-lg transition-all duration-300 ${
            isLandscape 
              ? 'top-4 left-1/2 -translate-x-1/2' 
              : 'top-1/2 left-4 -translate-y-1/2'
          } ${
            isDark 
              ? 'bg-slate-700 hover:bg-slate-600 text-yellow-400' 
              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
          }`}
          title={isDark ? '라이트 모드' : '다크 모드'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {isLandscape ? (
          landscapeLayout === 'partner-left' ? (
            <>
              {renderPartnerSection('landscape')}
              {renderMeSection('landscape')}
            </>
          ) : (
            <>
              {renderMeSection('landscape')}
              {renderPartnerSection('landscape')}
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1">
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
            <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>
              현재 왼쪽: {landscapeLayout === 'partner-left' ? '파트너' : '나'}
            </p>
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
