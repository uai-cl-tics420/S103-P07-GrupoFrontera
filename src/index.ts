import { serve } from "bun";
import index from "./index.html";

// 1. FORZAMOS EL BUILD (Esto crea el archivo que el navegador necesita)
const build = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./public",
  minify: false, // Lo dejamos en false para que sea más fácil de leer
});

if (!build.success) {
  console.error("❌ Error en el Build:", build.logs);
}

const server = serve({
  // Cambiamos al puerto 4000 para que el navegador NO use la memoria vieja
  port: 4000, 
  routes: {
    "/*": index,
  },
  development: true,
});

console.log(`🚀 PROYECTO LISTO en http://localhost:4000`);