import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { jwt } from '@elysiajs/jwt'
import { authRoutes } from './routes/auth'
import { protectMiddleware } from 'src/middleware/protect'

// Configura las variables de entorno para Google OAuth (Crítico!!)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const JWT_SECRET = process.env.JWT_SECRET

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
  throw new Error("Faltan variables de entorno críticas.")
}

//EL BUILD
const build = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./public",
  minify: false,
})

if (!build.success) {
  console.error("Error en el Build:", build.logs);
}

//SERVIDOR UNIFICADO (Elysia maneja todo)
const app = new Elysia()
  .use(cors({
    origin: 'http://localhost:5173'
  }))

  //Configuración de JWT
  .use(
    jwt({
      name: 'jwt',
      secret: JWT_SECRET,
      schema: t.Object({
        id: t.String(),
        email: t.String(),
        role: t.String(),
        otp_verified: t.Boolean()
      })
    })
  )
  .use(authRoutes) //Cargamos las rutas de login/callback/otp

  //Rutas protegidas (usando middleware)
  //Administradores
  .guard({
    beforeHandle: protectMiddleware('admin')
  }, app => app
    .get('/admin-dashboard', () => ({
      status: "success",
      data: "Panel de control de actividades (solo Admin)"
    }))
  )

  //Usuario autenticado (que ya pasó el OTP)
  .guard({
    beforeHandle: protectMiddleware()
  }, app => app
    .get('/my-panoramas', () => ({
      status: "success",
      data: "Tus reservas y recomendaciones personales"
    }))
  )

  //Servir el frontend para cualquier otra ruta
  .get('/*', () => new Response(Bun.file("./index.html"), {
    headers: { 'Content-Type': 'text/html' }
  }))

  .listen(4000)

console.log(`🚀 PROYECTO LISTO en http://localhost:4000`);