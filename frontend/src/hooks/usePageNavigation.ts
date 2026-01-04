import { useCallback, useRef, useEffect } from 'react';

interface UsePageNavigationOptions {
    baseTitle: string;        // e.g., "Staff Portal"
    scrollContainerRef?: React.RefObject<HTMLElement>;  // Container to scroll (or window if not provided)
}

/**
 * Custom hook for URL hashing, dynamic document titles, and scroll-to-top behavior.
 * 
 * Usage:
 * const { updateHash, updateTitle, scrollToTop } = usePageNavigation({ baseTitle: 'Staff Portal' });
 * 
 * // When tab changes:
 * updateHash('statistics');
 * updateTitle('Statistics');
 * scrollToTop();
 * 
 * // When request is selected:
 * updateHash(`request/${requestId}`);
 * updateTitle(`Request ${requestId}`);
 */
export function usePageNavigation({ baseTitle, scrollContainerRef }: UsePageNavigationOptions) {
    const initialLoad = useRef(true);

    // Update URL hash without triggering page reload
    const updateHash = useCallback((hash: string) => {
        if (hash) {
            window.history.replaceState(null, '', `${window.location.pathname}#${hash}`);
        } else {
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, []);

    // Update document title
    const updateTitle = useCallback((subtitle?: string) => {
        if (subtitle) {
            document.title = `${subtitle} | ${baseTitle}`;
        } else {
            document.title = baseTitle;
        }
    }, [baseTitle]);

    // Scroll to top of content area
    const scrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (scrollContainerRef?.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior });
        } else {
            window.scrollTo({ top: 0, behavior });
        }
    }, [scrollContainerRef]);

    // Get current hash
    const getHash = useCallback(() => {
        return window.location.hash.slice(1);  // Remove the # prefix
    }, []);

    // Parse hash into sections (e.g., "request/12345" -> { section: 'request', id: '12345' })
    const parseHash = useCallback(() => {
        const hash = getHash();
        if (!hash) return { section: '', id: '' };

        const parts = hash.split('/');
        return {
            section: parts[0] || '',
            id: parts[1] || '',
            parts
        };
    }, [getHash]);

    // On initial load, set base title
    useEffect(() => {
        if (initialLoad.current) {
            initialLoad.current = false;
            document.title = baseTitle;
        }
    }, [baseTitle]);

    return {
        updateHash,
        updateTitle,
        scrollToTop,
        getHash,
        parseHash,
        currentHash: typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    };
}

export default usePageNavigation;
