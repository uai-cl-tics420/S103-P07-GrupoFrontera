import { describe, it, expect } from "bun:test";
import { getSimulatedOccupancy } from "./placesService";

describe("getSimulatedOccupancy", () => {
  describe("Heurística por categoría/hora (solo cuando NO hay cupos)", () => {
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

  describe("Cupos reales (prioridad total cuando existen)", () => {
    it("debería retornar High si los cupos de la franja están muy solicitados (>=70%)", () => {
      // 8 de 10 cupos usados en esa franja = 80%
      expect(getSimulatedOccupancy("Restaurante", 13, 1, 0.8)).toBe("High");
    });

    it("debería retornar Medium si los cupos están moderadamente solicitados (>=30%)", () => {
      // 4 de 10 cupos usados en esa franja = 40%
      expect(getSimulatedOccupancy("Otros", 10, 1, 0.4)).toBe("Medium");
    });

    it("debería retornar Low si los cupos de la franja están poco solicitados (<30%)", () => {
      // 1 de 10 cupos usados = 10%, aunque la heurística por hora diría High
      expect(getSimulatedOccupancy("Restaurante", 13, 0, 0.1)).toBe("Low");
    });

    it("debería ignorar la heurística por completo cuando hay un ratio de cupos, sin importar categoría/hora", () => {
      // Restaurante sábado a la hora de almuerzo (heurística diría High), pero el ratio real es bajo
      expect(getSimulatedOccupancy("Restaurante", 13, 6, 0)).toBe("Low");
    });
  });
});
