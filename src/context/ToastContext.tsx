import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(2, 9);

        setToasts((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 4000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            <div className='fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none'>
                {toasts.map((toast) => {
                    const isSuccess = toast.type === 'success';
                    const isError = toast.type === 'error';

                    return (
                        <div
                            key={toast.id}
                            className={`pointer-events-auto w-full bg-white rounded-2xl p-4 shadow-xl border flex items-start gap-3 animate-slide-in transition-all duration-300
                                ${isSuccess ? 'border-emerald-100 bg-emerald-50/50' : ''}
                                ${isError ? 'border-red-100 bg-red-50/50' : ''}
                                ${toast.type === 'info' ? 'border-zinc-100 bg-zinc-50' : ''}
                              `}
                        >
                            {isSuccess && <CheckCircle2 className='w-5 h-5 text-emerald-500 shrink-0 mt-0.5' />}
                            {isError && <AlertCircle className='w-5 h-5 text-red-500 shrink-0 mt-0.5' />}
                            {toast.type === 'info' && <Info className='w-5 h-5 text-zinc-500 shrink-0 mt-0.5' />}

                            <div className='flex-grow'>
                                <p className='text-xs font-black tracking-tight text-gray-950 leading-relaxed'>
                                    {toast.message}
                                </p>
                            </div>

                            <button
                                onClick={() => removeToast(toast.id)}
                                className='text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded-lg hover:bg-black/5'
                            >
                                <X className='w-4 h-4' />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

//Hook para usar los toasts de forma limpia
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast debe ser usado dentro de un ToastProvider');
    }
    return context;
}