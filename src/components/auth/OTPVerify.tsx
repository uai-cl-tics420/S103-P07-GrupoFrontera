import React, { useState, useEffect } from 'react';
import { authClient } from "@/lib/auth-client";

const OTPVerify = ({ userId, email, onVerified }: { userId: string, email: string, onVerified: (token: string) => void }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const requestCode = async () => {
            try {
                await fetch("http://localhost:4000/api/otp/request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, email }),
                });
            } catch (err) {
                console.error("Error al solicitar el código OTP:", err);
            }
        };
        requestCode();
    }, [userId, email]);

    const handleVerify = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch("http://localhost:4000/api/otp/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, code }),
            });

            const data = await response.json();

            if (data.status === "success") {
                const tokenRes = await fetch("http://localhost:4000/api/auth/token", {
                    credentials: "include",
                });
                const tokenData = await tokenRes.json();
                onVerified(tokenData.token ?? "");
            } else {
                setError("Código incorrecto o expirado");
            }
        } catch (err) {
            setError("Error de conexión con el servidor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
            <div className="max-w-md w-full p-10 bg-white rounded-[40px] shadow-sm border border-gray-100 text-center">
                <h2 className="text-2xl font-black tracking-tighter mb-4">Verificación de Seguridad</h2>
                <p className="text-gray-400 text-sm mb-8">Ingresa el código de 6 dígitos para confirmar tu identidad.</p>

                <input
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    className="w-full text-center text-4xl font-mono tracking-[0.5em] p-5 bg-gray-50 rounded-2xl mb-6 focus:ring-2 focus:ring-black outline-none transition-all"
                />

                {error && <p className="text-red-500 text-xs mb-4">{error}</p>}

                <button
                    onClick={handleVerify}
                    disabled={loading || code.length < 6}
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95"
                >
                    {loading ? "Verificando..." : "Verificar Código"}
                </button>
                <button
                    onClick={() => authClient.signOut()}
                    className="w-full mt-3 bg-transparent text-gray-400 text-xs font-bold py-2 hover:text-gray-600 transition-all"
                >
                    Volver al inicio de sesión
                </button>

            </div>
        </div>
    );
};

export default OTPVerify;