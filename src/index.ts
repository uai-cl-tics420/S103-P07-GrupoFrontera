import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { auth } from './lib/auth';
import { protectMiddleware } from 'src/middleware/protect';
import { db } from "./lib/db";
import { user, activities, userPreferences } from "./lib/schema";
import { count, eq } from "drizzle-orm";

// Verificación de variables de entorno
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
  throw new Error("Faltan variables de entorno críticas en el archivo .env");
}


const app = new Elysia();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Interceptamos limpiamente las rutas de Better-Auth antes del router principal
app.onRequest(async ({ request }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/auth")) {
    return await auth.handler(request);
  }
});


// --- RUTAS OTP ---
// Las rutas manuales de OTP fueron eliminadas. Todo el flujo será manejado nativamente por Better-Auth.


app.get("/api/activities", async () => {
  const rows = await db.select().from(activities);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    tagClima: row.tag_clima,
    coordinates: { lat: row.lat, lng: row.lng },
  }));
});

app.get("/api/preferences/:userId", async ({ params }) => {
  const rows = await db.select().from(userPreferences)
    .where(eq(userPreferences.userId, params.userId));
  return { categories: rows[0]?.preferredCategories ?? [] };
});

app.put("/api/preferences/:userId", async ({ params, body }) => {
  const { categories } = body as { categories: string[] };
  await db.delete(userPreferences).where(eq(userPreferences.userId, params.userId));
  await db.insert(userPreferences).values({ userId: params.userId, preferredCategories: categories });
  return { ok: true, categories };
});

// --- PROTECCIÓN POR ROLES ---

app.guard({ beforeHandle: protectMiddleware('admin') }, (subApp) => subApp
  .get('/admin-dashboard', () => ({ status: "success", data: "Panel de control (solo Admin)" }))
);

app.guard({ beforeHandle: protectMiddleware() }, (subApp) => subApp
  .get('/my-panoramas', () => ({ status: "success", data: "Tus reservas y recomendaciones" }))
);

app.get('/main.js', () => new Response(Bun.file("./public/main.js"), {
  headers: { 'Content-Type': 'application/javascript' }
}));

app.get('/main.css', () => new Response(Bun.file("./public/main.css"), {
  headers: { 'Content-Type': 'text/css' }
}));

app.get('/*', () => new Response(Bun.file("./index.html"), {
  headers: { 'Content-Type': 'text/html' }
}));

const checkDatabase = async () => {
  try {
    const userCount = await db.select({ value: count() }).from(user);
    console.log(`📊 USUARIOS EN DB: ${userCount?.[0]?.value ?? 0}`);
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
  }
};

await checkDatabase();

app.listen(4000);
console.log(`🚀 PROYECTO LISTO en http://localhost:4000`);
