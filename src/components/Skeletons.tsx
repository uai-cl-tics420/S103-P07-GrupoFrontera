import React from 'react';

//Skeleton para el widget del clima
export function WeatherSkeleton() {
    return (
        <div className='flex items-center gap-2 bg-zinc-100/80 border border-zinc-200/60 px-4 py-2 rounded-full w-36 h-8 animate-pulse select-none'>
            <div className='w-4 h-4 bg-zinc-200 rounded-full'></div>
            <div className='h-3 bg-zinc-200 rounded w-12'></div>
            <div className='h-3 bg-zinc-200 rounded w-6'></div>
        </div>
    );
}

//Skeleton para las tarjetas de la grilla principal
export function ActivityCardSkeleton() {
    return (
        <div className="w-full bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[640px] animate-pulse">
            <div className="relative h-[400px] bg-zinc-50 flex items-center justify-center border-b border-gray-50 p-6">
                <div className="absolute top-6 left-6 w-12 h-12 bg-zinc-200/60 rounded-full"></div>
                <div className="absolute top-6 right-6 w-32 h-10 bg-zinc-200/60 rounded-full"></div>
                <div className="w-20 h-24 bg-zinc-200/80 rounded-2xl"></div>
            </div>

            <div className="p-8 flex flex-col flex-grow justify-between text-left">
                <div className="space-y-3">
                    <div className="w-16 h-3 bg-zinc-200 rounded-md tracking-widest"></div>
                    <div className="space-y-2">
                        <div className="w-11/12 h-8 bg-zinc-200 rounded-xl"></div>
                        <div className="w-6/12 h-8 bg-zinc-100 rounded-xl"></div>
                    </div>
                </div>

                <div className="pt-6">
                    <div className="w-full h-16 bg-zinc-200 rounded-3xl"></div>
                </div>
            </div>
        </div>
     );
}


//Skeleton para el bloque de recomendaciones especiales
export function RecommendationSkeleton() {
    return (
        <div className='w-full bg-zinc-50 border border-zinc-100 rounded-[32px] p-6 mb-8 animate-pulse flex flex-col gap-3'>
            <div className='w-48 h-4 bg-zinc-200 rounded-full mb-1'></div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='h-16 bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3'>
                    <div className='w-8 h-8 bg-zinc-100 rounded-xl'></div>
                    <div className='space-y-2 flex-1'>
                        <div className='w-1/2 h-3 bg-zinc-200 rounded-md'></div>
                        <div className='w-1/3 h-2 bg-zinc-100 rounded-md'></div>
                    </div>
                </div>
                <div className='hidden md:flex h-16 bg-white border border-gray-100 rounded-2xl p-4 items-center gap-3'>
                    <div className='w-8 h-8 bg-zinc-100 rounded-xl'></div>
                    <div className='space-y-2 flex-1'>
                        <div className='w-1/2 h-3 bg-zinc-200 rounded-md'></div>
                        <div className='w-1/3 h-2 bg-zinc-100 rounded-md'></div>
                    </div>
                </div>
            </div>
        </div>
    );
}