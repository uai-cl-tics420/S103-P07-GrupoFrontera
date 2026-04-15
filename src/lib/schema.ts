import { pgTable, text, varchar, doublePrecision } from "drizzle-orm/pg-core";
import { user } from "../../auth-schema"; // Traemos al usuario que fabricó Better-Auth

// 1. Tabla de Actividades (Panoramas)
export const activities = pgTable('activities', {
    id: varchar('id', { length: 50 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    tag_clima: varchar('tag_clima', { length: 50 }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
});

// 2. Tabla de Preferencias de Usuario
export const userPreferences = pgTable('user_preferences', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()), // Crea un ID único automático
    userId: text('user_id'),
    // FK a user.id se agrega cuando #32 (auth) mergee y haya usuarios reales
    preferredCategories: text('preferred_categories').array(),
});
