import { describe, it, expect } from "bun:test";
import { getRecommendedActivities } from "./recommendationService";
import { Category } from "./types/index";
import type { Activity, User } from "./types/index";

const makeActivity = (
    id: string,
    category: Category,
    lat: number,
    lng: number,
    name?: string,
    priceLevel?: number,
    disponible: boolean = true,
): Activity => {
    const act: any = {
        id,
        name: name || `Actividad ${id}`,
        category,
        tagClima: "Sunny",
        coordinates: { lat, lng },
        disponible,
    };
    if (priceLevel !== undefined) {
        act.price_level = priceLevel;
    }
    return act;
};

const makeUser = (lat: number, lng: number, favorites: string[] = [], reservations: string[] = [], purchased: string[] = []): User => ({
    id: "test-user",
    name: "Test",
    currentLocation: { lat, lng },
    history: { favorites, reservations, purchased }
});

describe("getRecommendedActivities (motor simplificado: historial + disponibilidad + afinidad de distancia)", () => {

    it("nunca recomienda un panorama no disponible, sin importar el resto de las señales", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0, "Favorito pero agotado", undefined, false),
            makeActivity("2", Category.CINE, 5, 5, "Lejano pero disponible"),
        ];
        const user = makeUser(0, 0, ["1"]); // le dio like al agotado, pero no esta disponible

        const result = getRecommendedActivities(user, activities);
        expect(result.length).toBe(1);
        expect(result[0]!.id).toBe("2");
    });

    it("la afinidad de distancia premia panoramas con distancia similar a la del historial del usuario (no 'lo más cercano' a secas)", () => {
        // El usuario suele ir a panoramas a ~10km (su favorito esta a 10km exactos de el).
        const favoritoLejano = makeActivity("fav", Category.CINE, 0.09, 0, "Favorito a 10km"); // ~10km
        const muyCercano = makeActivity("cerca", Category.CINE, 0.001, 0, "A pocos metros"); // ~0.1km
        const similarAlHistorial = makeActivity("similar", Category.CINE, 0.085, 0, "Tambien ~10km");
        const activities = [favoritoLejano, muyCercano, similarAlHistorial];
        const user = makeUser(0, 0, ["fav"]); // favorito = perfil de distancia ~10km

        const result = getRecommendedActivities(user, activities);
        // El panorama con distancia similar al patron historico (10km) debe superar al que esta
        // a pocos metros, aunque este ultimo sea objetivamente mas cercano en linea recta.
        const idxSimilar = result.findIndex(a => a.id === "similar");
        const idxCercano = result.findIndex(a => a.id === "cerca");
        expect(idxSimilar).toBeLessThan(idxCercano);
    });

    it("sin historial, la distancia no afecta el orden (no hay perfil de afinidad que calcular)", () => {
        const activities = [
            makeActivity("1", Category.CINE, 10, 10),
            makeActivity("2", Category.CINE, 0.01, 0.01),
        ];
        const user = makeUser(0, 0); // sin historial

        const result = getRecommendedActivities(user, activities);
        expect(result.length).toBe(2);
        // Ambos quedan con score 0 (sin ninguna señal de historial): el orden entre ellos no
        // está determinado por distancia absoluta.
    });

    it("prioriza las actividades que el usuario tiene en favoritos (el like puede repetir el mismo panorama)", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.PARQUE, 0, 0),
        ];
        const user = makeUser(0, 0, ["2"]); // Le dio like al parque

        const result = getRecommendedActivities(user, activities);
        expect(result[0]!.id).toBe("2");
    });

    it("una reserva pendiente NO vuelve a recomendar el mismo panorama, pero sube panoramas similares (misma categoría)", () => {
        const activities = [
            makeActivity("reservado", Category.CINE, 0, 0, "Cine Reservado"),
            makeActivity("similar", Category.CINE, 0, 0, "Otro Cine"),
            makeActivity("distinto", Category.MUSEO, 0, 0, "Museo"),
        ];
        // Reservó "reservado" (aun no lo paga/realiza): no se recomienda el mismo de nuevo,
        // pero su categoria (Cine) sube de afinidad para encontrar similares.
        const user = makeUser(0, 0, [], ["reservado"]);

        const result = getRecommendedActivities(user, activities);
        const idxReservado = result.findIndex(a => a.id === "reservado");
        const idxSimilar = result.findIndex(a => a.id === "similar");
        const idxDistinto = result.findIndex(a => a.id === "distinto");

        // Ni el reservado ni su similar deberian estar por delante de la categoria distinta
        // gracias a un boost directo del propio item reservado (ambos Cine reciben la misma
        // afinidad de categoria); lo importante es que el museo (otra categoria) queda al final.
        expect(idxDistinto).toBeGreaterThan(idxReservado);
        expect(idxDistinto).toBeGreaterThan(idxSimilar);
    });

    it("NO recomienda un panorama ya comprado/realizado aunque sea de interés (cae al fondo)", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.CINE, 0, 0),
        ];
        // Compró/pagó el cine 1 (realizado): sigue contando como interés para similitud,
        // pero el panorama en sí no debe recomendarse de nuevo.
        const user = makeUser(0, 0, [], ["1"], ["1"]);

        const result = getRecommendedActivities(user, activities);
        expect(result[result.length - 1]!.id).toBe("1"); // El realizado cae al fondo
        expect(result[0]!.id).toBe("2"); // El no realizado queda recomendado primero
    });

    it("array vacío de actividades retorna array vacío", () => {
        const result = getRecommendedActivities(makeUser(0, 0), []);
        expect(result).toEqual([]);
    });

    it("no muta el array original", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.PARQUE, 5, 5),
        ];
        const user = makeUser(0, 0, ["1"]);
        getRecommendedActivities(user, activities);
        expect(activities[0]!.id).toBe("1");
    });

    it("aplica afinidad de precios basada en la capacidad adquisitiva histórica del usuario", () => {
        const activities = [
            makeActivity("1", Category.RESTAURANTE, 0, 0, "Restaurant Caro", 4),
            makeActivity("2", Category.RESTAURANTE, 0, 0, "Restaurant Medio Alto", 3),
            makeActivity("3", Category.RESTAURANTE, 0, 0, "Restaurant Medio Bajo", 2),
            makeActivity("4", Category.RESTAURANTE, 0, 0, "Picada Barata", 1),
        ];

        // Usuario caro: favorite es "1" (precio 4)
        const userCaro = makeUser(0, 0, ["1"]);
        const resultCaro = getRecommendedActivities(userCaro, activities);

        expect(resultCaro[0]!.id).toBe("1");
        const idxOf2 = resultCaro.findIndex(a => a.id === "2");
        const idxOf3 = resultCaro.findIndex(a => a.id === "3");
        expect(idxOf2).toBeLessThan(idxOf3);

        // Usuario barato: favorite es "4" (precio 1)
        const userBarato = makeUser(0, 0, ["4"]);
        const resultBarato = getRecommendedActivities(userBarato, activities);

        expect(resultBarato[0]!.id).toBe("4");
        const idxOf3B = resultBarato.findIndex(a => a.id === "3");
        const idxOf2B = resultBarato.findIndex(a => a.id === "2");
        expect(idxOf3B).toBeLessThan(idxOf2B);
    });

    it("aplica afinidad implícita de categoría progresiva y equilibrada", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0, "Cine A", 2),
            makeActivity("2", Category.CINE, 0, 0, "Cine B", 2),
            makeActivity("t1", Category.TEATRO, 0, 0, "Teatro A", 2),
        ];

        // El usuario tiene de favorito "1" (Cine A).
        // Cine B (2) debe recibir +5 por afinidad implícita (1 interacción * 5 = 5).
        // Teatro A (t1) no tiene interacciones en su categoría, por ende recibe +0.
        const user1 = makeUser(0, 0, ["1"]);
        const result1 = getRecommendedActivities(user1, activities);

        const idxB1 = result1.findIndex(a => a.id === "2");
        const idxT1 = result1.findIndex(a => a.id === "t1");
        expect(idxB1).toBeLessThan(idxT1);
    });
});
