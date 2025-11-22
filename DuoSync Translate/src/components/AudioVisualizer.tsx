import React from 'react';

interface AudioVisualizerProps {
    isListening: boolean;
    volume: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isListening, volume }) => {
    if (!isListening) return null;

    return (
        <div className="flex items-center justify-center gap-1 h-12">
            {[...Array(5)].map((_, i) => (
                <div
                    key={i}
                    className="w-2 bg-cyan-400 rounded-full transition-all duration-75"
                    style={{
                        height: `${Math.max(10, (volume * (Math.random() * 1.2 + 0.8)) * 0.7)}px`,
                        opacity: Math.max(0.4, volume / 100),
                    }}
                />
            ))}
        </div>
    );
};
