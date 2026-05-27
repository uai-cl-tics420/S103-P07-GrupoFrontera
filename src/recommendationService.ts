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

// Verifica si un panorama está abierto según la hora actual
function isOpen(openingHour?: string, closingHour?: string): boolean {
    if (!openingHour || !closingHour) return true; // Asumimos abierto si no hay hora
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [oH, oM] = openingHour.split(':').map(Number);
    const openMinutes = oH * 60 + oM;
    
    const [cH, cM] = closingHour.split(':').map(Number);
    let closeMinutes = cH * 60 + cM;
    if (closeMinutes < openMinutes) closeMinutes += 24 * 60; // Pasa la medianoche
    
    let currentAdj = currentMinutes;
    if (currentAdj < openMinutes && currentAdj < closeMinutes - 24 * 60) {
        currentAdj += 24 * 60;
    }

    return currentAdj >= openMinutes && currentAdj <= closeMinutes;
}

export const getRecommendedActivities = (user: User, activities: Activity[]): Activity[] => {
    // Calculamos el historial de categorías para sacar "afinidad implícita" (Lo que te preguntabas)
    const reservedActivityIds = user.history?.reservations || [];
    const favoriteActivityIds = user.history?.favorites || [];
    
    // Extraemos las categorías de todo lo que el usuario ha comprado o le ha dado "Me gusta"
    const affinityCategories = activities
        .filter(a => reservedActivityIds.includes(a.id) || favoriteActivityIds.includes(a.id))
        .map(a => a.category);

    const scoredActivities = activities.map(activity => {
        let score = 0;

        // 1. Preferencia explícita (lo que marcó en su perfil al registrarse)
        if (user.preferences.includes(activity.category)) score += 20;

        // 2. Afinidades implícitas
        if (favoriteActivityIds.includes(activity.id)) score += 30; // Directamente es su favorito
        if (affinityCategories.includes(activity.category)) score += 15; // ¡RELACIONADO! a algo que ya le gustó o compró

        // 3. Penalizar si ya lo tiene reservado actualmente
        if (reservedActivityIds.includes(activity.id)) score -= 15;

        // 4. Distancia Haversine
        const distance = getDistance(
            user.currentLocation.lat, user.currentLocation.lng,
            activity.coordinates.lat, activity.coordinates.lng
        );
        score += Math.max(0, 50 - distance);

        // 5. Horarios
        const currentlyOpen = isOpen(activity.openingHour, activity.closingHour);
        if (!currentlyOpen) {
            score -= 100; // Penalización si está cerrado
        }

        return { activity, score, debug: { distance: distance.toFixed(1) + 'km', open: currentlyOpen } };
    });

    // Ordenar por score descendente
    const sorted = scoredActivities.sort((a, b) => b.score - a.score);

    // DEBUG VISUAL PARA LA CONSOLA: Para que puedas auditar el motor matemáticamente
    if (typeof window !== 'undefined') {
        console.log("=== 🧠 ANÁLISIS DEL MOTOR DE RECOMENDACIONES ===");
        console.table(sorted.map(s => ({
            Panorama: s.activity.name,
            Categoría: s.activity.category,
            Puntaje_Total: s.score.toFixed(1),
            Distancia: s.debug.distance,
            Está_Abierto: s.debug.open ? 'Sí ✅' : 'No ❌',
            Es_Favorito: favoriteActivityIds.includes(s.activity.id) ? 'Sí ❤️' : 'No'
        })));
    }

    return sorted.map(scored => scored.activity);
};

