import React from 'react';
import { LANGUAGES } from '../types';
import type { LanguageCode } from '../types';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
    selectedLanguage: LanguageCode;
    onSelectLanguage: (code: LanguageCode) => void;
    label: string;
    isInverted?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    selectedLanguage,
    onSelectLanguage,
    label,
    isInverted = false
}) => {
    return (
        <div className={`flex items-center gap-2 bg-slate-800/50 backdrop-blur-sm p-2 rounded-full border border-slate-700 ${isInverted ? 'flex-row-reverse' : ''}`}>
            <Globe size={16} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            <select
                value={selectedLanguage}
                onChange={(e) => onSelectLanguage(e.target.value as LanguageCode)}
                className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer"
            >
                {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-slate-800 text-white">
                        {lang.flag} {lang.name}
                    </option>
                ))}
            </select>
        </div>
    );
};
