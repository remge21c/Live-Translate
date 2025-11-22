import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, X } from 'lucide-react';
import { useAudio } from './hooks/useAudio';
import { AudioVisualizer } from './components/AudioVisualizer';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { LanguageSelector } from './components/LanguageSelector';
import { ChatHistory } from './components/ChatHistory';
import type { Message, LanguageCode } from './types';

import { translate } from './utils/translation';

function App() {
  const [myLanguage, setMyLanguage] = useState<LanguageCode>('ko-KR');
  const [partnerLanguage, setPartnerLanguage] = useState<LanguageCode>('en-US');
  const [messages, setMessages] = useState<Message[]>([]);

  // DeepL API Key State
  const [deepLKey, setDeepLKey] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  // Load API Key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('deepLKey');
    if (savedKey) setDeepLKey(savedKey);
  }, []);

  // Save API Key to localStorage
  const handleSaveKey = (key: string) => {
    setDeepLKey(key);
    localStorage.setItem('deepLKey', key);
  };

  // Track which mic is active: 'me', 'partner', or null
  const [activeMic, setActiveMic] = useState<'me' | 'partner' | null>(null);

  // Determine current listening language based on active mic
  const currentLanguage = activeMic === 'me' ? myLanguage : activeMic === 'partner' ? partnerLanguage : myLanguage;
  const isListening = activeMic !== null;

  const { volume } = useAudio(isListening);
  const { transcript, resetTranscript } = useSpeechRecognition(isListening, currentLanguage);

  // Track last processed transcript to avoid duplicates
  const lastProcessedRef = useRef<string>('');

  // Auto-commit on silence
  useEffect(() => {
    if (!isListening || !transcript || !activeMic) return;

    // Skip if we already processed this exact transcript
    if (transcript === lastProcessedRef.current) return;

    const timer = setTimeout(async () => {
      if (transcript.trim().length > 0 && transcript !== lastProcessedRef.current) {
        lastProcessedRef.current = transcript;
        await addMockMessage(transcript, activeMic);
        resetTranscript();
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [transcript, isListening, activeMic]);

  // Add message with translation
  const addMockMessage = async (text: string, sender: 'me' | 'partner') => {
    // Determine source and target languages
    const sourceLang = sender === 'me' ? myLanguage : partnerLanguage;
    const targetLang = sender === 'me' ? partnerLanguage : myLanguage;

    console.log('[addMockMessage] ===================================');
    console.log('[addMockMessage] Sender:', sender);
    console.log('[addMockMessage] Text:', text);
    console.log('[addMockMessage] Source Lang:', sourceLang);
    console.log('[addMockMessage] Target Lang:', targetLang);

    // Translate from source to target (async)
    // Pass deepLKey if available
    const { text: translatedText, source: translationSource } = await translate(text, targetLang, deepLKey);

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
  };

  // Effect to simulate adding message when transcript updates (debounce or wait for pause would be better)
  // For this demo, let's just show the transcript in the "Live" box and not auto-add to history to avoid spam.
  // We will add a "Send" button or just rely on the "Live" view for now, 
  // BUT the user asked for history. 
  // Let's Auto-add to history if the transcript is long enough and stable? 
  // No, let's just add a "Simulate Conversation" button for the user to see the UI, 
  // OR better: Modify the STT hook to return 'finalTranscript' separately.

  // For now, let's keep the UI structure ready.

  return (
    <div className="h-screen w-screen bg-slate-900 text-white overflow-hidden flex justify-center items-center">
      {/* Main Container - Responsive with max width */}
      <div className="h-full w-full max-w-[480px] sm:max-w-[640px] md:max-w-[768px] lg:max-w-[1024px] bg-slate-900 flex flex-col relative overflow-hidden">

        {/* DEBUG OVERLAY */}
        <div className="absolute top-0 left-0 z-50 p-2 bg-black/50 text-[10px] pointer-events-none">
          <p>Status: {activeMic ? `Listening (${activeMic} - ${currentLanguage})` : 'Idle'}</p>
          <p>Vol: {volume.toFixed(1)}</p>
          <p>DeepL: {deepLKey ? 'Active' : 'Inactive'}</p>
        </div>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 z-50 p-2 bg-slate-800/80 rounded-full hover:bg-slate-700 transition-colors"
        >
          <Settings size={20} className="text-slate-400" />
        </button>

        {/* Settings Modal */}
        {showSettings && (
          <div className="absolute inset-0 z-[100] bg-black/80 flex justify-center items-center p-4">
            <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">DeepL API Key</label>
                  <input
                    type="password"
                    value={deepLKey}
                    onChange={(e) => handleSaveKey(e.target.value)}
                    placeholder="Paste your DeepL API Key here"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Supports Free (ends with :fx) and Pro keys.
                    <br />
                    Key is saved locally in your browser.
                  </p>
                </div>

                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- Top Half (Partner) --- */}
        <div className="flex-1 flex flex-col bg-slate-800 rotate-180 border-b-2 border-cyan-400 transition-colors duration-300 relative overflow-hidden">
          {/* Partner Controls (Top Left relative to screen, Bottom Right relative to Partner) */}
          <div className="absolute top-4 left-4 z-20">
            <LanguageSelector
              label="Partner"
              selectedLanguage={partnerLanguage}
              onSelectLanguage={setPartnerLanguage}
            />
          </div>

          {/* Partner Chat History - Scrollable */}
          <div className="flex-1 overflow-hidden px-4 pt-20 pb-24">
            <div className="h-full bg-slate-700/40 rounded-2xl border border-slate-600/50 overflow-y-auto shadow-inner backdrop-blur-sm">
              <ChatHistory messages={messages} viewer="partner" />
            </div>
          </div>

          {/* Partner Mic Button (Fixed at Bottom) */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
            <button
              onClick={async () => {
                if (activeMic === 'partner') {
                  // Stop partner mic
                  if (transcript) {
                    await addMockMessage(transcript, 'partner');
                    resetTranscript();
                  }
                  setActiveMic(null);
                } else {
                  // Activate partner mic (automatically deactivates 'me' mic if active)
                  if (activeMic === 'me' && transcript) {
                    await addMockMessage(transcript, 'me');
                    resetTranscript();
                  }
                  setActiveMic('partner');
                }
              }}
              className={`p-4 rounded-full shadow-2xl transition-all duration-300 border-4 border-slate-700 ${activeMic === 'partner'
                ? 'bg-red-500 animate-pulse scale-110 border-red-400'
                : 'bg-slate-600 hover:bg-slate-500'
                }`}
            >
              {activeMic === 'partner' ? <Mic size={28} color="white" /> : <MicOff size={28} color="white" />}
            </button>
          </div>


        </div>


        {/* --- Bottom Half (Me) --- */}
        <div className="flex-1 flex flex-col bg-slate-900 transition-colors duration-300 relative overflow-hidden">



          {/* My Chat History - Scrollable */}
          <div className="flex-1 overflow-hidden px-4 pt-24 pb-24">
            <div className="h-full bg-slate-800/60 rounded-2xl border border-slate-700 overflow-y-auto shadow-inner backdrop-blur-sm">
              <ChatHistory messages={messages} viewer="me" />
            </div>
          </div>

          {/* My Mic Button (Fixed at Bottom) */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
            <button
              onClick={async () => {
                if (activeMic === 'me') {
                  // Stop my mic
                  if (transcript) {
                    await addMockMessage(transcript, 'me');
                    resetTranscript();
                  }
                  setActiveMic(null);
                } else {
                  // Activate my mic (automatically deactivates partner mic if active)
                  if (activeMic === 'partner' && transcript) {
                    await addMockMessage(transcript, 'partner');
                    resetTranscript();
                  }
                  setActiveMic('me');
                }
              }}
              className={`p-4 rounded-full shadow-2xl transition-all duration-300 border-4 border-slate-800 ${activeMic === 'me'
                ? 'bg-red-500 animate-pulse scale-110 border-red-400'
                : 'bg-cyan-600 hover:bg-cyan-500'
                }`}
            >
              {activeMic === 'me' ? <Mic size={28} color="white" /> : <MicOff size={28} color="white" />}
            </button>
          </div>

          {/* My Controls */}
          <div className="absolute bottom-4 right-4 z-20">
            <LanguageSelector
              label="Me"
              selectedLanguage={myLanguage}
              onSelectLanguage={setMyLanguage}
              isInverted
            />
          </div>
        </div>

        {/* Centered Visualizer - Between both chat areas */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-8 flex justify-center items-center pointer-events-none z-40">
          <AudioVisualizer isListening={isListening} volume={volume} />
        </div>
      </div>
    </div>
  );
}

export default App;
