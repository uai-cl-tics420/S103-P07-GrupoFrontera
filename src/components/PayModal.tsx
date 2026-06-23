import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useT } from '@/i18n/context';

interface PayModalProps {
    reservationId: string;
    activityName: string;
    price?: number | null;
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

type Phase = 'idle' | 'processing' | 'success' | 'error';

export function PayModal({ reservationId, activityName, price, open, onClose, onSuccess }: PayModalProps) {
    const { LL } = useT();
    const [phase, setPhase] = useState<Phase>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [txnId, setTxnId] = useState('');

    useEffect(() => {
        if (!open) {
            setPhase('idle');
            setErrorMsg('');
            setTxnId('');
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && phase !== 'processing') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, phase, onClose]);

    if (!open) return null;

    const handlePay = async () => {
        setPhase('processing');
        setErrorMsg('');
        try {
            const res = await fetch(`/api/reservations/${reservationId}/pay`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setPhase('error');
                setErrorMsg(data?.error ?? LL.reservationFailed());
                return;
            }
            setTxnId(data.payment?.transactionId ?? '');
            setPhase('success');
            onSuccess?.();
        } catch {
            setPhase('error');
            setErrorMsg(LL.reservationFailed());
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-8"
            onClick={() => phase !== 'processing' && onClose()}
        >
            <div
                className="max-w-md w-full bg-white rounded-[28px] sm:rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 sm:px-8 pt-6 pb-2">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900">
                        {LL.payButton()}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={phase === 'processing'}
                        className="text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-30"
                        aria-label={LL.reservationClose()}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 sm:px-8 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-black text-gray-900 tracking-tighter break-words">
                        {activityName}
                    </h3>
                </div>

                <div className="px-6 sm:px-8 py-6">
                {phase === 'idle' && (() => {
                        const base = price ?? 0;
                        const servicio = Math.round(base * 0.10);
                        const total = base + servicio;
                        return (
                            <div className="space-y-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {LL.paymentDetailLabel()}
                                </p>
                                <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>{LL.subtotalLabel()}</span>
                                        <span className="font-bold text-gray-900">${base.toLocaleString('es-CL')}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>{LL.serviceFeeLabel()}</span>
                                        <span className="font-bold text-gray-900">${servicio.toLocaleString('es-CL')}</span>
                                    </div>
                                    <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                                        <span className="text-sm font-black text-gray-900">{LL.totalLabel()}</span>
                                        <span className="text-xl font-black text-blue-600">${total.toLocaleString('es-CL')}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {phase === 'processing' && (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                            <p className="text-sm font-bold text-gray-600">{LL.reservationProcessing()}</p>
                        </div>
                    )}
                    {phase === 'success' && (
                        <div className="flex flex-col items-center gap-2 py-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                                <Check className="w-6 h-6 text-emerald-600" />
                            </div>
                            <p className="text-base font-black tracking-tighter text-gray-900">{LL.reservationCreatedPaid()}</p>
                            {txnId && (
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-mono mt-2 break-all">
                                    {LL.transactionLabel()}: {txnId}
                                </p>
                            )}
                        </div>
                    )}
                    {phase === 'error' && (
                        <div className="flex flex-col items-center gap-2 py-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <p className="text-base font-black tracking-tighter text-gray-900">{LL.reservationFailed()}</p>
                            {errorMsg && <p className="text-xs text-gray-500 max-w-xs break-words">{errorMsg}</p>}
                        </div>
                    )}
                </div>

                <div className="px-6 sm:px-8 pb-6 pt-2 flex flex-col gap-3">
                    {phase === 'idle' && (
                        <>
                            <button
                                type="button"
                                onClick={handlePay}
                                className="w-full bg-emerald-600 text-white text-sm font-black py-3 sm:py-4 rounded-2xl hover:bg-emerald-700 active:scale-[0.98] transition-all uppercase tracking-widest shadow-lg shadow-emerald-600/10"
                            >

                                {LL.reservationConfirmPay()}

                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full bg-gray-100 text-gray-600 text-xs font-bold py-3 px-4 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest"
                            >
                                {LL.reservationCancel()}
                            </button>
                        </>
                    )}
                    {(phase === 'success' || phase === 'error') && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full bg-black text-white text-sm font-black py-3 sm:py-4 rounded-2xl hover:bg-zinc-800 active:scale-[0.98] transition-all uppercase tracking-widest"
                        >
                            {LL.reservationClose()}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PayModal;
