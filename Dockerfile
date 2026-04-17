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

# Exponer el puerto de la aplicación
EXPOSE 4000

# Comando para iniciar la app en modo desarrollo (hot reload)
CMD ["sh", "-c", "bunx vite build && bun --hot run src/index.ts"]