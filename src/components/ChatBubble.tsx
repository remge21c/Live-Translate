import React from 'react';
import type { Message } from '../types';

interface ChatBubbleProps {
    message: Message;
    isMe: boolean; // "Me" relative to the viewer of this specific bubble list
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isMe }) => {
    // Logic:
    // Align Right if I sent it (isMe).
    // Align Left if Partner sent it (!isMe).

    // Content:
    // We want to show both languages, but prioritize the "Viewer's Language".
    // If isMe: My Original (Native) is Primary, Translated (Foreign) is Secondary.
    // If !isMe: Translated (Native) is Primary, Their Original (Foreign) is Secondary.

    const primaryText = isMe ? message.text : message.translatedText;
    const secondaryText = isMe ? message.translatedText : message.text;

    return (
        <div className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
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
                    <p className={`text-xs mt-2 pt-2 border-t ${isMe ? 'border-white/20 text-cyan-100' : 'border-slate-500 text-slate-400'}`}>
                        {secondaryText}
                    </p>
                )}
            </div>
        </div>
    );
};
