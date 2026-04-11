import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "../../auth-schema";

// Le pasamos la URL directamente a Bun para que él despiece todo (usuario, puerto, etc)
const pg = new SQL(process.env.DATABASE_URL as string);

// Exportamos la Base de Datos con el Mapa (schema) incrustado
export const db = drizzle(pg, { schema });
