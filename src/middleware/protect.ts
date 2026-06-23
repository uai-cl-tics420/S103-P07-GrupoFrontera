import { createRemoteJWKSet, jwtVerify } from 'jose';
import { db } from 'src/lib/db';
import { user } from 'src/lib/schema';
import { eq } from 'drizzle-orm';

const JWKS = createRemoteJWKSet(new URL('http://localhost:4000/api/auth/jwks'));

export const protectMiddleware = (roleRequired?: 'admin' | 'user') =>
    async ({ set, request }: any) => {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];

        if (!token) {
            set.status = 401;
            return { error: "No hay token de autorización" };
        }

        try {
            const { payload } = await jwtVerify(token, JWKS);
            const userId = payload.sub as string;

            if (roleRequired === 'admin') {
                const caller = await db.select().from(user)
                    .where(eq(user.id, userId))
                    .limit(1);
                const role = caller[0]?.role ?? 'user';

                if (role !== 'admin') {
                    set.status = 403;
                    return { error: "Acceso denegado: se requieren permisos de administrador" };
                }
            }
        } catch {
            set.status = 401;
            return { error: "Token inválido o expirado" };
        }
    };