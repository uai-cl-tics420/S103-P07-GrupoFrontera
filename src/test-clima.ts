import { getCurrentWeather } from "./services/weatherService";

async function probarConexionClima() {
  console.log("🛰️ Iniciando prueba de conexión con OpenWeatherMap...");
  
  // Coordenadas aproximadas de Santiago, Chile
  const latSantiago = -33.4372;
  const lngSantiago = -70.6506;

  const resultado = await getCurrentWeather(latSantiago, lngSantiago);
  
  console.log("\n--- 🌤️ RESULTADO DE LA API ---");
  console.log(`Condición Principal (weather.main): ${resultado.condition}`);
  console.log(`Temperatura Actual: ${resultado.temperature}°C`);
  console.log("-------------------------------\n");
}

probarConexionClima();