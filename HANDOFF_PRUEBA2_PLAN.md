# Plan de cambios — Prueba 2 (HOY, deadline 16:00 → Render corriendo)

> Ejecutor: **Antigravity 2.0**. NO tienes el historial de la sesión de auditoría; este doc te pone al día.
> Base analizada: commit `c972c4f` (rama `fix/ajustes-detalles`) + working tree.
> Estado verificado: `bunx tsc --noEmit` limpio · `bun test` = 27/27 pasan.

## Cómo trabajar
- Tras CUALQUIER cambio en `src/*.tsx` o i18n → corre `bunx vite build` (el backend sirve `public/main.js` precompilado; `bun --hot` NO reconstruye React).
- Tras editar `src/i18n/es|en/index.ts` → corre `bunx typesafe-i18n --no-watch` para regenerar tipos, si no `LL.nuevaKey()` no compila.
- Mantén `bun test` en verde y `tsc` limpio antes de pushear.
- `main` está protegido → PR + aprobación de compañero.

---

## ⛔ NO HACER / GOTCHAS
1. **NO commitear la versión de `recommendationService.ts` con nombres hardcodeados** ("sky costanera", "bocanáriz", "mestizo", lista de museos, etc.) que está en el working tree de algún editor. Es un mock viejo: solo funciona para nombres exactos e ignora `activity.price` (el precio real cargado por el admin). La versión correcta en disco usa `activity.price` como fuente de verdad. Si aparece ese diff, descártalo.
2. El pago simulado (`paymentService.ts`, 10% de fallo) se queda como está — el usuario QUIERE que pueda fallar en la demo para mostrar el manejo de error. NO toques `PAYMENT_FAIL_RATE`.
3. Bun acepta el stack (el doc de Evaluaciones dice "TypeScript utilizando BUN"). No migrar a Next/Deno.

---

## TIER 0 — CRÍTICO para Prueba 2 (hacer primero, son baratos y protegen puntos base)

### T0.1 — [P2-base: responsive] Falta el `<meta viewport>` → la app no se adapta en celular/tablet  ⏱️S
- **Archivo:** `index.html`. Hoy NO tiene `<meta name="viewport">`. Sin él, el móvil renderiza en ancho desktop (~980px) y los breakpoints Tailwind `sm/md/lg` no aplican → se ve "desktop achicado".
- **Fix:** agregar en `<head>`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ```
- **Además:** revisar `src/index.css:12` — el `body` tiene `min-w-[320px]` (resto del template Vite). Si tras el viewport hay overflow horizontal en tablet/móvil, quitarlo o ajustarlo.
- **Aceptación:** probar en celular REAL (no solo DevTools) y en tablet/iPad. Cubre el punto 2 del usuario y el punto base "100% responsive (Smartphone/Tablet/Desktop)".

### T0.2 — [P2-base: i18n] ~25 textos hardcodeados que saltan typesafe-i18n  ⏱️M
El sistema i18n está completo (270 keys, es=en) pero estos strings están escritos directo en JSX y NO cambian al togglear idioma. Crear key en `es/index.ts` + `en/index.ts`, regenerar tipos, reemplazar por `LL.*()`:
- **`src/components/ActivityDetailModal.tsx`** (el peor): "Detalle del pedido", "Subtotal", "Cargo por servicio", "Total", "Procesando...", "Volver", "Agotado", "Continuar con el pago", "Volver al detalle", "¡Solo quedan N cupos!", "N cupos disponibles", "Agotado para esta fecha".
- **`src/components/PayModal.tsx`**: "Subtotal", "Cargo por servicio", "Total", "Detalle del pedido".
- **`src/App.tsx`**: "Activar Admin", "Cualquier hora", "✕ Quitar fecha", "↺ Restablecer filtros".
- **`src/components/admin/AdminDashboard.tsx`**: `<option>` "Usuario", "Admin", "Actual".
- **`src/components/auth/OTPVerify.tsx:98`**: "Reenviar código".
- **`src/components/admin/CreatePanoramaForm.tsx`**: mensajes de validación ("El nombre es obligatorio", "El precio no puede ser negativo", etc.).
- **Aceptación:** togglear a inglés y recorrer login→reservar→pagar→admin sin ver español. Cubre punto base "100% i18n".
- **Prevención a futuro (punto del usuario):** agregar regla ESLint `eslint-plugin-i18next` → `no-literal-string` para que el build falle si alguien deja un literal en JSX. Esto evita que reaparezca en cada feature nueva. (Si no da el tiempo hoy, dejarlo anotado para examen.)

### T0.3 — [seguridad] Secreto TOTP hardcodeado + publicado en README → escalada de privilegios  ⏱️S
- **`src/index.ts:792`**: `const totpSecret = process.env.ADMIN_TOTP_SECRET || "KVKFKRCSN5RHKYTVMVRXEYLTMV3GOLJS";` — ese fallback está **publicado tal cual en `README.md`**. Cualquier user logueado puede usar "Activar Admin" → opción TOTP → generar un código desde ese secreto público → volverse admin.
- **Fix:** (a) quitar el `|| "KVKF..."` y hacer que falle si `ADMIN_TOTP_SECRET` no está; (b) **rotar** el valor real en Render a uno nuevo y privado; (c) borrar/ofuscar el valor de ejemplo del README.
- **Aceptación:** sin `ADMIN_TOTP_SECRET` la activación TOTP no funciona; el README ya no expone un secreto usable. Cubre "secretos revelados" del usuario.

### T0.4 — [P2-base] Verificar que el login de producción funciona en Render  ⏱️S
- Antes era el bug `BetterAuthError: Failed to decrypt private key` (la tabla `jwks` se cifra con `BETTER_AUTH_SECRET`; local vs Render tenían secrets distintos). Confirmar que `panoramapp.onrender.com` deja loguear (Google + email/OTP) end-to-end. Si no, regenerar la fila de `jwks` y alinear `BETTER_AUTH_SECRET`.
- **Por qué:** si el login no funciona en la entrega → **−2 puntos** de penalización directa.

---

## TIER 1 — Funcionalidad (sube "todas las funcionalidades completas", 2 pts)

### T1.1 — [func 3] Los filtros de cercanía y precio NO ordenan — CAUSA RAÍZ ÚNICA (puntos 8 y 9)  ⏱️M
- **Diagnóstico:** el backend SÍ ordena (`/api/activities` ordena por precio si `priceSort`, o por distancia si `radius!=30000`). PERO en `src/App.tsx:379` el frontend **vuelve a re-rankear TODO** con `getRecommendedActivities(...)` → ese orden destruye el sort del backend. Por eso "aprieto el filtro y no ordena del más cercano/precio".
- **Fix (App.tsx):** cuando el usuario aplica un sort explícito (priceSort asc/desc, o "cerca de mí"), **NO re-rankear con el motor** — renderizar la lista en el orden que vino del backend. Lógica sugerida: si hay sort explícito activo en `apiFilters`, usar `actualActivitiesList` (ya ordenado por backend) en vez de `recommendedActivities`; si no, usar el motor como hoy.
- Verificar también que el rango precio (`priceMin`/`priceMax`) realmente filtre (el backend tiene `matchesPriceRange`, confirmar que el front manda los params bien cuando `priceSort==='range'`).
- **Aceptación:** "menor a mayor" / "mayor a menor" reordenan visiblemente; el rango deja solo panoramas dentro de Mín–Máx. Arregla puntos 8 y 9 a la vez.

### T1.2 — [func 3, UX] Rediseñar filtro de cercanía como "Cerca de mí" + abrir radio (punto 8)  ⏱️M
- Botón "Cerca de mí" (radio 2–5 km) que ordena del más cercano al más lejano; luego opción "Abrir radio" → 7 / 10 / 20 km; sin filtro = radio máximo (30 km).
- Depende de T1.1 (que el sort por distancia se respete). El sort por distancia hoy solo se activa si `radius!=30000` (`index.ts:246`) — al usar "Cerca de mí" siempre habrá un radio acotado, así que se activará.
- **Aceptación:** "Cerca de mí" muestra solo lo cercano ordenado por proximidad. Refuerza la funcionalidad 3 (Maps/afluencia/cercanía) que es la que el usuario quiere asegurar.

### T1.3 — [func 3] Afluencia híbrida: cupos reales + heurística hora/categoría (reemplazar `Math.random`)  ⏱️M
- Hoy `src/services/placesService.ts` → `getSimulatedOccupancy()` es solo hora+random. El profe pidió basarla en cupos. Propuesta acordada con el usuario:
  - **Componente real:** `ocupación_cupos = reservas_activas_de_esa_fecha / cuposPorDia` (los datos ya se calculan en `index.ts` con `buildUsadosEnFecha()`).
  - **Componente simulado:** nivel base por **categoría + hora** (ej. cine 21:00 viernes = alto; parque 10:00 martes = bajo). Opcional/futuro: factor por comuna parseada de `address`.
  - **Combinación:** `nivel_final = max(nivel_por_cupos, nivel_heurístico(categoría, hora))`.
- **Aceptación:** la afluencia ya no es puro random; en el Q&A se defiende como "mezcla de datos reales de reservas + modelo de demanda por hora/categoría, porque Google no entrega ocupación en tiempo real gratis". (La parte de comuna es opcional/examen.)

### T1.4 — [func 1/2, polish] Panoramas con fecha/hora ya pasada → marcar no disponible (punto 4)  ⏱️M-L
- Regla: si una **fecha/franja específica** ya pasó → ese slot no se ofrece. Si **todas** las fechas del evento pasaron, o quedó sin cupos → el panorama entero queda "no disponible" (en gris, etiqueta "No disponible").
- Hoy los inputs de fecha tienen `min=hoy` pero los panoramas existentes con fechas pasadas no se ocultan solos. Implementar el filtro en `/api/activities` / `availability` y el estado visual gris en `ActivityCard`.
- Opcional (examen): correo al admin cuando un panorama se queda sin fechas disponibles.
- **Aceptación:** un panorama cuya última fecha ya pasó aparece gris/no reservable.

---

## TIER 2 — Pulido que ayuda en el showcase (si queda tiempo hoy)

### T2.1 — [Q&A] Reescribir `SECURITY.md` para que coincida con el código real  ⏱️S
- El doc describe OTP con fórmula `(Seed*TimeStep)%1.000.000` y JWT `RS256/HS256`. **El código real** usa `crypto.randomInt` (OTP correo) + `speakeasy` RFC 6238 (TOTP admin) y better-auth firma con **EdDSA/JWKS**. Riesgo directo en "identificar elementos criptográficos" si presentan este doc y no calza. Reescribir con la cripto real.

### T2.2 — [limpieza] Quitar logs de debug de producción  ⏱️S
- `src/components/admin/AdminDashboard.tsx:49` → `"GATILLANDO FETCH DE MÉTRICAS ALOOOOOO"` y `:56`. `src/recommendationService.ts:237-249` → `console.table` en cada cálculo. `src/index.ts` loguea **códigos OTP/admin en texto plano** (L750, L1181) y `auth.ts` tiene `logger.level: "debug"` → bajar a `warn`/`error` y no loguear códigos. (31 `console.*` solo en index.ts.)

### T2.3 — [marca] Login dice "Panoramas", debe decir "PanoramApp" (punto 5)  ⏱️S
- `src/components/auth/LoginForm.tsx:101-102` (`<h1>Panoramas</h1>`). Unificar con el nav (`App.tsx:603` ya dice "PanoramApp"). (Es marca, no requiere i18n.)

### T2.4 — [P2-base] Revisión de loading/toasts (punto 11)  ⏱️S
- Pasada rápida: muchas interacciones son inmediatas y no necesitan skeleton; otras (toggle favorito, cambio de filtro) podrían faltar feedback. El sistema (ToastContext + Skeletons) ya está bien usado; solo ajustar dónde sobra o falta. Cubre el punto base "ventanas de carga y toast donde corresponda".

---

## TIER 3 — Mejoras / dejar para EXAMEN si no alcanza hoy

### T3.1 — [punto 1] Validación de email + limpieza de cuentas no verificadas  ⏱️M
- **Nota importante:** `@gmial.com` es sintácticamente VÁLIDO (typo de dominio, no malformado) → NO se puede rechazar automáticamente con certeza. Sí se puede: (a) regex más estricto para los REALMENTE malformados (sin @, sin dominio, sin TLD); (b) sugerencia "¿quisiste decir gmail.com?" para typos comunes de dominio; (c) lo de fondo: las cuentas se guardan antes del OTP → agregar limpieza de cuentas con `otpVerified=false` tras N días (job programado o limpieza lazy al login) y/o botón en el dashboard para que el admin borre cuentas.

### T3.2 — [punto 1] Admin: borrar usuarios desde el dashboard  ⏱️M
- Hoy `AdminDashboard` solo cambia rol. Agregar `DELETE /api/admin/users/:id` (protegido, sin permitir borrar el superadmin `danielmpizarro@alumnos.uai.cl`) + botón en la tabla.

### T3.3 — [punto 3] Editar panoramas en "Administrar panoramas"  ⏱️M-L
- Hoy `ManagePanoramasView` solo togglea flags + borra + regeocode. Agregar "Editar" que reutilice `CreatePanoramaForm` pre-cargado + ampliar `PATCH /api/admin/activities/:id` (hoy solo maneja isTendencia/isPopular/disponible) para editar todos los campos.

### T3.4 — [punto 6] Botón de perfil (círculo naranjo) → acordeón  ⏱️M
- Convertir el círculo de `App.tsx:667` en botón que despliegue: correo/cuenta, Mis reservas, Mis favoritos, Solicitar admin, Cerrar sesión. Consolida el nav (que hoy tiene muchos botones sueltos).

### T3.5 — [punto 7] Planificación: límite de 5 días en fecha específica  ⏱️S
- En el modal de "Recomendar panoramas" y en el filtro de fecha, poner `max = hoy+5` (alineado con el pronóstico gratuito de OpenWeather, que es 5 días). Hoy el date input tiene `min` pero no `max`.

### T3.6 — [punto 10] Límite de cupones/cupos por persona  ⏱️M
- Al crear panorama, campo "máximo por persona"; el backend lo valida al reservar (hoy no hay tope por persona). Nuevo campo en schema + migración Drizzle + form + validación en `POST /api/reservations`.

### T3.7 — [examen] Tests de integración de la API (issue #42)  ⏱️L
- Los 27 tests solo cubren funciones puras. Falta cubrir rutas (recomendaciones, clima, rechazo sin token JWT, formato de respuesta). Elysia testea sin levantar server: `app.handle(new Request('http://localhost/api/...'))`. Es criterio de aceptación del issue #42 ("`bun test` incluye unitarios e integración") → relevante para el examen.

### T3.8 — [examen] Limpieza de deuda técnica  ⏱️M
- Quitar deps muertas (`jose`, `otplib`, `nodemailer`+types, `pg`+types, `qrcode`). Quitar columna/lógica muerta `user.otpSecret`. Quitar props muertas `isReserved`/`onReserve` + `handleReserve`. Actualizar `.env.example` (faltan OPENWEATHER/GOOGLE_PLACES/BREVO/ADMIN_TOTP; sobran GMAIL/GITHUB_TOKEN) y README (dice RESEND en vez de Brevo, puerto 3000). Agregar constraint único `(userId, activityId)` en `userFavorites` (hoy se pueden duplicar favoritos). Default de `userReservations.status` es 'comprado' pero el código usa pendiente/pagado/cancelado.

---

## Orden de ataque sugerido para HOY (hasta 16:00)
1. **T0.1** viewport (móvil/tablet) — 10 min, alto impacto visible.
2. **T0.3** secreto TOTP + rotar en Render — 15 min, seguridad.
3. **T0.4** confirmar login en producción — verificación.
4. **T0.2** i18n hardcodeados (empezar por ActivityDetailModal + PayModal) — el más largo, pero es punto base.
5. **T1.1** fix del override de filtros (arregla 8 y 9 juntos) — alto valor, func 3.
6. **T1.3** afluencia híbrida — func 3, defendible en Q&A.
7. **T1.2** "Cerca de mí" si queda tiempo.
8. **T2.1–T2.3** SECURITY.md, logs, "PanoramApp".
9. Lo que falte → **examen** (Tier 3).

Antes de cerrar: `bunx vite build` + `bunx tsc --noEmit` + `bun test` + commit + PR a main + redeploy Render + **probar en celular real**.
