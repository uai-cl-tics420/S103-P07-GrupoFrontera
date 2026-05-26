import { db } from "./db";
import { activities, user } from "./schema";
import { MOCK_ACTIVITIES } from "../mockActivities";
import { eq } from "drizzle-orm";

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

    console.log("⚙️  Promoviendo cuenta maestra a Administrador...");
    await db.update(user)
        .set({ role: 'admin' })
        .where(eq(user.email, 'danielmpizarro@alumnos.uai.cl'));
    console.log("👑 ¡Cuenta danielmpizarro@alumnos.uai.cl promovida a Admin!");

    console.log("✅ ¡Seed completado! La Bóveda de Postgres tiene los datos.");
    process.exit(0);
}

seed();
