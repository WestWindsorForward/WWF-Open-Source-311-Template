import { useContentTranslation } from '../hooks/useContentTranslation';

interface TranslatedContentProps {
    text: string;
    contentId: string;
    className?: string;
}

/**
 * Component to display translated user-generated content
 */
export function TranslatedContent({ text, contentId, className = '' }: TranslatedContentProps) {
    const { translatedText, isTranslating } = useContentTranslation(text, contentId);

    if (isTranslating) {
        return (
            <span className={`${className} opacity-50`}>
                {text}
            </span>
        );
    }

    return <span className={className}>{translatedText}</span>;
}
