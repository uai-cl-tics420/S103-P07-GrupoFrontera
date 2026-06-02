import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { auth } from './lib/auth';
import { protectMiddleware } from 'src/middleware/protect';
import { db } from "./lib/db";
import { user, activities, userPreferences, userFavorites, userReservations } from "./lib/schema";
import { and, count, eq, gt } from "drizzle-orm";
import nodemailer from 'nodemailer';
import { verification } from '../auth-schema';
import { randomInt, randomUUID } from 'crypto';
import { getCurrentWeather } from './services/weatherService';
import { processPayment } from './services/paymentService';

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


// Las rutas manuales de OTP fueron eliminadas. Todo el flujo será manejado nativamente por Better-Auth.


app.get("/api/activities", async ({ query, request }) => {
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

  // Extraer el usuario de la sesión para ver sus favoritos y reservas
  const session = await auth.api.getSession({ headers: request.headers });
  let userFavs: string[] = [];
  let userRes: string[] = [];
  
  if (session?.user?.id) {
    const favs = await db.select({ activityId: userFavorites.activityId })
      .from(userFavorites)
      .where(eq(userFavorites.userId, session.user.id));
    userFavs = favs.map(f => f.activityId);

    const res = await db.select({ activityId: userReservations.activityId })
      .from(userReservations)
      .where(eq(userReservations.userId, session.user.id));
    userRes = res.map(r => r.activityId);
  }

  //retornamos la lista optimizada por clima, y también la data del usuario
  return {
    currentWeather: weather,
    activities: climateRecommended,
    userHistory: {
      favorites: userFavs,
      reservations: userRes
    }
  };
});

app.get("/api/preferences/:userId", async ({ params }) => {
  let rows = await db.select().from(userPreferences)
    .where(eq(userPreferences.userId, params.userId));
  
  if (rows.length === 0) {
    await db.insert(userPreferences).values({
      userId: params.userId,
      preferredCategories: [],
    });
    
    rows = await db.select().from(userPreferences)
      .where(eq(userPreferences.userId, params.userId));
  }
  
  // Buscar el rol real directamente en la tabla user
  const u = await db.select().from(user)
    .where(eq(user.id, params.userId))
    .limit(1);
  
  const role = u[0]?.role ?? 'user';
  
  return { 
    categories: rows[0]?.preferredCategories ?? [],
    role: role
  };
});

app.put("/api/preferences/:userId", async ({ params, body }) => {
  const { categories } = body as { categories: string[] };
  
  const existing = await db.select().from(userPreferences)
    .where(eq(userPreferences.userId, params.userId))
    .limit(1);
    
  if (existing.length > 0) {
    await db.update(userPreferences)
      .set({ preferredCategories: categories })
      .where(eq(userPreferences.userId, params.userId));
  } else {
    await db.insert(userPreferences).values({
      userId: params.userId,
      preferredCategories: categories,
    });
  }
  
  return { ok: true, categories };
});

// --- RUTAS FAVORITOS ---
app.post("/api/favorites", async ({ body, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  const { activityId } = body as { activityId: string };
  await db.insert(userFavorites).values({
    userId: session.user.id,
    activityId
  }).onConflictDoNothing();
  return { success: true };
});

app.delete("/api/favorites", async ({ body, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  const { activityId } = body as { activityId: string };
  await db.delete(userFavorites)
    .where(and(eq(userFavorites.userId, session.user.id), eq(userFavorites.activityId, activityId)));
  return { success: true };
});

// --- RUTAS RESERVAS (issue #28) ---
// POST /api/reservations { activityId, payNow? }: crea reserva.
// payNow=false (default) => status='pendiente', sin cobro.
// payNow=true => cobra al toque y guarda status='pagado'.
app.post("/api/reservations", async ({ body, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  const { activityId, payNow } = body as { activityId: string; payNow?: boolean };
  if (!activityId) {
    set.status = 400;
    return { error: "activityId requerido" };
  }

  // Validar que la actividad existe
  const [act] = await db.select().from(activities).where(eq(activities.id, activityId));
  if (!act) {
    set.status = 404;
    return { error: "Actividad no encontrada" };
  }

  // Sin pago inmediato: queda pendiente
  if (!payNow) {
    const [created] = await db.insert(userReservations).values({
      userId: session.user.id,
      activityId,
      status: "pendiente",
    }).returning();
    return { success: true, reservation: created, payment: null };
  }

  // Con pago inmediato: cobrar y guardar como pagado
  const payment = await processPayment({ userId: session.user.id, activityId });
  if (!payment.success) {
    set.status = 402;
    return { error: payment.error, processedAt: payment.processedAt };
  }
  const [created] = await db.insert(userReservations).values({
    userId: session.user.id,
    activityId,
    status: "pagado",
  }).returning();
  return {
    success: true,
    reservation: created,
    payment: { transactionId: payment.transactionId, processedAt: payment.processedAt },
  };
});

// POST /api/reservations/:id/pay : cobra una reserva pendiente y la pasa a pagada
app.post("/api/reservations/:id/pay", async ({ params, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }

  const [existing] = await db.select().from(userReservations).where(eq(userReservations.id, params.id));
  if (!existing) {
    set.status = 404;
    return { error: "Reserva no encontrada" };
  }
  if (existing.userId !== session.user.id) {
    set.status = 403;
    return { error: "Prohibido" };
  }
  if (existing.status !== "pendiente") {
    set.status = 409;
    return { error: `Reserva ya esta en estado ${existing.status}` };
  }

  const payment = await processPayment({ userId: session.user.id, activityId: existing.activityId });
  if (!payment.success) {
    set.status = 402;
    return { error: payment.error, processedAt: payment.processedAt };
  }

  const [updated] = await db.update(userReservations)
    .set({ status: "pagado" })
    .where(eq(userReservations.id, params.id))
    .returning();
  return {
    success: true,
    reservation: updated,
    payment: { transactionId: payment.transactionId, processedAt: payment.processedAt },
  };
});

// GET /api/reservations/:userId : historial de reservas con detalle de actividad
app.get("/api/reservations/:userId", async ({ params, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  // Solo permitimos ver las propias (o si fuera admin se podria relajar)
  if (session.user.id !== params.userId) {
    set.status = 403;
    return { error: "Prohibido" };
  }

  const rows = await db
    .select({
      id: userReservations.id,
      activityId: userReservations.activityId,
      status: userReservations.status,
      createdAt: userReservations.createdAt,
      activityName: activities.name,
      activityCategory: activities.category,
      activityLat: activities.lat,
      activityLng: activities.lng,
    })
    .from(userReservations)
    .leftJoin(activities, eq(userReservations.activityId, activities.id))
    .where(eq(userReservations.userId, params.userId));

  return rows.map(r => ({
    id: r.id,
    activityId: r.activityId,
    status: r.status,
    createdAt: r.createdAt,
    activity: r.activityName ? {
      id: r.activityId,
      name: r.activityName,
      category: r.activityCategory,
      coordinates: { lat: r.activityLat, lng: r.activityLng },
    } : null,
  }));
});

// PATCH /api/reservations/:id { status }: cambiar estado (ej. cancelar)
app.patch("/api/reservations/:id", async ({ params, body, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  const { status } = body as { status: string };
  if (!status) {
    set.status = 400;
    return { error: "status requerido" };
  }

  // Validar ownership: solo el dueno puede modificar
  const [existing] = await db.select().from(userReservations).where(eq(userReservations.id, params.id));
  if (!existing) {
    set.status = 404;
    return { error: "Reserva no encontrada" };
  }
  if (existing.userId !== session.user.id) {
    set.status = 403;
    return { error: "Prohibido" };
  }

  const [updated] = await db.update(userReservations)
    .set({ status })
    .where(eq(userReservations.id, params.id))
    .returning();

  return { success: true, reservation: updated };
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

// --- ENDPOINT DE ESTADÍSTICAS REALES PARA ADMINISTRADOR ---
app.get("/api/admin/stats", async ({ request, set }) => {
  const session = await auth.api.getSession({
    headers: request.headers
  });
  if (!session) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  const caller = await db.select().from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  const role = caller[0]?.role ?? 'user';
  if (role !== 'admin') {
    set.status = 403;
    return { error: "Acceso denegado: se requieren permisos de administrador" };
  }

  // 1. Total de usuarios reales
  const totalUsersResult = await db.select({ value: count() }).from(user);
  const totalUsers = totalUsersResult[0]?.value ?? 0;

  // 2. Total de actividades reales
  const totalActivitiesResult = await db.select({ value: count() }).from(activities);
  const totalActivities = totalActivitiesResult[0]?.value ?? 0;

  // 3. Total de OTPs enviadas hoy
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const otpsSentTodayResult = await db.select({ value: count() }).from(verification)
    .where(gt(verification.createdAt, todayStart));
  const otpsSentToday = otpsSentTodayResult[0]?.value ?? 0;

  // 4. Actividades por categoría reales
  const categoryCounts = await db.select({ 
    category: activities.category, 
    count: count() 
  }).from(activities).groupBy(activities.category);

  // Determinar la categoría con más actividades
  let topCategory = "Parque";
  let maxCount = 0;
  for (const c of categoryCounts) {
    if (c.count > maxCount) {
      maxCount = c.count;
      topCategory = c.category;
    }
  }

  // 5. Lista de usuarios reales con sus roles y estados (consulta directa)
  const usersList = await db.select({
    id: user.id,
    email: user.email,
    otpVerified: user.otpVerified,
    createdAt: user.createdAt,
    role: user.role
  })
  .from(user)
  .orderBy(user.createdAt);

  const recentUsers = usersList.map(u => ({
    id: u.id,
    email: u.email,
    role: u.role ?? 'user',
    status: u.otpVerified ? 'active' : 'pending',
    joinedAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '2026-05-26'
  }));

  return {
    stats: {
      totalUsers,
      totalActivities,
      otpsSentToday,
      topCategory,
    },
    recentUsers,
    activitiesByCategory: categoryCounts.map(c => ({
      category: c.category,
      count: c.count
    }))
  };
});

// --- ENDPOINT PARA PROMOVER O DEGRADAR ROLES DE USUARIO (SOLO ADMINS) ---
app.patch("/api/admin/users/:targetUserId/role", async ({ params, body, request, set }) => {
  const session = await auth.api.getSession({
    headers: request.headers
  });
  if (!session) {
    set.status = 401;
    return { error: "No autorizado" };
  }

  // Validamos que el solicitante sea un administrador real
  const caller = await db.select().from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  
  const callerRole = caller[0]?.role ?? 'user';
  if (callerRole !== 'admin') {
    set.status = 403;
    return { error: "Acceso denegado: se requieren privilegios de administrador" };
  }

  const { role } = body as { role: 'user' | 'admin' };
  if (role !== 'user' && role !== 'admin') {
    set.status = 400;
    return { error: "Rol inválido" };
  }

  // Realizamos la promoción en la tabla 'user'
  await db.update(user)
    .set({ role: role })
    .where(eq(user.id, params.targetUserId));

  return { success: true, userId: params.targetUserId, newRole: role };
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
