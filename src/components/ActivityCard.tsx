import { useState } from 'react';
import { type Activity } from '../types/index';
import { useT } from "@/i18n/context";
import { Heart, Eye, CheckCircle2, Clock } from "lucide-react";
import { ReservationModal } from "@/components/ReservationModal";
import { DetailsModal } from "@/components/DetailsModal";
import { PayModal } from "@/components/PayModal";

export type ReservationStatus = 'pendiente' | 'pagado' | 'comprado' | 'cancelado';

interface ActivityCardProps {
  activity: Activity;
  isFavorite?: boolean;
  /** Reserva activa de esta actividad (no cancelada), si existe. */
  reservation?: { id: string; status: ReservationStatus } | null;
  onToggleFavorite?: (id: string) => void;
  /** Callback que dispara el padre cuando se confirmo una reserva o un pago. */
  onReservationChanged?: () => void;
  /** Coordenadas del usuario, para calcular distancia. */
  userCoords?: { lat: number; lng: number };
  /** Marca si esta actividad esta dentro de las recomendadas. */
  isRecommended?: boolean;
  /** Posicion en el ranking (1 = mejor recomendada). */
  rank?: number;
}

// Distancia de Haversine en KM
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

const ActivityCard = ({
  activity,
  isFavorite = false,
  reservation = null,
  onToggleFavorite,
  onReservationChanged,
  userCoords,
  isRecommended = false,
  rank,
}: ActivityCardProps) => {
  const { t } = useT();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  if (!activity) return null;

  const isPending = reservation?.status === 'pendiente';
  const isPaid = reservation?.status === 'pagado' || reservation?.status === 'comprado';

  // Mapeo de categoria (string) a clave de traduccion
  const categoryKeyMap: Record<string, "categoryCine" | "categoryParque" | "categoryTeatro" | "categoryMuseo" | "categoryRestaurante" | "categoryMiradores"> = {
    'Cine': 'categoryCine',
    'Parque': 'categoryParque',
    'Teatro': 'categoryTeatro',
    'Museo': 'categoryMuseo',
    'Restaurante': 'categoryRestaurante',
    'Miradores': 'categoryMiradores',
  };
  const categoryKey = categoryKeyMap[activity.category];
  const categoryLabel = categoryKey ? t(categoryKey) : activity.category;
  const distance = userCoords ? getDistance(userCoords.lat, userCoords.lng, activity.coordinates.lat, activity.coordinates.lng) : null;

  return (
    <>
      <div className="w-full bg-white rounded-[28px] sm:rounded-[32px] overflow-hidden border border-gray-100 shadow-sm mb-2 hover:shadow-xl transition-all duration-300 font-sans">
        <div className="aspect-square w-full bg-gray-50 flex items-center justify-center relative border-b border-gray-50 overflow-hidden">
          {(activity as any).imageUrl ? (
            <img src={(activity as any).imageUrl} alt={activity.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          ) : (
            <span className="text-5xl sm:text-6xl animate-bounce-short">
              {activity.category === 'Cine' ? '🍿' :
               activity.category === 'Parque' ? '🌳' :
               activity.category === 'Teatro' ? '🎭' :
               activity.category === 'Miradores' ? '🏔️' :
               activity.category === 'Restaurante' ? '🍽️' :
               activity.category === 'Museo' ? '🏛️' : '🖼️'}
            </span>
          )}
          <div className="absolute top-3 right-3 sm:top-5 sm:right-5 flex flex-col gap-2 items-end">
            <div className="bg-white/90 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 border border-gray-100 shadow-sm">
              {activity.tagClima === 'Sunny' ? t('weatherSunny') : t('weatherAll')}
            </div>
            {activity.openingHour && activity.closingHour && (
              <div className="bg-white/90 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 border border-gray-100 shadow-sm">
                🕒 {activity.openingHour} - {activity.closingHour}
              </div>
            )}
          </div>
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(activity.id)}
              className="absolute top-3 left-3 sm:top-5 sm:left-5 bg-white/90 backdrop-blur-sm p-2 rounded-full border border-gray-100 shadow-sm hover:scale-110 transition-transform active:scale-95 z-10"
              aria-label="favorite"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500 animate-pulse' : 'text-gray-400'}`} />
            </button>
          )}
          {isRecommended && rank && (
            <div className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 z-10 animate-fade-in">
              {rank === 1 ? (
                <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-amber-950 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center gap-1.5 border border-amber-300">
                  👑 #1 Recomendado
                </span>
              ) : rank === 2 ? (
                <span className="bg-gradient-to-r from-slate-200 via-zinc-100 to-slate-300 text-slate-800 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5 border border-slate-300">
                  🥈 #2 Recomendado
                </span>
              ) : rank === 3 ? (
                <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 text-white text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5 border border-amber-500">
                  🥉 #3 Recomendado
                </span>
              ) : (
                <span className="bg-black/75 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                  ✨ Recomendado
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8">
          {/* Status badge si hay reserva activa */}
          {(isPending || isPaid) && (
            <div className="mb-4">
              {isPending && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700">
                  <Clock className="w-3 h-3" />
                  {t('cardStatusPending')}
                </span>
              )}
              {isPaid && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('cardStatusPaid')}
                </span>
              )}
            </div>
          )}

          <div className="mb-5 sm:mb-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500 block mb-2">
              {categoryLabel}
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tighter leading-tight break-words mb-4">
              {activity.name}
            </h3>

            <div className="flex flex-col gap-2 mb-4 text-sm text-gray-600 font-medium">
              {activity.openingHour && activity.closingHour && (
                <div className="flex items-center gap-2">
                  <span>🕒</span> Abierto: {activity.openingHour} - {activity.closingHour}
                </div>
              )}

              {distance !== null && (
                <div className="flex items-center gap-2">
                  <span>📍</span> A {distance.toFixed(1)} km de distancia
                </div>
              )}

              {(activity as any).occupancy && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${(activity as any).occupancy === 'High' ? 'bg-red-500' : (activity as any).occupancy === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                  <span>Afluencia: {(activity as any).occupancy === 'High' ? 'Alta' : (activity as any).occupancy === 'Medium' ? 'Media' : 'Baja'}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${activity.coordinates.lat},${activity.coordinates.lng}`, '_blank')}
              className="w-full bg-gray-100 text-gray-700 text-[10px] font-bold py-2 rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-widest mb-2"
            >
              Ver en Google Maps 🗺️
            </button>
          </div>

          {/* Acciones segun estado */}
          <div className="flex gap-2">
            {/* Ver evento siempre */}
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 text-xs font-black py-3 rounded-2xl hover:bg-gray-200 active:scale-[0.95] transition-all uppercase tracking-widest"
            >
              <Eye className="w-3.5 h-3.5" />
              {t('viewEventCta')}
            </button>

            {/* Reservar (si no hay activa) o Pagar (si pendiente) */}
            {!isPaid && !isPending && (
              <button
                type="button"
                onClick={() => setReserveOpen(true)}
                className="flex-1 bg-black text-white text-xs font-black py-3 rounded-2xl hover:bg-zinc-800 active:scale-[0.95] transition-all uppercase tracking-widest shadow-lg shadow-black/10"
              >
                {t('reserveOnlyCta')}
              </button>
            )}
            {isPending && (
              <button
                type="button"
                onClick={() => setPayOpen(true)}
                className="flex-1 bg-emerald-600 text-white text-xs font-black py-3 rounded-2xl hover:bg-emerald-700 active:scale-[0.95] transition-all uppercase tracking-widest shadow-lg shadow-emerald-600/10"
              >
                {t('payButton')}
              </button>
            )}
          </div>
        </div>
      </div>

      <DetailsModal
        activity={{
          id: activity.id,
          name: activity.name,
          category: activity.category,
          tagClima: activity.tagClima,
          openingHour: (activity as any).openingHour,
          closingHour: (activity as any).closingHour,
          coordinates: (activity as any).coordinates,
        }}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onReserve={!isPaid && !isPending ? () => setReserveOpen(true) : undefined}
      />

      <ReservationModal
        activity={{
          id: activity.id,
          name: activity.name,
          category: activity.category,
          tagClima: activity.tagClima,
        }}
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        onSuccess={() => onReservationChanged?.()}
      />

      {reservation && (
        <PayModal
          reservationId={reservation.id}
          activityName={activity.name}
          open={payOpen}
          onClose={() => setPayOpen(false)}
          onSuccess={() => onReservationChanged?.()}
        />
      )}
    </>
  );
};

export default ActivityCard;
