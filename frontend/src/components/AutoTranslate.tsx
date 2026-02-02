import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from '../context/TranslationContext';

interface AutoTranslateProps {
    children: React.ReactNode;
}

// Supported languages by LibreTranslate
const SUPPORTED_LANGUAGES = ['en', 'es', 'zh', 'fr', 'hi', 'ar'];

// Cache for translations to avoid re-translating the same text
const translationCache = new Map<string, Map<string, string>>();

// Get cache key for language pair
const getCacheKey = (sourceLang: string, targetLang: string) => `${sourceLang}->${targetLang}`;

// Load cache from localStorage
const loadCacheFromStorage = () => {
    try {
        const stored = localStorage.getItem('auto_translate_cache');
        if (stored) {
            const parsed = JSON.parse(stored);
            Object.entries(parsed).forEach(([key, value]) => {
                translationCache.set(key, new Map(Object.entries(value as Record<string, string>)));
            });
        }
    } catch (err) {
        console.error('Failed to load translation cache:', err);
    }
};

// Save cache to localStorage
const saveCacheToStorage = () => {
    try {
        const cacheObj: Record<string, Record<string, string>> = {};
        translationCache.forEach((translations, key) => {
            cacheObj[key] = Object.fromEntries(translations);
        });
        localStorage.setItem('auto_translate_cache', JSON.stringify(cacheObj));
    } catch (err) {
        console.error('Failed to save translation cache:', err);
    }
};

// Get translation from cache
const getCachedTranslation = (text: string, sourceLang: string, targetLang: string): string | null => {
    const key = getCacheKey(sourceLang, targetLang);
    return translationCache.get(key)?.get(text) || null;
};

// Store translation in cache
const setCachedTranslation = (text: string, translation: string, sourceLang: string, targetLang: string) => {
    const key = getCacheKey(sourceLang, targetLang);
    if (!translationCache.has(key)) {
        translationCache.set(key, new Map());
    }
    translationCache.get(key)!.set(text, translation);
};

export function AutoTranslate({ children }: AutoTranslateProps) {
    const { language } = useTranslation();
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationProgress, setTranslationProgress] = useState(100);
    const isProcessingRef = useRef(false);
    const translatedElementsRef = useRef(new WeakSet<Node>());
    const originalValuesRef = useRef(new WeakMap<Node, string>());

    // Load cache on mount
    useEffect(() => {
        loadCacheFromStorage();
    }, []);

    // Check if language is supported
    const isSupported = SUPPORTED_LANGUAGES.includes(language);

    // Translate texts using the batch API
    const translateTexts = useCallback(async (texts: string[], targetLang: string): Promise<Map<string, string>> => {
        if (targetLang === 'en' || texts.length === 0) {
            return new Map(texts.map(t => [t, t]));
        }

        // First check cache
        const uncachedTexts: string[] = [];
        const results = new Map<string, string>();

        texts.forEach(text => {
            const cached = getCachedTranslation(text, 'en', targetLang);
            if (cached) {
                results.set(text, cached);
            } else {
                uncachedTexts.push(text);
            }
        });

        if (uncachedTexts.length === 0) {
            return results;
        }

        try {
            const response = await fetch('/api/system/translate/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texts: uncachedTexts,
                    target_lang: targetLang,
                    source_lang: 'en'
                })
            });

            if (response.ok) {
                const data = await response.json();
                uncachedTexts.forEach((text, idx) => {
                    const translation = data.translations?.[idx] || text;
                    results.set(text, translation);
                    setCachedTranslation(text, translation, 'en', targetLang);
                });
                saveCacheToStorage();
            }
        } catch (err) {
            console.error('Translation failed:', err);
            // Return original texts on error
            uncachedTexts.forEach(text => results.set(text, text));
        }

        return results;
    }, []);

    // Process translations - only translate elements with data-translate attribute
    // This is safer than mutating arbitrary text nodes
    const processTranslation = useCallback(async () => {
        if (isProcessingRef.current || language === 'en' || !isSupported) return;

        isProcessingRef.current = true;
        setIsTranslating(true);
        setTranslationProgress(0);

        try {
            // Find all elements that opt-in to translation with data-translate
            const translatableElements = document.querySelectorAll('[data-translate]');
            const textsToTranslate: string[] = [];
            const elementTextMap = new Map<string, Element[]>();

            translatableElements.forEach(el => {
                const text = el.textContent?.trim();
                if (!text) return;

                // Store original value if not already stored
                if (!originalValuesRef.current.has(el)) {
                    originalValuesRef.current.set(el, text);
                }

                // Skip if already translated
                if (translatedElementsRef.current.has(el)) return;

                const cached = getCachedTranslation(text, 'en', language);
                if (cached) {
                    el.textContent = cached;
                    translatedElementsRef.current.add(el);
                    return;
                }

                if (!elementTextMap.has(text)) {
                    elementTextMap.set(text, []);
                    textsToTranslate.push(text);
                }
                elementTextMap.get(text)!.push(el);
            });

            // Translate in batches
            const batchSize = 50;
            let translatedCount = 0;

            for (let i = 0; i < textsToTranslate.length; i += batchSize) {
                const batch = textsToTranslate.slice(i, i + batchSize);
                const translations = await translateTexts(batch, language);

                translations.forEach((translation, originalText) => {
                    const elements = elementTextMap.get(originalText) || [];
                    elements.forEach(el => {
                        el.textContent = translation;
                        translatedElementsRef.current.add(el);
                    });
                });

                translatedCount += batch.length;
                setTranslationProgress(Math.round((translatedCount / textsToTranslate.length) * 100));
            }
        } catch (err) {
            console.error('Translation processing error:', err);
        } finally {
            isProcessingRef.current = false;
            setIsTranslating(false);
            setTranslationProgress(100);
        }
    }, [language, isSupported, translateTexts]);

    // Reset translations when switching back to English
    useEffect(() => {
        if (language === 'en') {
            // Clear translation state
            translatedElementsRef.current = new WeakSet();
        } else if (isSupported) {
            // Delay to let React finish rendering
            const timer = setTimeout(() => {
                processTranslation();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [language, isSupported, processTranslation]);

    // Get banner message for each language
    const getBannerMessage = (code: string) => {
        const messages: Record<string, string> = {
            es: 'Traducido automáticamente. Las traducciones pueden no ser 100% precisas.',
            zh: '自动翻译。翻译可能不是 100% 准确。',
            hi: 'स्वचालित रूप से अनुवादित। अनुवाद 100% सटीक नहीं हो सकते।',
            fr: 'Traduit automatiquement. Les traductions peuvent ne pas être 100% exactes.',
            ar: 'مترجم تلقائياً. قد لا تكون الترجمات دقيقة 100%.',
        };
        return messages[code] || 'Automatically translated. Translations may not be 100% accurate.';
    };

    // Only show banner for supported non-English languages
    const showBanner = language !== 'en' && isSupported;

    return (
        <>
            {/* Translation banner */}
            {showBanner && (
                <div
                    className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-slate-700/95 to-slate-800/95 text-white/90 shadow-lg backdrop-blur-sm border-b border-white/10"
                    data-no-translate
                >
                    <div className="py-2 px-4 text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                            {isTranslating ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>
                                        {language === 'zh' ? '正在翻译...' :
                                            language === 'es' ? 'Traduciendo...' :
                                                language === 'hi' ? 'अनुवाद किया जा रहा है...' :
                                                    language === 'fr' ? 'Traduction en cours...' :
                                                        language === 'ar' ? 'جاري الترجمة...' :
                                                            'Translating...'} {translationProgress}%
                                    </span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                    </svg>
                                    <span>{getBannerMessage(language)}</span>
                                </>
                            )}
                        </div>
                    </div>
                    {/* Progress bar */}
                    {isTranslating && (
                        <div className="h-1 bg-black/20">
                            <div
                                className="h-full bg-white transition-all duration-300 ease-out"
                                style={{ width: `${translationProgress}%` }}
                            />
                        </div>
                    )}
                </div>
            )}
            {/* Add top padding when banner is shown */}
            <div style={{ display: 'contents' }}>
                {showBanner && <div style={{ height: '40px' }} />}
                {children}
            </div>
        </>
    );
}
