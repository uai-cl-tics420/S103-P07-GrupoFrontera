import { describe, it, expect, mock, spyOn } from "bun:test";
import { getRecommendedActivities } from "./recommendationService";
import { Category } from "./types/index";
import type { Activity, User } from "./types/index";

const makeActivity = (id: string, category: Category, lat: number, lng: number, oH?: string, cH?: string): Activity => ({
    id,
    name: `Actividad ${id}`,
    category,
    tagClima: "Sunny",
    coordinates: { lat, lng },
    openingHour: oH,
    closingHour: cH
});

const makeUser = (preferences: Category[], lat: number, lng: number, favorites: string[] = [], reservations: string[] = []): User => ({
    id: "test-user",
    name: "Test",
    preferences,
    currentLocation: { lat, lng },
    history: { favorites, reservations }
});

describe("getRecommendedActivities (Smart Engine)", () => {
    
    it("pone primero las actividades que coinciden con las preferencias de categoría", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.PARQUE, 0, 0),
            makeActivity("3", Category.MUSEO, 0, 0),
        ];
        const user = makeUser([Category.PARQUE], 0, 0);

        const result = getRecommendedActivities(user, activities);
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
        const dateSpy = spyOn(global, 'Date').mockImplementation(() => new RealDate('2026-05-26T12:00:00Z') as any);
        
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

        const result = getRecommendedActivities(user, activities);
        expect(result[0]!.id).toBe("2");
    });

    it("penaliza las actividades que el usuario ya reservó", () => {
        const activities = [
            makeActivity("1", Category.CINE, 0, 0),
            makeActivity("2", Category.PARQUE, 0, 0),
        ];
        // Ya reservó el cine
        const user = makeUser([], 0, 0, [], ["1"]);

        const result = getRecommendedActivities(user, activities);
        expect(result[0]!.id).toBe("2"); // Recomienda el parque porque el cine ya fue reservado
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
});
