import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { translations, type Locale, type TranslationKey } from './translations';

interface LocaleContextValue {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const LOCALE_STORAGE_KEY = 'app_locale';

function getInitialLocale(): Locale {
    if (typeof window === 'undefined') return 'es';
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
    // Detectar idioma del browser; fallback a 'es'
    const browserLang = navigator.language?.toLowerCase().slice(0, 2);
    return browserLang === 'en' ? 'en' : 'es';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

    useEffect(() => {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        if (typeof document !== 'undefined') {
            document.documentElement.lang = locale;
        }
    }, [locale]);

    const setLocale = (l: Locale) => setLocaleState(l);
    const t = (key: TranslationKey): string => translations[key]?.[locale] ?? key;

    return (
        <LocaleContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useT() {
    const ctx = useContext(LocaleContext);
    if (!ctx) {
        throw new Error('useT() debe usarse dentro de <LocaleProvider>');
    }
    return ctx;
}
