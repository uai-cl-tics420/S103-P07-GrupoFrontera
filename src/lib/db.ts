import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

// Le pasamos la URL y opciones a Bun. Desactivamos 'prepare' para
// ser compatibles con el connection pooler de Supabase (puerto 6543)
const pg = new SQL({
  url: process.env.DATABASE_URL as string,
  prepare: false,
});

// Exportamos la Base de Datos con el Mapa (schema) incrustado
export const db = drizzle(pg, { schema });

