import React from 'react';
import { X } from 'lucide-react';
import type { Message } from '../types';

interface ChatBubbleProps {
    message: Message;
    isMe: boolean; // "Me" relative to the viewer of this specific bubble list
    onDelete?: (id: string) => void; // 삭제 콜백 함수
    isDark?: boolean; // 다크모드 여부
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

    const handleDelete = () => {
        if (onDelete) {
            onDelete(message.id);
        }
    };

    // 삭제 버튼 스타일 - 심플하게 변경
    const deleteButtonClass = `self-center p-1 rounded-full transition-all duration-200 opacity-40 hover:opacity-100 ${
        isDark 
            ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600/50' 
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'
    }`;

    return (
        <div className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {/* 삭제 버튼 - 내 메시지일 때 왼쪽에 표시 */}
            {isMe && onDelete && (
                <button
                    onClick={handleDelete}
                    className={`${deleteButtonClass} mr-1`}
                    title="삭제"
                >
                    <X size={12} />
                </button>
            )}
            
            <div
                className={`
                    max-w-[80%] rounded-2xl p-4 shadow-md flex flex-col
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
                {/* Primary Text (Viewer's Language) */}
                <p className="text-base font-medium leading-relaxed">
                    {primaryText}
                </p>

                {/* Secondary Text (Other Language) */}
                {secondaryText && (
                    <div className={`text-xs mt-2 pt-2 border-t flex justify-between items-center ${
                        isMe 
                            ? 'border-white/20 text-white/70' 
                            : isDark 
                                ? 'border-slate-500 text-slate-400'
                                : 'border-gray-300 text-gray-500'
                    }`}>
                        <span>{secondaryText}</span>
                        {message.translationSource && (
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

            {/* 삭제 버튼 - 상대방 메시지일 때 오른쪽에 표시 */}
            {!isMe && onDelete && (
                <button
                    onClick={handleDelete}
                    className={`${deleteButtonClass} ml-1`}
                    title="삭제"
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
};
