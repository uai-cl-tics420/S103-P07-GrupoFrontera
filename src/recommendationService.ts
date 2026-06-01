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

// Verifica si un panorama está abierto según la hora actual o planificada
function isOpen(openingHour?: string, closingHour?: string, targetTime?: string): boolean {
    if (targetTime === 'any') return true; // Para planificación con "Cualquier hora", consideramos abierto
    if (!openingHour || !closingHour) return true; // Asumimos abierto si no hay hora
    
    let currentMinutes: number;
    if (targetTime) {
        const [tH, tM] = targetTime.split(':').map(Number);
        currentMinutes = tH * 60 + tM;
    } else {
        const now = new Date();
        currentMinutes = now.getHours() * 60 + now.getMinutes();
    }
    
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

// Estima el nivel de precio (0 a 4) para cualquier panorama para calcular afinidades
function estimatePriceLevel(activity: Activity): number {
    if ((activity as any).price_level !== undefined) {
        return (activity as any).price_level;
    }
    
    const nameLower = activity.name.toLowerCase();
    const cat = activity.category;
    
    if (cat === 'Parque') return 0;
    if (cat === 'Miradores') {
        if (nameLower.includes("sky costanera")) return 4;
        return 0; // Cerros gratuitos
    }
    if (cat === 'Museo') {
        const freeMuseums = [
            "bellas artes", "fine arts", "nacional de bellas artes",
            "arte contemporáneo", "contemporary art", "histórico nacional",
            "national history of chile", "museo histórico", "memoria", "memory",
            "human rights", "militar", "military", "natural history",
            "gabriela mistral", "cultural centre", "cultural center",
            "popular", "folk art", "lo matta", "matta cultural"
        ];
        if (freeMuseums.some(m => nameLower.includes(m))) return 0;
        return 2; // Museos de pago estimados en nivel 2
    }
    if (cat === 'Cine') return 2;
    if (cat === 'Teatro') return 2;
    if (cat === 'Restaurante') {
        if (nameLower.includes("bocanáriz") || nameLower.includes("mestizo") || nameLower.includes("rubaiyat")) return 3;
        return 2;
    }
    return 1; // Fallback general
}

export const getRecommendedActivities = (user: User, activities: Activity[], weatherTag?: string, targetTime?: string): Activity[] => {
    const reservedActivityIds = user.history?.reservations || [];
    const favoriteActivityIds = user.history?.favorites || [];
    
    // Contamos interacciones por categoría para afinidad implícita progresiva
    const likedCategoryCounts: Record<string, number> = {};
    activities
        .filter(a => reservedActivityIds.includes(a.id) || favoriteActivityIds.includes(a.id))
        .forEach(a => {
            likedCategoryCounts[a.category] = (likedCategoryCounts[a.category] || 0) + 1;
        });

    // Calculamos el perfil de capacidad adquisitiva promedio del usuario basado en su historial
    const interactedActivities = activities.filter(a => reservedActivityIds.includes(a.id) || favoriteActivityIds.includes(a.id));
    let averagePriceAffinity: number | null = null;
    if (interactedActivities.length > 0) {
        const sumPrices = interactedActivities.reduce((acc, curr) => acc + estimatePriceLevel(curr), 0);
        averagePriceAffinity = sumPrices / interactedActivities.length;
    }

    const scoredActivities = activities.map(activity => {
        let score = 0;

        // 1. Restricción Climática Estricta (Parques y cerros al aire libre quedan fuera si llueve)
        if (weatherTag === 'Rainy') {
            const isOutdoor = activity.category === 'Parque' || (activity.category === 'Miradores' && !activity.name.toLowerCase().includes("sky costanera"));
            if (isOutdoor) {
                score -= 1000; // Penalización extrema
            }
        }

        // 2. Preferencia explícita (lo que marcó en su perfil al registrarse)
        if (user.preferences.includes(activity.category)) score += 20;

        // 3. Afinidades implícitas progresivas (rompe la burbuja de likes planos)
        if (favoriteActivityIds.includes(activity.id)) score += 30; // Directamente es su favorito
        const countInCat = likedCategoryCounts[activity.category] || 0;
        if (countInCat > 0) {
            score += Math.min(15, countInCat * 5); // +5 por el primero, +10 por el segundo, max +15
        }

        // 4. Capacidad Adquisitiva (Afinidad de Precios basada en comportamiento de gasto)
        if (averagePriceAffinity !== null) {
            const price = estimatePriceLevel(activity);
            const diff = Math.abs(price - averagePriceAffinity);
            if (diff <= 0.8) {
                score += 15; // Premiar por cercanía a su rango adquisitivo habitual
            } else if (diff >= 2) {
                score -= 15; // Penalizar si se desvía drásticamente de su rango habitual
            }
        }

        // 5. Penalizar si ya lo tiene reservado actualmente
        if (reservedActivityIds.includes(activity.id)) score -= 15;

        // 6. Distancia Haversine
        const distance = getDistance(
            user.currentLocation.lat, user.currentLocation.lng,
            activity.coordinates.lat, activity.coordinates.lng
        );
        score += Math.max(0, 50 - distance);

        // 7. Horarios
        const currentlyOpen = isOpen(activity.openingHour, activity.closingHour, targetTime);
        if (!currentlyOpen) {
            score -= 100; // Penalización si está cerrado
        }

        // 8. Factor de Serendipia (Descubrimiento y Rotación)
        // Otorga un bono de exploración a panoramas nuevos (no marcados como favoritos ni reservados)
        // para evitar el estancamiento (filtro burbuja) y promover el descubrimiento de lugares altamente compatibles.
        const isNewDiscovery = !favoriteActivityIds.includes(activity.id) && !reservedActivityIds.includes(activity.id);
        if (isNewDiscovery) {
            score += 12;
        }

        return { 
            activity, 
            score, 
            debug: { 
                distance: distance.toFixed(1) + 'km', 
                open: currentlyOpen, 
                estimatedPrice: estimatePriceLevel(activity) 
            } 
        };
    });

    // Ordenar por score descendente
    const sorted = scoredActivities.sort((a, b) => b.score - a.score);

    // DEBUG VISUAL PARA LA CONSOLA: Muestra la puntuación detallada, incluyendo el precio estimado
    if (typeof window !== 'undefined') {
        console.log("=== 🧠 ANÁLISIS DEL MOTOR DE RECOMENDACIONES (PASO 2) ===");
        console.table(sorted.map(s => ({
            Panorama: s.activity.name,
            Categoría: s.activity.category,
            Puntaje_Total: s.score.toFixed(1),
            Precio_Est: s.debug.estimatedPrice,
            Distancia: s.debug.distance,
            Está_Abierto: s.debug.open ? 'Sí ✅' : 'No ❌',
            Es_Favorito: favoriteActivityIds.includes(s.activity.id) ? 'Sí ❤️' : 'No'
        })));
    }

    return sorted.map(scored => scored.activity);
};

