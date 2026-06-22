import { useState, useEffect } from 'react';
import { Category } from '../types';

/**
 * Hook de estado del usuario.
 *
 * - `role`: se consulta desde la BD (/api/preferences) para distinguir admin/user.
 * - `preferredCategory`: filtro de categoría TRANSITORIO de la sesión actual.
 *   IMPORTANTE: NO es una preferencia persistida. La categoría solo sirve para
 *   filtrar la vista y como señal de "panoramas similares" en el motor.
 *   La preferencia REAL del usuario se infiere de sus likes / reservas / compras,
 *   no de la pestaña de categoría que tenga seleccionada.
 */
export function useUserPreferences(userId?: string) {
    const [preferredCategory, setPreferredCategory] = useState<Category | null>(null);
    const [role, setRole] = useState<'user' | 'admin'>('user');

    // Solo consultamos el ROL del usuario. La categoría no se carga ni se persiste:
    // es un filtro de navegación, no una preferencia.
    useEffect(() => {
        if (!userId) return;
        fetch(`/api/preferences/${userId}`)
            .then(r => r.json())
            .then((data: { role?: 'user' | 'admin' }) => {
                if (data.role) {
                    setRole(data.role);
                }
            })
            .catch(() => {
                // Si la DB no responde, asumimos rol 'user' por defecto.
            });
    }, [userId]);

    return {
        preferredCategory,
        setPreferredCategory,
        role,
    };
}
