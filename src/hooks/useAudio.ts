import { useState, useEffect, useRef } from 'react';

export const useAudio = (isListening: boolean) => {
    const [volume, setVolume] = useState(0);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isListening) {
            // Cleanup when not listening
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            setVolume(0);
            console.log('[useAudio] Stopped listening, cleaned up resources');
            return;
        }

        console.log('[useAudio] Starting simulated volume visualization...');

        // Simulate volume changes with random animation
        // This avoids microphone access conflicts with Speech Recognition API
        const simulate = () => {
            // Generate realistic-looking volume variations with larger range
            const baseVolume = 50; // Base level (increased from 30)
            const variation = Math.random() * 60; // Random variation (increased from 40)
            const pulse = Math.sin(Date.now() / 200) * 25; // Smooth pulse (increased from 15)

            const simulatedVolume = baseVolume + variation + pulse;
            setVolume(Math.max(0, Math.min(100, simulatedVolume)));

            animationFrameRef.current = requestAnimationFrame(simulate);
        };

        simulate();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isListening]);

    return { volume };
};
