import { useEffect, useState } from 'react';
import { Globe, ChevronDown } from 'lucide-react';

// Languages supported (matching Google Translate widget config)
const LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English', googleCode: 'en' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', googleCode: 'es' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', googleCode: 'zh-CN' },
    { code: 'fr', name: 'French', nativeName: 'Français', googleCode: 'fr' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', googleCode: 'hi' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', googleCode: 'ar' },
];

// Trigger Google Translate language change
function triggerGoogleTranslate(langCode: string) {
    // Find the Google Translate combo box
    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (combo) {
        combo.value = langCode;
        combo.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Get current Google Translate language
function getCurrentGoogleLanguage(): string {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'googtrans') {
            // Cookie format: /en/es or /auto/es
            const match = value.match(/\/([a-z-]+)$/i);
            if (match) return match[1];
        }
    }
    return 'en';
}

export default function LanguageSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentLang, setCurrentLang] = useState('en');

    // Check current language on mount
    useEffect(() => {
        const checkLanguage = () => {
            const lang = getCurrentGoogleLanguage();
            const mapped = LANGUAGES.find(l => l.googleCode === lang || l.code === lang);
            if (mapped) {
                setCurrentLang(mapped.code);
            }
        };

        // Check immediately and periodically
        checkLanguage();
        const interval = setInterval(checkLanguage, 1000);
        return () => clearInterval(interval);
    }, []);

    const currentLanguage = LANGUAGES.find(lang => lang.code === currentLang) || LANGUAGES[0];

    const changeLanguage = (code: string) => {
        const lang = LANGUAGES.find(l => l.code === code);
        if (!lang) return;

        if (code === 'en') {
            // Reset to English - clear the cookie and reload
            document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
            window.location.reload();
        } else {
            // Trigger Google Translate
            triggerGoogleTranslate(lang.googleCode);
            setCurrentLang(code);
        }

        setIsOpen(false);
    };

    return (
        <div className="relative">
            {/* Hidden Google Translate element */}
            <div id="google_translate_element" className="hidden"></div>

            {/* Custom styled selector */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 transition-all text-white shadow-lg"
                aria-label="Select language"
            >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">{currentLanguage.nativeName}</span>
                <span className="sm:hidden text-sm">{currentLanguage.code.toUpperCase()}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-800 border border-white/20 shadow-2xl z-50 py-2">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => changeLanguage(lang.code)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${currentLang === lang.code
                                        ? 'bg-primary-500/30 text-white'
                                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <span className="font-medium text-sm">{lang.nativeName}</span>
                                {lang.nativeName !== lang.name && (
                                    <span className="text-xs text-white/50">({lang.name})</span>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
