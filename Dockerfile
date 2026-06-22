# Base oficial de Bun
FROM oven/bun:latest

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias primero (optimiza caché de Docker)
COPY package.json bun.lock* ./

# Instalar dependencias
RUN bun install

# Copiar el resto del código fuente
COPY . .

# Compilar el frontend en la fase de construcción de la imagen
RUN bun run build

# Exponer el puerto de la aplicación
EXPOSE 4000

# Ejecutar migraciones de Drizzle en Supabase y arrancar el servidor en producción sin hot reload
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun run src/index.ts"]