import { describe, it, expect } from "bun:test";
import { getRecommendedActivities } from "./recommendationService";
import { Category } from "./types/index";
import type { Activity, User } from "./types/index";

const makeActivity = (id: string, category: Category): Activity => ({
    id,
    name: `Actividad ${id}`,
    category,
    tagClima: "soleado",
    coordinates: { lat: 0, lng: 0 },
});

const makeUser = (preferences: Category[]): User => ({
    id: "test-user",
    name: "Test",
    preferences,
    currentLocation: { lat: 0, lng: 0 },
});

//  Tests 
describe("getRecommendedActivities", () => {
    
    // Tarea 1: Actividades ordenadas por preferencias
    it("pone primero las actividades que coinciden con las preferencias", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
            makeActivity("3", Category.MUSEO),
        ];
        const user = makeUser([Category.PARQUE]);

        const result = getRecommendedActivities(user, activities);
        expect(result[0]!.category).toBe(Category.PARQUE);
    });

    // Tarea 2: Sin preferencias, el orden no cambia
    it("sin preferencias, el orden del array no cambia", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
        ];
        const user = makeUser([]);

        const result = getRecommendedActivities(user, activities);
        expect(result[0]!.id).toBe("1");
        expect(result[1]!.id).toBe("2");
    });

    // Tarea 3: Categorías mezcladas (NUEVO)
    it("funciona correctamente con múltiples categorías preferidas", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
            makeActivity("3", Category.MUSEO),
        ];
        // Al usuario le gusta el Cine Y el Museo
        const user = makeUser([Category.CINE, Category.MUSEO]);

        const result = getRecommendedActivities(user, activities);
        
        // Los dos primeros deberían ser Cine y Museo (en cualquier orden de prioridad)
        const topTwo = result.slice(0, 2).map(a => a.category);
        expect(topTwo).toContain(Category.CINE);
        expect(topTwo).toContain(Category.MUSEO);
        // El último debería ser el que no estaba en preferencias
        expect(result[2]!.category).toBe(Category.PARQUE);
    });

    // Casos de borde extra (Tus originales)
    it("array vacío de actividades retorna array vacío", () => {
        const result = getRecommendedActivities(makeUser([Category.CINE]), []);
        expect(result).toEqual([]);
    });

    it("no muta el array original", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
        ];
        const user = makeUser([Category.PARQUE]);
        getRecommendedActivities(user, activities);
        expect(activities[0]!.id).toBe("1");
    });
});
