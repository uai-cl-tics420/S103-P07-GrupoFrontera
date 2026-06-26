/**
 * Calcula el nivel de ocupación (afluencia) de un panorama.
 *
 * Si el panorama tiene cupos (cuposRatio no es null), la afluencia es 100% ese dato real
 * y en tiempo real: cupos usados / cupos totales de la franja horaria correspondiente.
 * No se mezcla con ninguna heurística -- es el dato más fiel posible a "ocupación real".
 *
 * Si el panorama es de entrada libre (sin cupos registrados, ej. un parque o mirador sin
 * límite), no existe ningún dato real de ocupación para él. En ese caso se usa una
 * heurística declarada por categoría + hora + fin de semana (no pretende ser un dato real,
 * es una estimación de patrones típicos de uso, ya que no hay una API gratuita de afluencia).
 */
export function getSimulatedOccupancy(
  category?: string,
  hour?: number,
  dayOfWeek?: number,
  cuposRatio?: number | null
): "Low" | "Medium" | "High" {
  // 1. Dato real: ocupación basada en cupos de la franja horaria
  if (cuposRatio != null) {
    if (cuposRatio >= 0.7) return "High";
    if (cuposRatio >= 0.3) return "Medium";
    return "Low";
  }

  // 2. Sin cupos (entrada libre): heurística por categoría + hora + fin de semana
  const cat = category || 'Otros';
  const h = hour !== undefined ? hour : new Date().getHours();
  const day = dayOfWeek !== undefined ? dayOfWeek : new Date().getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 5 || day === 6; // Vie, Sab, Dom

  let level = 1; // 1 = Low, 2 = Medium, 3 = High

  if (cat === 'Cine' || cat === 'Teatro') {
    if (h >= 18 && h <= 23) {
      level = isWeekend ? 3 : 2;
    } else if (h >= 14 && h < 18) {
      level = 2;
    }
  } else if (cat === 'Restaurante') {
    if ((h >= 12 && h <= 15) || (h >= 19 && h <= 22)) {
      level = isWeekend ? 3 : 2;
    } else if (h >= 16 && h < 19) {
      level = 2;
    }
  } else if (cat === 'Parque' || cat === 'Miradores') {
    if (h >= 10 && h <= 18) {
      level = isWeekend ? 3 : 2;
    }
  } else if (cat === 'Museo') {
    if (h >= 10 && h <= 17) {
      level = 2;
    }
  }

  if (level === 3) return "High";
  if (level === 2) return "Medium";
  return "Low";
}
