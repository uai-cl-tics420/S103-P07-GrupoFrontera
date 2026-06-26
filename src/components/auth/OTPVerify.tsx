import React, { useState, useEffect } from 'react';
import { authClient } from "@/lib/auth-client";
import { useT } from "@/i18n/context";
import { LanguageToggle } from "@/components/LanguageToggle";

const OTPVerify = ({ userId, email, onVerified }: { userId: string, email: string, onVerified: (token: string) => void }) => {
    const { LL } = useT();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);

    const requestCode = React.useCallback(async () => {
        setSending(true);
        setError('');
        try {
            const res = await fetch("/api/otp/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, email }),
            });
            const data = await res.json().catch(() => null);
            // El backend devuelve 200 con { error: true } cuando el correo no logró enviarse
            // (ej. timeout del SMTP), en vez de un 500, para poder mostrar el mensaje al usuario.
            if (!res.ok || data?.error) {
                setError(data?.message || LL.serverError());
            }
        } catch (err) {
            setError(LL.serverError());
        } finally {
            setSending(false);
        }
    }, [userId, email]);

    useEffect(() => {
        requestCode();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleVerify = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch("/api/otp/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, code }),
            });

            const data = await response.json();

            if (data.status === "success") {
                const tokenRes = await fetch("/api/auth/token", {
                    credentials: "include",
                });
                const tokenData = await tokenRes.json();
                onVerified(tokenData.token ?? "");
            } else {
                setError(LL.otpInvalid());
            }
        } catch (err) {
            setError(LL.serverError());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4 py-8">
            <div className="max-w-md w-full p-8 sm:p-10 bg-white rounded-[32px] sm:rounded-[40px] shadow-sm border border-gray-100 text-center relative">

                <div className="absolute top-4 right-4">
                    <LanguageToggle />
                </div>

                <h2 className="text-2xl font-black tracking-tighter mb-4 mt-2">{LL.otpTitle()}</h2>
                <p className="text-gray-400 text-sm mb-8">{LL.otpInstructions()}</p>

                <input
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    className="w-full text-center text-3xl sm:text-4xl font-mono tracking-[0.5em] p-4 sm:p-5 bg-gray-50 rounded-2xl mb-6 focus:ring-2 focus:ring-black outline-none transition-all"
                />

                {error && (
                    <div className="mb-4">
                        <p className="text-red-500 text-xs">{error}</p>
                        <button
                            type="button"
                            onClick={requestCode}
                            disabled={sending}
                            className="text-xs font-bold text-gray-600 underline mt-1 disabled:opacity-50"
                        >
                            {sending ? LL.otpVerifying() : LL.otpResendCode()}
                        </button>
                    </div>
                )}

                <button
                    onClick={handleVerify}
                    disabled={loading || code.length < 6}
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
                >
                    {loading ? LL.otpVerifying() : LL.otpVerify()}
                </button>
                <button
                    onClick={() => authClient.signOut()}
                    className="w-full mt-3 bg-transparent text-gray-400 text-xs font-bold py-2 hover:text-gray-600 transition-all"
                >
                    {LL.otpBackToLogin()}
                </button>

            </div>
        </div>
    );
};

export default OTPVerify;
