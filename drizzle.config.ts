import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "postgresql",
    // Le decimos a Drizzle que lea AMBOS planos que escribimos
    schema: ["./auth-schema.ts", "./src/lib/schema.ts"],
    out: "./drizzle",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    }
});
