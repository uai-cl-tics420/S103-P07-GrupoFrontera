import React, { useEffect } from 'react';
import { X, Tag, CloudSun, Clock, MapPin } from 'lucide-react';
import { useT } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';

interface DetailsModalProps {
    activity: {
        id: string;
        name: string;
        category: string;
        tagClima?: string;
        openingHour?: string;
        closingHour?: string;
        coordinates?: { lat: number; lng: number };
    } | null;
    open: boolean;
    onClose: () => void;
    onReserve?: () => void;
}

const categoryKeyMap: Record<string, TranslationKey> = {
    'Cine': 'categoryCine',
    'Parque': 'categoryParque',
    'Teatro': 'categoryTeatro',
    'Museo': 'categoryMuseo',
    'Restaurante': 'categoryRestaurante',
    'Miradores': 'categoryMiradores',
};

export function DetailsModal({ activity, open, onClose, onReserve }: DetailsModalProps) {
    const { t } = useT();

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open || !activity) return null;

    const categoryLabel = categoryKeyMap[activity.category]
        ? t(categoryKeyMap[activity.category])
        : activity.category;
    const weatherLabel = activity.tagClima === 'Sunny'
        ? t('weatherSunny')
        : t('weatherAll');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-8"
            onClick={onClose}
        >
            <div
                className="max-w-md w-full bg-white rounded-[28px] sm:rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 sm:px-8 pt-6 pb-2">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900">
                        {t('detailsModalTitle')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-900 transition-colors"
                        aria-label={t('reservationClose')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 sm:px-8 py-4 border-b border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500 mb-1">
                        {categoryLabel}
                    </p>
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter leading-tight break-words">
                        {activity.name}
                    </h3>
                </div>

                <div className="px-6 sm:px-8 py-5 flex flex-col gap-3">
                    <Row icon={Tag} label={t('detailsCategoryLabel')} value={categoryLabel} />
                    <Row icon={CloudSun} label={t('detailsWeatherLabel')} value={weatherLabel} />
                    {activity.openingHour && activity.closingHour && (
                        <Row icon={Clock} label={t('detailsHoursLabel')} value={`${activity.openingHour} - ${activity.closingHour}`} />
                    )}
                    {activity.coordinates && (
                        <Row
                            icon={MapPin}
                            label={t('detailsCoordsLabel')}
                            value={`${activity.coordinates.lat.toFixed(4)}, ${activity.coordinates.lng.toFixed(4)}`}
                        />
                    )}
                </div>

                <div className="px-6 sm:px-8 pb-6 pt-2 flex flex-col sm:flex-row-reverse gap-3">
                    {onReserve && (
                        <button
                            type="button"
                            onClick={() => { onClose(); onReserve(); }}
                            className="flex-1 bg-black text-white text-sm font-black py-3 sm:py-4 rounded-2xl hover:bg-zinc-800 active:scale-[0.98] transition-all uppercase tracking-widest shadow-lg shadow-black/10"
                        >
                            {t('reserveOnlyCta')}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 sm:flex-initial bg-gray-100 text-gray-600 text-xs font-bold py-3 sm:py-4 px-4 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest"
                    >
                        {t('reservationClose')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-gray-900 break-words">{value}</p>
            </div>
        </div>
    );
}

export default DetailsModal;
