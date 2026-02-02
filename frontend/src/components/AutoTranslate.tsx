import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from '../context/TranslationContext';

interface AutoTranslateProps {
    children: React.ReactNode;
}

/**
 * AutoTranslate - Wraps content and translates text nodes using React state.
 * 
 * This version uses a MutationObserver to detect text, then translates via
 * the LibreTranslate API and updates React state (no direct DOM mutation).
 */
export function AutoTranslate({ children }: AutoTranslateProps) {
    const { language, translateBatch } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [progress, setProgress] = useState(100);
    const translatedTextsRef = useRef(new Map<string, string>());
    const pendingTranslationRef = useRef<NodeJS.Timeout | null>(null);

    // Collect and translate text nodes
    const translateContent = useCallback(async () => {
        if (!containerRef.current || language === 'en') return;

        // Get all text-containing elements
        const textElements = containerRef.current.querySelectorAll(
            'h1, h2, h3, h4, h5, h6, p, span, button, a, label, td, th, li, option'
        );

        const textsToTranslate: { element: Element; text: string }[] = [];

        textElements.forEach(el => {
            // Skip if has data-no-translate
            if (el.closest('[data-no-translate]')) return;
            // Skip inputs
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;

            // Get direct text content (not nested elements)
            const text = Array.from(el.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent?.trim())
                .filter(Boolean)
                .join(' ')
                .trim();

            if (text && text.length > 1) {
                textsToTranslate.push({ element: el, text });
            }
        });

        if (textsToTranslate.length === 0) return;

        setIsTranslating(true);
        setProgress(0);

        // Get unique texts
        const uniqueTexts = [...new Set(textsToTranslate.map(t => t.text))];

        // Translate in batches
        const batchSize = 50;
        const allTranslations = new Map<string, string>();

        for (let i = 0; i < uniqueTexts.length; i += batchSize) {
            const batch = uniqueTexts.slice(i, i + batchSize);
            const translations = await translateBatch(batch);
            translations.forEach((v, k) => allTranslations.set(k, v));
            setProgress(Math.round(((i + batch.length) / uniqueTexts.length) * 100));
        }

        // Apply translations by updating text nodes
        textsToTranslate.forEach(({ element, text }) => {
            const translated = allTranslations.get(text);
            if (translated && translated !== text) {
                // Find and replace the text node
                Array.from(element.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === text) {
                        node.textContent = translated;
                    }
                });
            }
        });

        setIsTranslating(false);
        setProgress(100);
    }, [language, translateBatch]);

    // Debounced translation trigger
    const scheduleTranslation = useCallback(() => {
        if (pendingTranslationRef.current) {
            clearTimeout(pendingTranslationRef.current);
        }
        pendingTranslationRef.current = setTimeout(() => {
            translateContent();
        }, 500);
    }, [translateContent]);

    // Translate on language change or content mutations
    useEffect(() => {
        if (language === 'en') return;

        scheduleTranslation();

        // Watch for content changes
        const observer = new MutationObserver(() => {
            scheduleTranslation();
        });

        if (containerRef.current) {
            observer.observe(containerRef.current, {
                childList: true,
                subtree: true,
                characterData: false // Avoid translating our own changes
            });
        }

        return () => {
            observer.disconnect();
            if (pendingTranslationRef.current) {
                clearTimeout(pendingTranslationRef.current);
            }
        };
    }, [language, scheduleTranslation]);

    // Get translated status message
    const getStatusMessage = () => {
        const messages: Record<string, { translating: string; done: string }> = {
            es: { translating: 'Traduciendo...', done: 'Traducido automáticamente' },
            zh: { translating: '正在翻译...', done: '自动翻译' },
            fr: { translating: 'Traduction...', done: 'Traduit automatiquement' },
            hi: { translating: 'अनुवाद हो रहा है...', done: 'स्वचालित अनुवाद' },
            ar: { translating: 'جاري الترجمة...', done: 'ترجمة آلية' },
        };
        return messages[language] || { translating: 'Translating...', done: 'Auto-translated' };
    };

    const showBanner = language !== 'en';
    const statusMsg = getStatusMessage();

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
                                    <span>{statusMsg.translating} {progress}%</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                    </svg>
                                    <span>{statusMsg.done}</span>
                                </>
                            )}
                        </div>
                    </div>
                    {/* Progress bar */}
                    {isTranslating && (
                        <div className="h-1 bg-black/20">
                            <div
                                className="h-full bg-white transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </div>
            )}
            {/* Content with top padding for banner */}
            <div ref={containerRef} style={{ display: 'contents' }}>
                {showBanner && <div style={{ height: '44px' }} />}
                {children}
            </div>
        </>
    );
}
