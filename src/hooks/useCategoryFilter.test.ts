import { describe, it, expect } from "bun:test";
import { filterActivitiesByCategory } from "./useCategoryFilter";
import { Category } from "../types/index";
import type { Activity } from "../types/index";

const makeActivity = (id: string, category: Category): Activity => ({
    id,
    name: `Actividad ${id}`,
    category,
    tagClima: "soleado",
    coordinates: { lat: 0, lng: 0 },
});

// Tests
describe("filterActivitiesByCategory (lógica del hook useCategoryFilter)", () => {

    it("retorna todas las actividades cuando no hay categoría seleccionada", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
            makeActivity("3", Category.MUSEO),
        ];
        const result = filterActivitiesByCategory(activities, null);
        expect(result).toHaveLength(3);
        expect(result).toEqual(activities);
    });

    it("filtra solo las actividades de la categoría seleccionada", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
            makeActivity("3", Category.CINE),
            makeActivity("4", Category.MUSEO),
        ];
        const result = filterActivitiesByCategory(activities, Category.CINE);
        expect(result).toHaveLength(2);
        expect(result.every(a => a.category === Category.CINE)).toBe(true);
    });

    it("retorna array vacío cuando no hay actividades de la categoría seleccionada", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
        ];
        const result = filterActivitiesByCategory(activities, Category.MUSEO);
        expect(result).toEqual([]);
    });

    it("array vacío de actividades retorna array vacío", () => {
        expect(filterActivitiesByCategory([], Category.CINE)).toEqual([]);
        expect(filterActivitiesByCategory([], null)).toEqual([]);
    });

    it("no muta el array original", () => {
        const activities = [
            makeActivity("1", Category.CINE),
            makeActivity("2", Category.PARQUE),
        ];
        const snapshot = activities.map(a => a.id);
        filterActivitiesByCategory(activities, Category.CINE);
        expect(activities.map(a => a.id)).toEqual(snapshot);
    });
});
