import { describe, it, expect } from "bun:test";
import { isOutdoorFriendly } from "./weatherHelpers";

describe("isOutdoorFriendly", () => {
    //Tarea 1: Condiciones ideales para exteriores (true)
    it("debería retornar true para condiciones amigables para exteriores", () => {
        expect(isOutdoorFriendly("Clear")).toBe(true);
        expect(isOutdoorFriendly("Clouds")).toBe(true);
    });

    //Tarea 2: Condiciones adversas (false)
    it("debería retornar false para condiciones adversas", () => {
        expect(isOutdoorFriendly("Rain")).toBe(false);
        expect(isOutdoorFriendly("Snow")).toBe(false);
        expect(isOutdoorFriendly("Thunderstorm")).toBe(false);
        expect(isOutdoorFriendly("Drizzle")).toBe(false);
    });

    //Tarea 3: Robustez y casos de borde (mayúsculas, minúsculas y espacios)
    it("debería ser tolerante a variaciones de mayúsculas y espacios", () => {
        expect(isOutdoorFriendly("  CLEAR  ")).toBe(true);
        expect(isOutdoorFriendly("clouds")).toBe(true);
        expect(isOutdoorFriendly("RAIN")).toBe(false);
    });

    //Tarea 3: Robustez y casos de borde (valores inválidos, nulos o vacíos)

    it("debería retornar false como fallback seguro ante condiciones vacías, nulas o desconocidas", () => {
        expect(isOutdoorFriendly("")).toBe(false);
        expect(isOutdoorFriendly(null)).toBe(false);
        expect(isOutdoorFriendly(undefined)).toBe(false);
        expect(isOutdoorFriendly("Tornado")).toBe(false); //Condición no aprobada
    });
});