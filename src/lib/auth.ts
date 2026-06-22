import { jwt } from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema";
import { randomInt } from 'crypto';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
            jwks: schema.jwks,
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
            role: {
                type: "string",
                required: false,
                defaultValue: "user",
            }
        },
    },

    trustedOrigins: ["http://localhost:4000", "http://localhost:5173", "https://panoramapp.onrender.com"],

    session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
    },

    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    // Generamos el secreto inicial manualmente (Base32)
                    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
                    let initialSecret = '';
                    for (let i = 0; i < 20; i++) {
                        initialSecret += alphabet.charAt(randomInt(0, alphabet.length));
                    }

                    const isAdminEmail = user.email === "danielmpizarro@alumnos.uai.cl";
                    console.log(`🔐 USUARIO NUEVO: Generando secreto y rol (${isAdminEmail ? 'admin' : 'user'}) para`, user.email);

                    return {
                        data: {
                            ...user,
                            otpSecret: initialSecret,
                            otpVerified: false,
                            role: isAdminEmail ? "admin" : "user",
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
    plugins: [
        jwt(),
    ],
    logger: {
        level: "debug",
    }

});