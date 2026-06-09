import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useT } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';

interface Activity {
    id: string;
    name: string;
    category: string;
    tagClima?: string;
}

interface ReservationModalProps {
    activity: Activity;
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

type Phase = 'idle' | 'processing' | 'success' | 'error';

const categoryKeyMap: Record<string, TranslationKey> = {
    'Cine': 'categoryCine',
    'Parque': 'categoryParque',
    'Teatro': 'categoryTeatro',
    'Museo': 'categoryMuseo',
    'Restaurante': 'categoryRestaurante',
    'Miradores': 'categoryMiradores',
};

export function ReservationModal({ activity, open, onClose, onSuccess }: ReservationModalProps) {
    const { t } = useT();
    const [phase, setPhase] = useState<Phase>('idle');
    const [paid, setPaid] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [txnId, setTxnId] = useState<string>('');

    useEffect(() => {
        if (!open) {
            setPhase('idle');
            setPaid(false);
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

    const categoryLabel = categoryKeyMap[activity.category]
        ? t(categoryKeyMap[activity.category])
        : activity.category;

    const handleReserve = async (payNow: boolean) => {
        setPhase('processing');
        setErrorMsg('');
        setPaid(payNow);
        try {
            const res = await fetch('/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ activityId: activity.id, payNow }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setPhase('error');
                setErrorMsg(data?.error ?? t('reservationFailed'));
                return;
            }
            setTxnId(data.payment?.transactionId ?? '');
            setPhase('success');
            onSuccess?.();
        } catch {
            setPhase('error');
            setErrorMsg(t('reservationFailed'));
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
                        {t('reservationModalTitle')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={phase === 'processing'}
                        className="text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={t('reservationClose')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 sm:px-8 py-4 border-b border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500 mb-1">
                        {categoryLabel}
                    </p>
                    <h3 className="text-lg font-black text-gray-900 tracking-tighter leading-tight break-words">
                        {activity.name}
                    </h3>
                </div>

                <div className="px-6 sm:px-8 py-6">
                    {phase === 'idle' && (
                        <p className="text-sm text-gray-500">{t('reservationModalDescription')}</p>
                    )}
                    {phase === 'processing' && (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                            <p className="text-sm font-bold text-gray-600">{t('reservationProcessing')}</p>
                        </div>
                    )}
                    {phase === 'success' && (
                        <div className="flex flex-col items-center gap-2 py-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                                <Check className="w-6 h-6 text-emerald-600" />
                            </div>
                            <p className="text-base font-black tracking-tighter text-gray-900">
                                {paid ? t('reservationCreatedPaid') : t('reservationCreatedPending')}
                            </p>
                            <p className="text-xs text-gray-500">{t('reservationSuccessHint')}</p>
                            {txnId && (
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-mono mt-2 break-all">
                                    {t('transactionLabel')}: {txnId}
                                </p>
                            )}
                        </div>
                    )}
                    {phase === 'error' && (
                        <div className="flex flex-col items-center gap-2 py-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <p className="text-base font-black tracking-tighter text-gray-900">{t('reservationFailed')}</p>
                            {errorMsg && <p className="text-xs text-gray-500 max-w-xs break-words">{errorMsg}</p>}
                        </div>
                    )}
                </div>

                <div className="px-6 sm:px-8 pb-6 pt-2 flex flex-col gap-3">
                    {phase === 'idle' && (
                        <>
                            <button
                                type="button"
                                onClick={() => handleReserve(false)}
                                className="w-full bg-black text-white text-sm font-black py-3 sm:py-4 rounded-2xl hover:bg-zinc-800 active:scale-[0.98] transition-all uppercase tracking-widest shadow-lg shadow-black/10"
                            >
                                {t('reserveOnlyCta')}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReserve(true)}
                                className="w-full bg-emerald-600 text-white text-sm font-black py-3 sm:py-4 rounded-2xl hover:bg-emerald-700 active:scale-[0.98] transition-all uppercase tracking-widest shadow-lg shadow-emerald-600/10"
                            >
                                {t('payNowCta')}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full bg-gray-100 text-gray-600 text-xs font-bold py-3 px-4 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest"
                            >
                                {t('reservationCancel')}
                            </button>
                        </>
                    )}
                    {(phase === 'success' || phase === 'error') && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full bg-black text-white text-sm font-black py-3 sm:py-4 rounded-2xl hover:bg-zinc-800 active:scale-[0.98] transition-all uppercase tracking-widest"
                        >
                            {t('reservationClose')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ReservationModal;
