import { useState, useCallback } from 'react';

export type SceneType = 'none' | 'nav' | 'meds' | 'memory' | 'face' | 'wandering' | 'sundowning';

export interface ScenarioState {
    activeScene: SceneType;
    scenePayload: Record<string, any>;
    isTalking: boolean;
    isListening: boolean;
    isThinking: boolean;
    avatarStatus: 'idle' | 'speaking' | 'listening' | 'error';
    aiMessage: string;
    safeFallbackMode: boolean;
}

export function useElderlyScenarioState() {
    const [state, setState] = useState<ScenarioState>({
        activeScene: 'none',
        scenePayload: {},
        isTalking: false,
        isListening: false,
        isThinking: false,
        avatarStatus: 'idle',
        aiMessage: "张爷爷，我在呢。有什么想聊的吗？",
        safeFallbackMode: false,
    });

    const triggerScene = useCallback((scene: SceneType, payload: Record<string, any> = {}) => {
        setState(prev => ({
            ...prev,
            activeScene: scene,
            scenePayload: payload
        }));
    }, []);

    const closeScene = useCallback(() => {
        setState(prev => ({
            ...prev,
            activeScene: 'none',
            scenePayload: {}
        }));
    }, []);

    const setTalking = useCallback((isTalking: boolean) => {
        setState(prev => ({ ...prev, isTalking, avatarStatus: isTalking ? 'speaking' : prev.isListening ? 'listening' : 'idle' }));
    }, []);

    const setListening = useCallback((isListening: boolean) => {
        setState(prev => ({ ...prev, isListening, avatarStatus: isListening ? 'listening' : prev.isTalking ? 'speaking' : 'idle' }));
    }, []);

    const setThinking = useCallback((isThinking: boolean) => {
        setState(prev => ({ ...prev, isThinking }));
    }, []);

    const setAiMessage = useCallback((message: string) => {
        setState(prev => ({ ...prev, aiMessage: message }));
    }, []);

    const setSafeFallbackMode = useCallback((isSafe: boolean) => {
        setState(prev => ({ ...prev, safeFallbackMode: isSafe }));
    }, []);

    return {
        ...state,
        triggerScene,
        closeScene,
        setTalking,
        setListening,
        setThinking,
        setAiMessage,
        setSafeFallbackMode
    };
}
