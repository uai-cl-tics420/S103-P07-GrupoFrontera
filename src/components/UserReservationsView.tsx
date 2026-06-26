import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, X, CheckCircle2, Clock, Ban, Loader2, CreditCard, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useT } from '@/i18n/context';
import { LanguageToggle } from '@/components/LanguageToggle';
import { PayModal } from '@/components/PayModal';
import type { TranslationFunctions } from '@/i18n/i18n-types';
type CategoryKey = 'categoryCine' | 'categoryParque' | 'categoryTeatro' | 'categoryMuseo' | 'categoryRestaurante' | 'categoryMiradores';
type StatusKey = 'reservationStatusPagado' | 'reservationStatusComprado' | 'reservationStatusCancelado' | 'reservationStatusPendiente';

interface Reservation {
    id: string;
    activityId: string;
    status: string;
    createdAt: string;
    reservedDate?: string | null;
    reservedTime?: string | null;
    activity: {
        id: string;
        name: string;
        category: string;
        price?: number | null;
        coordinates?: { lat: number; lng: number };
    } | null;
}

/** Un grupo = todas las filas que se crearon juntas (misma compra de N cupos de una vez). */
interface ReservationGroup {
    ids: string[];
    activityId: string;
    status: string;
    createdAt: string;
    reservedDate?: string | null;
    reservedTime?: string | null;
    activity: Reservation['activity'];
    cantidad: number;
}

function groupReservations(rows: Reservation[]): ReservationGroup[] {
    const map = new Map<string, ReservationGroup>();
    for (const r of rows) {
        // Las filas de un mismo "reservar X cupos" comparten activityId+status+fecha+franja+createdAt exacto
        // (se insertan en una sola transaccion, asi que el timestamp es identico bit a bit).
        const key = `${r.activityId}|${r.status}|${r.reservedDate ?? ''}|${r.reservedTime ?? ''}|${r.createdAt}`;
        const existing = map.get(key);
        if (existing) {
            existing.ids.push(r.id);
            existing.cantidad += 1;
        } else {
            map.set(key, {
                ids: [r.id],
                activityId: r.activityId,
                status: r.status,
                createdAt: r.createdAt,
                reservedDate: r.reservedDate,
                reservedTime: r.reservedTime,
                activity: r.activity,
                cantidad: 1,
            });
        }
    }
    return Array.from(map.values());
}

type StatusFilter = 'todas' | 'activas' | 'porPagar' | 'canceladas';

function matchesFilter(status: string, filter: StatusFilter): boolean {
    if (filter === 'todas') return true;
    if (filter === 'activas') return status === 'pagado' || status === 'comprado';
    if (filter === 'porPagar') return status === 'pendiente';
    return status === 'cancelado';
}

interface UserReservationsViewProps {
    userId: string;
    userEmail?: string;
    onBack: () => void;
    onReservationChanged?: () => void;
}

const categoryKeyMap: Record<string, CategoryKey> = {
    'Cine': 'categoryCine',
    'Parque': 'categoryParque',
    'Teatro': 'categoryTeatro',
    'Museo': 'categoryMuseo',
    'Restaurante': 'categoryRestaurante',
    'Miradores': 'categoryMiradores',
};

const statusKeyMap: Record<string, StatusKey> = {
    pagado: 'reservationStatusPagado',
    comprado: 'reservationStatusComprado',
    cancelado: 'reservationStatusCancelado',
    pendiente: 'reservationStatusPendiente',
};

function StatusBadge({ status, LL }: { status: string; LL: TranslationFunctions }) {
    const styles: Record<string, { bg: string; text: string; icon: any }> = {
        pagado: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
        comprado: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
        pendiente: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
        cancelado: { bg: 'bg-gray-100', text: 'text-gray-500', icon: Ban },
    };
    const style = styles[status] ?? styles.pendiente!;
    const Icon = style.icon;
    const labelKey: StatusKey = statusKeyMap[status] ?? 'reservationStatusPendiente';
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${style.bg} ${style.text}`}>
            <Icon className="w-3 h-3" />
            {LL[labelKey]()}
        </span>
    );
}

export function UserReservationsView({ userId, userEmail, onBack, onReservationChanged }: UserReservationsViewProps) {
    const { LL } = useT();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [payTarget, setPayTarget] = useState<ReservationGroup | null>(null);
    const [filter, setFilter] = useState<StatusFilter>('todas');
    const [cancelTarget, setCancelTarget] = useState<ReservationGroup | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [clearingCancelled, setClearingCancelled] = useState(false);

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

    // Cancela TODAS las filas del grupo (ej. las 3 unidades reservadas juntas), no solo una.
    // Se llama solo despues de confirmar en el modal propio (ver cancelTarget mas abajo).
    const confirmCancel = async () => {
        if (!cancelTarget) return;
        const ids = cancelTarget.ids;
        setCancelling(true);
        setBusyId(ids[0] ?? null);
        try {
            await Promise.all(ids.map((id) =>
                fetch(`/api/reservations/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ status: 'cancelado' }),
                })
            ));
            setReservations(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'cancelado' } : r));
            onReservationChanged?.();
        } finally {
            setCancelling(false);
            setBusyId(null);
            setCancelTarget(null);
        }
    };

    const handleClearCancelled = async () => {
        setClearingCancelled(true);
        try {
            const res = await fetch('/api/reservations/cancelled', { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                setReservations(prev => prev.filter(r => r.status !== 'cancelado'));
            }
        } finally {
            setClearingCancelled(false);
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
                        <span className="hidden sm:inline">{LL.adminGoBack()}</span>
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
                            {LL.logout()}
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <header className="mb-6 sm:mb-8">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-gray-900 mb-1">
                        {LL.myReservationsTitle()}
                    </h1>
                    {!loading && (
                        <p className="text-gray-400 text-sm">
                            {reservations.length} {reservations.length === 1 ? LL.panoramaFound() : LL.panoramasFound()}
                        </p>
                    )}
                </header>

                {!loading && reservations.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-6 sm:mb-8">
                        <div className="flex flex-wrap gap-2">
                            {(['todas', 'activas', 'porPagar', 'canceladas'] as StatusFilter[]).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className={`text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl transition ${filter === f ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                >
                                    {f === 'todas' ? LL.reservationFilterAll()
                                        : f === 'activas' ? LL.reservationFilterActive()
                                        : f === 'porPagar' ? LL.reservationFilterPending()
                                        : LL.reservationFilterCancelled()}
                                </button>
                            ))}
                        </div>
                        {filter === 'canceladas' && reservations.some(r => r.status === 'cancelado') && (
                            <button
                                type="button"
                                onClick={handleClearCancelled}
                                disabled={clearingCancelled}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest hover:text-red-500 transition disabled:opacity-50"
                            >
                                {clearingCancelled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                {LL.reservationClearCancelledCta()}
                            </button>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <p className="text-sm font-bold uppercase tracking-widest">{LL.myReservationsLoading()}</p>
                    </div>
                ) : reservations.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center">
                        <p className="text-gray-500 font-medium">{LL.myReservationsEmpty()}</p>
                    </div>
                ) : (() => {
                    const grupos = groupReservations(reservations).filter((g) => matchesFilter(g.status, filter));
                    if (grupos.length === 0) {
                        return (
                            <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center">
                                <p className="text-gray-500 font-medium">{LL.reservationFilterEmpty()}</p>
                            </div>
                        );
                    }
                    return (
                    <ul className="flex flex-col gap-4">
                        {grupos.map(g => {
                            const catKey = g.activity ? categoryKeyMap[g.activity.category] : undefined;
                            const catLabel = g.activity
                                ? (catKey ? LL[catKey]() : g.activity.category)
                                : '—';
                            const isCancelled = g.status === 'cancelado';
                            const isPending = g.status === 'pendiente';
                            const isPaid = g.status === 'pagado' || g.status === 'comprado';
                            const busy = g.ids.includes(busyId ?? '') || busyId === g.activityId;

                            return (
                                <li
                                    key={g.ids[0]}
                                    className={`bg-white rounded-3xl border border-gray-100 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow ${isCancelled ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500">
                                                    {catLabel}
                                                </span>
                                                <StatusBadge status={g.status} LL={LL} />
                                                {g.cantidad > 1 && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                                                        ×{g.cantidad}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg sm:text-xl font-black text-gray-900 tracking-tighter leading-tight break-words">
                                                {g.activity?.name ?? g.activityId}
                                            </h3>
                                            <p className="mt-1 text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                                                <span>{LL.reservationDate()}: {formatDate(g.createdAt)}</span>
                                                {g.reservedDate && (
                                                    <span>{g.reservedDate}{g.reservedTime ? ` · ${g.reservedTime}` : ''}</span>
                                                )}
                                                {g.activity?.coordinates && (
                                                    <span className="hidden sm:inline-flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {g.activity.coordinates.lat.toFixed(2)}, {g.activity.coordinates.lng.toFixed(2)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2 self-end sm:self-auto">
                                            {/* Pendiente: Pagar (todo el grupo, un solo cobro) */}
                                            {isPending && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPayTarget(g)}
                                                    disabled={busy}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-tighter whitespace-nowrap px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    <CreditCard className="w-3 h-3" />
                                                    {LL.payButton()}
                                                </button>
                                            )}
                                            {/* Pendiente o Pagado: Cancelar todo el grupo */}
                                            {(isPending || isPaid) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setCancelTarget(g)}
                                                    disabled={busy}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-red-500 whitespace-nowrap px-3 py-2 rounded-lg border border-gray-200 hover:border-red-200 disabled:opacity-50"
                                                >
                                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                                    {LL.reservationCancelAction()}
                                                </button>
                                            )}
                                            {/* Cancelada: Reservar de nuevo */}
                                            {isCancelled && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRebook(g.activityId)}
                                                    disabled={busy}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-tighter whitespace-nowrap px-3 py-2 rounded-lg bg-black hover:bg-zinc-800 disabled:opacity-50"
                                                >
                                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                    {LL.rebookCta()}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    );
                })()}
            </main>

            <footer className="mt-16 sm:mt-20 text-center opacity-20 font-black text-[10px] tracking-[0.5em] uppercase px-4">
                Grupo Frontera • 2026
            </footer>

            {/* Modal de pago para cualquier reserva pendiente seleccionada */}
            {payTarget && (
                <PayModal
                    reservationId={payTarget.ids[0]!}
                    reservationIds={payTarget.ids}
                    activityName={payTarget.activity?.name ?? payTarget.activityId}
                    price={payTarget.activity?.price ?? undefined}
                    open={!!payTarget}
                    onClose={() => setPayTarget(null)}
                    onSuccess={async () => {
                        await load();
                        onReservationChanged?.();
                    }}
                />
            )}

            {/* Modal propio de confirmacion de cancelacion (reemplaza el confirm() nativo del navegador) */}
            {cancelTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-8"
                    onClick={() => !cancelling && setCancelTarget(null)}
                >
                    <div
                        className="max-w-sm w-full bg-white rounded-[28px] sm:rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden p-6 sm:p-8 text-center space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {cancelling ? (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                                <p className="text-sm font-bold text-gray-600">{LL.reservationCancelProcessing()}</p>
                            </div>
                        ) : (
                            <>
                                <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                                </div>
                                <p className="text-base font-black tracking-tighter text-gray-900">{LL.reservationCancelConfirm()}</p>
                                {cancelTarget.activity?.name && (
                                    <p className="text-sm text-gray-500">{cancelTarget.activity.name}{cancelTarget.cantidad > 1 ? ` ×${cancelTarget.cantidad}` : ''}</p>
                                )}
                                <div className="flex flex-col gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={confirmCancel}
                                        className="w-full bg-red-600 text-white text-sm font-black py-3 sm:py-4 rounded-2xl hover:bg-red-700 active:scale-[0.98] transition-all uppercase tracking-widest"
                                    >
                                        {LL.confirmCta()}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCancelTarget(null)}
                                        className="w-full bg-gray-100 text-gray-600 text-xs font-bold py-3 px-4 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest"
                                    >
                                        {LL.cancelCta()}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserReservationsView;
