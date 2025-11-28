export type LanguageCode = 'ko-KR' | 'en-US' | 'ja-JP' | 'zh-CN' | 'de-DE';

export interface Language {
    code: LanguageCode;
    name: string;
    flag: string;
}

export interface Message {
    id: string;
    text: string;
    translatedText?: string;
    translationSource?: 'DeepL' | 'MyMemory' | 'Dictionary' | 'Error' | 'pending';
    sender: 'me' | 'partner';
    timestamp: number;
    language: LanguageCode;
}

export const LANGUAGES: Language[] = [
    { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
    { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳' },
    { code: 'de-DE', name: 'German', flag: '🇩🇪' },
];
