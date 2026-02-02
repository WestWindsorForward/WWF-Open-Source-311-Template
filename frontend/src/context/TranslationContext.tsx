import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

// Supported languages by LibreTranslate
export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

// Translation cache - persisted to localStorage
const translationCache = new Map<string, string>();

function loadCache() {
    try {
        const stored = localStorage.getItem('translation_cache_v2');
        if (stored) {
            const parsed = JSON.parse(stored);
            Object.entries(parsed).forEach(([key, value]) => {
                translationCache.set(key, value as string);
            });
        }
    } catch (e) { /* ignore */ }
}

function saveCache() {
    try {
        const obj: Record<string, string> = {};
        translationCache.forEach((v, k) => obj[k] = v);
        localStorage.setItem('translation_cache_v2', JSON.stringify(obj));
    } catch (e) { /* ignore */ }
}

loadCache();

// Cache key: text + source + target
function getCacheKey(text: string, targetLang: string): string {
    return `${targetLang}:${text}`;
}

// Context for current language
interface TranslationContextType {
    language: string;
    setLanguage: (lang: string) => void;
    translateText: (text: string) => Promise<string>;
    translateBatch: (texts: string[]) => Promise<Map<string, string>>;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState(() => {
        return localStorage.getItem('preferredLanguage') || 'en';
    });

    const setLanguage = useCallback((lang: string) => {
        setLanguageState(lang);
        localStorage.setItem('preferredLanguage', lang);
    }, []);

    // Translate single text
    const translateText = useCallback(async (text: string): Promise<string> => {
        if (language === 'en' || !text?.trim()) return text;

        const cacheKey = getCacheKey(text, language);
        const cached = translationCache.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch('/api/system/translate/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texts: [text],
                    source_lang: 'en',
                    target_lang: language
                })
            });

            if (response.ok) {
                const data = await response.json();
                const translated = data.translations?.[0] || text;
                translationCache.set(cacheKey, translated);
                saveCache();
                return translated;
            }
        } catch (e) {
            console.error('Translation failed:', e);
        }
        return text;
    }, [language]);

    // Translate batch of texts
    const translateBatch = useCallback(async (texts: string[]): Promise<Map<string, string>> => {
        const results = new Map<string, string>();
        if (language === 'en') {
            texts.forEach(t => results.set(t, t));
            return results;
        }

        // Check cache first
        const uncached: string[] = [];
        texts.forEach(text => {
            const cacheKey = getCacheKey(text, language);
            const cached = translationCache.get(cacheKey);
            if (cached) {
                results.set(text, cached);
            } else if (text?.trim()) {
                uncached.push(text);
            } else {
                results.set(text, text);
            }
        });

        if (uncached.length === 0) return results;

        try {
            const response = await fetch('/api/system/translate/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texts: uncached,
                    source_lang: 'en',
                    target_lang: language
                })
            });

            if (response.ok) {
                const data = await response.json();
                uncached.forEach((text, idx) => {
                    const translated = data.translations?.[idx] || text;
                    results.set(text, translated);
                    translationCache.set(getCacheKey(text, language), translated);
                });
                saveCache();
            } else {
                uncached.forEach(t => results.set(t, t));
            }
        } catch (e) {
            console.error('Batch translation failed:', e);
            uncached.forEach(t => results.set(t, t));
        }

        return results;
    }, [language]);

    return (
        <TranslationContext.Provider value={{ language, setLanguage, translateText, translateBatch }}>
            {children}
        </TranslationContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(TranslationContext);
    if (!context) {
        throw new Error('useTranslation must be used within TranslationProvider');
    }
    return context;
}

/**
 * Hook to translate a single piece of text.
 * Returns the translated text via React state (safe, no DOM manipulation).
 */
export function useTranslatedText(originalText: string): string {
    const { language, translateText } = useTranslation();
    const [translated, setTranslated] = useState(originalText);

    useEffect(() => {
        if (language === 'en') {
            setTranslated(originalText);
            return;
        }

        // Check cache first (sync)
        const cached = translationCache.get(getCacheKey(originalText, language));
        if (cached) {
            setTranslated(cached);
            return;
        }

        // Fetch translation (async)
        let cancelled = false;
        translateText(originalText).then(result => {
            if (!cancelled) setTranslated(result);
        });

        return () => { cancelled = true; };
    }, [originalText, language, translateText]);

    return translated;
}

/**
 * Component that renders translated text.
 * Use this for simple text that needs translation.
 */
export function T({ children }: { children: string }) {
    const translated = useTranslatedText(children);
    return <>{translated}</>;
}
