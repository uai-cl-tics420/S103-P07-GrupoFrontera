import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { auth } from './lib/auth';
import { protectMiddleware } from 'src/middleware/protect';
import { db } from "./lib/db";
import { user, activities, userPreferences } from "./lib/schema";
import { and, count, eq, gt } from "drizzle-orm";
import nodemailer from 'nodemailer';
import { verification } from '../auth-schema';
import { randomInt, randomUUID } from 'crypto';
import { getCurrentWeather } from './services/weatherService';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Verificación de variables de entorno
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, OPENWEATHER_API_KEY } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET || !OPENWEATHER_API_KEY) {
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


app.get("/api/activities", async ({ query }) => {
  //extraemos las coordenadas del frontend por la url
  //si no vienen, dejamos unas por defecto (ej. las de Stgo.)
  const lat = query.lat ? parseFloat(query.lat): -33.4372;
  const lng = query.lng ? parseFloat(query.lng): -70.6506;

  console.log(`Extrayendo clima para posición: lat ${lat}, lng ${lng}`);

  //consultamos el clima real del usuario en OpenWeather
  const weather = await getCurrentWeather(lat, lng);
  console.log(`Clima detectado: ${weather.condition} (${weather.temperature}°C)`);

  //traemos las actividades de la bbdd
  const rows = await db.select().from(activities);

  //mapeamos las filas al formato typescript
  const mappedActivities = rows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    tagClima: row.tag_clima,
    coordinates: { lat: row.lat, lng: row.lng },
  }));

  //inyección en lógica de filtrado/recomendación
  //mapeamos el main de OW (Clear, Clouds, Rain) a los tags de la bbdd (Sunny, Rainy)
  const weatherTag = (weather.condition === 'Clear' || weather.condition === 'Clouds') ? 'Sunny' : 'Rainy';

  //ordenamos dejando primero las actividades que favorecen al clima actual
  const climateRecommended = [...mappedActivities].sort((a, b) => {
    const aCalzaClima = a.tagClima === weatherTag;
    const bCalzaClima = b.tagClima === weatherTag;

    if (aCalzaClima && !bCalzaClima) return -1;
    if (!aCalzaClima && bCalzaClima) return 1;
    return 0;
  });

  //retornamos la lista optimizada por clima
  return {
    currentWeather: weather,
    activities: climateRecommended
  };
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
// --- RUTAS OTP ---
app.post("/api/otp/request", async ({ body }) => {
  const { userId, email } = body as { userId: string; email: string };

  const code = randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.delete(verification).where(eq(verification.identifier, userId));
  await db.insert(verification).values({
    id: randomUUID(),
    identifier: userId,
    value: code,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await transporter.sendMail({
    from: `"Panoramas App" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Tu código de verificación - Panoramas",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:40px;background:#fff;border-radius:16px;">
        <h1 style="font-size:24px;font-weight:900;margin-bottom:8px;">PANORAMAS</h1>
        <p style="color:#666;margin-bottom:32px;">Tu código de verificación es:</p>
        <div style="font-size:48px;font-weight:900;letter-spacing:0.5em;text-align:center;padding:24px;background:#f5f5f5;border-radius:12px;margin-bottom:24px;">
          ${code}
        </div>
        <p style="color:#999;font-size:12px;">Este código expira en 10 minutos.</p>
      </div>
    `,
  });

  return { message: "Código enviado" };
});

app.post("/api/otp/verify", async ({ body }) => {
  const { userId, code } = body as { userId: string; code: string };
  const now = new Date();

  const records = await db.select().from(verification)
    .where(and(
      eq(verification.identifier, userId),
      eq(verification.value, code),
      gt(verification.expiresAt, now)
    ))
    .limit(1);

  if (records.length === 0) {
    return { status: "error", message: "Código incorrecto o expirado" };
  }

  await db.delete(verification).where(eq(verification.identifier, userId));
  await db.update(user).set({ otpVerified: true } as any).where(eq(user.id, userId));

  return { status: "success" };
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
