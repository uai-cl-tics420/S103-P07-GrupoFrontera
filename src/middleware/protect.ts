import { auth } from 'src/lib/auth';
import { db } from 'src/lib/db';
import { user } from 'src/lib/schema';
import { eq } from 'drizzle-orm';

export const protectMiddleware = (roleRequired?: 'admin' | 'user') =>
    async ({ set, request }: any) => {
        const session = await auth.api.getSession({ headers: request.headers });

        if (!session?.user?.id) {
            set.status = 401;
            return { error: "No autorizado" };
        }

        if (roleRequired === 'admin') {
            const caller = await db.select().from(user)
                .where(eq(user.id, session.user.id))
                .limit(1);
            const role = caller[0]?.role ?? 'user';

            if (role !== 'admin') {
                set.status = 403;
                return { error: "Acceso denegado: se requieren permisos de administrador" };
            }
        }
    };