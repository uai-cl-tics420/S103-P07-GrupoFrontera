import { describe, it, expect } from "bun:test";
import { getSimulatedOccupancy } from "./placesService";

describe("getSimulatedOccupancy", () => {
  describe("Heurísticas de Categoría y Hora", () => {
    it("debería retornar Low por defecto", () => {
      expect(getSimulatedOccupancy("Otros", 10, 1)).toBe("Low");
    });

    it("debería retornar ocupación alta para Restaurante en hora de almuerzo en fin de semana", () => {
      // 0 = Domingo, Restaurante a las 13:00
      expect(getSimulatedOccupancy("Restaurante", 13, 0)).toBe("High");
    });

    it("debería retornar ocupación media para Restaurante en hora de almuerzo en día de semana", () => {
      // 1 = Lunes, Restaurante a las 13:00
      expect(getSimulatedOccupancy("Restaurante", 13, 1)).toBe("Medium");
    });
  });

  describe("Ajuste por Comuna", () => {
    it("debería subir la ocupación (heurística) en comunas de alta afluencia", () => {
      // Restaurante a las 13:00 en día de semana es Medium (2)
      // En Las Condes debería subir a High (3)
      expect(getSimulatedOccupancy("Restaurante", 13, 1, null, 0, "Av. Kennedy 5413, Las Condes")).toBe("High");
    });

    it("debería bajar la ocupación (heurística) en comunas de baja afluencia", () => {
      // Restaurante a las 13:00 en día de semana es Medium (2)
      // En Pirque debería bajar a Low (1)
      expect(getSimulatedOccupancy("Restaurante", 13, 1, null, 0, "Ramón Subercaseaux, Pirque")).toBe("Low");
    });

    it("no debería bajar de Low (1) en comunas de baja afluencia", () => {
      // Otros a las 10:00 es Low (1)
      // En Pirque debería mantenerse en Low (1)
      expect(getSimulatedOccupancy("Otros", 10, 1, null, 0, "Pirque")).toBe("Low");
    });

    it("no debería subir de High (3) en comunas de alta afluencia", () => {
      // Restaurante a las 13:00 en fin de semana es High (3)
      // En Providencia debería mantenerse en High (3)
      expect(getSimulatedOccupancy("Restaurante", 13, 0, null, 0, "Providencia")).toBe("High");
    });
  });

  describe("Prioridad de Cupos", () => {
    it("debería priorizar ocupación alta si los cupos están muy solicitados (>70%)", () => {
      // Restaurante en día de semana (Medium = 2) y comuna baja (Pirque = -1 => Low = 1)
      // Pero si se usaron 8 de 10 cupos (80% > 70%), debe retornar High (3)
      expect(getSimulatedOccupancy("Restaurante", 13, 1, 10, 8, "Pirque")).toBe("High");
    });

    it("debería priorizar ocupación media si los cupos están moderadamente solicitados (>30%)", () => {
      // Otros a las 10:00 en día de semana (Low = 1)
      // Con 4 de 10 cupos usados (40% > 30%), debe retornar Medium (2)
      expect(getSimulatedOccupancy("Otros", 10, 1, 10, 4)).toBe("Medium");
    });
  });
});
