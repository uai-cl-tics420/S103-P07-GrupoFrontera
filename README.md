# Panoramas — ¿Qué me recomiendas hacer?

Asistente que recomienda actividades de ocio según las preferencias del usuario y condiciones externas (clima, afluencia de público, disponibilidad de eventos).

## Integrantes

| Nombre | GitHub |
|--------|--------|
| Daniel Pizarro | [@DanielPizarroJ](https://github.com/DanielPizarroJ) |
| Ignacio Barros | [@nachobarroos](https://github.com/nachobarroos) |
| Faustina Parada | [@fauparada](https://github.com/fauparada) |

## Funcionalidades

1. **Sistema de recomendaciones personalizadas** — Sugerencias basadas en historial del usuario con filtros por categoría (cine, teatro, parques, etc.).
2. **Integración con clima** — Sugerencias adaptadas a la meteorología actual usando OpenWeatherMap.
3. **Integración con Google Maps y afluencia** — Lugares cercanos con ocupación estimada en tiempo real.
4. **Reservas y compra de entradas** — Opción de reservar o comprar boletos, con notificaciones de eventos en tendencia.

## Requisitos previos

- [Bun](https://bun.sh) v1.2 o superior
- [Docker](https://www.docker.com) y Docker Compose (para entorno en contenedor)

## Instalación y ejecución

### Con Bun (local)

```bash
bun install
bun run dev
```

La app queda disponible en `http://localhost:4000`.

### Con Docker (recomendado para desarrollo en equipo)

```bash
docker compose up
```

Esto construye la imagen y levanta el servidor con hot reload en `http://localhost:4000`.

## Política de ramas

| Prefijo | Uso | Ejemplo |
|---------|-----|---------|
| `feat/` | Nueva funcionalidad | `feat/recomendaciones-issue1` |
| `fix/` | Corrección de bug | `fix/clima-api-issue9` |
| `docs/` | Solo documentación | `docs/readme-issue4` |
| `arquitectura/` | Modelos de datos o estructura | `arquitectura/data-models-issue3` |
| `investigacion/` | Análisis técnico o pruebas de concepto | `investigacion/analisis-api-issue5` |

Cada rama debe asociarse al número de issue correspondiente. El avance del trabajo se registra a través de commits dentro de cada rama. La rama `main` se mantiene protegida y no se modifica directamente.

## Seguridad

Consulta nuestro [archivo de seguridad](./SECURITY.md) para detalles sobre la implementación de TOTP y firma de tokens.

## Despliegue en la Nube (Producción)

La aplicación está configurada para desplegarse en **Render** con la base de datos en **Supabase** y es accesible en:
👉 **[https://panoramapp.onrender.com](https://panoramapp.onrender.com)**

### Configuración de Render

El despliegue se realiza de forma automática utilizando el **Dockerfile** raíz. Este construye el frontend React con Vite y levanta el servidor backend Elysia en el puerto 4000 (o el puerto dinámico asignado por Render).

Para que la aplicación funcione en producción, se deben definir las siguientes variables de entorno en el panel de **Render (Environment)**:

| Variable | Descripción | Formato / Ejemplo |
|----------|-------------|-------------------|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `DATABASE_URL` | URL de conexión de Supabase (Connection Pooler) | `postgresql://postgres.xxx:pass@aws-1-us-west-2.pooler.supabase.com:5432/postgres` |
| `BETTER_AUTH_URL` | URL pública de la aplicación | `https://panoramapp.onrender.com` |
| `BETTER_AUTH_SECRET` | Clave para cifrar sesiones de better-auth | `un_secreto_largo_y_seguro` |
| `JWT_SECRET` | Clave para firma de tokens JWT internos | `otro_secreto_largo_y_seguro` |
| `AUTHORIZED_ADMIN_EMAILS` | Emails con permiso de activación de admin automática | `correo1@alumnos.uai.cl,correo2@gmail.com` |
| `ADMIN_TOTP_SECRET` | Clave secreta base32 para verificación TOTP manual | `TU_SECRETO_BASE32_AQUI` |
| `BREVO_API_KEY` | API Key de Brevo para envío de correos OTP | `xkeysib-xxxxxxxxx` |
| `OPENWEATHER_API_KEY` | API Key de OpenWeather | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `GOOGLE_PLACES_API_KEY` | API Key de Google Places | `AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth | `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx` |

### Notas de Base de Datos y Migraciones

La aplicación ejecuta `bunx drizzle-kit migrate` de forma automática al iniciar en Render. Si la base de datos en Supabase ya tiene las tablas creadas pero la tabla de control `drizzle.__drizzle_migrations` se encuentra vacía (lo cual causaría fallos de colisión de tablas), se debe sincronizar la metadata de migraciones insertando los registros de control locales de Drizzle (migraciones `0000` a `0004`) para asegurar arranques exitosos.

