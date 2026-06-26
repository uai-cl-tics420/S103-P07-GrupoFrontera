import React, { useEffect, useState } from 'react';
import { Trash2, TrendingUp, Star, CheckCircle2, XCircle, RefreshCw, MapPin, Pencil } from 'lucide-react';
import { Category } from '@/types';
import { useT } from '@/i18n/context';
import { CreatePanoramaForm } from './CreatePanoramaForm';

interface AdminActivity {
    id: string;
    name: string;
    category: string;
    imageUrl: string | null;
    price: number | null;
    address: string | null;
    isTendencia: boolean;
    isPopular: boolean;
    disponible: boolean;
    disponibleReal?: boolean;
    motivoNoDisponible?: 'manual' | 'vencido' | 'agotado' | null;
}

type CategoryKey = 'categoryAll' | 'categoryCine' | 'categoryParque' | 'categoryTeatro' | 'categoryMuseo' | 'categoryRestaurante' | 'categoryMiradores';

const CATEGORY_KEY_BY_VALUE: Record<string, CategoryKey> = {
    [Category.CINE]: 'categoryCine',
    [Category.PARQUE]: 'categoryParque',
    [Category.TEATRO]: 'categoryTeatro',
    [Category.MUSEO]: 'categoryMuseo',
    [Category.RESTAURANTE]: 'categoryRestaurante',
    [Category.MIRADORES]: 'categoryMiradores',
};

const FILTROS = ['Todas', ...Object.values(Category)];

export function ManagePanoramasView() {
    const { LL } = useT();
    const [items, setItems] = useState<AdminActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('Todas');
    const [error, setError] = useState<string | null>(null);
    const [regeoBusy, setRegeoBusy] = useState(false);
    const [regeoMsg, setRegeoMsg] = useState<string | null>(null);
    const [editingActivity, setEditingActivity] = useState<AdminActivity | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/activities', { credentials: 'include' });
            if (!res.ok) throw new Error(LL.adminManageLoadError());
            setItems(await res.json());
        } catch (e: any) {
            setError(e?.message || LL.adminManageLoadErrorGeneric());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const patchFlag = async (id: string, updates: Partial<AdminActivity>) => {
        setItems((prev) => prev.map((it) => {
            if (it.id !== id) return it;
            const next = { ...it, ...updates };
            // Si se toca el flag manual, reflejamos de inmediato el estado real esperado:
            // apagarlo manualmente siempre gana (real=false, motivo=manual); encenderlo manualmente
            // solo se confirma como "disponible" si no esta vencido/agotado (eso lo corrige el load() real abajo).
            if ('disponible' in updates) {
                next.disponibleReal = updates.disponible ? (it.motivoNoDisponible == null || it.motivoNoDisponible === 'manual') : false;
                next.motivoNoDisponible = updates.disponible ? (next.disponibleReal ? null : it.motivoNoDisponible) : 'manual';
            }
            return next;
        }));
        try {
            await fetch(`/api/admin/activities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates),
            });
            // Refrescamos desde el servidor para que disponibleReal/motivo queden exactos
            // (el optimista de arriba es solo para que el click se sienta instantaneo).
            if ('disponible' in updates) load();
        } catch {
            load();
        }
    };

    const remove = async (id: string, name: string) => {
        if (!window.confirm(LL.adminManageDeleteConfirm({ name }))) return;
        setItems((prev) => prev.filter((it) => it.id !== id));
        try {
            await fetch(`/api/admin/activities/${id}`, { method: 'DELETE', credentials: 'include' });
        } catch {
            load();
        }
    };

    const regeocode = async () => {
        setRegeoBusy(true); setRegeoMsg(null);
        try {
            const res = await fetch('/api/admin/activities/regeocode', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || LL.errorPrefix());
            setRegeoMsg(LL.adminManageRegeoSuccess({ n: data.actualizados ?? 0 }));
            await load();
        } catch (e: any) {
            setRegeoMsg(e?.message || LL.adminManageRegeoError());
        } finally {
            setRegeoBusy(false);
        }
    };

    const filtered = filter === 'Todas' ? items : items.filter((it) => it.category === filter);

    if (editingActivity) {
        return (
            <div className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter">Editar Panorama</h3>
                </div>
                <CreatePanoramaForm
                    activityToEdit={editingActivity}
                    onSuccess={() => {
                        setEditingActivity(null);
                        load();
                    }}
                    onCancel={() => setEditingActivity(null)}
                />
            </div>
        );
    }

    const chip = (active: boolean) =>
        `text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl transition ${active ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`;

    const filtroLabel = (f: string) => {
        const key = CATEGORY_KEY_BY_VALUE[f];
        return f === 'Todas' ? LL.categoryAll() : (key ? LL[key]() : f);
    };
    const categoryLabel = (cat: string) => {
        const key = CATEGORY_KEY_BY_VALUE[cat];
        return key ? LL[key]() : cat;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-wrap gap-2">
                    {FILTROS.map((f) => (
                        <button key={f} type="button" onClick={() => { setFilter(f); load(); }} className={chip(filter === f)}>
                            {filtroLabel(f)}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={regeocode} disabled={regeoBusy} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-black transition disabled:opacity-50">
                        <MapPin className="w-3.5 h-3.5" /> {regeoBusy ? LL.adminManageGeocodingCta() : LL.adminManageRegeocodeCta()}
                    </button>
                    <button type="button" onClick={load} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-black transition">
                        <RefreshCw className="w-3.5 h-3.5" /> {LL.adminManageReloadCta()}
                    </button>
                </div>
            </div>

            {regeoMsg && <p className="text-xs font-bold text-emerald-600">{regeoMsg}</p>}
            {loading && <p className="text-sm text-gray-400">{LL.loadingPanoramas()}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {!loading && !error && filtered.length === 0 && (
                <p className="text-sm text-gray-400">{LL.adminManageEmptyCategory()}</p>
            )}

            <div className="space-y-3">
                {filtered.map((it) => (
                    <div key={it.id} className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Thumb */}
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                            {it.imageUrl ? (
                                <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-2xl">🖼️</span>
                            )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">{categoryLabel(it.category)}</span>
                            <h4 className="text-sm font-black text-gray-900 truncate">{it.name}</h4>
                            <p className="text-xs text-gray-500">
                                {it.price == null ? LL.adminManageNoPrice() : it.price === 0 ? LL.free() : `$${it.price.toLocaleString('es-CL')}`}
                            </p>
                        </div>

                        {/* Acciones */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => patchFlag(it.id, { isTendencia: !it.isTendencia })}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition ${it.isTendencia ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                title={LL.badgeTendencia()}
                            >
                                <TrendingUp className="w-3.5 h-3.5" /> {LL.badgeTendencia()}
                            </button>
                            <button
                                type="button"
                                onClick={() => patchFlag(it.id, { isPopular: !it.isPopular })}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition ${it.isPopular ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                title={LL.badgePopular()}
                            >
                                <Star className="w-3.5 h-3.5" /> {LL.badgePopular()}
                            </button>
                            {/* El boton refleja el estado REAL (flag manual + vencido/agotado), no solo el flag.
                                Asi nunca se ve "Disponible" en verde si en realidad ya no se puede reservar.
                                El click sigue controlando el flag manual de la BD (para forzar encendido/apagado). */}
                            {(() => {
                                const real = it.disponibleReal ?? it.disponible;
                                const motivo = it.motivoNoDisponible;
                                const label = real
                                    ? LL.adminManageAvailableLabel()
                                    : motivo === 'vencido' ? LL.adminManageExpiredLabel()
                                    : motivo === 'agotado' ? LL.adminManageSoldOutLabel()
                                    : LL.adminManageUnavailableLabel();
                                return (
                                    <button
                                        type="button"
                                        onClick={() => patchFlag(it.id, { disponible: !it.disponible })}
                                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition ${real ? 'bg-emerald-100 text-emerald-700' : motivo && motivo !== 'manual' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}
                                        title={LL.adminManageAvailabilityTitle()}
                                    >
                                        {real ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                        {label}
                                    </button>
                                );
                            })()}
                            <button
                                type="button"
                                onClick={() => setEditingActivity(it)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:bg-zinc-200 transition"
                                title="Editar"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(it.id, it.name)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                                title={LL.adminManageDeleteTitle()}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ManagePanoramasView;
