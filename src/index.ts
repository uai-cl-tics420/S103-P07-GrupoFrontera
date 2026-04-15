import { serve } from "bun";
import index from "./index.html";
import { db } from "./lib/db";
import { activities, userPreferences } from "./lib/schema";
import { eq } from "drizzle-orm";
// Importamos la DB y las tablas para poder consultarlas en los endpoints.
// El objeto 'db' es la conexión a Postgres via Drizzle ORM.
// 'activities' y 'userPreferences' son los esquemas que Drizzle usa para construir queries.

// ID de usuario temporal hasta que el Issue #32 (auth) mergee y haya sesión real.
const MOCK_USER_ID = "mock-user-1";

const build = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./public",
  minify: false,
});

if (!build.success) {
  console.error("❌ Error en el Build:", build.logs);
}

const server = serve({
  port: 4000,
  routes: {
    // NOTA(#34): Endpoint temporal en sintaxis Bun nativa.
    // Cuando se fusione el Issue #32 (que migra el servidor a Elysia),
    // hay que portar esta ruta al formato: app.get('/api/activities', handler)
    "/api/activities": {
      GET: async () => {
        // Consultamos todas las actividades de la DB sin filtros
        const rows = await db.select().from(activities);

        // La DB guarda los datos en snake_case (tag_clima, lat, lng separados).
        // El frontend espera camelCase y coordenadas anidadas ({ lat, lng }).
        // Hacemos la transformación aquí para que el frontend no sepa nada de la DB.
        const result = rows.map(row => ({
          id: row.id,
          name: row.name,
          category: row.category,
          tagClima: row.tag_clima,
          coordinates: { lat: row.lat, lng: row.lng },
        }));

        return Response.json(result);
      },
    },
    // NOTA(#34): Endpoints de preferencias con usuario mock.
    // Cuando #32 (auth) mergee, reemplazar MOCK_USER_ID por el userId real de la sesión.
    "/api/preferences": {
      GET: async () => {
        const rows = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.userId, MOCK_USER_ID));

        const categories = rows[0]?.preferredCategories ?? [];
        return Response.json({ categories });
      },

      PUT: async (req: Request) => {
        const body = await req.json() as { categories: string[] };
        const { categories } = body;

        // Borramos las preferencias anteriores del usuario y guardamos las nuevas.
        // (delete + insert es más simple que upsert sin constraint unique en userId)
        await db
          .delete(userPreferences)
          .where(eq(userPreferences.userId, MOCK_USER_ID));

        await db
          .insert(userPreferences)
          .values({ userId: MOCK_USER_ID, preferredCategories: categories });

        return Response.json({ ok: true, categories });
      },
    },

    "/*": index,
  },
  development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 PROYECTO LISTO en http://localhost:4000`);
