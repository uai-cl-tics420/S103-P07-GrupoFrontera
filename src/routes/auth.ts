import { Elysia, t } from 'elysia';
import speakeasy from 'speakeasy';
import { jwt } from '@elysiajs/jwt';

export const authRoutes = (app: Elysia) =>
    app
        //Volvemos a registrar el plugin aquí para que TypeScript lo reconozca
        .use(
            jwt({
                name: 'jwt',
                secret: process.env.JWT_SECRET || 'un_secreto_temporal_123',
            })
        )

        //Definimos las rutas
        .group('/auth', (group) =>
            group
                //1. Iniciar sesión con Google (simulado por ahora)
                .get('/login', ({ redirect }) => {
                //En la siguiente fase aquí pondremos la url real de Google
                //Por ahora simulamos que Google nos devuelve al callback
                    return redirect('/auth/callback?code=fake_code_123');
                })

                //2. Callback donde llega la info de Google
                .get('/callback', async ({ query, jwt }) => {
                    //Aquí es donde Google nos dice quién es el usuario
                    //Simulamos que el mail es el de la UAI para asignar roles
                    const mockUser = {
                        email: "fauparada@alumnos.uai.cl",
                        id: "12345"
                    };

                    const isAdmin = mockUser.email.includes('admin'); //Lógica de roles 

                    //Firmamos un "Token Temporal" (OTP pendiente)
                    const token = await jwt.sign({
                        id: mockUser.id,
                        role: isAdmin ? 'admin' : 'user',
                        otp_verified: false //CRÍTICO!! El usuario aún no pone su código
                    });

                    return {
                        message: "Paso 1: Google OK. Ahora verifica tu OTP.",
                        temp_token: token
                    };
            }, {
                query: t.Object({
                    code: t.String()
                })
            })

            //3. Verificación de OTP
            .post('/verify-otp', async ({ body, jwt, set }) => {
                const { otpCode, tempToken } = body;

                //Verificamos el token temporal
                const payload = await jwt.verify(tempToken);

                if (!payload) {
                    set.status = 401;
                    return { error: "Sesión expirada o inválida" };
                }

                //Extraemos solo lo que nos interesa del payload viejo
                const { iat, exp, ...userData }: any = await jwt.verify(tempToken);

                if (!userData) {
                    set.status = 401;
                    return { error: "Sesión expirada o inválida"};
                }

                //Simulación de validación OTP
                //En el futuro aquí usaremos el secreto guardado en la BBDD
                const isOtpValid = otpCode === "123456"; //Simulación

                if (!isOtpValid) {
                    set.status = 400;
                    return { error: "Código OTP incorrecto" };
                }

                //Si todo está ok, firmamos el Token DEFINITIVO usando solo userData + el nuevo estado
                const finalToken = await jwt.sign({
                    id: userData.id,
                    role: userData.role,
                    email: userData.email,
                    otp_verified: true
                });

                return {
                    message: "Login completo!",
                    token: finalToken
                };
            }, {
                body: t.Object({
                    otpCode: t.String(),
                    tempToken: t.String()
                })
            })
);