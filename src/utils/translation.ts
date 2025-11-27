import type { LanguageCode } from '../types';

// DeepL Language Codes (target_lang expects two‑letter codes)
const deepLCodeMap: Record<LanguageCode, string> = {
    'ko-KR': 'KO',
    'en-US': 'EN',
    'ja-JP': 'JA',
    'zh-CN': 'ZH',
    'de-DE': 'DE',
};

// translateWithDeepL 함수는 더 이상 사용하지 않음
// 모든 DeepL 호출은 서버리스 함수(api/deepl.ts)를 통해 처리됨

/**
 * Translate text using DeepL API only.
 * API key is managed securely in serverless function (api/deepl.ts).
 * Client does not need to provide API key.
 */
export const translate = async (
    text: string,
    targetLang: LanguageCode,
): Promise<{ text: string; source: 'DeepL' | 'MyMemory' | 'Dictionary' | 'Error' }> => {
    if (!text || !text.trim()) {
        return { text, source: 'Dictionary' };
    }

    try {
        const targetLangCode = deepLCodeMap[targetLang];
        if (!targetLangCode) {
            console.error('[Translation] Unsupported language:', targetLang);
            return { text: `[번역 실패: 지원하지 않는 언어] ${text}`, source: 'Error' };
        }

        // 서버리스 함수를 통해 DeepL API 호출 (API 키는 서버에서만 사용)
        console.log('[Translation] Attempting DeepL via serverless function...');
        
        const isBrowser = typeof window !== 'undefined';
        if (!isBrowser) {
            console.error('[Translation] Serverless function can only be called from browser');
            return { text: `[번역 실패] ${text}`, source: 'Error' };
        }

        const response = await fetch('/api/deepl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                targetLang: targetLangCode,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('[Translation] Serverless function error:', response.status, errorData);
            return { text: `[번역 실패] ${text}`, source: 'Error' };
        }

        const data = await response.json();
        if (data.translations && data.translations.length > 0) {
            console.log('[Translation] DeepL success:', data.translations[0].text);
            return { text: data.translations[0].text, source: 'DeepL' };
        }

        console.error('[Translation] DeepL translation failed - no translations in response');
        return { text: `[번역 실패] ${text}`, source: 'Error' };
    } catch (error) {
        console.error('[Translation] Error:', error);
        return { text: `[번역 오류] ${text}`, source: 'Error' };
    }
};
