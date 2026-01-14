import { useState, useEffect } from 'react';
import { useTranslation } from '../context/TranslationContext';

// In-memory cache for translated content
const contentCache = new Map<string, string>();

/**
 * Hook to translate dynamic user-generated content
 * @param originalText The original text to translate
 * @param contentId Unique identifier for caching (e.g., "desc_123" or "comment_456")
 * @returns The translated text or original if in English/failed
 */
export function useContentTranslation(originalText: string, contentId: string) {
    const { language } = useTranslation();
    const [translatedText, setTranslatedText] = useState(originalText);
    const [isTranslating, setIsTranslating] = useState(false);

    useEffect(() => {
        // If English or no text, return original
        if (language === 'en' || !originalText) {
            setTranslatedText(originalText);
            return;
        }

        // Check cache first
        const cacheKey = `${contentId}_${language}`;
        if (contentCache.has(cacheKey)) {
            setTranslatedText(contentCache.get(cacheKey)!);
            return;
        }

        // Translate the content
        const translateContent = async () => {
            setIsTranslating(true);
            try {
                const response = await fetch('/api/system/translate/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        texts: [originalText],
                        target_lang: language
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.translations && data.translations[0]) {
                        const translated = data.translations[0];
                        contentCache.set(cacheKey, translated);
                        setTranslatedText(translated);
                    } else {
                        setTranslatedText(originalText);
                    }
                } else {
                    setTranslatedText(originalText);
                }
            } catch (error) {
                console.error('Failed to translate content:', error);
                setTranslatedText(originalText);
            } finally {
                setIsTranslating(false);
            }
        };

        translateContent();
    }, [originalText, contentId, language]);

    return { translatedText, isTranslating, isTranslated: language !== 'en' && translatedText !== originalText };
}
