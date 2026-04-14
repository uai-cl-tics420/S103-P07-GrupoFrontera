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
//añadimos esto para manejar los roles user y admin
export const rolesEnum = ['user', 'admin'] as const;

export const userPreferences = pgTable('user_preferences', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()), // Crea un ID único automático
    userId: text('user_id')
        .references(() => user.id, { onDelete: 'cascade' }), // Lo unimos al Usuario
    preferredCategories: text('preferred_categories').array(),
    role: text('role', { enum: rolesEnum }).default('user'), //Añadimos esto para manejar el rol en las preferencias
});
