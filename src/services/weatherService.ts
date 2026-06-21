import { Category } from "../types";

export interface WeatherData {
    condition: string;
    temperature: number;
    cityName: string;
    // true si el clima corresponde de verdad a la fecha pedida (hoy o pronóstico válido <= 5 días).
    // false si la fecha está fuera del alcance del pronóstico (el clima es solo referencial).
    reliable?: boolean;
}

export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherData> {
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
        throw new Error("OPENWEATHER_API_KEY no está definida en las variables de entorno");
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            //captura códigos de error
            throw new Error(`OpenWeatherMap respondió con estado: ${response.status}`);
        }

        const data = await response.json() as any;

        const condition = data.weather?.[0]?.main ?? "Clear";
        const temperature = data.main?.temp ?? 20;
        const cityName = data.name;

        return {
            condition,
            temperature,
            cityName,
            reliable: true // clima actual: siempre confiable para "hoy"
        };
    } catch (error) {
        //bloque try/catch para fallos de red/api key
        console.error("Error al consultar la API de OpenWeatherMap:", error);
        return { //fallback seguro
            condition: "Clear",
            temperature: 22,
            cityName: "Santiago",
            reliable: true
        };
    }
}

export async function getWeatherForecast(
    lat: number,
    lng: number,
    targetDate: string,
    targetTime?: string
): Promise<WeatherData> {
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
        throw new Error("OPENWEATHER_API_KEY no está definida en las variables de entorno");
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`OpenWeatherMap respondió con estado: ${response.status}`);
        }

        const data = await response.json() as any;

        if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
            const cur = await getCurrentWeather(lat, lng);
            return { ...cur, reliable: false }; // no hubo pronóstico real para esa fecha
        }

        // Construir fecha y hora objetivo para comparar
        const timePart = targetTime ? (targetTime.includes(":") ? (targetTime.split(":").length === 2 ? `${targetTime}:00` : targetTime) : "12:00:00") : "12:00:00";
        // Si no es un formato de hora válido, usar fallback a mediodía
        const targetDateTimeStr = `${targetDate}T${timePart}`;
        const targetTimeMs = new Date(targetDateTimeStr).getTime();

        let closestItem = data.list[0];
        let minDiff = Math.abs(closestItem.dt * 1000 - targetTimeMs);

        for (const item of data.list) {
            const diff = Math.abs(item.dt * 1000 - targetTimeMs);
            if (diff < minDiff) {
                minDiff = diff;
                closestItem = item;
            }
        }

        const condition = closestItem.weather?.[0]?.main ?? "Clear";
        const temperature = closestItem.main?.temp ?? 20;

        // El pronóstico gratuito cubre ~5 días en pasos de 3h. Si el item más cercano queda
        // a más de un paso (3h) del objetivo, la fecha está fuera de alcance: clima no confiable.
        const RELIABLE_THRESHOLD_MS = 3 * 60 * 60 * 1000;
        const reliable = minDiff <= RELIABLE_THRESHOLD_MS;

        return {
            condition,
            temperature,
            cityName: data.city?.name ?? "Santiago",
            reliable,
        };
    } catch (error) {
        console.error("Error al consultar el pronóstico de OpenWeatherMap:", error);
        const cur = await getCurrentWeather(lat, lng); // Fallback al clima actual
        return { ...cur, reliable: false };
    }
}