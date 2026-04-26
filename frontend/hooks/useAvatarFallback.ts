import { useState, useCallback, SyntheticEvent } from 'react';

export function useAvatarFallback() {
    const [hasVideoError, setHasVideoError] = useState(false);

    const handleVideoError = useCallback((e: SyntheticEvent<HTMLVideoElement, Event>) => {
        console.warn('[ElderlyApp] Avatar Video failed to load, switching to safe fallback mode.');
        setHasVideoError(true);
    }, []);

    const resetVideoError = useCallback(() => {
        setHasVideoError(false);
    }, []);

    return {
        hasVideoError,
        handleVideoError,
        resetVideoError
    };
}
