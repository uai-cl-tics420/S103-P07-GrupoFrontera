import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, X, CheckCircle2, Clock, Ban, Loader2, CreditCard, RotateCcw } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useT } from '@/i18n/context';
import { LanguageToggle } from '@/components/LanguageToggle';
import { PayModal } from '@/components/PayModal';
import type { TranslationKey } from '@/i18n/translations';

interface Reservation {
    id: string;
    activityId: string;
    status: string;
    createdAt: string;
    activity: {
        id: string;
        name: string;
        category: string;
        coordinates?: { lat: number; lng: number };
    } | null;
}

interface UserReservationsViewProps {
    userId: string;
    userEmail?: string;
    onBack: () => void;
    onReservationChanged?: () => void;
}

const categoryKeyMap: Record<string, TranslationKey> = {
    'Cine': 'categoryCine',
    'Parque': 'categoryParque',
    'Teatro': 'categoryTeatro',
    'Museo': 'categoryMuseo',
    'Restaurante': 'categoryRestaurante',
    'Miradores': 'categoryMiradores',
};

const statusKeyMap: Record<string, TranslationKey> = {
    pagado: 'reservationStatusPagado',
    comprado: 'reservationStatusComprado',
    cancelado: 'reservationStatusCancelado',
    pendiente: 'reservationStatusPendiente',
};

function StatusBadge({ status, t }: { status: string; t: (k: TranslationKey) => string }) {
    const styles: Record<string, { bg: string; text: string; icon: any }> = {
        pagado: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
        comprado: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
        pendiente: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
        cancelado: { bg: 'bg-gray-100', text: 'text-gray-500', icon: Ban },
    };
    const style = styles[status] ?? styles.pendiente;
    const Icon = style.icon;
    const labelKey = statusKeyMap[status] ?? 'reservationStatusPendiente';
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${style.bg} ${style.text}`}>
            <Icon className="w-3 h-3" />
            {t(labelKey)}
        </span>
    );
}

export function UserReservationsView({ userId, userEmail, onBack, onReservationChanged }: UserReservationsViewProps) {
    const { t } = useT();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [payTarget, setPayTarget] = useState<Reservation | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reservations/${userId}`, { credentials: 'include' });
            const data = await res.json();
            if (Array.isArray(data)) {
                data.sort((a: Reservation, b: Reservation) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setReservations(data);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const handleCancel = async (id: string) => {
        if (!confirm(t('reservationCancelConfirm'))) return;
        setBusyId(id);
        try {
            const res = await fetch(`/api/reservations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: 'cancelado' }),
            });
            if (res.ok) {
                setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelado' } : r));
                onReservationChanged?.();
            }
        } finally {
            setBusyId(null);
        }
    };

    const handleRebook = async (activityId: string) => {
        setBusyId(activityId);
        try {
            const res = await fetch('/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ activityId, payNow: false }),
            });
            if (res.ok) {
                await load();
                onReservationChanged?.();
            }
        } finally {
            setBusyId(null);
        }
    };

    const formatDate = (iso: string) => {
        try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] font-sans pb-20">
            <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5 mb-8 sm:mb-12">
                <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-tighter hover:text-gray-900 transition-colors whitespace-nowrap"
                    >
                        <ArrowLeft className="w-3 h-3" />
                        <span className="hidden sm:inline">{t('adminGoBack')}</span>
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <LanguageToggle />
                        <span className="hidden md:inline text-[10px] font-bold text-gray-400 uppercase tracking-tighter truncate max-w-[180px]">
                            {userEmail}
                        </span>
                        <button
                            onClick={() => authClient.signOut()}
                            className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-red-400 transition-colors whitespace-nowrap"
                        >
                            {t('logout')}
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <header className="mb-8 sm:mb-10">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-gray-900 mb-1">
                        {t('myReservationsTitle')}
                    </h1>
                    {!loading && (
                        <p className="text-gray-400 text-sm">
                            {reservations.length} {reservations.length === 1 ? t('panoramaFound') : t('panoramasFound')}
                        </p>
                    )}
                </header>

                {loading ? (
                    <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <p className="text-sm font-bold uppercase tracking-widest">{t('myReservationsLoading')}</p>
                    </div>
                ) : reservations.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center">
                        <p className="text-gray-500 font-medium">{t('myReservationsEmpty')}</p>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-4">
                        {reservations.map(r => {
                            const catLabel = r.activity
                                ? (categoryKeyMap[r.activity.category]
                                    ? t(categoryKeyMap[r.activity.category])
                                    : r.activity.category)
                                : '—';
                            const isCancelled = r.status === 'cancelado';
                            const isPending = r.status === 'pendiente';
                            const isPaid = r.status === 'pagado' || r.status === 'comprado';
                            const busy = busyId === r.id || busyId === r.activityId;

                            return (
                                <li
                                    key={r.id}
                                    className={`bg-white rounded-3xl border border-gray-100 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow ${isCancelled ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500">
                                                    {catLabel}
                                                </span>
                                                <StatusBadge status={r.status} t={t} />
                                            </div>
                                            <h3 className="text-lg sm:text-xl font-black text-gray-900 tracking-tighter leading-tight break-words">
                                                {r.activity?.name ?? r.activityId}
                                            </h3>
                                            <p className="mt-1 text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                                                <span>{t('reservationDate')}: {formatDate(r.createdAt)}</span>
                                                {r.activity?.coordinates && (
                                                    <span className="hidden sm:inline-flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {r.activity.coordinates.lat.toFixed(2)}, {r.activity.coordinates.lng.toFixed(2)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2 self-end sm:self-auto">
                                            {/* Pendiente: Pagar */}
                                            {isPending && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPayTarget(r)}
                                                    disabled={busy}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-tighter whitespace-nowrap px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    <CreditCard className="w-3 h-3" />
                                                    {t('payButton')}
                                                </button>
                                            )}
                                            {/* Pendiente o Pagado: Cancelar */}
                                            {(isPending || isPaid) && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancel(r.id)}
                                                    disabled={busy}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-red-500 whitespace-nowrap px-3 py-2 rounded-lg border border-gray-200 hover:border-red-200 disabled:opacity-50"
                                                >
                                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                                    {t('reservationCancelAction')}
                                                </button>
                                            )}
                                            {/* Cancelada: Reservar de nuevo */}
                                            {isCancelled && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRebook(r.activityId)}
                                                    disabled={busy}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-tighter whitespace-nowrap px-3 py-2 rounded-lg bg-black hover:bg-zinc-800 disabled:opacity-50"
                                                >
                                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                    {t('rebookCta')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </main>

            <footer className="mt-16 sm:mt-20 text-center opacity-20 font-black text-[10px] tracking-[0.5em] uppercase px-4">
                Grupo Frontera • 2026
            </footer>

            {/* Modal de pago para cualquier reserva pendiente seleccionada */}
            {payTarget && (
                <PayModal
                    reservationId={payTarget.id}
                    activityName={payTarget.activity?.name ?? payTarget.activityId}
                    open={!!payTarget}
                    onClose={() => setPayTarget(null)}
                    onSuccess={async () => {
                        await load();
                        onReservationChanged?.();
                    }}
                />
            )}
        </div>
    );
}

export default UserReservationsView;
