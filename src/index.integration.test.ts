import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "./index.ts";
import { not } from "drizzle-orm";

describe("Tests de Integración API PanoramApp", () => {

    //Verificar rechazo de endpoints protegidos sin token
    describe("Seguridad y Control de Acceso (JWT / Session", () => {
        it("Debe rechazar la creación de reservas si el usuario no está autenticado (401)", async () => {
            const respuesta = await app.handle(
                new Request("http://localhost:4000/api/reservations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activityId: "123-test", payNow: false })
                })
            );

            //Verificamos que devuelva No Autorizado
            expect(respuesta.status).toBe(401);
        });

        it("Debe denegar el acceso a rutas administrativas sin los privilegios correctos", async () => {
            const respuesta = await app.handle(
                new Request("http://localhost:4000/api/admin/metrics")
            );

            //El middleware debería denegar la entrada
            expect(respuesta.status).not.toBe(200);
        });
    });

    //Verificar que respondan con el formato correcto
    describe("Catálogo y Recomendaciones: GET /api/activities", () => {
        it("Debe retornar la lista de actividades con estructura de clima y catálogo integrado", async () => {
            const respuesta = await app.handle(
                new Request("http://localhost:4000/api/activities?lat=-33.43&lng=-70.65")
            );

            expect(respuesta.status).toBe(200);
            expect(respuesta.headers.get("content-type")).toContain("application/json");

            const data = await respuesta.json();

            expect(data).toHaveProperty("currentWeather");
            expect(data).toHaveProperty("activities");
            expect(data).toHaveProperty("userHistory");
            expect(Array.isArray(data.activities)).toBe(true);
        });
    });

    //Endpoint de Clima y Parámetros
    describe("Filtros y Meteorología Adaptativa", () => {
        it("Debe responder correctamente al filtrar por categorías específicas", async () => {
            const respuesta = await app.handle(
                new Request("http://localhost:4000/api/activities?category=Parque")
            );
            expect(respuesta.status).toBe(200);
            const data = await respuesta.json();

            //si la base de datos tiene info. verificamos que respete el filtro
            if (data.activities.length > 0) {
                expect(data.activities[0]).toHaveProperty("category");
                expect(data.activities[0]).toHaveProperty("tagClima");
            }
        });
    });
});