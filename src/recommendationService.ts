import { type Activity, type User } from './types/index';
import { MOCK_ACTIVITIES } from './mockActivities';

/** Función principal: Recibe un User y devuelve las Activity[] ordenadas por sus preferencias */

export const getRecommendedActivities = (user: User): Activity[] => {
    //Hacemos una copia de los mocks para no modificar el archivo original
    return [...MOCK_ACTIVITIES].sort((a,b) => {
        //La categoría de esta actividad está en los gustos del usuario?
        const aEsFavorito = user.preferences.includes(a.category);
        const bEsFavorito = user.preferences.includes(b.category);

        //Si 'a' es preferido y 'b' no, 'a' sube en la lista (-1)
        if (aEsFavorito && !bEsFavorito) return -1;

        //Si 'b' es preferido y 'a' no, 'b' sube en la lista (-1)
        if (!aEsFavorito && bEsFavorito) return 1;

        //Si ambos son iguales, se quedan en su posición actual
        return 0;
    });
};
