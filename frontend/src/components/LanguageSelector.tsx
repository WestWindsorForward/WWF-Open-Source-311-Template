import { useState } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation, SUPPORTED_LANGUAGES } from '../context/TranslationContext';

export default function LanguageSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const { language, setLanguage } = useTranslation();

    const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === language) || SUPPORTED_LANGUAGES[0];

    const changeLanguage = (code: string) => {
        if (code === language) {
            setIsOpen(false);
            return;
        }
        setLanguage(code);
        setIsOpen(false);
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
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Dropdown */}
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-800 border border-white/20 shadow-2xl z-50 py-2"
                        >
                            {SUPPORTED_LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => changeLanguage(lang.code)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${language === lang.code
                                            ? 'bg-primary-500/30 text-white'
                                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <span className="font-medium text-sm">{lang.nativeName}</span>
                                    {lang.nativeName !== lang.name && (
                                        <span className="text-xs text-white/50">({lang.name})</span>
                                    )}
                                    {language === lang.code && (
                                        <Check className="w-4 h-4 text-primary-400 ml-auto" />
                                    )}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
