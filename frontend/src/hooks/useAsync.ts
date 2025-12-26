import { useState, useCallback } from 'react';

interface UseAsyncState<T> {
    data: T | null;
    error: Error | null;
    isLoading: boolean;
}

export function useAsync<T>() {
    const [state, setState] = useState<UseAsyncState<T>>({
        data: null,
        error: null,
        isLoading: false,
    });

    const execute = useCallback(async (asyncFunction: () => Promise<T>) => {
        setState({ data: null, error: null, isLoading: true });
        try {
            const data = await asyncFunction();
            setState({ data, error: null, isLoading: false });
            return data;
        } catch (error) {
            setState({ data: null, error: error as Error, isLoading: false });
            throw error;
        }
    }, []);

    return { ...state, execute };
}

export function useMobileDetect() {
    const isMobile = window.innerWidth < 768;
    return { isMobile };
}
