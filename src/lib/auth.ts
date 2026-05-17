import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
        }
    }),

    // ESTO ES CLAVE: Le avisamos a Better-Auth que el usuario tiene estos campos extra
    user: {
        additionalFields: {
            otpSecret: {
                type: "string",
                required: false,
            },
            otpVerified: {
                type: "boolean",
                required: false,
                defaultValue: false,
            },
        },
    },

    trustedOrigins: ["http://localhost:4000", "http://localhost:5173"],

    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    // Generamos el secreto inicial manualmente (Base32)
                    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
                    let initialSecret = '';
                    for (let i = 0; i < 20; i++) {
                        initialSecret += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
                    }

                    console.log("🔐 USUARIO NUEVO: Generando secreto para", user.email);

                    return {
                        data: {
                            ...user,
                            otpSecret: initialSecret,
                            otpVerified: false,
                        }
                    };
                },
            }
        },
    },
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
    },
    secret: process.env.BETTER_AUTH_SECRET,
    logger: {
        level: "debug",
    }
});