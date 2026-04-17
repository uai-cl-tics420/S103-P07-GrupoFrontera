# Protocolos de Seguridad y Criptografía
Este documento explica los mecanismos de seguridad implementados en el sistema.

## 1. Algoritmo de Hashing para Tokens (OTP)
Utilizamos un generador basado en semilla numérica y ventanas de tiempo.
- **Algoritmo:** Transformación polinómica del secreto alfanumérico a la semilla.
- **Proceso:** Convertimos el secreto alfanumérico del usuario en una semilla (seed) sumando los valores ASCII de sus caracteres.
- **Seguridad:** Al ser un secreto de 20 caracteres aleatorios (Base32), es posible  evitar ataques en el corto periodo de validez.

## 2. Funcionamiento del TOTP
Nuestra implementación sigue la lógica del estándar RFC 6238:
- **Factor de Tiempo (Time Step):** Utilizamos una ventana de 10 minutos (600000 ms).
- **Generación:** El token de 6 dígitos se obtiene mediante una operación de módulo sobre el producto de la semilla y el paso de tiempo.
- **Fórmula:** `(Seed * TimeStep) % 1,000,000`
- **Persistencia:** El estado de verificación se guarda en PostgreSQL (otpVerified), impidiendo el acceso al Dashboard hasta que el backend valide la coincidencia.

## 3. Firma de JWT
Para la sesión principal (SSO), delegamos la seguridad en Better Auth:
- **Algoritmo de Firma:** Se usa RS256 (RSA Signature con SHA-256) o HS256.
- **Mecanismo:** El servidor firma el payload (ID de usuario, email, rol) con una AUTH_SECRET privada definida en las variables de entorno .env.
- **Validación:** Cada petición al backend verifica la integridad de la firma. Si el token es alterado, el servidor rechaza la conexión automáticamente. 
