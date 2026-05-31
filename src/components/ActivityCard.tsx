import React from 'react';
import { type Activity } from '../types/index';
import { useT } from "@/i18n/context";
import { Heart, Calendar, Clock, MapPin } from "lucide-react";

interface ActivityCardProps {
  activity: Activity;
  isFavorite?: boolean;
  isReserved?: boolean;
  onToggleFavorite?: (id: string) => void;
  onReserve?: (id: string) => void;
}

const ActivityCard = ({ activity, isFavorite = false, isReserved = false, onToggleFavorite, onReserve }: ActivityCardProps) => {
  const { t } = useT();
  if (!activity) return null;

  // Mapeo de categoría (string) a clave de traducción
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

  return (
    <div className="group w-full bg-white rounded-[28px] sm:rounded-[32px] overflow-hidden border border-gray-100/80 shadow-sm mb-2 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 ease-in-out font-sans flex flex-col h-full">
      <div className="aspect-square w-full bg-gradient-to-br from-gray-50 to-zinc-100 flex items-center justify-center relative border-b border-gray-50 overflow-hidden">
        <span className="text-5xl sm:text-6xl select-none transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 ease-out">
          {activity.category === 'Cine' ? '🍿' :
           activity.category === 'Parque' ? '🌳' :
           activity.category === 'Teatro' ? '🎭' :
           activity.category === 'Miradores' ? '🏔️' : '🖼️'}
        </span>
        <div className="absolute top-3 right-3 sm:top-5 sm:right-5 flex flex-col gap-2 items-end z-10">
          <div className="bg-white/80 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 border border-white/40 shadow-sm transition-all duration-200 group-hover:bg-white">
             {activity.tagClima === 'Sunny' ? t('weatherSunny') : t('weatherAll')}
          </div>
          {activity.openingHour && activity.closingHour && (
            <div className="bg-white/80 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 border border-white/40 shadow-sm transition-all duration-200 group-hover:bg-white flex items-center gap-1">
              <span>🕒</span> {activity.openingHour} - {activity.closingHour}
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
      </div>

      <div className="p-6 sm:p-8 flex flex-col flex-grow">
        <div className="mb-5 sm:mb-6 flex-grow">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500 block mb-2 transform group-hover:translate-x-1 transition-transform duration-200">
            {categoryLabel}
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tighter leading-tight break-words group-hover:text-zinc-700 transition-colors duration-200">
            {activity.name}
          </h3>
        </div>

        <button 
          onClick={() => onReserve?.(activity.id)}
          className={`w-full text-xs font-black py-4 rounded-2xl transition-all duration-200 shadow-lg uppercase tracking-widest relative overflow-hidden active:scale-[0.97]
            ${isReserved
              ? 'bg-emerald-500 text-white shadow-emerald-500/10 cursor-default'
              : 'bg-black hover:bg-zinc-800 text-white shadow-black/10 hover:shadow-black/20 group-hover:-translate-y-0.5'
            }`}>
          {isReserved ? (
            <span className="font-black tracking-widest">✅ {t('seeDetails') ? 'RESERVADO' : 'RESERVADO'}</span>
          ) : (
            t('seeDetails')
          )}
        </button>
      </div>
    </div>
  );
};

export default ActivityCard;
