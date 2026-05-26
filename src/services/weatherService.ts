import { Category } from "../types";

export interface WeatherData {
    condition: string;
    temperature: number;
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

        return {
            condition,
            temperature,
        };
    } catch (error) {
        //bloque try/catch para fallos de red/api key
        console.error("Error al consultar la API de OpenWeatherMap:", error);
        return { //fallback seguro
            condition: "Clear",
            temperature: 22,
        };
    }

}