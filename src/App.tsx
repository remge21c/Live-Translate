import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
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

const SILENCE_TIMEOUT_MS = 1800;
const NOTICE_DURATION_MS = 2000;

function App() {
  const [myLanguage, setMyLanguage] = useState<LanguageCode>('ko-KR');
  const [partnerLanguage, setPartnerLanguage] = useState<LanguageCode>('en-US');
  const [messages, setMessages] = useState<Message[]>([]);
  const [layoutMode, setLayoutMode] = useState<'portrait' | 'landscape'>(getInitialLayoutMode);
  const [landscapeLayout, setLandscapeLayout] = useState<'partner-left' | 'me-left'>(() => {
    if (typeof window === 'undefined') return 'partner-left';
    const stored = window.localStorage.getItem('landscapeLayout');
    return stored === 'me-left' ? 'me-left' : 'partner-left';
  });

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
    await addMockMessage(text, sender);
    resetTranscript();

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
          ? 'bg-slate-800 rotate-180 border-b-2 border-cyan-400'
          : 'bg-slate-800/90 rounded-3xl border border-slate-700/60'
      }`}
    >
      <div className="absolute top-4 left-4 z-20">
        <LanguageSelector
          label="Partner"
          selectedLanguage={partnerLanguage}
          onSelectLanguage={setPartnerLanguage}
        />
      </div>

      <div className={`flex-1 overflow-hidden px-4 ${variant === 'portrait' ? 'pt-10 pb-12' : 'pt-10 pb-10'}`}>
        <div className="h-full bg-slate-700/40 rounded-2xl border border-slate-600/50 overflow-y-auto shadow-inner backdrop-blur-sm">
          <ChatHistory messages={messages} viewer="partner" />
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
          className={`p-4 rounded-full shadow-2xl transition-all duration-300 border-4 border-slate-700 ${
            activeMic === 'partner'
              ? 'bg-red-500 animate-pulse scale-110 border-red-400'
              : 'bg-slate-600 hover:bg-slate-500'
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
        variant === 'portrait' ? 'bg-slate-900' : 'bg-slate-900/90 rounded-3xl border border-slate-800/60'
      }`}
    >
      <div className={`flex-1 overflow-hidden px-4 ${variant === 'portrait' ? 'pt-12 pb-12' : 'pt-10 pb-10'}`}>
        <div className="h-full bg-slate-800/60 rounded-2xl border border-slate-700 overflow-y-auto shadow-inner backdrop-blur-sm">
          <ChatHistory messages={messages} viewer="me" />
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
          className={`p-4 rounded-full shadow-2xl transition-all duration-300 border-4 border-slate-800 ${
            activeMic === 'me'
              ? 'bg-red-500 animate-pulse scale-110 border-red-400'
              : 'bg-cyan-600 hover:bg-cyan-500'
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
    <div className="h-[95vh] w-screen bg-slate-900 text-white overflow-hidden flex justify-center items-center">
      <div
        className={`h-full w-full ${containerWidthClasses} bg-slate-900 flex ${isLandscape ? 'flex-row gap-4' : 'flex-col'} relative overflow-hidden`}
      >
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
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
            <div className="rounded-full bg-black/70 px-4 py-1 text-xs font-medium text-white shadow-lg">
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
              className="px-4 py-2 rounded-full bg-slate-800/80 border border-cyan-400 text-xs font-semibold tracking-wide hover:bg-slate-700 transition-colors"
            >
              기본 위치 교체
            </button>
            <p className="text-[10px] text-slate-300">
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
