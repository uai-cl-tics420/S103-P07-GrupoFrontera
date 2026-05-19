import { type Activity } from '../types/index';
import { useT } from "@/i18n/context";

const ActivityCard = ({ activity }: { activity: any }) => {
  const { t } = useT();
  if (!activity) return null;

  // Mapeo de categoría (string) a clave de traducción
  const categoryKeyMap: Record<string, "categoryCine" | "categoryParque" | "categoryTeatro" | "categoryMuseo" | "categoryRestaurante"> = {
    'Cine': 'categoryCine',
    'Parque': 'categoryParque',
    'Teatro': 'categoryTeatro',
    'Museo': 'categoryMuseo',
    'Restaurante': 'categoryRestaurante',
  };
  const categoryKey = categoryKeyMap[activity.category];
  const categoryLabel = categoryKey ? t(categoryKey) : activity.category;

  return (
    <div className="w-full bg-white rounded-[28px] sm:rounded-[32px] overflow-hidden border border-gray-100 shadow-sm mb-2 hover:shadow-xl transition-all duration-300 font-sans">
      <div className="aspect-square w-full bg-gray-50 flex items-center justify-center relative border-b border-gray-50">
        <span className="text-5xl sm:text-6xl animate-bounce-short">
          {activity.category === 'Cine' ? '🍿' :
           activity.category === 'Parque' ? '🌳' :
           activity.category === 'Teatro' ? '🎭' : '🖼️'}
        </span>
        <div className="absolute top-3 right-3 sm:top-5 sm:right-5 bg-white/90 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 border border-gray-100 shadow-sm">
           {activity.tagClima === 'Sunny' ? t('weatherSunny') : t('weatherAll')}
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="mb-5 sm:mb-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500 block mb-2">
            {categoryLabel}
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tighter leading-tight break-words">
            {activity.name}
          </h3>
        </div>

        <button className="w-full bg-black text-white text-xs font-black py-4 rounded-2xl hover:bg-zinc-800 active:scale-[0.95] transition-all duration-200 shadow-lg shadow-black/10 uppercase tracking-widest">
          {t('seeDetails')}
        </button>
      </div>
    </div>
  );
};

export default ActivityCard;
