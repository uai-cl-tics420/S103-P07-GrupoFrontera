import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { auth } from './lib/auth'
import { authRoutes } from './routes/auth'
import { protectMiddleware } from 'src/middleware/protect'
import { db } from "./lib/db"
import { user } from "./lib/schema"
import { count } from "drizzle-orm"

// 1. Verificación de variables de entorno
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET } = process.env

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
  throw new Error("❌ Faltan variables de entorno críticas en el archivo .env")
}

// 2. Build del Frontend
const build = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./public",
  minify: false,
})

if (!build.success) {
  console.error("Error en el Build:", build.logs);
}

// 3. Configuración del Servidor Elysia
const app = new Elysia()
  .use(cors({
    origin: 'http://localhost:5173',
    credentials: true 
  }))
  
  // INTERCEPTOR DE AUTH: Usamos .onRequest para máxima prioridad
  .onRequest(async ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/auth")) {
      console.log("🚀 Auth Handler procesando:", url.pathname);
      return await auth.handler(request);
    }
  })

  // Rutas de tu API
  .use(authRoutes)

  // Guard de Administradores
  .guard({
    beforeHandle: protectMiddleware('admin')
  }, (subApp) => subApp
    .get('/admin-dashboard', () => ({
      status: "success",
      data: "Panel de control de actividades (solo Admin)"
    }))
  )

  // Guard de Usuarios Autenticados
  .guard({
    beforeHandle: protectMiddleware()
  }, (subApp) => subApp
    .get('/my-panoramas', () => ({
      status: "success",
      data: "Tus reservas y recomendaciones personales"
    }))
  )

  // Servir el index.html
  .get('/*', () => new Response(Bun.file("./index.html"), {
    headers: { 'Content-Type': 'text/html' }
  }))

// 4. Lógica de inicio y conteo
const checkDatabase = async () => {
  try {
    const userCount = await db.select({ value: count() }).from(user);
    console.log("-----------------------------------------");
    console.log(`USUARIOS TOTALES EN DB: ${userCount?.[0]?.value ?? 0}`);
    console.log("-----------------------------------------");
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
  }
}

await checkDatabase();

app.listen(4000);

console.log(`🚀 PROYECTO LISTO en http://localhost:4000`);