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

La app queda disponible en `http://localhost:3000`.

### Con Docker (recomendado para desarrollo en equipo)

```bash
docker compose up
```

Esto construye la imagen y levanta el servidor con hot reload en `http://localhost:3000`.

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
