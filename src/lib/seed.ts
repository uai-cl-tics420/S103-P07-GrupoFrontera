import { db } from "./db";
import { activities } from "./schema";
import { MOCK_ACTIVITIES } from "../mockActivities";

async function seed() {
    console.log("🌱 Iniciando la mudanza de datos (Seeding)...");

    for (const panorama of MOCK_ACTIVITIES) {
        await db.insert(activities).values({
            id: String(panorama.id),
            name: panorama.name,
            category: panorama.category,
            tag_clima: panorama.tagClima, // Traducimos del mock (tagClima) a la DB (tag_clima)
            lat: panorama.coordinates.lat, // Entramos al objeto coordinates
            lng: panorama.coordinates.lng,
        }).onConflictDoNothing();
    }

    console.log("✅ ¡Seed completado! La Bóveda de Postgres tiene los datos.");
    process.exit(0);
}

seed();
