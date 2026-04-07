import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

// Configuramos nuestro Guardia de Seguridad (Better-Auth)
export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg", // Le indicamos que usamos PostgreSQL
    }),
    emailAndPassword: {
        enabled: true,  // Habilitamos iniciar sesión con Email y Contraseña
    },
    plugins: [
        jwt(),          // Usamos Tokens de seguridad modernos
    ],
});
