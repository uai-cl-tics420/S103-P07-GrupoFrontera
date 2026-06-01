import React, {useState, useEffect } from 'react';
import { type Activity } from '../types/index.ts';
import { X, MapPin, Clock, CloudSun, Navigation, Calendar } from 'lucide-react';

interface ActivityDetailModalProps {
    activity: Activity | null;
    onClose: () => void;
    isReserved?: boolean;
    onReserve?: (id: string) => void;
}

export function ActivityDetailModal({ activity, onClose, isReserved = false, onReserve }: ActivityDetailModalProps) {
    const [hasBeenReserved, setHasBeenReserved] = useState(isReserved);

    useEffect(() => {
        setHasBeenReserved(isReserved);
    }, [isReserved, activity]);

    if (!activity) return null;

    return (
        <div className='fixed inset-0 z-50 flex items-center, justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in'>
            <div className='bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] animate-slide-up'>

                <div className='relative h-48 bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center border-b border-gray-100'>
                    <span className='text-7xl select-none animate-bounce-short'>
                        {activity.category === 'Cine' ? '🍿' :
                        activity.category === 'Parque' ? '🌳' :
                        activity.category === 'Teatro' ? '🎭' :
                        activity.category === 'Miradores' ? '🏔️' : '🖼️'}
                    </span>

                    <button
                        onClick={onClose}
                        className='absolute top-4 right-4 bg-black/5 hover:bg-black/10 text-gray-700 p-2 rounded-full transition-colors active:scale-90'
                    >
                        <X className='w-5 h-5' />
                    </button>
                </div>

                <div className='p-6 sm:p-8 overflow-y-auto space-y-6 flex-grow'>
                    <div>
                        <span className='text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500 block mb-1'>
                            {activity.category}
                        </span>
                        <h2 className='text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter leading-tight'>
                            {activity.name}
                        </h2>
                    </div>

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
                                    <span className='text-[9px] font-bold text-gray-400 uppercase tracking-wider'>Horario de Atención</span>
                                    <span className='text-xs font-black text-gray-700'>{activity.openingHour} - {activity.closingHour}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Espacio reservado para la distancia/ubicación */}
                    <div className='space-y-2'>
                        <h4 className='text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1'>
                            <Navigation className='w-3.5 h-3.5 text-zinc-500' /> Ubicación y Distancia
                        </h4>
                        <div className='bg-blue-50/40 border border-blue-100/60 p-4 rounded-2xl flex justify-between items-center'>
                            <span className='text-xs text-blue-900 font-medium'>Distancia desde tu ubicación:</span>
                            {/* Mock para reemplazar después con Places API :D */}
                            <span className='text-xs font-black bg-blue-500 text-white px-2.5 py-1 rounded-full animate-pulse'>
                                📍 1.5 km aprox.
                            </span>
                        </div>
                    </div>

                    {/* Espacio reservado para el mapa de Google */}
                    <div className='space-y-2'>
                        <h4 className='text-xs, font-black uppercase tracking-widest text-gray-400 flex items-center gap-1'>
                            <MapPin className='w-3.5 h-3.5 text-zinc-500' /> Mapa del Lugar
                        </h4>
                        {/* Contenedor del Mapa Placeholder */}
                        <div className='w-full h-40 bg-zinc-100 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-center p-4 select-none group'>
                            <span className='text-2xl group-hover:animate-bounce mb-1'>🗺️</span>
                            <p className='text-[11px] font-bold text-zinc-400 uppercase tracking-wider'>Google Maps API</p>
                            <p className='text-[9px] text-zinc-400 max-w-xs mt-0.5'>El mapa interactivo se renderizará acá</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-zinc-50 border-t border-gray-100 mt-auto">
                    <button 
                        onClick={(e) => {
                            e.preventDefault();  
                            e.stopPropagation(); 
      
                            setHasBeenReserved(true); 
                            onReserve?.(activity.id); 
                        }}
                        disabled={hasBeenReserved}
                        className={`w-full text-xs font-black py-4 rounded-2xl transition-all duration-300 shadow-lg uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98]
                            ${hasBeenReserved 
                                ? 'bg-emerald-500 text-white shadow-emerald-500/20 cursor-default scale-[1.01]' 
                                : 'bg-black hover:bg-zinc-800 text-white shadow-black/10'
                            }`}
                    >
                        <Calendar className="w-4 h-4" />
                        {hasBeenReserved ? '¡Reserva Completada!' : 'Confirmar Reserva'}
                    </button>
                </div>

            </div>
        </div>
    );
}