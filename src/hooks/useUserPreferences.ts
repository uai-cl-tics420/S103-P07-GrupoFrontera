import { useState, useEffect } from 'react';
import { Category } from '../types';

// Clave con la que guardamos en localStorage
const STORAGE_KEY = 'panoramas_categoria_preferida';

/**
 * Hook que persiste la categoría seleccionada por el usuario en localStorage.
 * Así, si el usuario recarga la página, su filtro favorito se mantiene.
 */
export function useUserPreferences() {
    // Inicializamos el estado leyendo directamente desde localStorage.
    // Si no hay nada guardado, arrancamos en null (sin filtro = "Todas").
    const [preferredCategory, setPreferredCategory] = useState<Category | null>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        // Verificamos que lo guardado sea una categoría válida del enum
        if (saved && Object.values(Category).includes(saved as Category)) {
            return saved as Category;
        }
        return null;
    });

    // Cada vez que el usuario cambia de categoría, lo guardamos en localStorage.
    useEffect(() => {
        if (preferredCategory === null) {
            // Si eligió "Todas", limpiamos la preferencia guardada
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, preferredCategory);
        }
    }, [preferredCategory]);

    return {
        preferredCategory,
        setPreferredCategory,
    };
}
