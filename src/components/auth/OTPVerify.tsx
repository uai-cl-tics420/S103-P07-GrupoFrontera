import React, { useState } from 'react';

const OTPVerify = ({ onVerify }: { onVerify: (code: string) => void }) => {
    const [code, setCode] = useState('');

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

                <button
                    onClick={() => onVerify(code)}
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95"
                >
                    Verificar Código
                </button>   
            </div>
        </div>
    );
};

export default OTPVerify;