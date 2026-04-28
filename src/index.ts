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

app.onRequest(async ({ request }) => {
  const url = new URL(request.url);
  const isManualOtpRoute =
    url.pathname.includes("/get-my-otp") ||
    url.pathname.includes("/verify-otp");
  if (url.pathname.startsWith("/api/auth") && !isManualOtpRoute) {
    return await auth.handler(request);
  }
});


// --- RUTAS OTP (de Fau) ---

app.get('/api/auth/get-my-otp/:userId', async ({ params }) => {
  const userId = params.userId;
  const [foundUser] = await db.select().from(user).where(eq(user.id, userId));
  if (!foundUser) return { status: "error", message: "Usuario no encontrado" };

  const ahora = new Date();
  const ultimaActualizacion = foundUser.updatedAt || foundUser.createdAt || ahora;
  const diferenciaMinutos = (ahora.getTime() - ultimaActualizacion.getTime()) / 60000;

  let secretoActual = foundUser.otpSecret;
  if (!secretoActual || diferenciaMinutos >= 10) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    secretoActual = '';
    for (let i = 0; i < 20; i++) {
      secretoActual += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    await db.update(user)
      .set({ otpSecret: secretoActual, otpVerified: false, updatedAt: ahora })
      .where(eq(user.id, userId));
  }

  const seed = secretoActual.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timeStep = Math.floor(ahora.getTime() / 600000);
  const token = ((seed * timeStep) % 1000000).toString().padStart(6, '0');

  return {
    status: "success",
    code: token,
    expiresInMinutes: Math.max(0, Math.floor(10 - diferenciaMinutos))
  };
});

app.post('/api/auth/verify-otp', async ({ body }) => {
  const { code, userId } = body as { code: string, userId: string };
  const [foundUser] = await db.select().from(user).where(eq(user.id, userId));
  if (!foundUser || !foundUser.otpSecret) {
    return { status: "error", message: "Usuario o secreto no encontrado" };
  }
  const seed = foundUser.otpSecret.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timeStep = Math.floor(new Date().getTime() / 600000);
  const expectedToken = ((seed * timeStep) % 1000000).toString().padStart(6, '0');
  if (code === expectedToken) {
    await db.update(user).set({ otpVerified: true }).where(eq(user.id, userId));
    return {
      status: "success",
      message: "¡Segundo factor verificado!",
      user: { id: foundUser.id, email: foundUser.email, role: (foundUser as any).role || 'user' }
    };
  }
  return { status: "error", message: "Código inválido o expirado" };
});

// --- RUTAS ACTIVIDADES Y PREFERENCIAS (de Daniel) ---

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
