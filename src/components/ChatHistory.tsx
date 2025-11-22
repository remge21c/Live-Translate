import React, { useEffect, useRef } from 'react';
import type { Message } from '../types';
import { ChatBubble } from './ChatBubble';

interface ChatHistoryProps {
    messages: Message[];
    viewer: 'me' | 'partner'; // Who is looking at this history?
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ messages, viewer }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex-1 w-full overflow-y-auto px-4 py-2 scrollbar-hide mask-gradient">
            {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} isMe={msg.sender === viewer} />
            ))}
            <div ref={bottomRef} />
        </div>
    );
};
