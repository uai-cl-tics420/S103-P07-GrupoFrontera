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
}

const ActivityCard = ({
  activity,
  isFavorite = false,
  reservation = null,
  onToggleFavorite,
  onReservationChanged,
}: ActivityCardProps) => {
  const { t } = useT();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  if (!activity) return null;

  const isPending = reservation?.status === 'pendiente';
  const isPaid = reservation?.status === 'pagado' || reservation?.status === 'comprado';

  return (
    <>
      <div className="w-full bg-white rounded-[28px] sm:rounded-[32px] overflow-hidden border border-gray-100 shadow-sm mb-2 hover:shadow-xl transition-all duration-300 font-sans">
        <div className="aspect-square w-full bg-gray-50 flex items-center justify-center relative border-b border-gray-50">
          <span className="text-5xl sm:text-6xl animate-bounce-short">
            {activity.category === 'Cine' ? '🍿' :
             activity.category === 'Parque' ? '🌳' :
             activity.category === 'Teatro' ? '🎭' :
             activity.category === 'Miradores' ? '🏔️' : '🖼️'}
          </span>
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
              className="absolute top-3 left-3 sm:top-5 sm:left-5 bg-white/90 backdrop-blur-sm p-2 rounded-full border border-gray-100 shadow-sm hover:scale-110 transition-transform active:scale-95"
              aria-label="favorite"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500 animate-pulse' : 'text-gray-400'}`} />
            </button>
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
              {activity.category}
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tighter leading-tight break-words">
              {activity.name}
            </h3>
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
            {/* Si esta pagado, no hay segundo boton -> 'Ver evento' queda full width visual */}
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
