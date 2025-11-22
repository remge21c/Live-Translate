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
    hello: '안녕하세요',
    hi: '안녕',
    'how are you': '잘 지내시나요?',
    'nice to meet you': '반갑습니다',
    'thank you': '감사합니다',
    'what is your name': '이름이 뭐예요?',
    "i'm hungry": '배고파요',
    "im hungry": '배고파요',
    "i'm thirsty": '목말라요',
    good: '좋아요',
    "it's okay": '괜찮아요',
    'i understand': '알겠습니다',
};

// DeepL Language Codes (target_lang expects two‑letter codes)
const deepLCodeMap: Record<LanguageCode, string> = {
    'ko-KR': 'KO',
    'en-US': 'EN',
    'ja-JP': 'JA',
    'zh-CN': 'ZH',
};

/**
 * Translate text using DeepL API.
 * Supports both free (ends with :fx) and paid tiers.
 */
const translateWithDeepL = async (
    text: string,
    targetLang: LanguageCode,
    apiKey: string,
): Promise<string | null> => {
    try {
        const targetLangCode = deepLCodeMap[targetLang];
        if (!targetLangCode) {
            console.error('[DeepL] 지원하지 않는 언어 코드입니다:', targetLang);
            return null;
        }

        const isFree = apiKey.endsWith(':fx');
        const params = new URLSearchParams();
        params.append('auth_key', apiKey);
        params.append('text', text);
        params.append('target_lang', targetLangCode);

        const isBrowser = typeof window !== 'undefined';
        const isViteDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

        // 로컬 개발 환경에서는 Vite 프록시를 통해 직접 DeepL 호출
        if (isBrowser && isViteDev) {
            const endpoint = isFree
                ? '/deepl-free/v2/translate'
                : '/deepl-pro/v2/translate';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[DeepL][DEV] API Error:', response.status, errorText);
                return null;
            }

            const data = await response.json();
            if (data.translations && data.translations.length > 0) {
                return data.translations[0].text;
            }
            return null;
        }

        // 프로덕션 브라우저 환경에서는 Vercel 서버리스 함수를 경유
        if (isBrowser) {
            const response = await fetch('/api/deepl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    targetLang: targetLangCode,
                    apiKey,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[DeepL][API Route] Error:', response.status, errorText);
                return null;
            }

            const data = await response.json();
            if (data.translations && data.translations.length > 0) {
                return data.translations[0].text;
            }
            return null;
        }

        // Node 테스트나 스크립트 환경에서는 DeepL 엔드포인트를 직접 호출
        const endpoint = isFree
            ? 'https://api-free.deepl.com/v2/translate'
            : 'https://api.deepl.com/v2/translate';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[DeepL][Node] API Error:', response.status, errorText);
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
 * Translate text using dictionary first, then DeepL (if a key is provided), then MyMemory API as fallback.
 */
export const translate = async (
    text: string,
    targetLang: LanguageCode,
    apiKey?: string,
): Promise<{ text: string; source: 'DeepL' | 'MyMemory' | 'Dictionary' | 'Error' }> => {
    if (!text || !text.trim()) {
        return { text, source: 'Dictionary' };
    }

    try {
        // Simple source‑language detection
        const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
        let sourceLang = hasKorean ? 'ko' : 'en';

        const targetLangCode = languageCodeMap[targetLang] || 'en';
        const normalizedText = text.trim().toLowerCase().replace(/[?.,!]/g, '');

        // Dictionary shortcuts
        if (sourceLang === 'ko' && targetLangCode === 'en') {
            for (const key in KOREAN_TO_ENGLISH) {
                if (text.includes(key)) {
                    console.log('[Translation] Using dictionary:', key, '→', KOREAN_TO_ENGLISH[key]);
                    return { text: KOREAN_TO_ENGLISH[key], source: 'Dictionary' };
                }
            }
        } else if (sourceLang === 'en' && targetLangCode === 'ko') {
            for (const key in ENGLISH_TO_KOREAN) {
                if (normalizedText.includes(key)) {
                    console.log('[Translation] Using dictionary:', key, '→', ENGLISH_TO_KOREAN[key]);
                    return { text: ENGLISH_TO_KOREAN[key], source: 'Dictionary' };
                }
            }
        }

        // DeepL attempt
        if (apiKey) {
            console.log('[Translation] Attempting DeepL...');
            const deepLResult = await translateWithDeepL(text, targetLang, apiKey);
            if (deepLResult) {
                console.log('[Translation] DeepL success:', deepLResult);
                return { text: deepLResult, source: 'DeepL' };
            }
            console.warn('[Translation] DeepL failed, falling back to MyMemory...');
        }

        // MyMemory fallback
        console.log('[Translation] Using MyMemory API for:', text);
        const hasJapanese = /[ぁ-ゔ|ァ-ヴー|一-龯]/.test(text);
        const hasChinese = /[\u4e00-\u9fff]/.test(text);
        if (hasKorean) sourceLang = 'ko';
        else if (hasJapanese) sourceLang = 'ja';
        else if (hasChinese) sourceLang = 'zh';

        if (sourceLang === targetLangCode) {
            return { text, source: 'Dictionary' };
        }

        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
            text,
        )}&langpair=${sourceLang}|${targetLangCode}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
            console.log('[Translation] API result:', data.responseData.translatedText);
            return { text: data.responseData.translatedText, source: 'MyMemory' };
        }
        console.warn('[Translation] API failed, returning fallback');
        return { text: `[번역 실패] ${text}`, source: 'Error' };
    } catch (error) {
        console.error('[Translation] Error:', error);
        return { text: `[번역 오류] ${text}`, source: 'Error' };
    }
};
