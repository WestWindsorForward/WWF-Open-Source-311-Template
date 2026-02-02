import React from 'react';

interface AutoTranslateProps {
    children: React.ReactNode;
}

/**
 * AutoTranslate wrapper - now a pass-through component.
 * 
 * Full-page translation is handled by the Google Translate widget 
 * configured in index.html. This component is kept for backwards 
 * compatibility but simply renders children without modification.
 */
export function AutoTranslate({ children }: AutoTranslateProps) {
    return <>{children}</>;
}
