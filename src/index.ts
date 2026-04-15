import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { auth } from './lib/auth';
import { authRoutes } from './routes/auth';
import { protectMiddleware } from 'src/middleware/protect';
import { db } from "./lib/db";
import { user } from "./lib/schema";
import { count, eq } from "drizzle-orm";

// 1. Verificación de variables de entorno
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET } = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
  throw new Error("Faltan variables de entorno críticas en el archivo .env");
}

// 2. Build del Frontend
const build = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./public",
  minify: false,
});

if (!build.success) {
  console.error("Error en el Build:", build.logs);
}

// 3. Configuración del Servidor Elysia
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
    console.log("🚀 Better-Auth procesando:", url.pathname);
    return await auth.handler(request);
  }
});

app.use(authRoutes);

//RUTAS DE OTP

app.get('/api/auth/get-my-otp/:userId', async ({ params }) => {
    const userId = params.userId;
    const [foundUser] = await db.select().from(user).where(eq(user.id, userId));
    
    if (!foundUser) return { status: "error", message: "Usuario no encontrado" };

    const ahora = new Date();
    const ultimaActualizacion = foundUser.updatedAt || foundUser.createdAt;
    const diferenciaMinutos = (ahora.getTime() - ultimaActualizacion.getTime()) / 60000;

    let secretoActual = foundUser.otpSecret;

    if (diferenciaMinutos >= 10 || !secretoActual) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        secretoActual = '';
        for (let i = 0; i < 20; i++) {
            secretoActual += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }

        await db.update(user)
            .set({ 
                otpSecret: secretoActual, 
                otpVerified: false, 
                updatedAt: new Date() 
            })
            .where(eq(user.id, userId));
        
        console.log(`🔄 SECRETO ACTUALIZADO para: ${foundUser.email}`);
    }

    //GENERADOR MATEMÁTICO PROPIO, otplib no funcionaba :(
    // Creamos una "semilla" numérica basada en el secreto único del usuario
    const seed = secretoActual.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // El código cambia cada 10 minutos (600,000 ms)
    const timeStep = Math.floor(ahora.getTime() / 600000);
    const token = ((seed * timeStep) % 1000000).toString().padStart(6, '0');

    console.log("-----------------------------------------");
    console.log(`CÓDIGO OTP GENERADO: ${token}`);
    console.log(`USUARIO: ${foundUser.email}`);
    console.log(`EXPIRA EN: ${Math.max(0, Math.floor(10 - diferenciaMinutos))} MINUTOS`);
    console.log("-----------------------------------------");

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

  // REPLICAMOS LA LÓGICA PARA VERIFICAR
  const seed = foundUser.otpSecret.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timeStep = Math.floor(new Date().getTime() / 600000);
  const expectedToken = ((seed * timeStep) % 1000000).toString().padStart(6, '0');

  if (code === expectedToken) {
    await db.update(user)
      .set({ otpVerified: true })
      .where(eq(user.id, userId));
    
    console.log(`OTP VERIFICADO con éxito para: ${foundUser.email}`);

    return {
        status: "success",
        message: "¡Segundo factor verificado!",
        user: { id: foundUser.id, email: foundUser.email, role: (foundUser as any).role || 'user' }
    };
  }

  console.log(`INTENTO FALLIDO de OTP para: ${foundUser.email}`);
  return { status: "error", message: "Código inválido o expirado" };
});

//PROTECCIÓN POR ROLES Y SERVIDO DE ARCHIVOS

app.guard({
  beforeHandle: protectMiddleware('admin')
}, (subApp) => subApp
  .get('/admin-dashboard', () => ({
    status: "success",
    data: "Panel de control de actividades (solo Admin)"
  }))
);

app.guard({
  beforeHandle: protectMiddleware()
}, (subApp) => subApp
  .get('/my-panoramas', () => ({
    status: "success",
    data: "Tus reservas y recomendaciones personales"
  }))
);

app.get('/*', () => new Response(Bun.file("./index.html"), {
  headers: { 'Content-Type': 'text/html' }
}));

const checkDatabase = async () => {
  try {
    const userCount = await db.select({ value: count() }).from(user);
    console.log("-----------------------------------------");
    console.log(`📊 USUARIOS TOTALES EN DB: ${userCount?.[0]?.value ?? 0}`);
    console.log("-----------------------------------------");
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
  }
};

await checkDatabase();

app.listen(4000);
console.log(`🚀 PROYECTO LISTO en http://localhost:4000`);