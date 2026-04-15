import React from 'react';
import { authClient } from "@/lib/auth-client";

const LoginForm = () => {
    const handleGoogleLogin = async () => {
        try {
            //Función que abre Google
            await authClient.signIn.social({
                provider: "google",
                callbackURL: window.location.origin, //a donde irá el usuario después de loguearse
            });
        } catch (error) {
            console.error("Error al iniciar sesión con Google:", error);
            alert("Hubo un problema al conectar con Google.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] font-sans">
            <div className="max-w-md w-full p-10 bg-white rounded-[40px] shadow-sm border border-gray-100 text-center">
                <div className="mb-8 flex justify-center">
                    <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white font-black text-xl">
                        P
                    </div>
                </div>

                <h1 className="text-4xl font-black tracking-tighter mb-2 text-gray-900 uppercase">
                    Panoramas
                </h1>
                <p className="text-gray-400 text-sm mb-10 font-medium">
                    Grupo Frontera • 2026
                </p>

                <button
                    onClick={handleGoogleLogin} //cambiamos la función que antes era handleLogin
                    className="w-full flex items-center justify-center gap-3 bg-black text-white py-4 px-6 rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-black/5"
                >
                    {/* Ícono de Google */}
                    <img
                        src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
                        alt="Google"
                        className="w-5 h-5 bg-white rounded-full p-0.5"
                    />
                    <span className="tracking-tight text-sm">Continuar con Google</span>
                </button>

                <div className="mt-10 pt-6 border-t border-gray-50">
                    <p className="text-[10px] text-gray-300 uppercase tracking-[0.2em] font-bold">
                        Autenticación Segura (SSO + OTP)
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;