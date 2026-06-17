# Puesta en marcha - rama `feat/nueva-logica-panoramas`

Pasos para dejar la rama funcionando tras clonar o cambiarte a ella.

## 1. Variables de entorno (.env)
Copia `.env.example` a `.env` y completa las claves. Esta rama usa:
- `GOOGLE_PLACES_API_KEY`: una API key de Google con estas APIs habilitadas en Google Cloud:
  - **Geocoding API** (direccion -> coordenadas)
  - **Routes API** (distancia en auto)
  - El mapa embebido del detalle no requiere key.
- `OPENWEATHER_API_KEY`, `DATABASE_URL`, secretos de auth, etc. (ver `.env.example`).

## 2. Levantar los contenedores (recrear para cargar el .env)
```
docker compose down
docker compose up
```
> Importante: `docker compose restart` NO recarga el `.env`. Al cambiar claves usa `down` + `up`.

## 3. Aplicar el esquema a la base de datos
Opcion A (recomendada, sincroniza desde `src/lib/schema.ts`):
```
docker compose exec app bunx drizzle-kit push
```
Opcion B (SQL directo, PowerShell):
```
Get-Content docs\migracion_nueva_logica_panoramas.sql | docker compose exec -T db psql -U frontera -d grupofrontera
```

## 4. (Opcional) Promover tu cuenta a admin
```
docker compose exec app bun run src/lib/seed.ts
```
Edita el email en `src/lib/seed.ts` si tu cuenta admin es otra.

## 5. Usar la app
Disponible en http://localhost:4000. En **Admin -> Crear panorama** cargas eventos con
direccion real, horarios y cupos; en **Administrar panoramas** los gestionas
(eliminar, tendencia/popular/disponible, re-geocodificar).
