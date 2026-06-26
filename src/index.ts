import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { auth } from './lib/auth';
import { protectMiddleware } from 'src/middleware/protect';
import speakeasy from 'speakeasy';
import { db } from "./lib/db";
import { user, activities, userFavorites, userReservations, activitySchedules, verification } from "./lib/schema";
import { and, count, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { randomInt, randomUUID } from 'crypto';
import { getCurrentWeather, getWeatherForecast } from './services/weatherService';
import { isOutdoorFriendly } from './utils/weatherHelpers';
import { getSimulatedOccupancy } from './services/placesService';
import { processPayment } from './services/paymentService';

export const getSantiagoDateString = (date: Date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
};

export const getSantiagoTimeString = (date: Date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(date);
};


async function sendEmail(to: string | string[], subject: string, html: string) {
  const toArray = Array.isArray(to) ? to : [to];
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    console.warn("⚠️ Advertencia: BREVO_API_KEY o BREVO_SENDER_EMAIL no están configuradas.");
    return { success: false, error: "Missing Brevo Configuration" };
  }

  console.log(`✉️ [Brevo API] Enviando correo a: ${toArray.join(", ")} desde ${senderEmail}`);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: {
        name: "Panoramas App",
        email: senderEmail
      },
      to: toArray.map(email => ({ email })),
      subject: subject,
      htmlContent: html
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Brevo API respondió con error: ${res.status} - ${JSON.stringify(errData)}`);
  }
  return await res.json();
}

// Verificación de variables de entorno
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, OPENWEATHER_API_KEY } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET || !OPENWEATHER_API_KEY) {
  throw new Error("Faltan variables de entorno críticas en el archivo .env");
}


export const app = new Elysia();

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
  if (dateStr && dateStr !== 'today' && dateStr !== 'next5days') {
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

  const todayStr = getSantiagoDateString(new Date());
  const nowHM = getSantiagoTimeString(new Date());

  //traemos las actividades de la bbdd
  const rows = await db.select().from(activities);

  //traemos los horarios de cada panorama
  const allSchedules = await db.select().from(activitySchedules);

  // Obtener conteo de reservas activas para todas las actividades, por fecha Y por franja horaria
  // (los cupos ahora se cuentan de forma independiente por hora, no compartidos en todo el dia).
  const allReservations = await db.select({
    activityId: userReservations.activityId,
    reservedDate: userReservations.reservedDate,
    reservedTime: userReservations.reservedTime,
    count: count(userReservations.id)
  })
  .from(userReservations)
  .where(ne(userReservations.status, 'cancelado'))
  .groupBy(userReservations.activityId, userReservations.reservedDate, userReservations.reservedTime);

  // Clave compuesta fecha+franja: misma forma que el reservedTime que manda el front
  // (`${horaInicio} - ${horaFin}`), para que el conteo calce exacto con lo guardado.
  const franjaKey = (fecha: string, reservedTime?: string | null) => `${fecha}|${reservedTime ?? ''}`;

  const reservationCounts: Record<string, Record<string, number>> = {};
  for (const r of allReservations) {
    if (r.activityId && r.reservedDate) {
      const actMap = (reservationCounts[r.activityId] ??= {});
      actMap[franjaKey(r.reservedDate, r.reservedTime)] = r.count;
    }
  }

  //mapeamos las filas al formato typescript (panoramas creados por el admin)
  const mappedActivities = rows.map(row => {
    const sched = allSchedules
      .filter(sch => sch.activityId === row.id)
      .map(sch => ({ fecha: sch.fecha, horaInicio: sch.horaInicio, horaFin: sch.horaFin }));
    const primera = sched[0];

    const explicitlyDisabled = (row as any).disponible === false;

    const hasSchedules = sched.length > 0;
    const allInPast = hasSchedules && sched.every(s => {
      if (s.fecha < todayStr) return true;
      if (s.fecha === todayStr && s.horaFin && s.horaFin <= nowHM) return true;
      return false;
    });

    let allSoldOut = false;
    if (hasSchedules && !allInPast && row.cuposPorDia != null) {
      const futureSchedules = sched.filter(s => {
        if (s.fecha < todayStr) return false;
        if (s.fecha === todayStr && s.horaFin && s.horaFin <= nowHM) return false;
        return true;
      });
      if (futureSchedules.length > 0) {
        // "Agotado" = TODAS las franjas futuras de TODAS las fechas futuras sin cupo.
        // Si una sola franja de una sola fecha tiene cupo, el evento sigue disponible.
        allSoldOut = futureSchedules.every(s => {
          const usados = reservationCounts[row.id]?.[franjaKey(s.fecha, `${s.horaInicio ?? ''} - ${s.horaFin ?? ''}`)] ?? 0;
          return row.cuposPorDia! - usados <= 0;
        });
      }
    }

    const isDisponible = !explicitlyDisabled && !allInPast && !allSoldOut;

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
      disponible: isDisponible,
      explicitlyDisabled,
      schedules: sched,
    };
  });

  // Fecha objetivo de la planificación (si el usuario usó "Recomendar Panoramas").
  // 'today' se traduce a la fecha real de hoy para poder comparar contra activitySchedules.
  const targetDateStr = dateStr ? (dateStr === 'today' ? todayStr : dateStr) : undefined;

  // Cupos ya usados por panorama en una fecha dada (reservas activas de esa fecha), para poder
  // excluir los panoramas AGOTADOS en esa fecha. Se reusa tanto para la fecha de planificación
  // ("Recomendar Panoramas") como para el filtro de fecha independiente del toolbar.
  // Devuelve, para una fecha dada, cuantos cupos se usaron por actividad y por franja horaria
  // (clave `${horaInicio} - ${horaFin}`, o '' si la reserva no tiene franja especifica).
  async function buildUsadosEnFecha(fecha: string): Promise<Record<string, Record<string, number>>> {
    const reservasFecha = await db.select({ activityId: userReservations.activityId, reservedTime: userReservations.reservedTime })
      .from(userReservations)
      .where(and(eq(userReservations.reservedDate, fecha), ne(userReservations.status, 'cancelado')));
    const map: Record<string, Record<string, number>> = {};
    for (const r of reservasFecha) {
      const actMap = (map[r.activityId] ??= {});
      const key = r.reservedTime ?? '';
      actMap[key] = (actMap[key] ?? 0) + 1;
    }
    return map;
  }

  // Un panorama SIN fechas programadas se considera de entrada libre (disponible todos los días).
  // Un panorama CON fechas programadas solo aparece si la fecha coincide con alguna de sus fechas
  // agendadas Y todavía quedan cupos para esa fecha (no está agotado).
  // Generar arreglo con los próximos 5 días (de hoy a hoy+4)
  const next5DaysArray: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    next5DaysArray.push(getSantiagoDateString(d));
  }

  // Si se busca en los próximos 5 días, construimos el mapa de reservas usadas para cada fecha en el rango
  // (fecha -> activityId -> franja -> cantidad usada)
  const next5DaysUsados: Record<string, Record<string, Record<string, number>>> = {};
  if (targetDateStr === 'next5days' || filterDate === 'next5days') {
    for (const f of next5DaysArray) {
      next5DaysUsados[f] = await buildUsadosEnFecha(f);
    }
  }

  // Un panorama SIN fechas programadas se considera de entrada libre (disponible todos los días).
  // Un panorama CON fechas programadas solo aparece si la fecha coincide con alguna de sus fechas
  // agendadas Y todavía quedan cupos para esa fecha (no está agotado).
  // disponible si ALGUNA franja de esa fecha tiene cupo (no se exigen todas)
  function franjaTieneCupo(a: { id: string; cuposPorDia?: number }, s: { horaInicio?: string | null; horaFin?: string | null }, usadosPorFranja: Record<string, number>): boolean {
    if (a.cuposPorDia == null) return true;
    const key = `${s.horaInicio ?? ''} - ${s.horaFin ?? ''}`;
    const usados = usadosPorFranja[key] ?? 0;
    return a.cuposPorDia - usados > 0;
  }

  function buildMatchesDate(fecha: string | undefined, usados: Record<string, Record<string, number>>) {
    return (a: { id: string; schedules: { fecha: string; horaInicio?: string | null; horaFin?: string | null }[]; cuposPorDia?: number }): boolean => {
      if (!fecha) return true; // sin filtro de fecha
      if (!a.schedules || a.schedules.length === 0) return true; // entrada libre

      if (fecha === 'next5days') {
        // En los próximos 5 días: disponible si alguna fecha del rango tiene alguna franja con cupo
        const tieneFechaValida = a.schedules.some(s => {
          const isWithin5Days = next5DaysArray.includes(s.fecha);
          if (!isWithin5Days) return false;
          const usadosEsaFecha = next5DaysUsados[s.fecha]?.[a.id] ?? {};
          return franjaTieneCupo(a, s, usadosEsaFecha);
        });
        return tieneFechaValida;
      }

      const schedulesEnFecha = a.schedules.filter(s => s.fecha === fecha);
      if (schedulesEnFecha.length === 0) return false;
      const usadosEsaFecha = usados[a.id] ?? {};
      // La fecha es valida si AL MENOS UNA de sus franjas tiene cupo disponible
      return schedulesEnFecha.some(s => franjaTieneCupo(a, s, usadosEsaFecha));
    };
  }

  const usadosEnFecha = (targetDateStr && targetDateStr !== 'next5days') ? await buildUsadosEnFecha(targetDateStr) : {};
  const matchesPlannedDate = buildMatchesDate(targetDateStr, usadosEnFecha);

  const usadosEnFiltroFecha = (filterDate && filterDate !== 'next5days') ? await buildUsadosEnFecha(filterDate) : {};
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

  const occupancyDate = filterDate || targetDateStr || todayStr;
  const targetDateForOccupancy = occupancyDate === 'next5days' ? todayStr : occupancyDate;
  const usadosEnOccupancyPorFranja = (filterDate === occupancyDate)
    ? usadosEnFiltroFecha
    : (targetDateStr === occupancyDate)
      ? usadosEnFecha
      : await buildUsadosEnFecha(targetDateForOccupancy);
  // La heuristica de afluencia mira el dia completo, no una franja especifica: sumamos todas las horas.
  const usadosEnOccupancy: Record<string, number> = {};
  for (const [actId, porFranja] of Object.entries(usadosEnOccupancyPorFranja)) {
    usadosEnOccupancy[actId] = Object.values(porFranja).reduce((a, b) => a + b, 0);
  }

  const dateObj = occupancyDate ? new Date(occupancyDate + 'T12:00:00') : new Date();
  const dayOfWeek = dateObj.getDay();
  const filterHourStr = filterTime?.split(':')[0];
  const timeHourStr = timeStr?.split(':')[0];
  const hour = filterHourStr 
    ? parseInt(filterHourStr, 10) 
    : (timeHourStr ? parseInt(timeHourStr, 10) : new Date().getHours());

  const placesWithOccupancy = baseList.map(a => ({
    ...a,
    occupancy: getSimulatedOccupancy(a.category, hour, dayOfWeek, a.cuposPorDia, usadosEnOccupancy[a.id] ?? 0, a.vicinity)
  }));

  // Evaluación de condiciones climáticas adaptativas (Tu lógica + Barros)
  const conditionClean = (weather?.condition || currentCondition || '').toLowerCase().trim();
  const aptoParaExteriores = isOutdoorFriendly(conditionClean);
  console.log(`¿El clima detectado es apto para exteriores?: ${aptoParaExteriores ? 'SÍ' : 'NO'}`);

  // Mapeamos el main de OpenWeatherMap a los tags oficiales de la BBDD (Sunny, Rainy)
  const currentMainCondition = weather?.condition || currentCondition;
  const weatherTag = (currentMainCondition === 'Clear' || currentMainCondition === 'Clouds') ? 'Sunny' : 'Rainy';

  // Ordenamos la grilla dejando primero las actividades que favorecen al clima actual de Santiago
  const climateRecommended = (priceSort || radius !== 30000)
    ? [...placesWithOccupancy]
    : [...placesWithOccupancy].sort((a, b) => {
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
    occupancy: getSimulatedOccupancy(a.category, hour, dayOfWeek, a.cuposPorDia, usadosEnOccupancy[a.id] ?? 0, a.vicinity),
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

  // Volvemos a ordenar la lista combinada final respetando el sort activo
  const finalOrdered = [...combinedActivities];
  if (priceSort) {
    finalOrdered.sort((a, b) => {
      const pa = a.price ?? 0, pb = b.price ?? 0;
      return priceSort === 'asc' ? pa - pb : pb - pa;
    });
  } else if (radius !== 30000) {
    finalOrdered.sort((a, b) =>
      getDistanceInMeters(lat, lng, a.coordinates.lat, a.coordinates.lng) -
      getDistanceInMeters(lat, lng, b.coordinates.lat, b.coordinates.lng)
    );
  } else {
    finalOrdered.sort((a, b) => {
      const aCalzaClima = a.tagClima === weatherTag;
      const bCalzaClima = b.tagClima === weatherTag;

      if (aCalzaClima && !bCalzaClima) return -1;
      if (!aCalzaClima && bCalzaClima) return 1;
      return 0;
    });
  }

  // Filtrar las fechas programadas de cada panorama para que solo se devuelvan
  // las que pertenecen al rango de planificación activo.  Así el frontend no
  // muestra fechas fuera del rango seleccionado por el usuario.
  const activeDateFilter = targetDateStr || filterDate;
  const filteredActivities = finalOrdered.map(a => {
    if (!a.schedules || a.schedules.length === 0) return a;
    if (activeDateFilter === 'next5days') {
      return { ...a, schedules: a.schedules.filter((s: { fecha: string }) => next5DaysArray.includes(s.fecha)) };
    }
    if (activeDateFilter && activeDateFilter !== 'today') {
      // Fecha específica: solo mostrar la fecha que coincida
      return { ...a, schedules: a.schedules.filter((s: { fecha: string }) => s.fecha === activeDateFilter) };
    }
    if (activeDateFilter === 'today') {
      return { ...a, schedules: a.schedules.filter((s: { fecha: string }) => s.fecha === todayStr) };
    }
    return a;
  });

  // retornamos la lista combinada y optimizada, y la data del usuario
  return {
    currentWeather: weather,
    activities: filteredActivities,
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

// --- Grupo de rutas administrativas (SOLO ADMIN) ---
app.group("/api/admin", (adminGroup) => adminGroup
  .guard({
    beforeHandle: protectMiddleware('admin')
  }, (adminApp) => adminApp
    .post("/activities", async ({ body, set }) => {
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
            limitePorPersona: typeof b.limite_por_persona === 'number' ? b.limite_por_persona : null,
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
    })
    .get("/activities", async () => {
      const rows = await db.select().from(activities);
      const allSchedules = await db.select().from(activitySchedules);
      const allReservas = await db.select({
        activityId: userReservations.activityId,
        reservedDate: userReservations.reservedDate,
        reservedTime: userReservations.reservedTime,
        count: count(userReservations.id),
      }).from(userReservations)
        .where(ne(userReservations.status, 'cancelado'))
        .groupBy(userReservations.activityId, userReservations.reservedDate, userReservations.reservedTime);

      const usados: Record<string, Record<string, number>> = {};
      for (const r of allReservas) {
        if (!r.activityId || !r.reservedDate) continue;
        const actMap = (usados[r.activityId] ??= {});
        actMap[`${r.reservedDate}|${r.reservedTime ?? ''}`] = r.count;
      }

      const todayStr = getSantiagoDateString(new Date());
      const nowHM = getSantiagoTimeString(new Date());

      return rows.map(r => {
        const explicitlyDisabled = (r as any).disponible === false;
        const sched = allSchedules.filter(s => s.activityId === r.id);
        const hasSchedules = sched.length > 0;
        const allInPast = hasSchedules && sched.every(s => {
          if (s.fecha < todayStr) return true;
          if (s.fecha === todayStr && s.horaFin && s.horaFin <= nowHM) return true;
          return false;
        });
        const cupos = (r as any).cuposPorDia ?? null;
        let allSoldOut = false;
        if (hasSchedules && !allInPast && cupos != null) {
          const futureSchedules = sched.filter(s => {
            if (s.fecha < todayStr) return false;
            if (s.fecha === todayStr && s.horaFin && s.horaFin <= nowHM) return false;
            return true;
          });
          if (futureSchedules.length > 0) {
            allSoldOut = futureSchedules.every(s => {
              const usadosFr = usados[r.id]?.[`${s.fecha}|${s.horaInicio ?? ''} - ${s.horaFin ?? ''}`] ?? 0;
              return cupos - usadosFr <= 0;
            });
          }
        }
        // motivo: por que no esta disponible (si aplica), para que el admin entienda el estado real
        const motivo = explicitlyDisabled ? 'manual' : allInPast ? 'vencido' : allSoldOut ? 'agotado' : null;

        return {
          id: r.id,
          name: r.name,
          category: r.category,
          imageUrl: (r as any).imageUrl ?? null,
          price: (r as any).price ?? null,
          address: (r as any).address ?? null,
          isTendencia: (r as any).isTendencia ?? false,
          isPopular: (r as any).isPopular ?? false,
          // disponible = flag manual del admin (lo que controla el boton de la UI)
          disponible: (r as any).disponible ?? true,
          // disponibleReal = lo que el usuario final ve (considera vencido/agotado ademas del flag manual)
          disponibleReal: !explicitlyDisabled && !allInPast && !allSoldOut,
          motivoNoDisponible: motivo,
        };
      });
    })
    .delete("/activities/:id", async ({ params }) => {
      await db.delete(activities).where(eq(activities.id, params.id));
      return { success: true, id: params.id };
    })
    .get("/activities/:id", async ({ params, set }) => {
      const [act] = await db.select().from(activities).where(eq(activities.id, params.id));
      if (!act) { set.status = 404; return { error: "Actividad no encontrada" }; }
      const scheds = await db.select().from(activitySchedules).where(eq(activitySchedules.activityId, params.id));
      
      const diasMap: Record<string, { fecha: string; franjas: { horaInicio: string; horaFin: string }[] }> = {};
      for (const s of scheds) {
        let dayGroup = diasMap[s.fecha];
        if (!dayGroup) {
          dayGroup = { fecha: s.fecha, franjas: [] };
          diasMap[s.fecha] = dayGroup;
        }
        if (s.horaInicio || s.horaFin) {
          dayGroup.franjas.push({
            horaInicio: s.horaInicio || '',
            horaFin: s.horaFin || '',
          });
        }
      }
      
      return {
        id: act.id,
        name: act.name,
        category: act.category,
        tag_clima: act.tag_clima,
        imageUrl: (act as any).imageUrl ?? null,
        description: (act as any).description ?? null,
        address: (act as any).address ?? null,
        placeId: (act as any).placeId ?? null,
        price: (act as any).price ?? null,
        cupos_por_dia: (act as any).cuposPorDia ?? null,
        limite_por_persona: (act as any).limitePorPersona ?? null,
        isTendencia: (act as any).isTendencia ?? false,
        isPopular: (act as any).isPopular ?? false,
        disponible: (act as any).disponible ?? true,
        schedules: Object.values(diasMap),
      };
    })
    .patch("/activities/:id", async ({ params, body, set }) => {
      const b = body as any;
      const updates: any = {};

      if (b.name !== undefined) updates.name = b.name;
      if (b.category !== undefined) updates.category = b.category;
      if (b.description !== undefined) updates.description = b.description;
      if (b.address !== undefined) updates.address = b.address;
      if (b.tag_clima !== undefined) updates.tag_clima = b.tag_clima;
      // El front manda `null` (no solo '') cuando se limpia el campo, asi que ambos casos
      // deben tratarse como "sin valor" -- si no, Number(null) da 0 en vez de quedar vacio.
      if (b.price !== undefined) updates.price = (b.price === '' || b.price == null) ? null : Number(b.price);
      if (b.cupos_por_dia !== undefined) updates.cuposPorDia = (b.cupos_por_dia === '' || b.cupos_por_dia == null) ? null : Number(b.cupos_por_dia);
      if (b.limite_por_persona !== undefined) updates.limitePorPersona = (b.limite_por_persona === '' || b.limite_por_persona == null) ? null : Number(b.limite_por_persona);
      if (b.image_url !== undefined) updates.imageUrl = b.image_url;
      if (b.place_id !== undefined) updates.placeId = b.place_id;
      
      if (typeof b.isTendencia === 'boolean') updates.isTendencia = b.isTendencia;
      if (typeof b.isPopular === 'boolean') updates.isPopular = b.isPopular;
      if (typeof b.disponible === 'boolean') updates.disponible = b.disponible;

      const [currentActivity] = await db.select().from(activities).where(eq(activities.id, params.id));
      if (!currentActivity) { set.status = 404; return { error: "Actividad no encontrada" }; }

      if (b.address !== undefined && b.address !== (currentActivity as any).address) {
        const coords = (typeof b.coordinates?.lat === 'number' && typeof b.coordinates?.lng === 'number')
          ? { lat: b.coordinates.lat, lng: b.coordinates.lng }
          : await geocodeAddress(b.address);
        if (coords) {
          updates.lat = coords.lat;
          updates.lng = coords.lng;
        }
      } else if (b.coordinates?.lat !== undefined) {
        updates.lat = b.coordinates.lat;
        updates.lng = b.coordinates.lng;
      }

      try {
        await db.transaction(async (tx) => {
          if (Object.keys(updates).length > 0) {
            await tx.update(activities).set(updates).where(eq(activities.id, params.id));
          }

          if (Array.isArray(b.schedules)) {
            await tx.delete(activitySchedules).where(eq(activitySchedules.activityId, params.id));
            for (const dia of b.schedules) {
              if (!dia?.fecha) continue;
              const franjas = Array.isArray(dia.franjas) ? dia.franjas : [];
              for (const f of franjas) {
                await tx.insert(activitySchedules).values({
                  activityId: params.id,
                  fecha: dia.fecha,
                  horaInicio: f?.horaInicio || null,
                  horaFin: f?.horaFin || null,
                });
              }
            }
          }
        });
      } catch (e) {
        console.error('[editar panorama] transaccion revertida:', e);
        set.status = 500;
        return { error: "No se pudo actualizar el panorama (cambios revertidos)" };
      }

      const seVolvioTendencia = updates.isTendencia === true && !(currentActivity as any).isTendencia;
      const seVolvioPopular = updates.isPopular === true && !(currentActivity as any).isPopular;

      if (seVolvioTendencia || seVolvioPopular) {
        (async () => {
          try {
            console.log(`Iniciando campaña de correos masivos para: "${currentActivity.name}"`);

            const allUsers = await db.select({ email: user.email }).from(user);
            const recipientEmails = allUsers.map(u => u.email).filter(Boolean) as string[];

            if (recipientEmails.length === 0) {
              console.log("No hay destinatarios registrados para enviar la campaña.");
              return;
            }

            const subject = seVolvioTendencia
              ? `🔥 ¡Panorama en Tendencia: "${currentActivity.name}"!`
              : `⭐ ¡Panorama Popular: "${currentActivity.name}"!`;

            const headingText = seVolvioTendencia
              ? "¡Este panorama está causando furor!"
              : "¡Este panorama es uno de los favoritos de la comunidad!";

            const htmlContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
                <h2 style="color: #4f46e5; text-align: center;">${headingText}</h2>
                <p>Hola,</p>
                <p>Queremos contarte que el panorama <strong>"${currentActivity.name}"</strong> ahora es considerado uno de los más destacados de nuestra plataforma.</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #1f2937;">${currentActivity.name}</h3>
                  <p style="color: #4b5563; margin-bottom: 0;">${(currentActivity as any).description || "Sin descripción disponible."}</p>
                </div>
                <p style="text-align: center; margin-top: 30px;">
                  <a href="https://panoramapp.onrender.com" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver Detalles</a>
                </p>
                <hr style="border: 0; border-top: 1px solid #e0e0e0; margin-top: 40px;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center;">Recibiste este correo porque estás registrado en Panoramas App.</p>
              </div>
            `;

            await sendEmail(recipientEmails, subject, htmlContent);
            console.log(`¡Notificaciones enviadas con éxito a ${recipientEmails.length} usuarios!`);
          } catch (err) {
            console.error("Error en el proceso de envío de correos:", err);
          }
        })();
      }
      return { success: true, id: params.id, updated: updates };
    })
    .post("/activities/regeocode", async ({ set }) => {
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
    })
    .get("/metrics", async ({ set }) => {
      try {
        const popularResult = await db
          .select({
            activityId: userFavorites.activityId,
            activityName: activities.name,
            totalLikes: count(userFavorites.id),
          })
          .from(userFavorites)
          .innerJoin(activities, eq(userFavorites.activityId, activities.id))
          .groupBy(userFavorites.activityId, activities.name)
          .orderBy((fields) => [sql`count(${userFavorites.id}) desc`])
          .limit(1);

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
    })
    .get("/stats", async ({ set }) => {
      const totalUsersResult = await db.select({ value: count() }).from(user);
      const totalUsers = totalUsersResult[0]?.value ?? 0;

      const totalActivitiesResult = await db.select({ value: count() }).from(activities);
      const totalActivities = totalActivitiesResult[0]?.value ?? 0;

      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const otpsSentTodayResult = await db.select({ value: count() }).from(verification)
        .where(gt(verification.createdAt, todayStart));
      const otpsSentToday = otpsSentTodayResult[0]?.value ?? 0;

      const categoryCounts = await db.select({
        category: activities.category,
        count: count()
      }).from(activities).groupBy(activities.category);

      let topCategory = "Parque";
      let maxCount = 0;
      for (const c of categoryCounts) {
        if (c.count > maxCount) {
          maxCount = c.count;
          topCategory = c.category;
        }
      }

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
    })
    .patch("/users/:targetUserId/role", async ({ params, body, request, set }) => {
      const session = await auth.api.getSession({ headers: request.headers });
      if (session?.user?.id === params.targetUserId) {
        set.status = 400;
        return { error: "No puedes cambiar tu propio rol" };
      }

      const { role } = body as { role: 'user' | 'admin' };
      if (role !== 'user' && role !== 'admin') {
        set.status = 400;
        return { error: "Rol inválido" };
      }

      const SUPER_ADMIN_EMAIL = "danielmpizarro@alumnos.uai.cl";
      const [targetUser] = await db.select().from(user).where(eq(user.id, params.targetUserId)).limit(1);
      if (!targetUser) {
        set.status = 404;
        return { error: "Usuario no encontrado" };
      }

      if (targetUser.email === SUPER_ADMIN_EMAIL) {
        set.status = 403;
        return { error: "No está permitido modificar el rol del superadministrador principal" };
      }

      await db.update(user)
        .set({ role: role })
        .where(eq(user.id, params.targetUserId));

      return { success: true, userId: params.targetUserId, newRole: role };
    })
  )
);

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

// --- ACTIVACIÓN DE ADMINISTRADOR HÍBRIDA (OTP / TOTP) ---
const getAuthorizedAdminEmails = () => {
  const list = process.env.AUTHORIZED_ADMIN_EMAILS || "";
  return list.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
};

app.post("/api/request-admin-otp", async ({ request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id || !session.user.email) {
    set.status = 401;
    return { error: "No autorizado" };
  }

  const email = session.user.email.toLowerCase();
  const authorizedEmails = getAuthorizedAdminEmails();
  if (!authorizedEmails.includes(email)) {
    set.status = 403;
    return { error: "Tu correo no está en la lista de correos autorizados para activación automática. Solicita el código TOTP manual al administrador." };
  }

  const code = randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
  const identifier = `admin-otp:${email}`;

  // Eliminar OTPs anteriores para este identificador
  await db.delete(verification).where(eq(verification.identifier, identifier));

  // Guardar en la tabla de verificación
  await db.insert(verification).values({
    id: randomUUID(),
    identifier,
    value: code,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`🔑 [Admin OTP] Código generado para ${email}: ${code}`);
  }

  try {
    await sendEmail(session.user.email, "Código de activación Administrador - Panoramas", `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:40px;background:#fff;border-radius:16px;">
        <h1 style="font-size:24px;font-weight:900;margin-bottom:8px;color:#d97706;">PANORAMAS</h1>
        <p style="color:#666;margin-bottom:32px;">Tu código de verificación para activar el rol de Administrador es:</p>
        <div style="font-size:48px;font-weight:900;letter-spacing:0.5em;text-align:center;padding:24px;background:#fef3c7;color:#d97706;border-radius:12px;margin-bottom:24px;">
          ${code}
        </div>
        <p style="color:#999;font-size:12px;">Este código expira en 10 minutos.</p>
      </div>
    `);
  } catch (err) {
    console.error("❌ Error enviando OTP de Administrador:", err);
    if (process.env.NODE_ENV !== "production") {
      console.log(`💡 [Desarrollo] OTP de Administrador en consola: ${code}`);
      return { success: true, message: `Código generado en desarrollo: ${code}` };
    }
    set.status = 500;
    return { error: "No se pudo enviar el código por correo. Intenta de nuevo." };
  }

  return { success: true, message: "Código enviado a tu correo" };
});

app.post("/api/activate-admin", async ({ body, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id || !session.user.email) {
    set.status = 401;
    return { error: "No autorizado" };
  }

  const { token } = body as { token: string };
  if (!token) {
    set.status = 400;
    return { error: "Código de verificación requerido" };
  }

  const cleanToken = token.trim();

  // 1. Intentar validar como TOTP manual (Administrador)
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  const isValidTotp = totpSecret ? speakeasy.totp.verify({
    secret: totpSecret,
    encoding: 'base32',
    token: cleanToken
  }) : false;

  let activationMethod = 'totp';

  if (!isValidTotp) {
    // 2. Si no es TOTP válido, intentar validar como OTP enviado por correo
    const identifier = `admin-otp:${session.user.email.toLowerCase()}`;
    const [record] = await db.select()
      .from(verification)
      .where(and(
        eq(verification.identifier, identifier),
        eq(verification.value, cleanToken)
      ));

    if (!record) {
      set.status = 400;
      return { error: "Código incorrecto o expirado" };
    }

    if (new Date() > record.expiresAt) {
      // Eliminar el código expirado
      await db.delete(verification).where(eq(verification.id, record.id));
      set.status = 400;
      return { error: "El código de verificación ha expirado" };
    }

    // Código válido, eliminarlo para prevenir reuso
    await db.delete(verification).where(eq(verification.id, record.id));
    activationMethod = 'email';
  }

  // Activar rol de administrador
  await db.update(user)
    .set({ role: 'admin' })
    .where(eq(user.id, session.user.id));

  console.log(`👑 Rol 'admin' activado mediante ${activationMethod.toUpperCase()} para: ${session.user.email}`);
  return { success: true, method: activationMethod };
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
  
  if (act.disponible === false) {
    return { activityId: params.id, name: act.name, price: act.price ?? null, limitePorPersona: (act as any).limitePorPersona ?? null, fechas: [] };
  }

  const cupos = act.cuposPorDia ?? null;
  const sched = await db.select().from(activitySchedules).where(eq(activitySchedules.activityId, params.id));
  const reservas = await db.select({ d: userReservations.reservedDate, t: userReservations.reservedTime })
    .from(userReservations)
    .where(and(eq(userReservations.activityId, params.id), ne(userReservations.status, 'cancelado')));
  // usados por fecha+franja: los cupos ahora se cuentan por hora, no compartidos en todo el dia
  const usadosPorFranja: Record<string, number> = {};
  for (const r of reservas) {
    if (!r.d) continue;
    const key = `${r.d}|${r.t ?? ''}`;
    usadosPorFranja[key] = (usadosPorFranja[key] ?? 0) + 1;
  }
  const fechasMap: Record<string, { horaInicio: string | null; horaFin: string | null }[]> = {};
  for (const sc of sched) {
    (fechasMap[sc.fecha] ??= []).push({ horaInicio: sc.horaInicio, horaFin: sc.horaFin });
  }
  const todayStr = getSantiagoDateString(new Date());
  const nowHM = getSantiagoTimeString(new Date());

  const fechas = Object.entries(fechasMap)
    .filter(([fecha]) => fecha >= todayStr)
    .map(([fecha, franjas]) => {
      const activeFranjas = fecha === todayStr
        ? franjas.filter(fr => !fr.horaFin || fr.horaFin > nowHM)
        : franjas;
      // cupos restantes por franja (cada hora cuenta de forma independiente)
      const franjasConCupos = activeFranjas.map(fr => {
        const key = `${fecha}|${fr.horaInicio ?? ''} - ${fr.horaFin ?? ''}`;
        const usadosFr = usadosPorFranja[key] ?? 0;
        return { ...fr, disponibles: cupos == null ? null : Math.max(0, cupos - usadosFr) };
      });
      // La fecha esta disponible si ALGUNA franja tiene cupo (no se exigen todas)
      const disponibles = cupos == null
        ? null
        : franjasConCupos.length > 0
          ? Math.max(...franjasConCupos.map(f => f.disponibles ?? 0))
          : Math.max(0, cupos - (usadosPorFranja[`${fecha}|`] ?? 0));
      return {
        fecha,
        franjas: franjasConCupos,
        cuposPorDia: cupos,
        disponibles,
      };
    })
    .filter(f => f.franjas.length > 0 || (fechasMap[f.fecha]?.length ?? 0) === 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { activityId: params.id, name: act.name, price: act.price ?? null, limitePorPersona: (act as any).limitePorPersona ?? null, fechas };
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
  const { activityId, payNow, reservedDate, reservedTime, cantidad: cantidadRaw } = body as { activityId: string; payNow?: boolean; reservedDate?: string; reservedTime?: string; cantidad?: number };
  if (!activityId) {
    set.status = 400;
    return { error: "activityId requerido" };
  }
  // Cuantos cupos de la misma franja se reservan de una sola vez (ej. comprar 3 entradas juntas)
  const cantidad = Number.isInteger(cantidadRaw) && (cantidadRaw as number) > 0 ? Math.min(cantidadRaw as number, 20) : 1;

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
      const limitePorPersona = (locked as any)?.limitePorPersona ?? null;

      // Los cupos se cuentan por franja horaria (fecha + reservedTime), no por todo el dia:
      // dos personas pueden reservar el mismo dia en horas distintas sin competir por el mismo cupo.
      if (cuposDia != null && reservedDate) {
        const usados = await tx.select({ value: count() }).from(userReservations)
          .where(and(
            eq(userReservations.activityId, activityId),
            eq(userReservations.reservedDate, reservedDate),
            reservedTime ? eq(userReservations.reservedTime, reservedTime) : isNull(userReservations.reservedTime),
            ne(userReservations.status, 'cancelado'),
          ));
        if ((usados[0]?.value ?? 0) + cantidad > cuposDia) {
          throw Object.assign(new Error('SIN_CUPOS'), { code: 'SIN_CUPOS' });
        }
      }

      // Limite de cupos por persona: cuenta lo que ESTE usuario ya tiene reservado en esa misma
      // franja (sumado a lo nuevo), para que no lo evada reservando varias veces por separado.
      if (limitePorPersona != null && reservedDate) {
        const propios = await tx.select({ value: count() }).from(userReservations)
          .where(and(
            eq(userReservations.activityId, activityId),
            eq(userReservations.userId, session.user.id),
            eq(userReservations.reservedDate, reservedDate),
            reservedTime ? eq(userReservations.reservedTime, reservedTime) : isNull(userReservations.reservedTime),
            ne(userReservations.status, 'cancelado'),
          ));
        if ((propios[0]?.value ?? 0) + cantidad > limitePorPersona) {
          throw Object.assign(new Error('LIMITE_PERSONA'), { code: 'LIMITE_PERSONA', limitePorPersona });
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

      // Cada cupo comprado de una vez es su propia fila (asi el conteo por franja sigue siendo
      // un simple COUNT(*), sin necesitar una columna de cantidad aparte).
      const created = await tx.insert(userReservations).values(
        Array.from({ length: cantidad }, () => ({
          userId: session.user.id,
          activityId,
          status,
          reservedDate: reservedDate ?? null,
          reservedTime: reservedTime ?? null,
        }))
      ).returning();

      return { created, payment };
    });

    return {
      success: true,
      cantidad: result.created.length,
      reservation: result.created[0],
      payment: result.payment
        ? { transactionId: result.payment.transactionId, processedAt: result.payment.processedAt }
        : null,
    };
  } catch (e: any) {
    if (e?.code === 'SIN_CUPOS') {
      set.status = 409;
      return { error: "No quedan cupos para esa fecha" };
    }
    if (e?.code === 'LIMITE_PERSONA') {
      set.status = 409;
      return { error: `Este panorama permite reservar como máximo ${e.limitePorPersona} cupo(s) por persona`, code: 'LIMITE_PERSONA' };
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
      reservedDate: userReservations.reservedDate,
      reservedTime: userReservations.reservedTime,
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
    reservedDate: r.reservedDate,
    reservedTime: r.reservedTime,
    activity: r.activityName ? {
      id: r.activityId,
      name: r.activityName,
      category: r.activityCategory,
      price: r.activityPrice ?? null,
      coordinates: { lat: r.activityLat, lng: r.activityLng },
    } : null,
  }));
});

// POST /api/reservations/pay-batch { ids: string[] }: paga de una sola vez un grupo de
// reservas pendientes que se crearon juntas (ej. "reservar 3 cupos"), con un solo cobro.
app.post("/api/reservations/pay-batch", async ({ body, request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  const { ids } = body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    set.status = 400;
    return { error: "ids requerido" };
  }

  const rows = await db.select().from(userReservations).where(inArray(userReservations.id, ids));
  if (rows.length !== ids.length || rows.some(r => r.userId !== session.user.id)) {
    set.status = 403;
    return { error: "Prohibido" };
  }
  if (rows.some(r => r.status !== 'pendiente')) {
    set.status = 409;
    return { error: "Alguna de estas reservas ya no esta pendiente" };
  }

  const activityId = rows[0]!.activityId;
  const payment = await processPayment({ userId: session.user.id, activityId });
  if (!payment.success) {
    set.status = 402;
    return { error: payment.error ?? "Pago rechazado", processedAt: payment.processedAt };
  }

  await db.update(userReservations).set({ status: 'pagado' }).where(inArray(userReservations.id, ids));
  return {
    success: true,
    cantidad: ids.length,
    payment: { transactionId: payment.transactionId, processedAt: payment.processedAt },
  };
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

// DELETE /api/reservations/cancelled : limpia (borra) las reservas canceladas del usuario
app.delete("/api/reservations/cancelled", async ({ request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    set.status = 401;
    return { error: "No autorizado" };
  }
  const deleted = await db.delete(userReservations)
    .where(and(eq(userReservations.userId, session.user.id), eq(userReservations.status, 'cancelado')))
    .returning({ id: userReservations.id });
  return { success: true, deleted: deleted.length };
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

  if (process.env.NODE_ENV !== "production") {
    console.log(`🔑 [OTP] Código generado para ${email}: ${code}`);
  }

  try {
    await sendEmail(email, "Tu código de verificación - Panoramas", `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:40px;background:#fff;border-radius:16px;">
        <h1 style="font-size:24px;font-weight:900;margin-bottom:8px;">PANORAMAS</h1>
        <p style="color:#666;margin-bottom:32px;">Tu código de verificación es:</p>
        <div style="font-size:48px;font-weight:900;letter-spacing:0.5em;text-align:center;padding:24px;background:#f5f5f5;border-radius:12px;margin-bottom:24px;">
          ${code}
        </div>
        <p style="color:#999;font-size:12px;">Este código expira en 10 minutos.</p>
      </div>
    `);
  } catch (err) {
    console.error("❌ Error enviando OTP por Brevo:", err);
    if (process.env.NODE_ENV !== "production") {
      console.log(`💡 [Desarrollo] Usando código fallback: ${code}`);
      return { message: "Código enviado" };
    }
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

const serverPort = process.env.PORT || 4000;
app.listen(serverPort);
console.log(`🚀 PROYECTO LISTO en http://localhost:${serverPort}`);
