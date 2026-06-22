import React, { useEffect, type ReactNode } from 'react';
import TypesafeI18n from './i18n-react';
import { useI18nContext } from './i18n-react';
import { loadAllLocales } from './i18n-util.sync';
import type { Locales } from './i18n-types';

export type Locale = Locales;

const LOCALE_STORAGE_KEY = 'app_locale';

// Carga sincrónica de todos los diccionarios (es/en) al iniciar la app.
loadAllLocales();

function getInitialLocale(): Locale {
    if (typeof window === 'undefined') return 'es';
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
    // Detectar idioma del navegador; fallback a 'es'
    const browserLang = navigator.language?.toLowerCase().slice(0, 2);
    return browserLang === 'en' ? 'en' : 'es';
}

// IMPORTANTE: <TypesafeI18n locale={...}> solo usa esa prop como valor
// INICIAL (primer render). Internamente maneja su propio estado y su propio
// setLocale (expuesto via useI18nContext()), que es el único que realmente
// actualiza LL/traducciones. Por eso este componente vive DENTRO de
// <TypesafeI18n>: necesita leer ese contexto real para sincronizar los
// side-effects (localStorage, <html lang>) cada vez que cambia el locale
// de verdad, en vez de mantener un useState propio desconectado (ese era
// el bug: cambiar de idioma no se reflejaba hasta recargar la página).
function LocaleSideEffects({ children }: { children: ReactNode }) {
    const { locale } = useI18nContext();

    useEffect(() => {
        if (!locale) return;
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        if (typeof document !== 'undefined') {
            document.documentElement.lang = locale;
        }
    }, [locale]);

    return <>{children}</>;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
    return (
        <TypesafeI18n locale={getInitialLocale()}>
            <LocaleSideEffects>{children}</LocaleSideEffects>
        </TypesafeI18n>
    );
}

/**
 * Hook principal de traducciones. Reemplaza al antiguo useT() del diccionario propio:
 * ahora usa typesafe-i18n internamente, expuesto vía LL (LL.miClave()) en vez de t('miClave').
 */
export function useT() {
    const { locale, LL, setLocale } = useI18nContext();
    return { locale, setLocale, LL };
}
