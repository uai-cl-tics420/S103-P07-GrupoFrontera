import React, { useState, useEffect } from 'react';
import { type Activity } from '../types/index.ts';
import { X, MapPin, Clock, CloudSun, Ticket, Calendar, ArrowLeft, Navigation } from 'lucide-react';

interface Franja { horaInicio: string | null; horaFin: string | null; }
interface AvailFecha { fecha: string; franjas: Franja[]; cuposPorDia: number | null; disponibles: number | null; }
interface AvailResp { activityId: string; name: string; price: number | null; fechas: AvailFecha[]; }

interface ActivityDetailModalProps {
    activity: Activity | null;
    onClose: () => void;
    isReserved?: boolean;
    onReserve?: (id: string) => void;
    onReservationChanged?: () => void;
    userCoords?: { lat: number; lng: number };
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ActivityDetailModal({ activity, onClose, onReservationChanged, userCoords }: ActivityDetailModalProps) {
    const [step, setStep] = useState<'detalle' | 'fechas'>('detalle');
    const [avail, setAvail] = useState<AvailResp | null>(null);
    const [loadingAvail, setLoadingAvail] = useState(false);
    const [selFecha, setSelFecha] = useState<string | null>(null);
    const [selFranja, setSelFranja] = useState<Franja | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmPay, setConfirmPay] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [drivingKm, setDrivingKm] = useState<number | null>(null);

    useEffect(() => {
        setStep('detalle'); setAvail(null); setSelFecha(null); setSelFranja(null); setMsg(null); setConfirmPay(false);
    }, [activity]);

    useEffect(() => {
        const c = activity?.coordinates;
        const valid = !!c && (c.lat !== 0 || c.lng !== 0);
        if (!userCoords || !valid || !c) { setDrivingKm(null); return; }
        let cancel = false;
        fetch(`/api/distance?fromLat=${userCoords.lat}&fromLng=${userCoords.lng}&toLat=${c.lat}&toLng=${c.lng}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => { if (!cancel && typeof d?.km === 'number') setDrivingKm(d.km); })
            .catch(() => {});
        return () => { cancel = true; };
    }, [userCoords?.lat, userCoords?.lng, activity?.coordinates?.lat, activity?.coordinates?.lng]);

    if (!activity) return null;

    const emoji = activity.category === 'Cine' ? '🍿' :
        activity.category === 'Parque' ? '🌳' :
        activity.category === 'Teatro' ? '🎭' :
        activity.category === 'Miradores' ? '🏔️' :
        activity.category === 'Restaurante' ? '🍽️' :
        activity.category === 'Museo' ? '🏛️' : '🖼️';

    const coords = activity.coordinates;
    const hasMap = !!coords && (coords.lat !== 0 || coords.lng !== 0);
    const distanciaKm = userCoords && hasMap ? getDistanceKm(userCoords.lat, userCoords.lng, coords.lat, coords.lng) : null;
    const distMostrar = drivingKm ?? distanciaKm;
    const fechaSel = avail?.fechas.find((f) => f.fecha === selFecha) || null;
    const franjasDeFecha = fechaSel?.franjas || [];
    const agotadoSel = fechaSel?.disponibles === 0;
    const puedeReservar = !!selFecha && !agotadoSel && (selFranja !== null || franjasDeFecha.length === 0);

    const consultar = async () => {
        setLoadingAvail(true); setMsg(null);
        try {
            const res = await fetch(`/api/activities/${activity.id}/availability`, { credentials: 'include' });
            const data = await res.json();
            setAvail(data);
            setStep('fechas');
        } catch {
            setMsg({ ok: false, text: 'No se pudo cargar la disponibilidad.' });
        } finally {
            setLoadingAvail(false);
        }
    };

    const reservar = async (payNow: boolean) => {
        if (!selFecha) return;
        setBusy(true); setMsg(null);
        try {
            const res = await fetch('/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    activityId: activity.id,
                    payNow,
                    reservedDate: selFecha,
                    reservedTime: selFranja ? `${selFranja.horaInicio ?? ''} - ${selFranja.horaFin ?? ''}` : null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'No se pudo reservar');
            setMsg({ ok: true, text: payNow ? '¡Pago realizado! Reserva confirmada y cupo descontado.' : 'Reserva creada (pendiente de pago). Cupo descontado.' });
            onReservationChanged?.();
            // Refrescar la disponibilidad para que el cupo se vea descontado al instante
            try {
                const av = await fetch(`/api/activities/${activity.id}/availability`, { credentials: 'include' });
                setAvail(await av.json());
                setSelFranja(null);
            } catch { /* noop */ }
        } catch (e: any) {
            setMsg({ ok: false, text: e?.message || 'Error al reservar' });
        } finally {
            setBusy(false);
        }
    };

    const chip = (active: boolean, disabled = false) =>
        `text-xs font-bold px-3 py-2 rounded-xl transition ${disabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : active ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in'>
            <div className='bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] animate-slide-up'>

                <div className='relative h-48 bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center border-b border-gray-100 overflow-hidden'>
                    {activity.imageUrl ? (
                        <img src={activity.imageUrl} alt={activity.name} className='w-full h-full object-cover' />
                    ) : (
                        <span className='text-7xl select-none'>{emoji}</span>
                    )}
                    <button onClick={onClose} className='absolute top-4 right-4 bg-white/80 hover:bg-white text-gray-700 p-2 rounded-full transition-colors active:scale-90'>
                        <X className='w-5 h-5' />
                    </button>
                </div>

                <div className='p-6 sm:p-8 overflow-y-auto space-y-6 flex-grow'>
                    <div>
                        <span className='text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500 block mb-1'>{activity.category}</span>
                        <h2 className='text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter leading-tight'>{activity.name}</h2>
                    </div>

                    {activity.description && (
                        <p className='text-sm text-gray-600 leading-relaxed break-words whitespace-pre-line'>{activity.description}</p>
                    )}

                    <div className='grid grid-cols-2 gap-3'>
                        <div className='bg-zinc-50 border border-gray-100 p-3 rounded-2xl flex items-center gap-2'>
                            <CloudSun className='w-4 h-4 text-amber-500' />
                            <div className='flex flex-col'>
                                <span className='text-[9px] font-bold text-gray-400 uppercase tracking-wider'>Clima Sugerido</span>
                                <span className='text-xs font-black text-gray-700'>{activity.tagClima === 'Sunny' ? 'Ideal Exterior' : 'Apto Todo Clima'}</span>
                            </div>
                        </div>

                        {activity.openingHour && (
                            <div className='bg-zinc-50 border border-gray-100 p-3 rounded-2xl flex items-center gap-2'>
                                <Clock className='w-4 h-4 text-blue-500' />
                                <div className='flex flex-col'>
                                    <span className='text-[9px] font-bold text-gray-400 uppercase tracking-wider'>Horario</span>
                                    <span className='text-xs font-black text-gray-700'>{activity.openingHour} - {activity.closingHour}</span>
                                </div>
                            </div>
                        )}

                        {activity.price != null && (
                            <div className='bg-zinc-50 border border-gray-100 p-3 rounded-2xl flex items-center gap-2'>
                                <Ticket className='w-4 h-4 text-emerald-500' />
                                <div className='flex flex-col'>
                                    <span className='text-[9px] font-bold text-gray-400 uppercase tracking-wider'>Precio base</span>
                                    <span className='text-xs font-black text-gray-700'>{activity.price === 0 ? 'Gratis' : `$${activity.price.toLocaleString('es-CL')}`}</span>
                                    <span className='text-[8px] text-gray-400'>+ costo de servicio al pagar</span>
                                </div>
                            </div>
                        )}

                        {distMostrar != null && (
                            <div className='bg-zinc-50 border border-gray-100 p-3 rounded-2xl flex items-center gap-2'>
                                <Navigation className='w-4 h-4 text-blue-500' />
                                <div className='flex flex-col'>
                                    <span className='text-[9px] font-bold text-gray-400 uppercase tracking-wider'>{drivingKm != null ? 'Distancia en auto' : 'Distancia aproximada'}</span>
                                    <span className='text-xs font-black text-gray-700'>~{distMostrar.toFixed(1)} km</span>
                                    <span className='text-[8px] text-gray-400'>{drivingKm != null ? 'por carretera' : 'en línea recta'}</span>
                                </div>
                            </div>
                        )}

                        {activity.vicinity && (
                            <div className='col-span-2 bg-zinc-50 border border-gray-100 p-3 rounded-2xl flex items-start gap-2'>
                                <MapPin className='w-4 h-4 text-rose-500 mt-0.5 shrink-0' />
                                <div className='flex flex-col min-w-0'>
                                    <span className='text-[9px] font-bold text-gray-400 uppercase tracking-wider'>Direccion</span>
                                    <span className='text-xs font-black text-gray-700 break-words'>{activity.vicinity}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {step === 'detalle' && (
                        <div className='space-y-2'>
                            <h4 className='text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1'>
                                <MapPin className='w-3.5 h-3.5 text-zinc-500' /> Mapa del Lugar
                            </h4>
                            {hasMap ? (
                                <iframe title='mapa' className='w-full h-48 rounded-2xl border border-gray-100' loading='lazy'
                                    src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`} />
                            ) : (
                                <div className='w-full h-40 bg-zinc-100 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-center p-4 select-none'>
                                    <span className='text-2xl mb-1'>🗺️</span>
                                    <p className='text-[11px] font-bold text-zinc-400 uppercase tracking-wider'>Sin ubicacion</p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'fechas' && (
                        <div className='space-y-4'>
                            <h4 className='text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1'>
                                <Calendar className='w-3.5 h-3.5 text-zinc-500' /> Elige fecha y horario
                            </h4>
                            {loadingAvail && <p className='text-sm text-gray-400'>Cargando disponibilidad...</p>}
                            {avail && avail.fechas.length === 0 && (
                                <p className='text-sm text-gray-400'>Este panorama no tiene fechas cargadas todavía.</p>
                            )}
                            <div className='flex flex-wrap gap-2'>
                                {avail?.fechas.map((f) => {
                                    const agotado = f.disponibles === 0;
                                    return (
                                        <button key={f.fecha} type='button'
                                            onClick={() => { setSelFecha(f.fecha); setSelFranja(null); }}
                                            className={chip(selFecha === f.fecha)}>
                                            {f.fecha}
                                            <span className={`block text-[9px] font-bold ${agotado ? 'text-red-500' : 'opacity-70'}`}>
                                                {f.disponibles == null ? 'cupos libres' : agotado ? 'AGOTADO' : `${f.disponibles} cupos`}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {selFecha && franjasDeFecha.length > 0 && (
                                <div>
                                    <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2'>Horario</p>
                                    <div className='flex flex-wrap gap-2'>
                                        {franjasDeFecha.map((fr, i) => (
                                            <button key={i} type='button' onClick={() => setSelFranja(fr)}
                                                className={chip(selFranja === fr)}>
                                                {fr.horaInicio} - {fr.horaFin}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selFecha && fechaSel?.disponibles != null && (
                                <div className={`text-center text-xs font-black rounded-xl py-2 ${fechaSel.disponibles === 0 ? 'bg-red-50 text-red-600' : fechaSel.disponibles <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                    {fechaSel.disponibles === 0
                                        ? 'Agotado para esta fecha'
                                        : fechaSel.disponibles <= 5
                                        ? `¡Solo quedan ${fechaSel.disponibles} cupos!`
                                        : `${fechaSel.disponibles} cupos disponibles`}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className='p-6 bg-zinc-50 border-t border-gray-100 mt-auto space-y-3'>
                    {msg && (
                        <p className={`text-xs font-bold text-center ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>
                    )}

                    {step === 'detalle' && !msg?.ok && (
                        <button type='button' onClick={consultar} disabled={loadingAvail}
                            className='w-full text-xs font-black py-4 rounded-2xl bg-black hover:bg-zinc-800 text-white uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50'>
                            <Calendar className='w-4 h-4' /> {loadingAvail ? 'Cargando...' : 'Consultar fecha y hora'}
                        </button>
                    )}

                    {step === 'fechas' && !msg?.ok && (
                        <>
                            {confirmPay ? (
                                <>
                                    {(() => {
                                        const base = activity.price ?? 0;
                                        const servicio = Math.round(base * 0.10);
                                        const total = base + servicio;
                                        return (
                                            <div className='bg-white border border-gray-100 rounded-2xl p-4 space-y-2'>
                                                <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>Detalle del pedido</p>
                                                <div className='flex justify-between text-sm text-gray-600'><span>Subtotal</span><span className='font-bold text-gray-900'>${base.toLocaleString('es-CL')}</span></div>
                                                <div className='flex justify-between text-sm text-gray-600'><span>Cargo por servicio</span><span className='font-bold text-gray-900'>${servicio.toLocaleString('es-CL')}</span></div>
                                                <div className='border-t border-gray-200 pt-2 flex justify-between items-center'><span className='text-sm font-black text-gray-900'>Total</span><span className='text-xl font-black text-blue-600'>${total.toLocaleString('es-CL')}</span></div>
                                            </div>
                                        );
                                    })()}
                                    <button type='button' onClick={() => reservar(true)} disabled={busy}
                                        className='w-full text-xs font-black py-4 rounded-2xl bg-black hover:bg-zinc-800 text-white uppercase tracking-widest active:scale-[0.98] disabled:opacity-50'>
                                        {busy ? 'Procesando...' : 'Continuar pago'}
                                    </button>
                                    <button type='button' onClick={() => setConfirmPay(false)}
                                        className='w-full text-[11px] font-bold text-gray-400 hover:text-gray-700 uppercase tracking-widest'>
                                        Volver
                                    </button>
                                </>
                            ) : (
                                <>
                                    {agotadoSel ? (
                                        <button type='button' disabled
                                            className='w-full text-xs font-black py-4 rounded-2xl bg-gray-300 text-gray-500 uppercase tracking-widest cursor-not-allowed'>
                                            Agotado
                                        </button>
                                    ) : puedeReservar && (
                                        <div className='flex gap-2'>
                                            <button type='button' onClick={() => reservar(false)} disabled={busy}
                                                className='flex-1 text-xs font-black py-4 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-800 uppercase tracking-widest active:scale-[0.98] disabled:opacity-50'>
                                                Reservar
                                            </button>
                                            <button type='button' onClick={() => setConfirmPay(true)} disabled={busy}
                                                className='flex-1 text-xs font-black py-4 rounded-2xl bg-black hover:bg-zinc-800 text-white uppercase tracking-widest active:scale-[0.98] disabled:opacity-50'>
                                                Pagar al tiro
                                            </button>
                                        </div>
                                    )}
                                    <button type='button' onClick={() => { setStep('detalle'); setSelFecha(null); setSelFranja(null); }}
                                        className='w-full text-[11px] font-bold text-gray-400 hover:text-gray-700 uppercase tracking-widest flex items-center justify-center gap-1'>
                                        <ArrowLeft className='w-3 h-3' /> Volver al detalle
                                    </button>
                                </>
                            )}
                        </>
                    )}

                    {msg?.ok && (
                        <button type='button' onClick={onClose}
                            className='w-full text-xs font-black py-4 rounded-2xl bg-emerald-500 text-white uppercase tracking-widest active:scale-[0.98]'>
                            Listo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ActivityDetailModal;
