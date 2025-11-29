import React from 'react';
import { X } from 'lucide-react';
import type { Message } from '../types';

interface ChatBubbleProps {
    message: Message;
    isMe: boolean; // "Me" relative to the viewer of this specific bubble list
    onDelete?: (id: string) => void;
    isDark?: boolean;
    alignLeft?: boolean; // 강제로 왼쪽 정렬 (가로모드 왼쪽 패널용)
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isMe, onDelete, isDark = true, alignLeft }) => {
    // Logic:
    // Align Right if I sent it (isMe).
    // Align Left if Partner sent it (!isMe).
    // But if alignLeft is explicitly set, use that for alignment

    // Content:
    // We want to show both languages, but prioritize the "Viewer's Language".
    // If isMe: My Original (Native) is Primary, Translated (Foreign) is Secondary.
    // If !isMe: Translated (Native) is Primary, Their Original (Foreign) is Secondary.

    const primaryText = isMe ? message.text : message.translatedText;
    const secondaryText = isMe ? message.translatedText : message.text;

    // 정렬 결정: alignLeft가 명시되면 그것을 사용, 아니면 isMe 기준
    const shouldAlignLeft = alignLeft !== undefined ? alignLeft : !isMe;
    const shouldAlignRight = !shouldAlignLeft;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(message.id);
        }
    };

    return (
        <div className={`flex w-full mb-4 ${shouldAlignRight ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`
                    max-w-[80%] rounded-2xl p-4 shadow-md flex flex-col relative group
                    ${isMe
                        ? isDark 
                            ? 'bg-cyan-600 text-white'
                            : 'bg-blue-500 text-white'
                        : isDark
                            ? 'bg-slate-700 text-slate-200'
                            : 'bg-gray-200 text-gray-800'
                    }
                    ${shouldAlignRight ? 'rounded-tr-none' : 'rounded-tl-none'}
                `}
            >
                {/* 삭제 버튼 - 항상 왼쪽에 배치, 은은한 스타일 */}
                {onDelete && (
                    <button
                        onClick={handleDelete}
                        className={`absolute -top-1.5 -left-1.5 p-1 rounded-full transition-all duration-200 opacity-40 hover:opacity-100 active:opacity-100 ${
                            isDark 
                                ? 'bg-slate-500/80 hover:bg-red-500 active:bg-red-600 text-slate-300 hover:text-white'
                                : 'bg-gray-400/60 hover:bg-red-500 active:bg-red-600 text-gray-500 hover:text-white'
                        }`}
                        title="삭제"
                    >
                        <X size={12} />
                    </button>
                )}

                {/* Primary Text (Viewer's Language) */}
                <p className="text-base font-medium leading-relaxed">
                    {primaryText}
                </p>

                {/* Secondary Text (Other Language) */}
                {secondaryText && (
                    <div className={`text-xs mt-2 pt-2 border-t ${
                        isMe 
                            ? 'border-white/20 text-cyan-100' 
                            : isDark 
                                ? 'border-slate-500 text-slate-400'
                                : 'border-gray-300 text-gray-500'
                    }`}>
                        <span>{secondaryText}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
