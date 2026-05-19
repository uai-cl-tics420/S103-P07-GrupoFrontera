import { useT } from '@/i18n/context';

/**
 * Botón compacto para alternar entre ES y EN.
 * Muestra el código del idioma AL QUE va a cambiar (no el actual).
 */
export function LanguageToggle() {
    const { locale, setLocale } = useT();
    const next = locale === 'es' ? 'en' : 'es';

    return (
        <button
            type="button"
            onClick={() => setLocale(next)}
            className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-gray-900 transition-colors px-2 py-1 rounded border border-gray-200"
            aria-label={`Switch language to ${next === 'es' ? 'Spanish' : 'English'}`}
        >
            {next.toUpperCase()}
        </button>
    );
}
