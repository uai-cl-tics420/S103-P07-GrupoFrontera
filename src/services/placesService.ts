/**
 * Simula el nivel de ocupación dependiendo de la hora actual.
 */
export function getSimulatedOccupancy(): "Low" | "Medium" | "High" {
  const currentHour = new Date().getHours();
  const rand = Math.random();

  if (currentHour >= 18 && currentHour <= 22) {
    return rand > 0.3 ? "High" : "Medium";
  } else if (currentHour >= 12 && currentHour <= 17) {
    return rand > 0.4 ? "Medium" : "Low";
  } else {
    return rand > 0.8 ? "Medium" : "Low";
  }
}
