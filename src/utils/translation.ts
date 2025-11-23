import type { LanguageCode } from '../types';

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
 * Translate text using DeepL API only.
 * DeepL API key is read from environment variable VITE_DEEPL_API_KEY if not provided as parameter.
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
        // DeepL API 키 확인 - 환경 변수에서 읽기 (파라미터가 없을 경우)
        const deepLApiKey = apiKey || import.meta.env.VITE_DEEPL_API_KEY || '';
        console.log('[Translation] DeepL API Key check:', {
            provided: !!apiKey,
            fromEnv: !!import.meta.env.VITE_DEEPL_API_KEY,
            envValue: import.meta.env.VITE_DEEPL_API_KEY ? '***' + import.meta.env.VITE_DEEPL_API_KEY.slice(-4) : 'not found',
            finalKey: deepLApiKey ? '***' + deepLApiKey.slice(-4) : 'not found'
        });

        if (!deepLApiKey) {
            console.error('[Translation] DeepL API Key not found. Check .env file and restart dev server.');
            return { text: `[번역 실패: API 키 없음] ${text}`, source: 'Error' };
        }

        // DeepL API 사용
        console.log('[Translation] Attempting DeepL...');
        const deepLResult = await translateWithDeepL(text, targetLang, deepLApiKey);
        
        if (deepLResult) {
            console.log('[Translation] DeepL success:', deepLResult);
            return { text: deepLResult, source: 'DeepL' };
        }

        // DeepL 실패 시 에러 반환
        console.error('[Translation] DeepL translation failed');
        return { text: `[번역 실패] ${text}`, source: 'Error' };
    } catch (error) {
        console.error('[Translation] Error:', error);
        return { text: `[번역 오류] ${text}`, source: 'Error' };
    }
};
