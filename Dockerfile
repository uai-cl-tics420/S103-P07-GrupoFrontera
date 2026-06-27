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

# Ejecutar migraciones de Drizzle en Supabase y arrancar el servidor en producción sin hot reload.
# CI=1 desactiva el spinner animado de drizzle-kit (redibuja la linea con \r), que en los logs de
# Render puede perder el mensaje de error real si el proceso muere a mitad del redibujado.
CMD ["sh", "-c", "CI=1 bunx drizzle-kit migrate; code=$?; if [ $code -ne 0 ]; then echo \"MIGRATION FAILED exit_code=$code\"; exit $code; fi; bun run src/index.ts"]