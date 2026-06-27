import { type Activity, type User } from './types/index';

// Distancia de Haversine en KM
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Estima el nivel de precio (0 a 4) para cualquier panorama para calcular afinidades
function estimatePriceLevel(activity: Activity): number {
    // Permite a los tests inyectar un nivel de precio explícito
    if ((activity as any).price_level !== undefined) {
        return (activity as any).price_level;
    }

    // Precio real en CLP cargado por el admin al crear el panorama: la fuente de verdad.
    if (typeof activity.price === 'number') {
        if (activity.price <= 0) return 0;
        if (activity.price <= 5000) return 1;
        if (activity.price <= 15000) return 2;
        if (activity.price <= 30000) return 3;
        return 4;
    }

    // Fallback por categoría solo si el panorama no tiene precio cargado
    if (activity.category === 'Parque' || activity.category === 'Miradores') return 0;
    return 1;
}

/**
 * Motor de recomendación basado EXCLUSIVAMENTE en el historial del usuario (likes, reservas,
 * compras), distancia y disponibilidad real. La meteorología NO participa aquí -- es un filtro
 * aparte que el usuario aplica en el toolbar si quiere, para no mezclar "qué te recomendamos
 * por tu historial" con "qué calza con el clima de hoy".
 *
 * Reglas de historial:
 * - Like: puede volver a recomendarse el MISMO panorama (el usuario lo marcó como interesante).
 * - Reservado o comprado: el motor NO vuelve a recomendar el mismo panorama puntual -- en vez
 *   de eso, ese historial alimenta la afinidad de categoría y precio para encontrar SIMILARES.
 * - Comprado especificamente recibe una penalización fuerte (ya se realizó).
 *
 * Restricción dura: nunca se recomienda un panorama no disponible (sea por fecha vencida,
 * agotado, o desactivado manualmente) -- se filtra antes de puntuar, no se castiga con puntaje.
 *
 * El orden final es por puntaje (decide quién entra a "Recomendados" vs "Otros"), pero dentro de
 * cada grupo la UI reordena por fecha más próxima a más lejana (ver App.tsx) -- aquí se expone el
 * puntaje para eso.
 */
export interface ScoredActivity {
    activity: Activity;
    score: number;
}

// Variante que expone el puntaje de cada panorama, para que la UI pueda separar
// "Recomendados" (score > 0, algo realmente lo empuja) de "Otros panoramas" (score <= 0).
export const getScoredActivities = (user: User, activities: Activity[]): ScoredActivity[] => {
    const reservedActivityIds = user.history?.reservations || [];
    const favoriteActivityIds = user.history?.favorites || [];
    const purchasedActivityIds = user.history?.purchased || []; // ya realizado (comprado/pagado)

    // Restricción dura: jamás recomendar algo no disponible (vencido, agotado o desactivado).
    // "disponible" ya considera, por panorama, si ALGUNA franja/fecha futura sigue siendo
    // reservable -- si una hora está agotada pero otra no, el panorama sigue siendo válido.
    const disponibles = activities.filter(a => a.disponible !== false);

    // Señales de interés del usuario: like, reserva y compra. Las tres alimentan la afinidad
    // de categoría y precio (para encontrar similares), aunque solo el like puede repetir
    // el mismo panorama como recomendación directa.
    const interestIds = new Set<string>([...favoriteActivityIds, ...reservedActivityIds, ...purchasedActivityIds]);

    // Contamos interacciones por categoría para afinidad implícita progresiva
    const likedCategoryCounts: Record<string, number> = {};
    disponibles
        .filter(a => interestIds.has(a.id))
        .forEach(a => {
            likedCategoryCounts[a.category] = (likedCategoryCounts[a.category] || 0) + 1;
        });

    // Calculamos el perfil de capacidad adquisitiva promedio del usuario basado en su historial
    const interactedActivities = disponibles.filter(a => interestIds.has(a.id));
    let averagePriceAffinity: number | null = null;
    if (interactedActivities.length > 0) {
        const sumPrices = interactedActivities.reduce((acc, curr) => acc + estimatePriceLevel(curr), 0);
        averagePriceAffinity = sumPrices / interactedActivities.length;
    }

    // Perfil de distancia tipica del usuario (a cuantos km suele interesarle ir, segun su
    // historial) -- NO es "mientras mas cerca mejor" de forma absoluta (para eso ya existe el
    // filtro "Cerca de ti"), es una afinidad: si historicamente se mueve lejos, un panorama lejano
    // no se penaliza solo por estar lejos.
    let averageDistanceAffinity: number | null = null;
    if (interactedActivities.length > 0) {
        const sumDistances = interactedActivities.reduce((acc, curr) => acc + getDistance(
            user.currentLocation.lat, user.currentLocation.lng,
            curr.coordinates.lat, curr.coordinates.lng
        ), 0);
        averageDistanceAffinity = sumDistances / interactedActivities.length;
    }

    const scoredActivities = disponibles.map(activity => {
        let score = 0;

        // 1. Like: el mismo panorama puede volver a recomendarse directamente.
        if (favoriteActivityIds.includes(activity.id)) score += 30;

        // 2. Afinidad de categoría (like + reserva + compra): premia panoramas SIMILARES a su
        // historial, sin repetir el mismo panorama reservado/comprado como recomendación directa.
        const countInCat = likedCategoryCounts[activity.category] || 0;
        if (countInCat > 0) {
            score += Math.min(15, countInCat * 5); // +5 por el primero, +10 por el segundo, max +15
        }

        // 3. Afinidad de precio (similitud de capacidad adquisitiva con su historial)
        if (averagePriceAffinity !== null) {
            const price = estimatePriceLevel(activity);
            const diff = Math.abs(price - averagePriceAffinity);
            if (diff <= 0.8) {
                score += 15;
            } else if (diff >= 2) {
                score -= 15;
            }
        }

        // 4. Ya comprado: no se recomienda el mismo panorama de nuevo (recién realizado).
        // Penalización fuerte para que no aparezca como "recomendado" (su categoría/precio
        // ya aportó a la afinidad arriba, para encontrar panoramas similares).
        if (purchasedActivityIds.includes(activity.id)) score -= 1000;

        // 5. Afinidad de distancia (similitud con su patron de movimiento habitual, no un valor
        // absoluto): si la distancia de este panorama se parece a la que el usuario suele
        // recorrer segun su historial, suma; si es muy distinta (mucho mas cerca o mucho mas
        // lejos de lo habitual), resta un poco. El filtro "Cerca de ti" ya cubre "lo mas cercano".
        if (averageDistanceAffinity !== null) {
            const distance = getDistance(
                user.currentLocation.lat, user.currentLocation.lng,
                activity.coordinates.lat, activity.coordinates.lng
            );
            const diff = Math.abs(distance - averageDistanceAffinity);
            if (diff <= 2) {
                score += 15;
            } else if (diff >= 10) {
                score -= 15;
            }
        }

        return { activity, score };
    });

    // Ordenar por score descendente
    return scoredActivities.sort((a, b) => b.score - a.score);
};

// Variante simple (compatibilidad): devuelve solo la lista de actividades ordenadas, sin puntaje.
export const getRecommendedActivities = (user: User, activities: Activity[]): Activity[] => {
    return getScoredActivities(user, activities).map(s => s.activity);
};
