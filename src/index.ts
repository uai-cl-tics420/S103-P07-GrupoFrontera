import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { auth } from './lib/auth';
import { protectMiddleware } from 'src/middleware/protect';
import { db } from "./lib/db";
import { user, activities, userFavorites, userReservations, activitySchedules } from "./lib/schema";
import { and, count, eq, gt, ne, sql } from "drizzle-orm";
import nodemailer from 'nodemailer';
import { verification } from '../auth-schema';
import { randomInt, randomUUID } from 'crypto';
import { getCurrentWeather, getWeatherForecast } from './services/weatherService';
import { isOutdoorFriendly } from './utils/weatherHelpers';
import { getSimulatedOccupancy } from './services/placesService';
import { processPayment } from './services/paymentService';


// Puerto 587 con STARTTLS en vez del shorthand "service: 'gmail'" (que usa 465/SSL implícito):
// algunos hosts bloquean o filtran 465, dando "Connection timeout" sin ningún error de auth.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 10000,
});

// Verificación de variables de entorno
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, OPENWEATHER_API_KEY } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET || !OPENWEATHER_API_KEY) {
  throw new Error("Faltan variables de entorno críticas en el archivo .env");
}


const app = new Elysia();

app.use(cors({
  origin: ['http://localhost:5173', 'https://panoramapp.onrender.com'],
  credentials: true
}));

// Interceptamos limpiamente las rutas de Better-Auth antes del router principal
app.onRequest(async ({ request }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/auth")) {
    return await auth.handler(request);
  }
});

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.get("/api/activities", async ({ query, request }) => {
  //extraemos las coordenadas del frontend por la url
  //si no vienen, dejamos unas por defecto (ej. las de Stgo.)
  const lat = query.lat ? parseFloat(query.lat as string): -33.4372;
  const lng = query.lng ? parseFloat(query.lng as string): -70.6506;
  
  // Extraemos parámetros dinámicos de filtrado
  const filterCategory = query.category as string | undefined;
  const radius = query.radius ? parseInt(query.radius as string) : 30000;
  const priceSort = (query.priceSort === 'asc' || query.priceSort === 'desc') ? query.priceSort : undefined;
  const priceMin = query.priceMin !== undefined && query.priceMin !== '' ? parseInt(query.priceMin as string) : undefined;
  const priceMax = query.priceMax !== undefined && query.priceMax !== '' ? parseInt(query.priceMax as string) : undefined;
  // Filtro de fecha/hora del toolbar de navegación (independiente de "Recomendar Panoramas")
  const filterDate = query.filterDate as string | undefined;
  const filterTime = query.filterTime as string | undefined;

  console.log(`Extrayendo clima para posición: lat ${lat}, lng ${lng}`);

  // Si viene una fecha planificada, calculamos su pronóstico
  const dateStr = query.date as string | undefined;
  const timeStr = query.time as string | undefined;

  let weather;
  if (dateStr && dateStr !== 'today') {
    console.log(`Consultando pronóstico para fecha: ${dateStr}, hora: ${timeStr || 'cualquier hora'}`);
    weather = await getWeatherForecast(lat, lng, dateStr, timeStr);
  } else {
    weather = await getCurrentWeather(lat, lng);
  }
  console.log(`Clima detectado: ${weather.condition} (${weather.temperature}°C)`);

  //info para el widget
  const currentCondition = weather.condition || 'Clear';
  const currentTemp = weather.temperature || 20;
  const cityName = (weather as any).cityName || (weather as any).name || "Santiago";

  //traemos las actividades de la bbdd
  const rows = await db.select().from(activities);

  //traemos los horarios de cada panorama
  const allSchedules = await db.select().from(activitySchedules);

  //mapeamos las filas al formato typescript (panoramas creados por el admin)
  const mappedActivities = rows.map(row => {
    const sched = allSchedules
      .filter(sch => sch.activityId === row.id)
      .map(sch => ({ fecha: sch.fecha, horaInicio: sch.horaInicio, horaFin: sch.horaFin }));
    const primera = sched[0];
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      tagClima: row.tag_clima,
      coordinates: { lat: row.lat, lng: row.lng },
      openingHour: row.openingHour || (row as any).opening_hour || primera?.horaInicio || undefined,
      closingHour: row.closingHour || (row as any).closing_hour || primera?.horaFin || undefined,
      imageUrl: (row as any).imageUrl ?? undefined,
      description: (row as any).description ?? undefined,
      price: (row as any).price ?? undefined,
      vicinity: (row as any).address ?? undefined,
      cuposPorDia: (row as any).cuposPorDia ?? undefined,
      isTendencia: (row as any).isTendencia ?? false,
      isPopular: (row as any).isPopular ?? false,
      disponible: (row as any).disponible ?? true,
      schedules: sched,
    };
  });

  // Fecha objetivo de la planificación (si el usuario usó "Recomendar Panoramas").
  // 'today' se traduce a la fecha real de hoy para poder comparar contra activitySchedules.
  const today = new Date().toISOString().slice(0, 10);
  const targetDateStr = dateStr ? (dateStr === 'today' ? today : dateStr) : undefined;

  // Cupos ya usados por panorama en una fecha dada (reservas activas de esa fecha), para poder
  // excluir los panoramas AGOTADOS en esa fecha. Se reusa tanto para la fecha de planificación
  // ("Recomendar Panoramas") como para el filtro de fecha independiente del toolbar.
  async function buildUsadosEnFecha(fecha: string): Promise<Record<string, number>> {
    const reservasFecha = await db.select({ activityId: userReservations.activityId })
      .from(userReservations)
      .where(and(eq(userReservations.reservedDate, fecha), ne(userReservations.status, 'cancelado')));
    const map: Record<string, number> = {};
    for (const r of reservasFecha) map[r.activityId] = (map[r.activityId] ?? 0) + 1;
    return map;
  }

  // Un panorama SIN fechas programadas se considera de entrada libre (disponible todos los días).
  // Un panorama CON fechas programadas solo aparece si la fecha coincide con alguna de sus fechas
  // agendadas Y todavía quedan cupos para esa fecha (no está agotado).
  function buildMatchesDate(fecha: string | undefined, usados: Record<string, number>) {
    return (a: { id: string; schedules: { fecha: string }[]; cuposPorDia?: number }): boolean => {
      if (!fecha) return true; // sin filtro de fecha
      if (!a.schedules || a.schedules.length === 0) return true; // entrada libre
      const tieneFecha = a.schedules.some(s => s.fecha === fecha);
      if (!tieneFecha) return false;
      if (a.cuposPorDia != null) {
        const disponibles = a.cuposPorDia - (usados[a.id] ?? 0);
        if (disponibles <= 0) return false;
      }
      return true;
    };
  }

  const usadosEnFecha = targetDateStr ? await buildUsadosEnFecha(targetDateStr) : {};
  const matchesPlannedDate = buildMatchesDate(targetDateStr, usadosEnFecha);

  const usadosEnFiltroFecha = filterDate ? await buildUsadosEnFecha(filterDate) : {};
  const matchesFilterDate = buildMatchesDate(filterDate, usadosEnFiltroFecha);

  // Filtro de precio por rango, sobre el monto real en CLP guardado en la BD (activities.price)
  function matchesPriceRange(a: { price?: number | null }): boolean {
    const price = a.price ?? 0;
    if (priceMin !== undefined && price < priceMin) return false;
    if (priceMax !== undefined && price > priceMax) return false;
    return true;
  }

  // Filtro de hora: compara una hora objetivo (real "ahora" para la fecha de planificación de
  // hoy, o la hora elegida en el toolbar) contra el horario del panorama. Sin horario definido
  // o sin hora objetivo = entrada libre / sin restricción = siempre pasa.
  function matchesTimeWindow(openingHour?: string, closingHour?: string, hhmm?: string): boolean {
    if (!hhmm) return true;
    if (!openingHour || !closingHour) return true;
    const [h, m] = hhmm.split(':').map(Number);
    const targetMinutes = (h ?? 0) * 60 + (m ?? 0);
    const [oH, oM] = openingHour.split(':').map(Number);
    const openMinutes = (oH ?? 0) * 60 + (oM ?? 0);
    const [cH, cM] = closingHour.split(':').map(Number);
    let closeMinutes = (cH ?? 0) * 60 + (cM ?? 0);
    if (closeMinutes < openMinutes) closeMinutes += 24 * 60; // cruza medianoche
    let targetAdj = targetMinutes;
    if (targetAdj < openMinutes && targetAdj < closeMinutes - 24 * 60) targetAdj += 24 * 60;
    return targetAdj >= openMinutes && targetAdj <= closeMinutes;
  }

  function matchesRadius(a: { coordinates: { lat: number; lng: number } }): boolean {
    const distMeters = getDistanceInMeters(lat, lng, a.coordinates.lat, a.coordinates.lng);
    return distMeters <= radius;
  }

  // La fuente de panoramas ahora es la BD (creados por el admin), no Google Places.
  // Excluimos los marcados como NO disponibles.
  let baseList = mappedActivities
    .filter(a => a.disponible !== false)
    .filter(matchesPlannedDate)
    .filter(matchesFilterDate)
    .filter(matchesRadius)
    .filter(matchesPriceRange)
    .filter(a => matchesTimeWindow(a.openingHour, a.closingHour, filterTime));
  if (filterCategory && filterCategory !== 'Todas') {
    baseList = baseList.filter(a => a.category === filterCategory);
  }

  // Orden explícito del usuario: precio tiene prioridad si se eligió; si no, y el radio se
  // acotó (distinto del default de 30km, el más amplio del dropdown), ordenamos por cercanía.
  // Al ser sorts estables, dentro de cada grupo de clima (más abajo) se preserva este orden.
  if (priceSort) {
    baseList = [...baseList].sort((a, b) => {
      const pa = a.price ?? 0, pb = b.price ?? 0;
      return priceSort === 'asc' ? pa - pb : pb - pa;
    });
  } else if (radius !== 30000) {
    baseList = [...baseList].sort((a, b) =>
      getDistanceInMeters(lat, lng, a.coordinates.lat, a.coordinates.lng) -
      getDistanceInMeters(lat, lng, b.coordinates.lat, b.coordinates.lng)
    );
  }

  // Afluencia simulada por ahora (en standby hasta definir la fuente real con el profe)
  const placesWithOccupancy = baseList.map(a => ({ ...a, occupancy: getSimulatedOccupancy() }));

  // Evaluación de condiciones climáticas adaptativas (Tu lógica + Barros)
  const conditionClean = (weather?.condition || currentCondition || '').toLowerCase().trim();
  const aptoParaExteriores = isOutdoorFriendly(conditionClean);
  console.log(`¿El clima detectado es apto para exteriores?: ${aptoParaExteriores ? 'SÍ' : 'NO'}`);

  // Mapeamos el main de OpenWeatherMap a los tags oficiales de la BBDD (Sunny, Rainy)
  const currentMainCondition = weather?.condition || currentCondition;
  const weatherTag = (currentMainCondition === 'Clear' || currentMainCondition === 'Clouds') ? 'Sunny' : 'Rainy';

  // Ordenamos la grilla dejando primero las actividades que favorecen al clima actual de Santiago

  const climateRecommended = [...placesWithOccupancy].sort((a, b) => {
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
      .where(and(eq(userReservations.userId, session.user.id), ne(userReservations.status, 'cancelado')));
    userRes = res.map(r => r.activityId);
  }

  // Filtrar las actividades de la base de datos que el usuario ha interactuado
  // (Likes y Reservas), y asegurarnos de que cumplan con la categoría, el radio y la fecha
  // planificada seleccionados para que no distorsionen los filtros
  let filteredInteracted = mappedActivities
    .filter(a => userFavs.includes(a.id) || userRes.includes(a.id))
    .filter(matchesPlannedDate)
    .filter(matchesFilterDate);

  // 1. Filtrar por categoría si se especificó una distinta de 'Todas'
  if (filterCategory && filterCategory !== 'Todas') {
    filteredInteracted = filteredInteracted.filter(a => a.category === filterCategory);
  }

  // 2. Filtrar por radio de distancia aproximada (radius viene en metros)
  filteredInteracted = filteredInteracted.filter(matchesRadius);

  // 3. Mismos filtros de precio y horario que el catálogo principal, para consistencia
  filteredInteracted = filteredInteracted
    .filter(matchesPriceRange)
    .filter(a => matchesTimeWindow(a.openingHour, a.closingHour, filterTime));

  const userInteractedActivities = filteredInteracted.map(a => ({
    ...a,
    occupancy: getSimulatedOccupancy(), // Afluencia simulada real (issue #23)
    openingHour: a.openingHour || "09:00",
    closingHour: a.closingHour || "21:00"
  }));

  // Combinamos los resultados de Google con los favoritos/reservas del usuario (evitando duplicados por id o nombre)
  const combinedActivities = [...climateRecommended];
  for (const act of userInteractedActivities) {
    const exists = combinedActivities.some(c => c.id === act.id || c.name.toLowerCase() === act.name.toLowerCase());
    if (!exists) {
      combinedActivities.push(act as any);
    }
  }

  // Volvemos a ordenar la lista combinada final por correspondencia climática
  const finalOrdered = combinedActivities.sort((a, b) => {
    const aCalzaClima = a.tagClima === weatherTag;
    const bCalzaClima = b.tagClima === weatherTag;

    if (aCalzaClima && !bCalzaClima) return -1;
    if (!aCalzaClima && bCalzaClima) return 1;
    return 0;
  });

  // retornamos la lista combinada y optimizada, y la data del usuario
  return {
    currentWeather: weather,
    activities: finalOrdered,
    userHistory: {
      favorites: userFavs,
      reservations: userRes
    }
  };
});

// --- Geocodificacion de direcciones (Google Geocoding API) ---
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !address) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    console.warn('[geocode] sin resultado:', data.status, data.error_message || '');
    return null;
  } catch (e) {
    console.error('[geocode] error:', e);
    return null;
  }
}

// --- Crear panorama (SOLO ADMIN) - nueva logica de panoramas ---
app.post("/api/admin/activities", async ({ body, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  const caller = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  if ((caller[0]?.role ?? 'user') !== 'admin') {
    set.status = 403;
    return { error: "Acceso denegado: se requieren permisos de administrador" };
  }

  const b = body as any;
  if (!b?.name || !b?.category) {
    set.status = 400;
    return { error: "Faltan campos obligatorios: name y category" };
  }

  const coords = (typeof b.coordinates?.lat === 'number' && typeof b.coordinates?.lng === 'number')
    ? { lat: b.coordinates.lat, lng: b.coordinates.lng }
    : (b.address ? await geocodeAddress(b.address) : null);

  const id = randomUUID();
  const schedules = Array.isArray(b.schedules) ? b.schedules : [];

  // Transaccion: el panorama y todos sus horarios se guardan atomicamente.
  try {
    await db.transaction(async (tx) => {
      await tx.insert(activities).values({
        id,
        name: b.name,
        category: b.category,
        tag_clima: b.tag_clima ?? 'All',
        lat: coords?.lat ?? 0,
        lng: coords?.lng ?? 0,
        imageUrl: b.image_url ?? null,
        description: b.description ?? null,
        address: b.address ?? null,
        placeId: b.place_id ?? null,
        price: typeof b.price === 'number' ? b.price : null,
        cuposPorDia: typeof b.cupos_por_dia === 'number' ? b.cupos_por_dia : null,
      });

      for (const dia of schedules) {
        if (!dia?.fecha) continue;
        const franjas = Array.isArray(dia.franjas) ? dia.franjas : [];
        for (const f of franjas) {
          await tx.insert(activitySchedules).values({
            activityId: id,
            fecha: dia.fecha,
            horaInicio: f?.horaInicio || null,
            horaFin: f?.horaFin || null,
          });
        }
      }
    });
  } catch (e) {
    console.error('[crear panorama] transaccion revertida:', e);
    set.status = 500;
    return { error: "No se pudo guardar el panorama (cambios revertidos)" };
  }

  return { success: true, id, geocoded: coords !== null, coordinates: coords };
});

// --- Listar panoramas para administracion (SOLO ADMIN) ---
app.get("/api/admin/activities", async ({ request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) { set.status = 401; return { error: "No autorizado" }; }
  const caller = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  if ((caller[0]?.role ?? 'user') !== 'admin') { set.status = 403; return { error: "Acceso denegado" }; }
  const rows = await db.select().from(activities);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    imageUrl: (r as any).imageUrl ?? null,
    price: (r as any).price ?? null,
    address: (r as any).address ?? null,
    isTendencia: (r as any).isTendencia ?? false,
    isPopular: (r as any).isPopular ?? false,
    disponible: (r as any).disponible ?? true,
  }));
});

// --- Eliminar panorama (SOLO ADMIN) ---
app.delete("/api/admin/activities/:id", async ({ params, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) { set.status = 401; return { error: "No autorizado" }; }
  const caller = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  if ((caller[0]?.role ?? 'user') !== 'admin') { set.status = 403; return { error: "Acceso denegado" }; }
  await db.delete(activities).where(eq(activities.id, params.id));
  return { success: true, id: params.id };
});

// --- Actualizar flags: tendencia / popular / disponible (SOLO ADMIN) ---
app.patch("/api/admin/activities/:id", async ({ params, body, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) { set.status = 401; return { error: "No autorizado" }; }
  const caller = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  if ((caller[0]?.role ?? 'user') !== 'admin') { set.status = 403; return { error: "Acceso denegado" }; }
  const b = body as any;
  const updates: any = {};
  if (typeof b.isTendencia === 'boolean') updates.isTendencia = b.isTendencia;
  if (typeof b.isPopular === 'boolean') updates.isPopular = b.isPopular;
  if (typeof b.disponible === 'boolean') updates.disponible = b.disponible;
  if (Object.keys(updates).length === 0) { set.status = 400; return { error: "Nada que actualizar" }; }

  //Buscamos los datos actuales de la actividad antes de actualizar para saber si el flag cambió
  const [currentActivity] = await db.select().from(activities).where(eq(activities.id, params.id));
  if (!currentActivity) { set.status = 404; return { error: "Actividad no encontrada" }; }

  //Actualizamos la bbdd
  await db.update(activities).set(updates).where(eq(activities.id, params.id));

  //Motor de notificaciones en segundo plano
  //evaluamos si se activó un flag que antes estaba apagado
  const seVolvioTendencia = updates.isTendencia === true && !(currentActivity as any).isTendencia;
  const seVolvioPopular = updates.isPopular === true && !(currentActivity as any).isPopular;

  if (seVolvioTendencia || seVolvioPopular) {
    //función asíncrona que se dispara
    (async () => {
      try {
        console.log(`Iniciando campaña de correos masivos para: "${currentActivity.name}"`);

        //buscamos a los usuarios reales registrados en el sistema
        const allUsers = await db.select({ email: user.email }).from(user);
        const recipientEmails = allUsers.map(u => u.email).filter(Boolean);

        if (recipientEmails.length === 0) return;

        //definimos el asunto y diseño visual adaptativo según el tipo de logo del panorama
        let subject = "";
        let badgeColor = "";
        let badgeText = "";
        let messageText = "";

        if (seVolvioTendencia) {
          subject = `📈 ¡ALERTA DE TENDENCIA! ${currentActivity.name} está arrasando`
          badgeColor = "#f97316";
          badgeText = "⚡️ TENDENCIA DEL MOMENTO";
          messageText = "Este panorama está siendo el más reservado por la comunidad en los últimos días y los cupos vuelan. ¡No te quedes fuera!";
        } else {
          subject = `❤️ ¡A todos les encanta! ${currentActivity.name} es el nuevo favorito`
          badgeColor = "#ec4899";
          badgeText = "❤️ EL FAVORITO DE TODOS";
          messageText = "¡Este panorama se ha convertido en el favorito de todos! La comunidad lo ha elegido como uno de los lugares más top e imperdibles.";
        }

        const htmlContent = `
          <div style="font-family:sans-serif; max-width:500px; margin:0 auto; padding:30px; background:#fafafa; border-radius:20px; border: 1px solid #eee;">
            <h1 style="font-size:26px; font-weight:900; margin-bottom:16px; color:#111; letter-spacing:-0.03em;">PANORAMAS</h1>
            
            <div style="display:inline-block; background:${badgeColor}; color:#fff; px-3; padding:6px 14px; rounded-full; border-radius:50px; font-size:11px; font-weight:bold; letter-spacing:0.05em; margin-bottom:20px;">
              ${badgeText}
            </div>

            <h2 style="font-size:20px; font-weight:700; margin-top:0; color:#222;">${currentActivity.name}</h2>
            <p style="color:#555; font-size:14px; line-height:1.6; margin-bottom:24px;">${messageText}</p>
            
            <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid #eaeaea; margin-bottom:24px;">
              <p style="margin:0 0 8px 0; font-size:13px; color:#888;"><strong>Categoría:</strong> ${currentActivity.category}</p>
              ${(currentActivity as any).address ? `<p style="margin:0; font-size:13px; color:#888;"><strong>Ubicación:</strong> ${(currentActivity as any).address}</p>` : ''}
            </div>

            <div style="text-align:center; margin-top:30px;">
              <a href="http://localhost:5173" style="background:#111; color:#fff; text-decoration:none; padding:12px 24px; font-size:14px; font-weight:600; border-radius:10px; display:inline-block;">
                Ver detalles en la App
              </a>
            </div>
            
            <p style="color:#aaa; font-size:11px; text-align:center; margin-top:40px; border-top:1px solid #eee; padding-top:20px;">
              Recibiste esta notificación automática porque formas parte de la comunidad Panoramas.
            </p>
          </div>
        `;

        //Enviamos el correo a la lista de distribución
        await transporter.sendMail({
          from: `"Panoramas App" <${process.env.GMAIL_USER}>`,
          to: recipientEmails.join(', '),
          subject: subject,
          html: htmlContent,
        });

        console.log(`¡Notificaciones enviadas con éxito a ${recipientEmails.length} usuarios!`);
      } catch (err) {
        console.error("Error en el proceso de envío de correos:", err);
      }
    })();
  }
  return { success: true, id: params.id, updated: updates };
});

// --- Re-geocodificar panoramas sin coordenadas (SOLO ADMIN) ---
app.post("/api/admin/activities/regeocode", async ({ request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) { set.status = 401; return { error: "No autorizado" }; }
  const caller = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  if ((caller[0]?.role ?? 'user') !== 'admin') { set.status = 403; return { error: "Acceso denegado" }; }
  const rows = await db.select().from(activities);
  let actualizados = 0;
  for (const r of rows) {
    const addr = (r as any).address;
    const sinCoords = (r.lat === 0 || r.lat == null) && (r.lng === 0 || r.lng == null);
    if (addr && sinCoords) {
      const coords = await geocodeAddress(addr);
      if (coords) {
        await db.update(activities).set({ lat: coords.lat, lng: coords.lng }).where(eq(activities.id, r.id));
        actualizados++;
      }
    }
  }
  return { success: true, actualizados };
});

// --- Distancia en auto (por carretera) via Routes API ---
app.get("/api/distance", async ({ query }) => {
  const fromLat = parseFloat(query.fromLat as string);
  const fromLng = parseFloat(query.fromLng as string);
  const toLat = parseFloat(query.toLat as string);
  const toLng = parseFloat(query.toLng as string);
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || [fromLat, fromLng, toLat, toLng].some(n => Number.isNaN(n))) return { km: null };
  if (toLat === 0 && toLng === 0) return { km: null };
  try {
    const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,condition',
      },
      body: JSON.stringify({
        origins: [{ waypoint: { location: { latLng: { latitude: fromLat, longitude: fromLng } } } }],
        destinations: [{ waypoint: { location: { latLng: { latitude: toLat, longitude: toLng } } } }],
        travelMode: 'DRIVE',
      }),
    });
    const data = await res.json();
    const el = Array.isArray(data) ? data[0] : null;
    if (el && el.condition === 'ROUTE_EXISTS' && typeof el.distanceMeters === 'number') {
      return { km: el.distanceMeters / 1000 };
    }
    console.warn('[distance] sin ruta:', JSON.stringify(data).slice(0, 200));
    return { km: null };
  } catch (e) {
    console.error('[distance] error:', e);
    return { km: null };
  }
});

// Devuelve solo el ROL del usuario (admin/user). La categoría dejó de ser una preferencia
// persistida: el interés del usuario se modela con likes/reservas/compras.
app.get("/api/preferences/:userId", async ({ params }) => {
  const u = await db.select().from(user)
    .where(eq(user.id, params.userId))
    .limit(1);

  return { role: u[0]?.role ?? 'user' };
});

// --- RUTAS FAVORITOS ---
app.post("/api/favorites", async ({ body, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  const { activityId, activity } = body as { activityId: string; activity?: any };

  // Si se envió la actividad completa, nos aseguramos de persistirla en la tabla 'activities' primero
  if (activity) {
    await db.insert(activities).values({
      id: activity.id,
      name: activity.name,
      category: activity.category,
      tag_clima: activity.tagClima || 'All',
      lat: activity.coordinates.lat,
      lng: activity.coordinates.lng,
      openingHour: activity.openingHour || null,
      closingHour: activity.closingHour || null,
    }).onConflictDoUpdate({
      target: activities.id,
      set: {
        name: activity.name,
        category: activity.category,
        tag_clima: activity.tagClima || 'All',
        lat: activity.coordinates.lat,
        lng: activity.coordinates.lng,
        openingHour: activity.openingHour || null,
        closingHour: activity.closingHour || null,
      }
    });
  }

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

// --- Disponibilidad de un panorama: fechas, horarios y cupos ---
app.get("/api/activities/:id/availability", async ({ params }) => {
  const [act] = await db.select().from(activities).where(eq(activities.id, params.id));
  if (!act) return { error: "Panorama no encontrado", fechas: [] };
  const cupos = (act as any).cuposPorDia ?? null;
  const sched = await db.select().from(activitySchedules).where(eq(activitySchedules.activityId, params.id));
  const reservas = await db.select({ d: userReservations.reservedDate })
    .from(userReservations)
    .where(and(eq(userReservations.activityId, params.id), ne(userReservations.status, 'cancelado')));
  const usados: Record<string, number> = {};
  for (const r of reservas) { if (r.d) usados[r.d] = (usados[r.d] ?? 0) + 1; }
  const fechasMap: Record<string, { horaInicio: string | null; horaFin: string | null }[]> = {};
  for (const sc of sched) {
    (fechasMap[sc.fecha] ??= []).push({ horaInicio: sc.horaInicio, horaFin: sc.horaFin });
  }
  const fechas = Object.entries(fechasMap).map(([fecha, franjas]) => ({
    fecha,
    franjas,
    cuposPorDia: cupos,
    disponibles: cupos == null ? null : Math.max(0, cupos - (usados[fecha] ?? 0)),
  })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { activityId: params.id, name: act.name, price: (act as any).price ?? null, fechas };
});

// --- Autocomplete de direcciones (Places API New) ---
app.get("/api/places/autocomplete", async ({ query, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) { set.status = 401; return { suggestions: [] }; }
  const input = (query.q as string) || '';
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || input.trim().length < 3) return { suggestions: [] };
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify({ input, includedRegionCodes: ['cl'] }),
    });
    const data = await res.json();
    const suggestions = Array.isArray(data?.suggestions)
      ? data.suggestions
          .filter((sug: any) => sug?.placePrediction)
          .map((sug: any) => ({ placeId: sug.placePrediction.placeId, description: sug.placePrediction.text?.text ?? '' }))
      : [];
    if (!suggestions.length && data?.error) console.warn('[autocomplete]', data.error?.message);
    return { suggestions };
  } catch (e) {
    console.error('[autocomplete] error:', e);
    return { suggestions: [] };
  }
});

// --- Detalle de un lugar: direccion formateada + coordenadas (Places API New) ---
app.get("/api/places/details", async ({ query, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) { set.status = 401; return { error: "No autorizado" }; }
  const placeId = (query.placeId as string) || '';
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !placeId) { set.status = 400; return { error: "placeId requerido" }; }
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,formattedAddress,location' },
    });
    const data = await res.json();
    if (data?.location) {
      return { placeId: data.id, address: data.formattedAddress ?? '', lat: data.location.latitude, lng: data.location.longitude };
    }
    console.warn('[place details]', data?.error?.message);
    set.status = 502;
    return { error: "No se pudo obtener el detalle del lugar" };
  } catch (e) {
    console.error('[place details] error:', e);
    set.status = 500;
    return { error: "Error consultando el detalle" };
  }
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
  const { activityId, payNow, reservedDate, reservedTime } = body as { activityId: string; payNow?: boolean; reservedDate?: string; reservedTime?: string };
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

  // Transaccion atomica anti-sobreventa: bloquea la actividad, valida cupos,
  // (cobra si corresponde) e inserta la reserva. Si algo falla, se revierte todo.
  try {
    const result = await db.transaction(async (tx) => {
      // Lock de la fila de la actividad para serializar reservas concurrentes
      const [locked] = await tx.select().from(activities).where(eq(activities.id, activityId)).for('update');
      const cuposDia = (locked as any)?.cuposPorDia ?? null;

      if (cuposDia != null && reservedDate) {
        const usados = await tx.select({ value: count() }).from(userReservations)
          .where(and(eq(userReservations.activityId, activityId), eq(userReservations.reservedDate, reservedDate), ne(userReservations.status, 'cancelado')));
        if ((usados[0]?.value ?? 0) >= cuposDia) {
          throw Object.assign(new Error('SIN_CUPOS'), { code: 'SIN_CUPOS' });
        }
      }

      let payment: any = null;
      let status = 'pendiente';
      if (payNow) {
        payment = await processPayment({ userId: session.user.id, activityId });
        if (!payment.success) {
          throw Object.assign(new Error('PAGO_FALLO'), { code: 'PAGO_FALLO', payment });
        }
        status = 'pagado';
      }

      const [created] = await tx.insert(userReservations).values({
        userId: session.user.id,
        activityId,
        status,
        reservedDate: reservedDate ?? null,
        reservedTime: reservedTime ?? null,
      }).returning();

      return { created, payment };
    });

    return {
      success: true,
      reservation: result.created,
      payment: result.payment
        ? { transactionId: result.payment.transactionId, processedAt: result.payment.processedAt }
        : null,
    };
  } catch (e: any) {
    if (e?.code === 'SIN_CUPOS') {
      set.status = 409;
      return { error: "No quedan cupos para esa fecha" };
    }
    if (e?.code === 'PAGO_FALLO') {
      set.status = 402;
      return { error: e.payment?.error ?? "Pago rechazado", processedAt: e.payment?.processedAt };
    }
    console.error('[reservar] transaccion revertida:', e);
    set.status = 500;
    return { error: "No se pudo crear la reserva (cambios revertidos)" };
  }
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
      activityPrice: activities.price,
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
      price: r.activityPrice ?? null,
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

  try {
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
  } catch (err) {
    console.error("❌ Error enviando OTP por correo:", err);
    return { message: "No se pudo enviar el código por correo. Intenta de nuevo en unos segundos.", error: true };
  }

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

//ENDPOINT DE INSIGHTS PARA PANORAMA POPULAR Y TENDENCIA
app.get("/api/admin/metrics", async ({ request, set }) => {
  const session = await auth.api.getSession({
    headers: request.headers
  });

  if (!session) {
    set.status = 401;
    return { error: "No autorizado" };
  }

  //Validamos que el solicitante sea un administrador real
  const caller = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);

  const callerRole = caller[0]?.role ?? 'user';
  if (callerRole !== 'admin') {
    set.status = 403;
    return { error: "Acceso denegado: se requieren privilegios de admin." };
  }

  try {
    //1. Encontrar el panorama más popular (mayor sumatoria en user_favorites)
    const popularResult = await db
      .select({
        activityId: userFavorites.activityId,
        activityName: activities.name,
        totalLikes: count(userFavorites.id),
      })
      .from(userFavorites)
      .innerJoin(activities, eq(userFavorites.activityId, activities.id)) //inner join para heredar el nombre del panorama
      .groupBy(userFavorites.activityId, activities.name)
      .orderBy((fields) => [sql`count(${userFavorites.id}) desc`])
      .limit(1);
    
    //2. Encontrar el panorama en tendencia (mayor sumatoria en user_reservations)
    //Excluimos las reservas canceladas para que la métrica sea real
    const tendenciaResult = await db
      .select({
        activityId: userReservations.activityId,
        activityName: activities.name,
        totalReservas: count(userReservations.id),
      })
      .from(userReservations)
      .innerJoin(activities, eq(userReservations.activityId, activities.id))
      .where(ne(userReservations.status, 'cancelado'))
      .groupBy(userReservations.activityId, activities.name)
      .orderBy((fields) => [sql`count(${userReservations.id}) desc`])
      .limit(1);
    
    //Mapeo seguro por si la bbdd está vacía en las primeras pruebas
    const masPopular = popularResult[0] || { activityName: "Sin likes registrados aún", totalLikes: 0 };
    const enTendencia = tendenciaResult[0] || { activityName: "Sin reservas activas aún", totalReservas: 0 };

    return {
      success: true,
      data: {
        popular: {
          name: masPopular.activityName,
          count: masPopular.totalLikes
        },
        tendencia: {
          name: enTendencia.activityName,
          count: enTendencia.totalReservas
        }
      }
    };   
  } catch (error) {
    console.error("Error al calcular métricas:", error);
    set.status = 500;
    return { error: "Error interno al procesar métricas analíticas" };
  }
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
