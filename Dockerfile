# Base oficial de Bun
FROM oven/bun:latest

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias primero (optimiza caché de Docker)
COPY package.json bun.lockb* ./

# Instalar dependencias
RUN bun install

# Copiar el resto del código fuente
COPY . .

# Exponer el puerto de la aplicación
EXPOSE 3000

# Comando para iniciar la app en modo desarrollo (hot reload)
CMD ["bun", "--hot", "run", "src/index.ts"]