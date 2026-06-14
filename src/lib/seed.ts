import { db } from "./db";
import { user } from "./schema";
import { eq } from "drizzle-orm";

// Seed minimo: promueve la cuenta maestra a Administrador.
// Los panoramas ahora los crea el admin desde el formulario (ya no se siembran mocks).
async function seed() {
    console.log("Promoviendo cuenta maestra a Administrador...");
    await db.update(user)
        .set({ role: "admin" })
        .where(eq(user.email, "danielmpizarro@alumnos.uai.cl"));
    console.log("Cuenta danielmpizarro@alumnos.uai.cl promovida a Admin.");
    console.log("Seed completado.");
    process.exit(0);
}

seed();
