import { describe, it, expect, mock, spyOn } from "bun:test";
import { getRecommendedActivities } from "./recommendationService";
import { Category } from "./types/index";
import type { Activity, User } from "./types/index";

const makeActivity = (
    id: string, 
    category: Category, 
    lat: number, 
    lng: number, 
    oH?: string, 
    cH?: string,
    name?: string,
    priceLevel?: number
): Activity => {
    const act = {
        id,
        name: name || `Actividad ${id}`,
        category,
        tagClima: "Sunny",
        coordinates: { lat, lng },
        openingHour: oH,
        closingHour: cH
    };
    if (priceLevel !== undefined) {
        (act as any).price_level = priceLevel;
    }
    return act;
};

const makeUser = (preferences: Category[], lat: number, lng: number, favorites: string[] = [], reservations: string[] = [], purchased: string[] = []): User => ({
    id: "test-user",
    name: "Test",
    preferences,
    currentLocation: { lat, lng },
    history: { favorites, reservations, purchased }
});

describe("getRecommendedActivities (Smart Engine)", () => {
    
    it("pone primero las actividades que coinciden con las preferencias de categoría", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.PARQUE, 0, 0),
            makeActivity("3", Category.MUSEO, 0, 0),
        ];
        const user = makeUser([Category.PARQUE], 0, 0);

        // Hora diurna fija ("14:00") para que la regla de "exterior de noche" no afecte al Parque.
        const result = getRecommendedActivities(user, activities, undefined, "14:00");
        expect(result[0]!.category).toBe(Category.PARQUE);
    });

    it("prioriza actividades cercanas por sobre las lejanas", () => {
        const activities = [
            makeActivity("1", Category.CINE, 10, 10), // Lejos
            makeActivity("2", Category.CINE, 0.01, 0.01), // Cerca
        ];
        const user = makeUser([], 0, 0);

        const result = getRecommendedActivities(user, activities);
        expect(result[0]!.id).toBe("2"); // El más cercano primero
    });

    it("penaliza severamente si la actividad está cerrada actualmente", () => {
        // Mockeamos la hora a las 12:00 de forma segura
        const RealDate = global.Date;
        const dateSpy = spyOn(global as any, 'Date').mockImplementation(() => new RealDate('2026-05-26T12:00:00Z') as any);
        
        const activities = [
            makeActivity("1", Category.CINE, 0, 0, "13:00", "20:00"), // Cerrado (abre a las 13)
            makeActivity("2", Category.CINE, 0, 0, "10:00", "20:00"), // Abierto
        ];
        const user = makeUser([], 0, 0);

        const result = getRecommendedActivities(user, activities);
        expect(result[0]!.id).toBe("2"); // El abierto primero

        dateSpy.mockRestore();
    });

    it("prioriza las actividades que el usuario tiene en favoritos", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.PARQUE, 0, 0),
        ];
        // Le gusta el parque
        const user = makeUser([], 0, 0, ["2"], []);

        // Hora diurna fija ("14:00") para aislar el efecto del favorito de la regla de noche.
        const result = getRecommendedActivities(user, activities, undefined, "14:00");
        expect(result[0]!.id).toBe("2");
    });

    it("trata una reserva (pendiente) como interés: el panorama reservado se recomienda", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.CINE, 0, 0),
        ];
        // Reservó el cine 1 (aún no lo paga/realiza) => es interés, como un like
        const user = makeUser([], 0, 0, [], ["1"]);

        const result = getRecommendedActivities(user, activities);
        expect(result[0]!.id).toBe("1"); // El reservado (interés) queda arriba
    });

    it("NO recomienda un panorama ya comprado/realizado aunque sea de interés (cae al fondo)", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.CINE, 0, 0),
        ];
        // Compró/pagó el cine 1 (realizado): sigue contando como interés para similitud,
        // pero el panorama en sí no debe recomendarse de nuevo.
        const user = makeUser([], 0, 0, [], ["1"], ["1"]);

        const result = getRecommendedActivities(user, activities);
        expect(result[result.length - 1]!.id).toBe("1"); // El realizado cae al fondo
        expect(result[0]!.id).toBe("2"); // El no realizado queda recomendado primero
    });

    it("array vacío de actividades retorna array vacío", () => {
        const result = getRecommendedActivities(makeUser([Category.CINE], 0, 0), []);
        expect(result).toEqual([]);
    });

    it("no muta el array original", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.PARQUE, 0, 0),
        ];
        const user = makeUser([Category.PARQUE], 0, 0);
        getRecommendedActivities(user, activities);
        expect(activities[0]!.id).toBe("1");
    });

    // --- NUEVOS TEST CASES PARA LAS MEJORAS DEL PASO 2 ---

    it("penaliza drásticamente actividades al aire libre (Parques y Miradores) si está lluvioso", () => {
        const activities = [
            makeActivity("1", Category.PARQUE, 0, 0, undefined, undefined, "Parque Araucano"), // Aire libre (Parque)
            makeActivity("2", Category.MIRADORES, 0, 0, undefined, undefined, "Cerro San Cristóbal"), // Aire libre (Mirador)
            makeActivity("3", Category.MIRADORES, 0, 0, undefined, undefined, "Sky Costanera"), // También Mirador: aunque sea techado, sin vista no tiene gracia
            makeActivity("4", Category.CINE, 0, 0), // Interior
        ];
        const user = makeUser([], 0, 0);

        const result = getRecommendedActivities(user, activities, "Rainy");

        // Las tres actividades al aire libre/Miradores (1, 2 y 3) deben tener penalización extrema (-1000)
        // Por ende, "Cine" (4) debe quedar primero en las recomendaciones
        expect(result[0]!.id).toBe("4");

        const penalizedIds = result.slice(1, 4).map(a => a.id);
        expect(penalizedIds).toContain("1");
        expect(penalizedIds).toContain("2");
        expect(penalizedIds).toContain("3");
    });

    it("aplica afinidad de precios basada en la capacidad adquisitiva histórica del usuario", () => {
        const activities = [
            makeActivity("1", Category.RESTAURANTE, 0, 0, undefined, undefined, "Restaurant Caro", 4),
            makeActivity("2", Category.RESTAURANTE, 0, 0, undefined, undefined, "Restaurant Medio Alto", 3),
            makeActivity("3", Category.RESTAURANTE, 0, 0, undefined, undefined, "Restaurant Medio Bajo", 2),
            makeActivity("4", Category.RESTAURANTE, 0, 0, undefined, undefined, "Picada Barata", 1),
        ];

        // Usuario caro: favorite es "1" (precio 4)
        const userCaro = makeUser([], 0, 0, ["1"]);
        const resultCaro = getRecommendedActivities(userCaro, activities);
        
        // "1" (favorito + afinidad de precio) debe estar primero
        expect(resultCaro[0]!.id).toBe("1");
        // "2" (diff 1 -> sin penalidad) debe estar antes de "3" (diff 2 -> penalidad -15)
        const idxOf2 = resultCaro.findIndex(a => a.id === "2");
        const idxOf3 = resultCaro.findIndex(a => a.id === "3");
        expect(idxOf2).toBeLessThan(idxOf3);

        // Usuario barato: favorite es "4" (precio 1)
        const userBarato = makeUser([], 0, 0, ["4"]);
        const resultBarato = getRecommendedActivities(userBarato, activities);

        // "4" (favorito + afinidad de precio) debe estar primero
        expect(resultBarato[0]!.id).toBe("4");
        // "3" (diff 1 -> sin penalidad) debe estar antes de "2" (diff 2 -> penalidad -15)
        const idxOf3B = resultBarato.findIndex(a => a.id === "3");
        const idxOf2B = resultBarato.findIndex(a => a.id === "2");
        expect(idxOf3B).toBeLessThan(idxOf2B);
    });

    it("aplica afinidad implícita de categoría progresiva y equilibrada", () => {
        // Creamos actividades de Cine y Teatro, todos con el mismo price_level para aislar afinidad implícita
        const activities = [
            makeActivity("1", Category.CINE, 0, 0, undefined, undefined, "Cine A", 2),
            makeActivity("2", Category.CINE, 0, 0, undefined, undefined, "Cine B", 2),
            makeActivity("t1", Category.TEATRO, 0, 0, undefined, undefined, "Teatro A", 2),
        ];

        // El usuario tiene de favorito "1" (Cine A).
        // Cine B (2) debe recibir +5 por afinidad implícita (1 interacción * 5 = 5).
        // Teatro A (t1) no tiene interacciones en su categoría, por ende recibe +0.
        // Como ambos tienen la misma distancia y afinidad de precios, Cine B debe quedar sobre Teatro A.
        const user1 = makeUser([], 0, 0, ["1"]);
        const result1 = getRecommendedActivities(user1, activities);
        
        const idxB1 = result1.findIndex(a => a.id === "2");
        const idxT1 = result1.findIndex(a => a.id === "t1");
        expect(idxB1).toBeLessThan(idxT1);
    });

    it("permite verificar apertura de actividades para un horario futuro planificado", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0, "18:00", "23:00"), // Abierto tarde (18 a 23)
            makeActivity("2", Category.CINE, 0, 0, "10:00", "15:00"), // Abierto temprano (10 a 15)
        ];
        const user = makeUser([], 0, 0);

        // Si planificamos para las 20:00, la actividad 1 debe estar primero
        const resultTarde = getRecommendedActivities(user, activities, undefined, "20:00");
        expect(resultTarde[0]!.id).toBe("1");

        // Si planificamos para las 11:00, la actividad 2 debe estar primero
        const resultTemprano = getRecommendedActivities(user, activities, undefined, "11:00");
        expect(resultTemprano[0]!.id).toBe("2");
    });

    it("considera abiertas todas las actividades si targetTime es 'any' (Cualquier hora)", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0, "18:00", "23:00"),
            makeActivity("2", Category.CINE, 0, 0, "10:00", "15:00"),
        ];
        const user = makeUser([], 0, 0);

        // Si targetTime es 'any', ninguna actividad debe penalizarse por estar cerrada
        const resultAny = getRecommendedActivities(user, activities, undefined, "any");
        expect(resultAny.length).toBe(2);
    });

    it("aplica un factor de serendipia (bono de descubrimiento) a actividades no marcadas como favoritas", () => {
        const activities = [
            makeActivity("1", Category.CINE, 2, 2), // Muy lejos, favorito
            makeActivity("2", Category.CINE, 0, 0), // Cerca, descubrimiento
        ];
        const user = makeUser([], 0, 0, ["1"]);

        // Con el bono de descubrimiento, la actividad más cercana/compatible puede ganar terreno frente a favoritos lejanos
        const result = getRecommendedActivities(user, activities);
        expect(result[0]!.id).toBe("2"); // El descubrimiento más cercano y compatible pasa al puesto 1
    });

    // --- NUEVOS TEST CASES: REGLAS HORARIAS DEL MOTOR HÍBRIDO (#61) ---

    it("reachability: penaliza un evento de hora fija si no alcanzas a llegar a tiempo", () => {
        // Dos cines con la misma función corta (20:00-22:00 = ventana de 2h => evento de hora fija)
        const activities = [
            makeActivity("near", Category.CINE, 0, 0, "20:00", "22:00", "Cine Cercano"),
            makeActivity("far", Category.CINE, 0.5, 0.5, "20:00", "22:00", "Cine Lejano"), // ~78km => ETA enorme
        ];
        const user = makeUser([], 0, 0);

        // Objetivo 20:00: el cercano llega a tiempo (ETA~0), el lejano llega cuando ya empezó.
        const result = getRecommendedActivities(user, activities, undefined, "20:00");
        expect(result[0]!.id).toBe("near");
        expect(result[result.length - 1]!.id).toBe("far");
    });

    it("reachability: en entrada libre penaliza si llegas sin tiempo útil antes del cierre", () => {
        // Dos museos a la misma distancia (ventana larga => entrada libre); uno cierra pronto.
        const activities = [
            makeActivity("amplio", Category.MUSEO, 0, 0, "09:00", "23:00", "Museo Amplio"),
            makeActivity("cerrando", Category.MUSEO, 0, 0, "09:00", "18:00", "Museo Cerrando"),
        ];
        const user = makeUser([], 0, 0);

        // A las 17:45, llegar al que cierra 18:00 deja < 30 min de disfrute => penalizado.
        const result = getRecommendedActivities(user, activities, undefined, "17:45");
        expect(result[0]!.id).toBe("amplio");
    });

    it("noche: penaliza panoramas al aire libre entre las 20:00 y las 07:00", () => {
        const activities = [
            makeActivity("parque", Category.PARQUE, 0, 0, undefined, undefined, "Parque Nocturno"),
            makeActivity("museo", Category.MUSEO, 0, 0, undefined, undefined, "Museo Nocturno"),
        ];
        const user = makeUser([], 0, 0);

        // A las 22:00, el Parque (exterior) baja y el Museo (interior) queda primero.
        const result = getRecommendedActivities(user, activities, undefined, "22:00");
        expect(result[0]!.category).toBe(Category.MUSEO);
        expect(result[result.length - 1]!.category).toBe(Category.PARQUE);
    });

    it("noche: con targetTime 'any' NO se aplica la penalización de exterior", () => {
        const activities = [
            makeActivity("parque", Category.PARQUE, 0, 0, undefined, undefined, "Parque Libre"),
            makeActivity("museo", Category.MUSEO, 0, 0, undefined, undefined, "Museo Libre"),
        ];
        // El usuario prefiere Parque: sin penalización de noche, debe quedar primero.
        const user = makeUser([Category.PARQUE], 0, 0);

        const result = getRecommendedActivities(user, activities, undefined, "any");
        expect(result[0]!.category).toBe(Category.PARQUE);
    });
});
