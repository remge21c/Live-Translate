import type { LanguageCode } from '../types';

// Convert our language codes to API format
const languageCodeMap: Record<LanguageCode, string> = {
    'ko-KR': 'ko',
    'en-US': 'en',
    'ja-JP': 'ja',
    'zh-CN': 'zh',
};

// Dictionary for common phrases (fallback for API)
const KOREAN_TO_ENGLISH: Record<string, string> = {
    '안녕하세요': 'Hello',
    '반갑습니다': 'Nice to meet you',
    '잘 지내시나요': 'How are you?',
    '감사합니다': 'Thank you',
    '이름이 뭐예요': 'What is your name?',
    '안녕': 'Hi',
    '배고파요': "I'm hungry",
    '배고파': "I'm hungry",
    '목말라요': "I'm thirsty",
    '좋아요': 'Good',
    '괜찮아요': "It's okay",
    '알겠습니다': 'I understand',
};

const ENGLISH_TO_KOREAN: Record<string, string> = {
    'hello': '안녕하세요',
    'hi': '안녕',
    'how are you': '잘 지내시나요?',
    'nice to meet you': '반갑습니다',
    'thank you': '감사합니다',
    'what is your name': '이름이 뭐예요?',
    "i'm hungry": '배고파요',
    "im hungry": '배고파요',
    "i'm thirsty": '목말라요',
    'good': '좋아요',
    "it's okay": '괜찮아요',
    'i understand': '알겠습니다',
};

// DeepL Language Codes
const deepLCodeMap: Record<LanguageCode, string> = {
    'ko-KR': 'KO',
    'en-US': 'EN-US',
    'ja-JP': 'JA',
    'zh-CN': 'ZH',
};

/**
 * Translate text using DeepL API
 */
const translateWithDeepL = async (text: string, targetLang: LanguageCode, apiKey: string): Promise<string | null> => {
    try {
        const isFree = apiKey.endsWith(':fx');
        const endpoint = isFree ? '/deepl-free/v2/translate' : '/deepl-pro/v2/translate';

        const targetLangCode = deepLCodeMap[targetLang];

        const params = new URLSearchParams();
        params.append('auth_key', apiKey);
        params.append('text', text);
        params.append('target_lang', targetLangCode);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[DeepL] API Error:', response.status, errorText);
            return null;
        }

        const data = await response.json();
        if (data.translations && data.translations.length > 0) {
            return data.translations[0].text;
        }
        return null;
    } catch (error) {
        console.error('[DeepL] Network/Parsing Error:', error);
        return null;
    }
};

/**
 * Translate text using dictionary first, then DeepL (if key provided), then MyMemory API as fallback
 */
export const translate = async (text: string, targetLang: LanguageCode, apiKey?: string): Promise<string> => {
    if (!text || !text.trim()) return text;

    try {
        // Detect source language (simple heuristic)
        const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);

        let sourceLang = 'en'; // default
        if (hasKorean) sourceLang = 'ko';
        // ... other detections if needed, but MyMemory handles auto-detect well usually.
        // DeepL also handles auto-detect of source.

        const targetLangCode = languageCodeMap[targetLang] || 'en';

        // Try dictionary first for better quality on common phrases
        const normalizedText = text.trim().toLowerCase().replace(/[?.,!]/g, '');

        if (sourceLang === 'ko' && targetLangCode === 'en') {
            // Korean to English
            for (const key in KOREAN_TO_ENGLISH) {
                if (text.includes(key)) {
                    console.log('[Translation] Using dictionary:', key, '→', KOREAN_TO_ENGLISH[key]);
                    return KOREAN_TO_ENGLISH[key];
                }
            }
        } else if (sourceLang === 'en' && targetLangCode === 'ko') {
            // English to Korean
            for (const key in ENGLISH_TO_KOREAN) {
                if (normalizedText.includes(key)) {
                    console.log('[Translation] Using dictionary:', key, '→', ENGLISH_TO_KOREAN[key]);
                    return ENGLISH_TO_KOREAN[key];
                }
            }
        }

        // Try DeepL if API key is present
        if (apiKey) {
            console.log('[Translation] Attempting DeepL...');
            const deepLResult = await translateWithDeepL(text, targetLang, apiKey);
            if (deepLResult) {
                console.log('[Translation] DeepL success:', deepLResult);
                return deepLResult;
            }
            console.warn('[Translation] DeepL failed, falling back to MyMemory...');
        }

        // Call MyMemory API as fallback
        console.log('[Translation] Using MyMemory API for:', text);
        // MyMemory expects 'ko|en' format
        // We need to be careful with source lang detection for MyMemory if we want to be explicit,
        // but usually 'Autodetect' works if we just provide target? 
        // Actually MyMemory requires source|target.
        // Let's use the existing logic for source lang code.

        // Re-using the existing sourceLang logic from previous code (which I removed in this replacement block, so I need to put it back or ensure it's there)
        // Wait, I am replacing the whole function. I need to make sure I have the source detection logic.

        // Let's refine the source detection to match the original robust one
        const hasJapanese = /[ぁ-ゔ|ァ-ヴー|一-龯]/.test(text);
        const hasChinese = /[\u4e00-\u9fff]/.test(text);

        if (hasKorean) sourceLang = 'ko';
        else if (hasJapanese) sourceLang = 'ja';
        else if (hasChinese) sourceLang = 'zh';

        // Skip if source and target are the same
        if (sourceLang === targetLangCode) return text;

        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLangCode}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
            console.log('[Translation] API result:', data.responseData.translatedText);
            return data.responseData.translatedText;
        }

        // Fallback if API fails
        console.warn('[Translation] API failed, returning fallback');
        return `[번역 실패] ${text}`;
    } catch (error) {
        console.error('[Translation] Error:', error);
        return `[번역 오류] ${text}`;
    }
};
