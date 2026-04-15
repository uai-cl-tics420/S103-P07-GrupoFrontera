import { useState, useEffect } from 'react';
import { Category } from '../types';

// Clave con la que guardamos en localStorage
const STORAGE_KEY = 'panoramas_categoria_preferida';

/**
 * Hook que persiste la categoría preferida del usuario.
 * - Al arrancar: lee primero desde la DB (/api/preferences). Si no hay nada, usa localStorage.
 * - Al cambiar: guarda en localStorage inmediatamente Y llama PUT /api/preferences (fire-and-forget).
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

    // Al montar, consulta la DB. Si tiene preferencia guardada, la usa.
    useEffect(() => {
        fetch('/api/preferences')
            .then(r => r.json())
            .then((data: { categories: string[] }) => {
                const first = data.categories[0];
                if (first && Object.values(Category).includes(first as Category)) {
                    setPreferredCategory(first as Category);
                }
            })
            .catch(() => {
                // Si la DB no responde, el localStorage ya está activo como fallback.
            });
    }, []);

    // Al cambiar categoría: guarda en localStorage Y envía a la DB en segundo plano.
    useEffect(() => {
        if (preferredCategory === null) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, preferredCategory);
        }

        const categories = preferredCategory ? [preferredCategory] : [];
        fetch('/api/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories }),
        }).catch(() => {
            // Error de red: la preferencia ya quedó en localStorage, no es crítico.
        });
    }, [preferredCategory]);


    return {
        preferredCategory,
        setPreferredCategory,
    };
}
