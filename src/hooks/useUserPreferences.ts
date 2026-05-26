import { useState, useEffect } from 'react';
import { Category } from '../types';

// Clave con la que guardamos en localStorage
const STORAGE_KEY = 'panoramas_categoria_preferida';

/**
 * Hook que persiste la categoría preferida del usuario.
 * - Al arrancar: lee primero desde la DB (/api/preferences). Si no hay nada, usa localStorage.
 * - Al cambiar: guarda en localStorage inmediatamente Y llama PUT /api/preferences (fire-and-forget).
 */
export function useUserPreferences(userId?: string) {
    const [preferredCategory, setPreferredCategory] = useState<Category | null>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && Object.values(Category).includes(saved as Category)) {
            return saved as Category;
        }
        return null;
    });
    const [role, setRole] = useState<'user' | 'admin'>('user');

    // Al montar (y cuando llega el userId), consulta la DB.
    useEffect(() => {
        if (!userId) return;
        fetch(`/api/preferences/${userId}`)
            .then(r => r.json())
            .then((data: { categories: string[]; role?: 'user' | 'admin' }) => {
                const first = data.categories[0];
                if (first && Object.values(Category).includes(first as Category)) {
                    setPreferredCategory(first as Category);
                }
                if (data.role) {
                    setRole(data.role);
                }
            })
            .catch(() => {
                // Si la DB no responde, el localStorage ya está activo como fallback.
            });
    }, [userId]);

    // Al cambiar categoría: guarda en localStorage Y envía a la DB en segundo plano.
    useEffect(() => {
        if (preferredCategory === null) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, preferredCategory);
        }

        if (!userId) return;
        const categories = preferredCategory ? [preferredCategory] : [];
        fetch(`/api/preferences/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories }),
        }).catch(() => {
            // Error de red: la preferencia ya quedó en localStorage, no es crítico.
        });
    }, [preferredCategory, userId]);


    return {
        preferredCategory,
        setPreferredCategory,
        role,
    };
}
