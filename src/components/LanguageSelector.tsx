import React from 'react';
import { LANGUAGES } from '../types';
import type { LanguageCode } from '../types';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
    selectedLanguage: LanguageCode;
    onSelectLanguage: (code: LanguageCode) => void;
    label: string;
    isInverted?: boolean;
    isDark?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    selectedLanguage,
    onSelectLanguage,
    label,
    isInverted = false,
    isDark = true
}) => {
    return (
        <div className={`flex items-center gap-2 backdrop-blur-sm p-2 rounded-full border ${
            isDark 
                ? 'bg-slate-800/50 border-slate-700' 
                : 'bg-white/70 border-gray-200'
        } ${isInverted ? 'flex-row-reverse' : ''}`}>
            <Globe size={16} className={isDark ? 'text-slate-400' : 'text-gray-500'} />
            <span className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-gray-500'
            }`}>{label}</span>
            <select
                value={selectedLanguage}
                onChange={(e) => onSelectLanguage(e.target.value as LanguageCode)}
                className={`bg-transparent font-bold text-sm focus:outline-none cursor-pointer ${
                    isDark ? 'text-white' : 'text-gray-800'
                }`}
            >
                {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className={isDark ? 'bg-slate-800 text-white' : 'bg-white text-gray-800'}>
                        {lang.flag} {lang.name}
                    </option>
                ))}
            </select>
        </div>
    );
};
