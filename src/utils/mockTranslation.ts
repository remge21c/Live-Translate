import type { LanguageCode } from '../types';

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

export const mockTranslate = (text: string, targetLang: LanguageCode): string => {
    const normalizedText = text.trim().toLowerCase().replace(/[?.,!]/g, '');

    if (targetLang === 'en-US') {
        // Try exact match
        for (const key in KOREAN_TO_ENGLISH) {
            if (text.includes(key)) return KOREAN_TO_ENGLISH[key];
        }
        return `(Translated) ${text}`;
    } else if (targetLang === 'ko-KR') {
        for (const key in ENGLISH_TO_KOREAN) {
            if (normalizedText.includes(key)) return ENGLISH_TO_KOREAN[key];
        }
        return `(번역됨) ${text}`;
    }

    return text;
};
