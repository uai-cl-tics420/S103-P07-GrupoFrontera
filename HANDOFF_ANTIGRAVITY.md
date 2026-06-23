# Handoff para Antigravity 2.0 — Proyecto P07 Panoramas

> Tienes la MISMA carpeta que el asistente anterior, pero NO su historial de conversación.
> Este documento te pone al día. Lee TODO antes de tocar nada. Fecha límite: **Prueba 2 = 23 jun 2026 (mañana)**.

---

## PASO 0 — Ponte al día (análisis obligatorio antes de actuar)

Ejecuta tu propia evaluación para verificar el estado real (no confíes en memoria ajena):

1. `git status` y `git branch --show-current` → confirma rama y cambios sin commitear.
2. `git log --oneline -5` → últimos commits.
3. `bunx tsc --noEmit` (ignora warnings TS5101/baseUrl) → debe estar limpio.
4. `bun test` → deben pasar 27 tests.
5. Lee `src/index.ts` (rutas API), `src/lib/auth.ts` (better-auth), `src/middleware/protect.ts`.

---

## ESTADO ACTUAL (resumen de la sesión anterior)

**Rama de trabajo:** `chore/auditoria-previa-render-supabase` (era `fix/render-y-supabase`, renombrada).
**Último commit:** `a8dde20` (migración 0004 + email dual Gmail/Resend).

### ⚠️ HAY TRABAJO SIN COMMITEAR en el working tree (NO perderlo):
1. **Limpieza de código muerto** (verificada: tsc + tests + build OK):
   - Borrados: `src/APITester.tsx`, `src/frontend.tsx`, `build.ts`, `src/test-clima.ts`, `src/components/DetailsModal.tsx`, `src/components/ReservationModal.tsx` (eran restos del template Bun + 2 modales huérfanos que nunca se abrían).
   - Editados: `src/components/ActivityCard.tsx` (quitados imports/estados/props muertos de los modales), `src/App.tsx` (quitado prop `onReservationChanged` de ActivityCard).
   - Quitada dependencia muerta `@elysiajs/jwt` (better-auth `jwt()` es el sistema definido).
2. **Fixes de i18n** (typesafe-i18n — textos fijos que estaban hardcodeados):
   - Nueva key `weatherNotConsidered` (bug: no existía, banner de clima siempre salía en español).
   - Nueva key `tableAction` ("Acción" en AdminDashboard).
   - 6 toasts de `LoginForm.tsx` ahora usan `LL.*()` (+ keys `redirectingToGoogle`, `loginSuccessToast`, `accountCreatedToast`, `registerServerError`).
   - `CreatePanoramaForm.tsx`: el dropdown de categoría mostraba el valor crudo del enum; ahora traduce vía `categoryLabel()`.
   - Renombrada `toastPrefsSaved` → `toastShowingCategory` (texto "Mostrando {category}." — antes decía "Preferencias guardadas" que ya no aplica porque se eliminó la tabla `user_preferences`).
   - `public/main.js`/`main.css` reconstruidos.

### ⚠️ PRODUCCIÓN: login ROTO, pendiente
- En `panoramapp.onrender.com` el login da 500. Causa raíz: `BetterAuthError: Failed to decrypt private key` — la tabla `jwks` se encripta con `BETTER_AUTH_SECRET`, y local vs Render tenían secrets distintos.
- Acciones ya hechas: se borró la fila vieja de `jwks` en Supabase; Fau actualizó `BETTER_AUTH_SECRET` en Render a `un_secreto_super_seguro_y_largo_para_frontera` (igual al `.env` local). Faltaba confirmar que el redeploy de Render aplicara y regenerara `jwks` limpio. **VERIFICAR primero si ya funciona antes de tocar nada.**

---

## PLAN A SEGUIR (en orden)

### 1. Commitear el trabajo sin commitear (2 commits lógicos)
- Commit A: limpieza de código muerto.
- Commit B: fixes de i18n.
- Luego `bunx vite build` y `git add public/` si cambió el bundle.

### 2. Merge a `main` (OJO: main está PROTEGIDO → requiere PR + aprobación de compañero)
- `git push origin chore/auditoria-previa-render-supabase`
- Crear PR a `main` (vía web GitHub o `gh pr create`). No se puede push directo a main.
- Necesita que un compañero apruebe (al menos 1 review).

### 3. Desde `main` actualizado → nueva rama para Issue #60
- `git checkout main && git pull && git checkout -b refactor/middleware-jwt-issue60`

### 4. Issue #60 — "Reparación Middleware JWT y Cobertura de Seguridad"
**⚠️ REENCUADRE CRÍTICO — la premisa del issue es un diagnóstico ERRADO, verificado en la auditoría:**
- El issue afirma "middleware roto, mayoría de endpoints expuestos". **FALSO.** Las rutas admin SÍ validan sesión+rol inline:
  - `POST /api/admin/activities` (L393), `GET /api/admin/activities` (L459), `/regeocode` (L584), `/api/admin/metrics` (L1042), `/api/admin/stats` (L1115) → todas hacen `auth.api.getSession()` + chequeo `role !== 'admin'` → 401/403.
- El `protectMiddleware` (`src/middleware/protect.ts`, usa jose+JWKS) solo protege 2 rutas DEMO (`/admin-dashboard`, `/my-panoramas`) que **el frontend NUNCA llama** → código huérfano.
- Las 5 rutas sin sesión son **públicas por diseño**: catálogo de lectura (`/api/activities`, `/api/distance`, `/api/activities/:id/availability`) y OTP (`/api/otp/request`, `/api/otp/verify` — no pueden requerir sesión porque SON parte del login).
- **Por lo tanto #60 = CONSOLIDACIÓN, no reparación de emergencia.** El valor real: (a) centralizar los checks repetidos en un sub-router `app.guard({ beforeHandle: protectMiddleware('admin') }, ...)` con prefijo `/api/admin/*`, (b) unificar los DOS estilos de auth (inline `getSession` vs `protect.ts` jose/JWKS) en UNO solo, (c) borrar las 2 rutas demo huérfanas + el import muerto.
- **RIESGO:** si refactorizas confiando en "todo está expuesto" y mueves rutas a guards sin cuidado, puedes ROMPER auth que hoy funciona. **Verifica cada ruta antes y después con un test manual (curl con/sin token).** Mantén los 27 tests pasando.

---

## GOTCHAS IMPORTANTES (te ahorran horas)

1. **Frontend NO se actualiza solo.** El backend sirve `public/main.js` precompilado. Tras CUALQUIER cambio en `src/*.tsx`/i18n → corre `bunx vite build`. El `--hot`/`bun --hot` solo recarga la API, NO reconstruye React.
2. **i18n:** tras editar `src/i18n/es|en/index.ts` → corre `bunx typesafe-i18n --no-watch` para regenerar `i18n-types.ts` y utils, si no `LL.nuevaKey()` no compila.
3. **Docker Desktop es INESTABLE** en esta máquina (crashea con error `dockerInference`). Si `docker` no responde: el usuario debe Quit + reabrir Docker Desktop. La DB local es el contenedor `frontera-db` (puerto 5433→5432).
4. **Probar la app:** `bun src/index.ts` levanta en `localhost:4000` (sirve el bundle). Lee `.env` (DATABASE_URL=localhost:5433 = Docker local). Para apuntar a Supabase: `$env:DATABASE_URL="postgresql://postgres.ihorqeekcfeipoctltjv:<pass>@aws-1-us-west-2.pooler.supabase.com:5432/postgres"` (Session pooler, puerto 5432; la conexión directa `db.xxx.supabase.co` NO resuelve por DNS desde esta red).
5. **Procesos zombie en puerto 4000:** frecuente. Si hay >1 proceso en 4000 o "connection refused", mata con `taskkill //PID <pid> //F` y relanza limpio.
6. **Entorno:** Windows + PowerShell. Bun runtime, Elysia, Drizzle ORM, React 19 + Vite, better-auth.

---

## CHECKLIST PRUEBA 2 (estado al cierre de la sesión anterior)
- ✅ Responsive (16/20 componentes con breakpoints)
- ✅ Docker (compose app+db, verificado levanta)
- ✅ API cifrada/JWT (YA cumple — better-auth + JWT Ed25519/JWKS; era el diagnóstico errado de #60)
- ✅ Loading + toasts (skeletons y toasts en toda la app)
- ✅ i18n textos fijos (arreglado esta sesión)
- ⏸️ Título/descripción de panoramas bilingüe (EN ESPERA — decisión post-entrega; NO es requisito de typesafe-i18n)
- ⚠️ Afluencia real (función 3 del P07) — hoy es `getSimulatedOccupancy()`. Decidir: documentar como "simulada por diseño" o implementar.
- 🔴 Login en producción (verificar/cerrar)
