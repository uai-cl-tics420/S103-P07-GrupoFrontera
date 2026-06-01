import React, { useState } from 'react';
import { authClient } from "@/lib/auth-client";
import { useT } from "@/i18n/context";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useToast } from "@/context/ToastContext";

type Mode = 'login' | 'register';

const LoginForm = () => {
    const { t } = useT();
    const { showToast } = useToast();
    const [mode, setMode] = useState<Mode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailReadOnly, setEmailReadOnly] = useState(true);
    const [passwordReadOnly, setPasswordReadOnly] = useState(true);

    const handleGoogleLogin = async () => {
        try {
            await authClient.signIn.social({
                provider: "google",
                callbackURL: window.location.origin,
            });
            showToast("Redirigiendo a Google...", "info");
        } catch {
            setError(t('loginGoogleFailed'));
            showToast("Falló la autenticación con Google.", "error");
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { error } = await authClient.signIn.email({ email, password });
            if (error) { 
                setError(error.message ?? t('badCredentials')); 
                showToast(error.message ?? "Credenciales inválidas.", "error"); 
            } else {
                showToast("¡Sesión iniciada correctamente!", "success");
            }
        } catch {
            setError(t('serverError'));
            showToast("Error de conexión con el servidor.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleEmailRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { error } = await authClient.signUp.email({
                email,
                password,
                name: name.trim() || email.split('@')[0] || 'Usuario',
            });
            if (error) {
                setError(error.message ?? t('createAccountError'));
                showToast(error.message ?? "No se pudo crear la cuenta.", "error");
            } else {
                showToast("¡Cuenta creada con éxito! Bienvenido a Panoramas.", "success");
                setMode('login');
            }
        } catch {
            setError(t('serverError'));
            showToast("Error crítico en el servidor de registro.", "error");
        } finally {
            setLoading(false);
        }
    };

    const passwordChecks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    const passwordValid = Object.values(passwordChecks).every(Boolean);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] font-sans px-4 py-8">
            <div className="max-w-md w-full p-8 sm:p-10 bg-white rounded-[32px] sm:rounded-[40px] shadow-sm border border-gray-100 text-center relative">

                <div className="absolute top-4 right-4">
                    <LanguageToggle />
                </div>

                <div className="mb-8 flex justify-center">
                    <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white font-black text-xl">
                        P
                    </div>
                </div>

                <h1 className="text-4xl font-black tracking-tighter mb-2 text-gray-900 uppercase">
                    Panoramas
                </h1>
                <p className="text-gray-400 text-sm mb-8 font-medium">
                    Grupo Frontera • 2026
                </p>

                <div className="flex bg-gray-100 rounded-2xl p-1 mb-8">
                    <button
                        type="button"
                        onClick={() => { setMode('login'); setError(''); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                    >
                        {t('signIn')}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode('register'); setError(''); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                    >
                        {t('register')}
                    </button>
                </div>

                <form onSubmit={mode === 'login' ? handleEmailLogin : handleEmailRegister} className="flex flex-col gap-3 mb-4">
                    {mode === 'register' && (
                        <input
                            type="text"
                            placeholder={t('name')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-black outline-none transition-all"
                        />
                    )}
                    <input
                        type="email"
                        placeholder={t('email')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        readOnly={emailReadOnly}
                        onFocus={() => setEmailReadOnly(false)}
                        autoComplete="username"
                        className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-black outline-none transition-all"
                    />
                    <input
                        type="password"
                        placeholder={t('password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        readOnly={passwordReadOnly}
                        onFocus={() => setPasswordReadOnly(false)}
                        autoComplete="current-password"
                        className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-black outline-none transition-all"
                    />
                    {mode === 'register' && password.length > 0 && (
                        <div className="flex flex-col gap-1 px-1 text-left">
                            {[
                                { ok: passwordChecks.length, label: t('pwdMin8') },
                                { ok: passwordChecks.uppercase, label: t('pwdUppercase') },
                                { ok: passwordChecks.number, label: t('pwdNumber') },
                                { ok: passwordChecks.special, label: t('pwdSpecial') },
                            ].map(({ ok, label }) => (
                                <p key={label} className={`text-xs font-medium ${ok ? 'text-green-500' : 'text-gray-400'}`}>
                                    {ok ? '✓' : '·'} {label}
                                </p>
                            ))}
                        </div>
                    )}

                    {error && <p className="text-red-500 text-xs text-left px-1">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || (mode === 'register' && !passwordValid)}
                        className="w-full bg-black text-white py-4 rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? t('loading') : mode === 'login' ? t('signIn') : t('createAccount')}
                    </button>
                </form>

                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-gray-100"></div>
                    <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">{t('or')}</span>
                    <div className="flex-1 h-px bg-gray-100"></div>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 py-4 px-6 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95"
                >
                    <img
                        src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
                        alt="Google"
                        className="w-5 h-5"
                    />
                    <span className="tracking-tight text-sm">{t('continueWithGoogle')}</span>
                </button>

                <div className="mt-8 pt-6 border-t border-gray-50">
                    <p className="text-[10px] text-gray-300 uppercase tracking-[0.2em] font-bold">
                        {t('secureAuth')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;
