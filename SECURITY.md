# Protocolos de Seguridad y Criptografía

Este documento explica los mecanismos de seguridad implementados en PanoramApp.

## 1. Algoritmo de Hashing y Generación de Códigos OTP
Utilizamos un generador de números enteros aleatorios criptográficamente seguro para el envío de OTP por correo electrónico:
- **Algoritmo:** `crypto.randomInt` provisto por el módulo nativo de Node/Bun (`crypto`).
- **Validez:** Los códigos constan de 6 dígitos decimales y se almacenan con una expiración estricta de 10 minutos en la tabla `verification` de PostgreSQL.
- **Validación:** Al ingresar el código, el servidor verifica la existencia y coincidencia exacta del código y la expiración en la base de datos. Una vez validado, se elimina de inmediato de la base de datos para prevenir el reuso del token (replay attacks).

## 2. Funcionamiento de TOTP (Administración)
Para la elevación de privilegios de administrador, se utiliza la autenticación de dos factores TOTP (Time-Based One-Time Password):
- **Estándar:** RFC 6238 (totp base32).
- **Proceso:** Se utiliza la biblioteca `speakeasy` para realizar la verificación en base a un secreto Base32 privado configurado únicamente en las variables de entorno del servidor (`ADMIN_TOTP_SECRET`).
- **Ventana de Tiempo:** Ventana estándar de 30 segundos (`Time Step`) provista por el protocolo RFC 6238.
- **Persistencia:** Al ser exitoso el TOTP, se actualiza el rol del usuario a `'admin'` en PostgreSQL.

## 3. Autenticación de Sesión y Firmas JWT
La sesión principal y el Single Sign-On (SSO) son gestionados a través de **Better Auth**:
- **Mecanismo:** Firma asimétrica de tokens mediante llaves públicas/privadas almacenadas en la base de datos (`jwks`).
- **Algoritmo de Firma:** Algoritmo de firma digital asimétrica EdDSA (Ed25519) administrado por el plugin JWT de Better-Auth.
- **Validación:** Cada llamada protegida al backend verifica la integridad de la sesión del usuario mediante cabeceras de autenticación procesadas por Better-Auth. Si la firma o el token son alterados o expiran, el acceso es revocado de forma inmediata (status 401).
