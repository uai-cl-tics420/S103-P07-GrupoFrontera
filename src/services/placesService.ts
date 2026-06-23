/**
 * Calcula el nivel de ocupación (afluencia) basándose en una combinación de
 * cupos reales reservados y una heurística de demanda por categoría y hora.
 */
export function getSimulatedOccupancy(
  category?: string,
  hour?: number,
  dayOfWeek?: number,
  cuposPorDia?: number | null,
  cuposUsados?: number
): "Low" | "Medium" | "High" {
  // 1. Componente real basado en cupos
  let levelCupos = 1; // 1 = Low, 2 = Medium, 3 = High
  if (cuposPorDia && cuposPorDia > 0) {
    const ratio = (cuposUsados ?? 0) / cuposPorDia;
    if (ratio >= 0.7) {
      levelCupos = 3;
    } else if (ratio >= 0.3) {
      levelCupos = 2;
    }
  }

  // 2. Componente heurístico simulado basado en categoría + hora + día
  const cat = category || 'Otros';
  const h = hour !== undefined ? hour : new Date().getHours();
  const day = dayOfWeek !== undefined ? dayOfWeek : new Date().getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 5 || day === 6; // Vie, Sab, Dom

  let levelHeuristica = 1; // Default "Low"

  if (cat === 'Cine' || cat === 'Teatro') {
    if (h >= 18 && h <= 23) {
      levelHeuristica = isWeekend ? 3 : 2; // High on weekend, Medium on weekday
    } else if (h >= 14 && h < 18) {
      levelHeuristica = 2; // Medium
    }
  } else if (cat === 'Restaurante') {
    if ((h >= 12 && h <= 15) || (h >= 19 && h <= 22)) {
      levelHeuristica = isWeekend ? 3 : 2;
    } else if (h >= 16 && h < 19) {
      levelHeuristica = 2;
    }
  } else if (cat === 'Parque' || cat === 'Miradores') {
    if (h >= 10 && h <= 18) {
      levelHeuristica = isWeekend ? 3 : 2;
    }
  } else if (cat === 'Museo') {
    if (h >= 10 && h <= 17) {
      levelHeuristica = 2;
    }
  }

  // 3. Combinación: max(nivel_por_cupos, nivel_heurístico)
  const finalLevel = Math.max(levelCupos, levelHeuristica);

  if (finalLevel === 3) return "High";
  if (finalLevel === 2) return "Medium";
  return "Low";
}
