import React from 'react';
import type { Message } from '../types';

interface ChatBubbleProps {
    message: Message;
    isMe: boolean; // "Me" relative to the viewer of this specific bubble list
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isMe }) => {
    // Logic:
    // "My Language" (Native) -> Always on the RIGHT.
    // "Partner Language" (Foreign) -> Always on the LEFT.

    // If I sent the message (isMe):
    //   Right: My Original Text
    //   Left: Translated Text
    // If Partner sent the message (!isMe):
    //   Right: Translated Text (My Language)
    //   Left: Their Original Text (Foreign Language)

    const rightText = isMe ? message.text : message.translatedText;
    const leftText = isMe ? message.translatedText : message.text;

    console.log('[ChatBubble]', {
        messageId: message.id,
        sender: message.sender,
        isMe,
        originalText: message.text,
        translatedText: message.translatedText,
        leftText,
        rightText
    });

    return (
        <div className="flex w-full mb-6 items-end gap-4">
            {/* Left Side (Foreign Language) */}
            <div className="flex-1 flex justify-start">
                {leftText && (
                    <div className="bg-slate-700 text-slate-200 rounded-2xl rounded-tl-none p-3 shadow-md max-w-[90%]">
                        <p className="text-sm font-medium leading-relaxed">{leftText}</p>
                    </div>
                )}
            </div>

            {/* Right Side (Native Language) */}
            <div className="flex-1 flex justify-end">
                <div className="bg-cyan-600 text-white rounded-2xl rounded-tr-none p-3 shadow-md max-w-[90%]">
                    <p className="text-sm font-medium leading-relaxed">{rightText}</p>
                </div>
            </div>
        </div>
    );
};
