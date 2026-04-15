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

describe("getRecommendedActivities", () => {
    it("pone primero las actividades que coinciden con las preferencias", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
            makeActivity("3", Category.MUSEO),
        ];
        const user = makeUser([Category.PARQUE]);

        const result = getRecommendedActivities(user, activities);

        expect(result[0].category).toBe(Category.PARQUE);
    });

    it("sin preferencias, el orden del array no cambia", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
        ];
        const user = makeUser([]);

        const result = getRecommendedActivities(user, activities);

        expect(result[0].id).toBe("1");
        expect(result[1].id).toBe("2");
    });

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

        expect(activities[0].id).toBe("1");
    });
});
