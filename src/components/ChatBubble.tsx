import React from 'react';
import { X } from 'lucide-react';
import type { Message } from '../types';

interface ChatBubbleProps {
    message: Message;
    isMe: boolean; // "Me" relative to the viewer of this specific bubble list
    onDelete?: (id: string) => void;
    isDark?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isMe, onDelete, isDark = true }) => {
    // Logic:
    // Align Right if I sent it (isMe).
    // Align Left if Partner sent it (!isMe).

    // Content:
    // We want to show both languages, but prioritize the "Viewer's Language".
    // If isMe: My Original (Native) is Primary, Translated (Foreign) is Secondary.
    // If !isMe: Translated (Native) is Primary, Their Original (Foreign) is Secondary.

    const primaryText = isMe ? message.text : message.translatedText;
    const secondaryText = isMe ? message.translatedText : message.text;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(message.id);
        }
    };

    return (
        <div className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`
                    max-w-[80%] rounded-2xl p-4 shadow-md flex flex-col relative group
                    ${isMe
                        ? isDark 
                            ? 'bg-cyan-600 text-white rounded-tr-none'
                            : 'bg-blue-500 text-white rounded-tr-none'
                        : isDark
                            ? 'bg-slate-700 text-slate-200 rounded-tl-none'
                            : 'bg-gray-200 text-gray-800 rounded-tl-none'
                    }
                `}
            >
                {/* 삭제 버튼 */}
                {onDelete && (
                    <button
                        onClick={handleDelete}
                        className={`absolute -top-2 -right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
                            isDark 
                                ? 'bg-slate-600 hover:bg-red-500 text-white'
                                : 'bg-gray-300 hover:bg-red-500 text-gray-700 hover:text-white'
                        }`}
                        title="삭제"
                    >
                        <X size={14} />
                    </button>
                )}

                {/* Primary Text (Viewer's Language) */}
                <p className="text-base font-medium leading-relaxed">
                    {primaryText}
                </p>

                {/* Secondary Text (Other Language) */}
                {secondaryText && (
                    <div className={`text-xs mt-2 pt-2 border-t flex justify-between items-center ${
                        isMe 
                            ? 'border-white/20 text-cyan-100' 
                            : isDark 
                                ? 'border-slate-500 text-slate-400'
                                : 'border-gray-300 text-gray-500'
                    }`}>
                        <span>{secondaryText}</span>
                        {message.translationSource && message.translationSource !== 'pending' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ml-2 ${
                                message.translationSource === 'DeepL'
                                    ? isDark
                                        ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                                        : 'bg-blue-100 text-blue-600 border border-blue-200'
                                    : isDark
                                        ? 'bg-slate-500/20 text-slate-400'
                                        : 'bg-gray-100 text-gray-500'
                            }`}>
                                {message.translationSource}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
