import React from 'react';
import { X } from 'lucide-react';
import type { Message } from '../types';

interface ChatBubbleProps {
    message: Message;
    isMe: boolean; // "Me" relative to the viewer of this specific bubble list
    onDelete?: (id: string) => void; // 삭제 콜백 함수
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isMe, onDelete }) => {
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

    return (
        <div className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {/* 삭제 버튼 - 내 메시지일 때 왼쪽에 표시 */}
            {isMe && onDelete && (
                <button
                    onClick={handleDelete}
                    className="self-center mr-2 p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-colors opacity-60 hover:opacity-100"
                    title="메시지 삭제"
                >
                    <X size={14} />
                </button>
            )}
            
            <div
                className={`
                    max-w-[80%] rounded-2xl p-4 shadow-md flex flex-col
                    ${isMe
                        ? 'bg-cyan-600 text-white rounded-tr-none'
                        : 'bg-slate-700 text-slate-200 rounded-tl-none'
                    }
                `}
            >
                {/* Primary Text (Viewer's Language) */}
                <p className="text-base font-medium leading-relaxed">
                    {primaryText}
                </p>

                {/* Secondary Text (Other Language) */}
                {secondaryText && (
                    <div className={`text-xs mt-2 pt-2 border-t flex justify-between items-center ${isMe ? 'border-white/20 text-cyan-100' : 'border-slate-500 text-slate-400'}`}>
                        <span>{secondaryText}</span>
                        {message.translationSource && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ml-2 ${message.translationSource === 'DeepL'
                                    ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                                    : 'bg-slate-500/20 text-slate-400'
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
                    className="self-center ml-2 p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-colors opacity-60 hover:opacity-100"
                    title="메시지 삭제"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
};
