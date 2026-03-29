# Investigación técnica de APIs - P07

## 1. Clima (con OpenWeatherMap)
- **Factibilidad:** Alta, la respuesta entrega un array llamado "weather" donde el campo "main" define el estado (Cloudy, Rain, Clear).
- **Uso técnico:** Podemos crear un "Helper" que nos indique si el tiempo es adecuado para el aire libre (booleano "isOutdoorFriendly")
- **Endpoint:** 'https://api.openweathermap.org/data/2.5/weather'
- **Parámetros necesarios:** "lat", "lon", "appid" (API Key) y "units=metric".
- **Límites:** 60 llamadas por minuto en la capa gratuita.

## 2. Mapas y afluencia (Google Places)
- **Factibilidad:** Media-Alta.
- **Geolocalización:** Usaremos el endpoint 'Nearby Search' para encontrar lugares por categoría ("type"), como "park" o "movie_theater".
- **Análisis de Costos:** Se verificó en la consola de Google que funciones clave como "Autocomplete" y las primeras consultas de "Places Details" tienen un costo inicial de USD 0.00, lo que garantiza que no incurriremos en gastos.
- **Desafío para la afluencia:** La API oficial no entrega "Popular Times" de forma pública.
- **Decisión técnica:** Simularemos el nivel de ocupación (Low, Medium o High) con una función aleatoria ponderada por la hora actual para cumplir el requerimiento y simular la realidad.

# 3. Formato de respuesta del sistema (propuesta JSON)
```json
{
  "weather": { 
    "condition": "Rain", 
    "temp": 15,
    "isOutdoorFriendly": false
  },
  "results": [
    { 
      "name": "Cine Hoyts La Reina", 
      "category": "Cine", 
      "occupancy": "High",
      "location": { "lat": -33.45, "lng": -70.66 }
    }
  ]
}
