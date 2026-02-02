import { useState } from 'react';
import { Globe, Check, ChevronDown, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../context/TranslationContext';

// Languages supported by LibreTranslate (self-hosted, free)
const LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];


export default function LanguageSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { language, setLanguage } = useTranslation();

    const currentLanguage = LANGUAGES.find(lang => lang.code === language) || LANGUAGES.find(l => l.code === 'en')!;

    // Filter languages based on search
    const filteredLanguages = LANGUAGES.filter(lang =>
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const changeLanguage = (code: string) => {
        if (code === language) {
            setIsOpen(false);
            setSearchQuery('');
            return;
        }
        setLanguage(code);
        setIsOpen(false);
        setSearchQuery('');
        // Refresh the page to apply translations cleanly
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    return (
        <div className="relative">
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

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => {
                                setIsOpen(false);
                                setSearchQuery('');
                            }}
                        />

                        {/* Dropdown */}
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-800 border border-white/20 shadow-2xl z-50"
                            style={{
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.3)'
                            }}
                        >
                            {/* Search Header */}
                            <div className="p-3 border-b border-white/10 sticky top-0 bg-slate-800 rounded-t-xl">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                    <input
                                        type="text"
                                        placeholder="Search languages..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="mt-2 text-xs text-white/40">
                                    {filteredLanguages.length} of {LANGUAGES.length} languages
                                </div>
                            </div>

                            {/* Language List */}
                            <div className="max-h-[400px] overflow-y-auto p-2">
                                {filteredLanguages.length === 0 ? (
                                    <div className="text-center py-8 text-white/40 text-sm">
                                        No languages found
                                    </div>
                                ) : (
                                    filteredLanguages.map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => changeLanguage(lang.code)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${language === lang.code
                                                ? 'bg-primary-500/30 text-white border border-primary-400/30'
                                                : 'text-white/80 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">{lang.nativeName}</div>
                                                {lang.nativeName !== lang.name && (
                                                    <div className="text-xs text-white/50 truncate">{lang.name}</div>
                                                )}
                                            </div>
                                            {language === lang.code && (
                                                <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
