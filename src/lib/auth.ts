import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db"; // Ahora que están en la misma carpeta, se usa './'
import * as schema from "./schema"; // Importamos tu schema.ts local

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification, // Better-Auth lo necesita sí o sí
        }
    }),
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
    },
    secret: process.env.BETTER_AUTH_SECRET,
    logger: {
        enabled: true,
        level: "debug",
    }
});
