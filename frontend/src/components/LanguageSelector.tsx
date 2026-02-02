import { Globe } from 'lucide-react';

/**
 * Language Selector - Shows browser translation hint
 * 
 * Since frontend translation widgets (Google Translate, GTranslate) 
 * conflict with React's DOM management, we now:
 * - Use LibreTranslate for backend (emails/SMS notifications) 
 * - Suggest browser built-in translation for frontend
 */
export default function LanguageSelector() {
    const handleClick = () => {
        // Show a helpful message about browser translation
        alert(
            "To translate this page:\n\n" +
            "• Chrome: Right-click → Translate to [language]\n" +
            "• Edge: Click the translate icon in the address bar\n" +
            "• Safari: View → Translation → Translate to [language]\n" +
            "• Firefox: Install a translation extension\n\n" +
            "Email and SMS notifications will be sent in your preferred language."
        );
    };

    return (
        <button
            onClick={handleClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 transition-all text-white shadow-lg"
            aria-label="Translation help"
            title="How to translate this page"
        >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">Translate</span>
        </button>
    );
}
