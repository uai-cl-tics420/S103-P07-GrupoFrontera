import { pgTable, text, varchar, doublePrecision, timestamp, boolean } from "drizzle-orm/pg-core";

// --- 0. TABLAS DE BETTER-AUTH (¡Añade esto!) ---
// Estas son las que faltaban y por eso daban error en auth.ts

// --- ENUMERADO DE ROLES ---
export const rolesEnum = ['user', 'admin'] as const;

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    otpSecret: text("otp_secret"), //el secreto para generar el código
    otpVerified: boolean("otp_verified").default(false), //ya pasó el segundo factor?
    role: text("role", { enum: rolesEnum }).default("user"), // Campo de rol directo en el usuario
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id),
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
});

// --- 1. Tabla de Actividades (Tus tablas originales) ---
export const activities = pgTable('activities', {
    id: varchar('id', { length: 50 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    tag_clima: varchar('tag_clima', { length: 50 }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    openingHour: text('opening_hour'),
    closingHour: text('closing_hour'),
});

// --- 2. Tabla de Preferencias de Usuario ---
export const userPreferences = pgTable('user_preferences', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    preferredCategories: text('preferred_categories').array(),
});

// --- 3. Favoritos y Reservas (Issue #50) ---
export const userFavorites = pgTable('user_favorites', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
    activityId: varchar('activity_id', { length: 50 }).references(() => activities.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userReservations = pgTable('user_reservations', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
    activityId: varchar('activity_id', { length: 50 }).references(() => activities.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    status: text('status').default('comprado').notNull(),
});