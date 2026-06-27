import React from 'react';
import { type Activity } from '../types/index';
import { useT } from "@/i18n/context";
import { Heart, Eye, CheckCircle2, Clock, Calendar, MapPin } from "lucide-react";

export type ReservationStatus = 'pendiente' | 'pagado' | 'comprado' | 'cancelado';


interface ActivityCardProps {
  activity: Activity & {
    isPopular?: boolean;
    isTendencia?: boolean;
  };
  isFavorite?: boolean;
  /** Reserva activa de esta actividad (no cancelada), si existe. */
  reservation?: { id: string; status: ReservationStatus } | null;
  onToggleFavorite?: (id: string) => void;
  onSeeDetails?: (activity: Activity) => void;
  /** Coordenadas del usuario, para calcular distancia. */
  userCoords?: { lat: number; lng: number };
  /** Marca si esta actividad esta dentro de las recomendadas. */
  isRecommended?: boolean;
  /** Posicion en el ranking (1 = mejor recomendada). */
  rank?: number;
}

// Función matemática de Haversine para calcular distancia real en KM (Track 1 - Daniel)

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// "2026-06-29" -> "29/06", para que quepa compacto en la tarjeta
function formatFechaCorta(fecha: string): string {
    const [, m, d] = fecha.split('-');
    return d && m ? `${d}/${m}` : fecha;
}

const ActivityCard = ({ 
  activity, 
  isFavorite = false, 
  reservation = null, // El objeto de reserva detallado de Barros
  onToggleFavorite,
  onSeeDetails,       // Tu prop para levantar el modal premium
  userCoords,
  isRecommended = false,
  rank
}: ActivityCardProps) => {

  const { LL } = useT();

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
  const categoryLabel = categoryKey ? LL[categoryKey]() : activity.category;
  const hasValidCoords = !!activity.coordinates && (activity.coordinates.lat !== 0 || activity.coordinates.lng !== 0);
  // Distancia en linea recta (Haversine). Mostramos esta misma metrica con la que el backend
  // ordena la grilla por cercania, para que el orden visible coincida con los km de cada tarjeta.
  // La distancia por carretera (Routes API) se muestra en el detalle del panorama.
  const shownKm = userCoords && hasValidCoords ? getDistance(userCoords.lat, userCoords.lng, activity.coordinates.lat, activity.coordinates.lng) : null;

  return (
    <>
      <div className={`group w-full bg-white rounded-[28px] sm:rounded-[32px] overflow-hidden border border-gray-100/80 shadow-sm mb-2 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 ease-in-out font-sans flex flex-col h-full ${activity.disponible === false ? 'opacity-65 saturate-50' : ''}`}>
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-gray-50 to-zinc-100 flex items-center justify-center relative border-b border-gray-50 overflow-hidden">
          
          {/* Renderizado de imagen de Google Places o Emoji animado (Tu UI Premium) */}
          {activity.imageUrl ? (
            <img 
              src={activity.imageUrl} 
              alt={activity.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
            />
          ) : (
            <span className="text-5xl sm:text-6xl select-none transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 ease-out">
              {activity.category === 'Cine' ? '🍿' :
               activity.category === 'Parque' ? '🌳' :
               activity.category === 'Teatro' ? '🎭' :
               activity.category === 'Miradores' ? '🏔️' :
               activity.category === 'Restaurante' ? '🍽️' :
               activity.category === 'Museo' ? '🏛️' : '🖼️'}
            </span>
          )}

          <div className="absolute top-3 right-3 sm:top-5 sm:right-5 flex flex-col gap-2 items-end z-10">
            {activity.disponible === false && (
              <div className='bg-zinc-800 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 border border-zinc-700/20 animate-fade-in'>
                <span>🚫</span> {LL.soldOutLabel()}
              </div>
            )}

            {activity.isPopular && (
              <div className='bg-gradient-to-r from-pink-500 to-rose-400 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 border border-pink-400/20 animate-fade-in'>
                <span>⭐️</span> {LL.badgePopular()}
              </div>
            )}

            {activity.isTendencia && (
              <div className='bg-gradient-to-r from-orange-500 to-amber-400 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 border border-orange-400/20 animate-fade-in'>
                <span>📈</span> {LL.badgeTendencia()}
              </div>
            )}

            {activity.weatherCondition && activity.nearestDate && activity.weatherReliable !== false ? (() => {
              // Clima REAL pronosticado para la fecha de este panorama (no un chip generico).
              // Verde = coincide con lo que el panorama necesita (tagClima); gris = no coincide
              // o el panorama acepta cualquier clima ("All").
              const emoji = activity.weatherCondition === 'Clear' ? '☀️'
                : activity.weatherCondition === 'Clouds' ? '☁️'
                : activity.weatherCondition === 'Rain' || activity.weatherCondition === 'Drizzle' ? '🌧️'
                : activity.weatherCondition === 'Thunderstorm' ? '⛈️'
                : activity.weatherCondition === 'Snow' ? '❄️' : '🌤️';
              const coincide = activity.tagClima === 'All' || activity.weatherTag === 'Sunny';
              return (
                <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all duration-200 flex items-center gap-1 ${coincide ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white/80 backdrop-blur-md border-white/40 text-gray-500 group-hover:bg-white'}`}>
                  <span>{emoji}</span> {activity.weatherTemp?.toFixed(0)}°C · {formatFechaCorta(activity.nearestDate)}
                </div>
              );
            })() : (
              <div className="bg-white/80 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 border border-white/40 shadow-sm transition-all duration-200 group-hover:bg-white">
                {activity.tagClima === 'Sunny' ? LL.weatherSunny() : LL.weatherAll()}
              </div>
            )}
            {shownKm !== null && (
              <div className="bg-white/80 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 border border-white/40 shadow-sm flex items-center gap-1">
                <span>📍</span> {shownKm.toFixed(1)} km
              </div>
            )}
          </div>
          
          {onToggleFavorite && (
            <button 
              onClick={() => onToggleFavorite(activity.id)}
              className="absolute top-3 left-3 sm:top-5 sm:left-5 bg-white/80 backdrop-blur-md p-2.5 rounded-full border border-white/40 shadow-sm hover:scale-110 active:scale-90 text-gray-400 hover:text-red-500 hover:bg-white transition-all duration-200 z-10"
            >
              <Heart className={`w-5 h-5 transition-all duration-300 ${isFavorite ? 'fill-red-500 text-red-500 scale-105' : 'text-gray-400'}`} />
            </button>
          )}

          {isRecommended && rank && (
            <div className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 z-10 animate-fade-in">
              {rank === 1 ? (
                <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-amber-950 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center gap-1.5 border border-amber-300">
                  👑 {LL.rank1Label()}
                </span>
              ) : rank === 2 ? (
                <span className="bg-gradient-to-r from-slate-200 via-zinc-100 to-slate-300 text-slate-800 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5 border border-slate-300">
                  🥈 {LL.rank2Label()}
                </span>
              ) : rank === 3 ? (
                <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 text-white text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5 border border-amber-500">
                  🥉 {LL.rank3Label()}
                </span>
              ) : (
                <span className="bg-black/75 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                  ✨ {LL.recommendedLabel()}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 flex flex-col flex-grow">
          {/* 📥 Los Status Badges del sistema de reservas de Barros */}
          {reservation && (
            <div className="mb-4 flex flex-wrap gap-2">
              {isPending && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="w-3 h-3" />
                  {LL.cardStatusPending()}
                </span>
              )}
              {isPaid && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  {LL.cardStatusPaid()}
                </span>
              )}
            </div>
          )}

          <div className="mb-5 sm:mb-6 flex-grow">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500 block mb-2 transform group-hover:translate-x-1 transition-transform duration-200">
              {categoryLabel}
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tighter leading-tight break-words mb-4 group-hover:text-zinc-700 transition-colors duration-200">
              {activity.name}
            </h3>
            
            <div className="flex flex-col gap-2 mb-3 text-sm text-gray-600 font-medium">
              {activity.nearestDate ? (
                <>
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>{LL.nearestDateLabel({
                        fecha: formatFechaCorta(activity.nearestDate),
                        horarios: (activity.nearestFranjas?.length ?? 0) === 1 ? LL.slotsAvailableSingular() : LL.slotsAvailableMulti({ n: activity.nearestFranjas?.length ?? 0 }),
                    })}</span>
                  </div>
                  {activity.schedules && new Set(activity.schedules.map(s => s.fecha)).size > 1 && (
                    <p className="text-[10px] text-gray-400 -mt-1">{LL.moreDatesHint()}</p>
                  )}
                </>
              ) : activity.openingHour && activity.closingHour && (
                <div className="flex items-center gap-2">
                  <span>🕒</span> {LL.openHours({ open: activity.openingHour, close: activity.closingHour })}
                </div>
              )}

              {activity.occupancy && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${activity.occupancy === 'High' ? 'bg-red-500' : activity.occupancy === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                  <span>
                    {activity.nearestDate
                      ? LL.occupancyLabelWithDate({ fecha: formatFechaCorta(activity.nearestDate), level: activity.occupancy === 'High' ? LL.occupancyHigh() : activity.occupancy === 'Medium' ? LL.occupancyMedium() : LL.occupancyLow() })
                      : LL.occupancyLabel({ level: activity.occupancy === 'High' ? LL.occupancyHigh() : activity.occupancy === 'Medium' ? LL.occupancyMedium() : LL.occupancyLow() })}
                  </span>
                </div>
              )}
            </div>

            {activity.price != null && (
              <div className="mb-1">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{LL.priceLabel()}</span>
                <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter">
                  {activity.price === 0 ? LL.free() : `$${activity.price.toLocaleString('es-CL')}`}
                </div>
              </div>
            )}

          </div>

          {/* Accion unica: ver evento (la reserva ahora vive en el detalle) */}
          <div className="mt-auto">
            <button
              type="button"
              onClick={() => {
                onSeeDetails?.(activity);
              }}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 text-xs font-black py-3 rounded-2xl hover:bg-gray-200 active:scale-[0.95] transition-all uppercase tracking-widest"
            >
              <Eye className="w-3.5 h-3.5" />
              {LL.viewEventCta()}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ActivityCard;
