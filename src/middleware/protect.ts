export const protectMiddleware = (roleRequired?: 'admin' | 'user') => 
    async ({ jwt, set, request, roleRequired }: any) => {
        //1. Sacar el token del header (Bearer token)
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];

        if (!token) {
            set.status = 401;
            return { error: "No hay token de sesión" };
        }

        //2. Verificar el token
        const payload = await jwt.verify(token);

        if (!payload || !payload.otp_verified) {
            set.status = 401;
            return { error: "Debes completar la verificación OTP" };
        }

        //3. Verificar roles
        if (roleRequired === 'admin' && payload.role !== 'admin') {
            set.status = 403;
            return { error: "Acceso denegado: Se requieren permisos de administrador" };
        }

        return; //Si está todo bien lo deja pasar
};