import React, { useState, useRef, useMemo } from 'react';
import { Plus, Trash2, MapPin, Image as ImageIcon, Clock, Ticket, Users, Info } from 'lucide-react';
import { Category } from '@/types';
import { useT } from '@/i18n/context';
import { useToast } from '@/context/ToastContext';


/**
 * Formulario de creación de panoramas (segunda pestaña del panel admin).
 *
 * NOTA: por ahora es solo UI. El botón "Crear panorama" todavía NO llama al backend;
 * arma el objeto y lo muestra en pantalla para validar el flujo de ingreso de datos.
 * El backend (POST /api/admin/activities), la geocodificación de la dirección y la
 * migración de base de datos vienen en la siguiente etapa.
 */

interface Franja {
    horaInicio: string;  // "HH:MM"
    horaFin: string;     // "HH:MM"
}
interface DiaHorario {
    fecha: string;       // "YYYY-MM-DD"
    franjas: Franja[];   // una misma fecha puede tener varios horarios
}

const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";
const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-black focus:border-black transition";

interface CreatePanoramaFormProps {
    activityToEdit?: any;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function CreatePanoramaForm({ activityToEdit, onSuccess, onCancel }: CreatePanoramaFormProps = {}) {
    const { LL } = useT();
    // Mismo mapeo que ActivityCard: traduce el valor fijo del enum (almacenado en BD) a la
    // etiqueta visible en el idioma activo, sin alterar el value que se guarda.
    const categoryLabel = (c: Category): string => {
        switch (c) {
            case Category.CINE: return LL.categoryCine();
            case Category.TEATRO: return LL.categoryTeatro();
            case Category.PARQUE: return LL.categoryParque();
            case Category.MUSEO: return LL.categoryMuseo();
            case Category.RESTAURANTE: return LL.categoryRestaurante();
            case Category.MIRADORES: return LL.categoryMiradores();
            default: return c;
        }
    };
    // Fecha de hoy (YYYY-MM-DD) en zona local, para impedir agendar panoramas en fechas pasadas
    const todayStr = useMemo(() => {
        const d = new Date();
        const off = d.getTimezoneOffset();
        return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
    }, []);
    const [imageUrl, setImageUrl] = useState(activityToEdit?.imageUrl || '');
    const [nombre, setNombre] = useState(activityToEdit?.name || '');
    const [descripcion, setDescripcion] = useState(activityToEdit?.description || '');
    const [categoria, setCategoria] = useState<Category>((activityToEdit?.category as Category) || Category.CINE);
    const [direccion, setDireccion] = useState(activityToEdit?.address || '');
    const [tagClima, setTagClima] = useState<'All' | 'Sunny'>(activityToEdit?.tag_clima || 'All');
    const [precio, setPrecio] = useState<string>(activityToEdit?.price != null ? String(activityToEdit.price) : '');
    const [cuposPorDia, setCuposPorDia] = useState<string>(activityToEdit?.cupos_por_dia != null ? String(activityToEdit.cupos_por_dia) : (activityToEdit?.cuposPorDia != null ? String(activityToEdit.cuposPorDia) : ''));
    const [limitePorPersona, setLimitePorPersona] = useState<string>(activityToEdit?.limite_por_persona != null ? String(activityToEdit.limite_por_persona) : (activityToEdit?.limitePorPersona != null ? String(activityToEdit.limitePorPersona) : ''));
    const [dias, setDias] = useState<DiaHorario[]>([
        { fecha: '', franjas: [{ horaInicio: '', horaFin: '' }] },
    ]);
    const [preview, setPreview] = useState<any>(null);
    const [imgError, setImgError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const { showToast } = useToast();
    const [placeId, setPlaceId] = useState<string | null>(activityToEdit?.placeId || null);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [suggestions, setSuggestions] = useState<{ placeId: string; description: string }[]>([]);
    const [showSug, setShowSug] = useState(false);
    const acTimer = useRef<any>(null);

    React.useEffect(() => {
        if (!activityToEdit) return;
        const fetchDetails = async () => {
            try {
                const res = await fetch(`/api/admin/activities/${activityToEdit.id}`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    setImageUrl(data.imageUrl || '');
                    setNombre(data.name || '');
                    setDescripcion(data.description || '');
                    setCategoria((data.category as Category) || Category.CINE);
                    setDireccion(data.address || '');
                    setTagClima(data.tag_clima || 'All');
                    setPrecio(data.price != null ? String(data.price) : '');
                    setCuposPorDia(data.cupos_por_dia != null ? String(data.cupos_por_dia) : '');
                    setLimitePorPersona(data.limite_por_persona != null ? String(data.limite_por_persona) : '');
                    setPlaceId(data.placeId || null);
                    if (data.schedules && data.schedules.length > 0) {
                        setDias(data.schedules);
                    }
                }
            } catch (err) {
                console.error("Error fetching activity schedules for edit:", err);
            }
        };
        fetchDetails();
    }, [activityToEdit]);

    const addDia = () =>
        setDias((d) => [...d, { fecha: '', franjas: [{ horaInicio: '', horaFin: '' }] }]);

    const removeDia = (di: number) =>
        setDias((d) => (d.length > 1 ? d.filter((_, i) => i !== di) : d));

    const updateFecha = (di: number, value: string) =>
        setDias((d) => d.map((row, i) => (i === di ? { ...row, fecha: value } : row)));

    const addFranja = (di: number) =>
        setDias((d) => d.map((row, i) =>
            i === di ? { ...row, franjas: [...row.franjas, { horaInicio: '', horaFin: '' }] } : row));

    const removeFranja = (di: number, fi: number) =>
        setDias((d) => d.map((row, i) =>
            i === di
                ? { ...row, franjas: row.franjas.length > 1 ? row.franjas.filter((_, j) => j !== fi) : row.franjas }
                : row));

    const updateFranja = (di: number, fi: number, field: keyof Franja, value: string) =>
        setDias((d) => d.map((row, i) =>
            i === di
                ? { ...row, franjas: row.franjas.map((fr, j) => (j === fi ? { ...fr, [field]: value } : fr)) }
                : row));

    // Copia las franjas (horarios) de OTRA fecha ya ingresada a esta, para no repetir el mismo
    // horario a mano cuando varias fechas comparten el horario. Reemplaza lo que hubiera en esta
    // fecha, pero queda como cualquier franja normal: se puede seguir editando o agregando mas.
    const copyFranjasFrom = (di: number, sourceIndex: number) =>
        setDias((d) => d.map((row, i) =>
            i === di
                ? { ...row, franjas: d[sourceIndex]!.franjas.map((fr) => ({ ...fr })) }
                : row));

    const onDireccionChange = (value: string) => {
        setDireccion(value);
        setPlaceId(null);
        setCoords(null);
        if (acTimer.current) clearTimeout(acTimer.current);
        if (value.trim().length < 3) { setSuggestions([]); setShowSug(false); return; }
        acTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(value)}`, { credentials: 'include' });
                const data = await res.json();
                setSuggestions(data?.suggestions || []);
                setShowSug(true);
            } catch { setSuggestions([]); }
        }, 350);
    };

    const pickSuggestion = async (sug: { placeId: string; description: string }) => {
        setShowSug(false);
        setSuggestions([]);
        setDireccion(sug.description);
        setPlaceId(sug.placeId);
        try {
            const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(sug.placeId)}`, { credentials: 'include' });
            const data = await res.json();
            if (res.ok && typeof data?.lat === 'number') {
                setCoords({ lat: data.lat, lng: data.lng });
                if (data.address) setDireccion(data.address);
            }
        } catch { /* noop */ }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validacion de inputs
        const errores: string[] = [];
        if (!nombre.trim()) errores.push(LL.adminFormErrorNameRequired());
        if (precio !== '' && Number(precio) < 0) errores.push(LL.adminFormErrorPriceNegative());
        if (cuposPorDia !== '' && Number(cuposPorDia) < 0) errores.push(LL.adminFormErrorSlotsNegative());
        if (limitePorPersona !== '' && Number(limitePorPersona) <= 0) errores.push(LL.adminFormErrorPersonLimitInvalid());
        if (limitePorPersona !== '' && cuposPorDia !== '' && Number(limitePorPersona) > Number(cuposPorDia)) errores.push(LL.adminFormErrorPersonLimitExceedsSlots());
        for (const d of dias) {
            if (!d.fecha) continue;
            if (d.fecha < todayStr) {
                errores.push(LL.adminFormErrorPastDate({ fecha: d.fecha }));
                break;
            }
            for (const f of d.franjas) {
                if (f.horaInicio && f.horaFin && f.horaInicio >= f.horaFin) {
                    errores.push(LL.adminFormErrorTimeRangeInvalid({ fecha: d.fecha }));
                    break;
                }
            }
        }
        if (errores.length > 0) {
            const firstError = errores[0] ?? 'Error';
            showToast(firstError, 'error');
            setResultMsg({ ok: false, text: firstError });
            return;
        }
        // Objeto que (en la próxima etapa) se enviará a POST /api/admin/activities
        const payload = {
            name: nombre,
            description: descripcion,
            category: categoria,
            address: direccion,
            tag_clima: tagClima,
            price: precio === '' ? null : Number(precio),
            cupos_por_dia: cuposPorDia === '' ? null : Number(cuposPorDia),
            limite_por_persona: limitePorPersona === '' ? null : Number(limitePorPersona),
            image_url: imageUrl || null,
            place_id: placeId,
            schedules: dias
                .filter((d) => d.fecha)
                .map((d) => ({
                    fecha: d.fecha,
                    franjas: d.franjas.filter((f) => f.horaInicio || f.horaFin),
                })),
            // Coordenadas capturadas del autocomplete de Google; si es null, el backend geocodifica "address"
            coordinates: coords,
        };
        setPreview(payload);
        setSaving(true);
        setResultMsg(null);
        try {
            const url = activityToEdit
                ? `/api/admin/activities/${activityToEdit.id}`
                : '/api/admin/activities';
            const method = activityToEdit ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || (activityToEdit ? "Error al actualizar el panorama" : LL.adminFormErrorCreating()));
            
            const okText = activityToEdit
                ? (data.geocoded ? "Panorama actualizado y guardado. Dirección geocodificada." : "Panorama actualizado y guardado (la dirección no se pudo geocodificar).")
                : (data.geocoded ? LL.adminFormSuccessGeocoded() : LL.adminFormSuccessNotGeocoded());
            showToast(okText, 'success');
            setResultMsg({ ok: true, text: okText });
            if (activityToEdit) {
                onSuccess?.();
            }
        } catch (err: any) {
            const errText = err?.message || LL.adminFormSaveErrorGeneric();
            setResultMsg({ ok: false, text: errText });
            showToast(errText, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ====== FORMULARIO (2 columnas) ====== */}
            <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
                {/* Datos principales */}
                <section className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <h2 className="text-lg font-black tracking-tighter text-gray-900 mb-6">
                        {LL.adminFormSectionPanoramaData()}
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Imagen URL */}
                        <div className="sm:col-span-2">
                            <label className={labelCls}>
                                <span className="inline-flex items-center gap-1.5"><ImageIcon className="w-3 h-3" /> {LL.adminFormImageLabel()}</span>
                            </label>
                            <input
                                type="url"
                                value={imageUrl}
                                onChange={(e) => { setImageUrl(e.target.value); setImgError(false); }}
                                placeholder={LL.adminFormImagePlaceholder()}
                                className={inputCls}
                            />
                            <p className="text-[11px] text-gray-400 mt-1">
                                {LL.adminFormImageHint()}
                            </p>
                        </div>

                        {/* Nombre */}
                        <div className="sm:col-span-2">
                            <label className={labelCls}>{LL.adminFormNameLabel()}</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder={LL.adminFormNamePlaceholder()}
                                className={inputCls}
                                required
                            />
                        </div>

                        {/* Descripción */}
                        <div className="sm:col-span-2">
                            <label className={labelCls}>{LL.adminFormDescriptionLabel()}</label>
                            <textarea
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                placeholder={LL.adminFormDescriptionPlaceholder()}
                                rows={3}
                                className={inputCls + ' resize-none'}
                            />
                        </div>

                        {/* Categoría */}
                        <div>
                            <label className={labelCls}>{LL.detailsCategoryLabel()}</label>
                            <select
                                value={categoria}
                                onChange={(e) => setCategoria(e.target.value as Category)}
                                className={inputCls + ' cursor-pointer'}
                            >
                                {Object.values(Category).map((c) => (
                                    <option key={c} value={c}>{categoryLabel(c)}</option>
                                ))}
                            </select>
                        </div>

                        {/* Etiqueta de clima */}
                        <div>
                            <label className={labelCls}>{LL.adminFormWeatherTagLabel()}</label>
                            <select
                                value={tagClima}
                                onChange={(e) => setTagClima(e.target.value as 'All' | 'Sunny')}
                                className={inputCls + ' cursor-pointer'}
                            >
                                <option value="All">{LL.adminFormWeatherAllOption()}</option>
                                <option value="Sunny">{LL.adminFormWeatherSunnyOption()}</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Dirección + nota de distancia */}
                <section className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <h2 className="text-lg font-black tracking-tighter text-gray-900 mb-6">
                        {LL.detailsCoordsLabel()}
                    </h2>
                    <label className={labelCls}>
                        <span className="inline-flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {LL.adminFormAddressLabel()}</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={direccion}
                            onChange={(e) => onDireccionChange(e.target.value)}
                            onFocus={() => suggestions.length > 0 && setShowSug(true)}
                            placeholder={LL.adminFormAddressPlaceholder() || "Escribe y elige una direccion de Google..."}
                            className={inputCls}
                            autoComplete="off"
                        />
                        {showSug && suggestions.length > 0 && (
                            <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-auto">
                                {suggestions.map((sug) => (
                                    <li key={sug.placeId}>
                                        <button type="button" onClick={() => pickSuggestion(sug)}
                                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                            {sug.description}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {coords && (
                        <p className="text-[11px] text-emerald-600 font-bold mt-1">{LL.adminFormLocationSelected()}</p>
                    )}
                    <div className="mt-3 flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-xl p-3">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div className="text-[12px] text-blue-700 leading-relaxed">
                            {LL.adminFormGeoInfoHtml ? (
                                <>
                                    <span dangerouslySetInnerHTML={{ __html: LL.adminFormGeoInfoHtml() }} />
                                    <span className="block text-blue-400 mt-1">{LL.adminFormGeoInfoHint()}</span>
                                </>
                            ) : (
                                <p>
                                    Escribe la direccion y <strong>elige una sugerencia de Google</strong> para capturar el placeId y las
                                    <strong> coordenadas exactas</strong>. Si no eliges sugerencia, el backend geocodifica el texto al guardar.
                                    La distancia se calcula con esas coordenadas y se muestra en la tarjeta.
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {/* Horarios */}
                <section className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black tracking-tighter text-gray-900">
                            <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4" /> {LL.adminFormSchedulesSection()}</span>
                        </h2>
                        <button
                            type="button"
                            onClick={addDia}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest bg-black text-white px-3 py-2 rounded-xl hover:bg-gray-800 transition"
                        >
                            <Plus className="w-3 h-3" /> {LL.adminFormAddDateCta()}
                        </button>
                    </div>

                    <div className="space-y-4">
                        {dias.map((dia, di) => (
                            <div key={di} className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40">
                                {/* Fecha */}
                                <div className="grid grid-cols-12 gap-2 items-end mb-3">
                                    <div className="col-span-11">
                                        <label className={labelCls}>{LL.adminFormDateLabel()}</label>
                                        <input type="date" value={dia.fecha} min={todayStr}
                                            onChange={(e) => updateFecha(di, e.target.value)}
                                            className={inputCls} />
                                    </div>
                                    <div className="col-span-1 flex justify-center pb-1">
                                        <button type="button" onClick={() => removeDia(di)}
                                            className="text-gray-300 hover:text-red-500 transition p-1"
                                            title={LL.adminFormRemoveDateTitle()}>
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Franjas horarias de esa fecha */}
                                <div className="space-y-2">
                                    {dia.franjas.map((f, fi) => (
                                        <div key={fi} className="grid grid-cols-12 gap-2 items-end">
                                            <div className="col-span-5">
                                                <label className={labelCls}>{LL.adminFormStartLabel()}</label>
                                                <input type="time" value={f.horaInicio}
                                                    onChange={(e) => updateFranja(di, fi, 'horaInicio', e.target.value)}
                                                    className={inputCls} />
                                            </div>
                                            <div className="col-span-5">
                                                <label className={labelCls}>{LL.adminFormEndLabel()}</label>
                                                <input type="time" value={f.horaFin}
                                                    onChange={(e) => updateFranja(di, fi, 'horaFin', e.target.value)}
                                                    className={inputCls} />
                                            </div>
                                            <div className="col-span-2 flex justify-center pb-1">
                                                <button type="button" onClick={() => removeFranja(di, fi)}
                                                    className="text-gray-300 hover:text-red-500 transition p-1"
                                                    title={LL.adminFormRemoveSlotTitle()}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                        <button type="button" onClick={() => addFranja(di)}
                                            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-black transition">
                                            <Plus className="w-3 h-3" /> {LL.adminFormAddSlotCta()}
                                        </button>

                                        {/* Copiar el horario de otra fecha ya ingresada: reemplaza las franjas de
                                            ESTA fecha, pero siguen siendo editables/ampliables normalmente despues. */}
                                        {dias.length > 1 && (
                                            <select
                                                value=""
                                                onChange={(e) => {
                                                    const idx = Number(e.target.value);
                                                    if (!Number.isNaN(idx)) copyFranjasFrom(di, idx);
                                                }}
                                                className="text-[11px] font-bold uppercase tracking-widest text-gray-500 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 hover:text-black transition cursor-pointer"
                                            >
                                                <option value="" disabled>{LL.adminFormCopyScheduleCta()}</option>
                                                {dias.map((otraDia, otroIdx) => otroIdx !== di && (
                                                    <option key={otroIdx} value={otroIdx}>
                                                        {otraDia.fecha || LL.adminFormCopyScheduleUntitled({ n: otroIdx + 1 })}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Precio + Cupos */}
                <section className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <h2 className="text-lg font-black tracking-tighter text-gray-900 mb-6">
                        {LL.adminFormPriceSection()}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelCls}>
                                <span className="inline-flex items-center gap-1.5"><Ticket className="w-3 h-3" /> {LL.adminFormPriceLabel()}</span>
                            </label>
                            <input type="number" min="0" value={precio}
                                onChange={(e) => setPrecio(e.target.value)}
                                placeholder={LL.adminFormPricePlaceholder()}
                                className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>
                                <span className="inline-flex items-center gap-1.5"><Users className="w-3 h-3" /> {LL.adminFormSlotsLabel()}</span>
                            </label>
                            <input type="number" min="0" value={cuposPorDia}
                                onChange={(e) => setCuposPorDia(e.target.value)}
                                placeholder={LL.adminFormSlotsPlaceholder()}
                                className={inputCls} />
                            <p className="text-[11px] text-gray-400 mt-1">
                                {LL.adminFormSlotsHint()}
                            </p>
                        </div>
                        <div>
                            <label className={labelCls}>
                                <span className="inline-flex items-center gap-1.5"><Users className="w-3 h-3" /> {LL.adminFormPersonLimitLabel()}</span>
                            </label>
                            <input type="number" min="1" value={limitePorPersona}
                                onChange={(e) => setLimitePorPersona(e.target.value)}
                                placeholder={LL.adminFormPersonLimitPlaceholder()}
                                className={inputCls} />
                            <p className="text-[11px] text-gray-400 mt-1">
                                {LL.adminFormPersonLimitHint()}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Submit */}
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 bg-black text-white text-sm font-bold px-6 py-3 rounded-2xl hover:bg-gray-800 transition shadow-sm disabled:opacity-50"
                    >
                        {!activityToEdit && <Plus className="w-4 h-4" />}
                        {saving ? LL.adminFormSavingCta() : (activityToEdit ? "Guardar cambios" : LL.adminFormSubmitCta())}
                    </button>
                    {activityToEdit && onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={saving}
                            className="bg-gray-100 text-gray-700 text-sm font-bold px-6 py-3 rounded-2xl hover:bg-gray-200 transition disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                    )}
                    {resultMsg && (
                        <span className={`text-xs font-bold ${resultMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                            {resultMsg.text}
                        </span>
                    )}
                </div>

                {/* Vista del payload generado */}
                {preview && (
                    <section className="bg-gray-900 rounded-3xl p-6 shadow-sm">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                            {LL.adminFormPreviewPayloadTitle()}
                        </h3>
                        <pre className="text-[12px] text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(preview, null, 2)}
                        </pre>
                    </section>
                )}
            </form>

            {/* ====== VISTA PREVIA EN VIVO (1 columna) ====== */}
            <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-28 space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{LL.adminFormPreviewLabel()}</p>

                    <div className="w-full bg-white rounded-[28px] overflow-hidden border border-gray-100 shadow-sm">
                        {/* Imagen */}
                        <div className="aspect-square w-full bg-gradient-to-br from-gray-50 to-zinc-100 flex items-center justify-center relative overflow-hidden">
                            {imageUrl && !imgError ? (
                                <img src={imageUrl} alt={nombre || 'preview'} onError={() => setImgError(true)} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-6xl select-none">
                                    {categoria === Category.CINE ? 'CINE' :
                                        categoria === Category.PARQUE ? 'PARQUE' :
                                        categoria === Category.TEATRO ? 'TEATRO' :
                                        categoria === Category.MIRADORES ? 'MIRADOR' :
                                        categoria === Category.RESTAURANTE ? 'COMIDA' :
                                        categoria === Category.MUSEO ? 'MUSEO' : 'PANORAMA'}
                                </span>
                            )}
                            {/* Badges arriba a la derecha (clima + distancia), como la tarjeta real */}
                            <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                                <div className="bg-white/90 backdrop-blur text-[10px] font-bold text-gray-700 px-2.5 py-1 rounded-full shadow-sm uppercase tracking-widest">
                                    {tagClima === 'Sunny' ? LL.adminWeatherSunnyShort() : LL.adminWeatherAllShort()}
                                </div>
                                <div className="bg-white/90 backdrop-blur text-[11px] font-bold text-gray-700 px-2.5 py-1 rounded-full shadow-sm inline-flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-orange-500" /> ~2,4 km
                                </div>
                            </div>
                        </div>

                        {/* Cuerpo (mismo orden que la tarjeta real) */}
                        <div className="p-5">
                            <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">{categoria}</span>
                            <h4 className="text-base font-black tracking-tighter text-gray-900 mt-1 mb-1">
                                {nombre || LL.adminFormNameLabel()}
                            </h4>
                            <div className="flex flex-col gap-1.5 text-xs text-gray-600 font-medium mb-2">
                                <div className="flex items-center gap-2">
                                    <span>🕒</span> {dias[0]?.franjas[0]?.horaInicio && dias[0]?.franjas[0]?.horaFin
                                        ? LL.openHours({ open: dias[0].franjas[0].horaInicio, close: dias[0].franjas[0].horaFin })
                                        : LL.adminFormScheduleTBD()}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                    <span>{LL.occupancyLabel({ level: LL.occupancyMedium() })}</span>
                                </div>
                            </div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{LL.priceLabel()}</span>
                            <div className="text-2xl font-black text-gray-900 tracking-tighter">
                                {precio === '' ? '-' : Number(precio) === 0 ? LL.free() : `$${Number(precio).toLocaleString('es-CL')}`}
                            </div>
                        </div>
                    </div>

                    {/* Mini-preview del detalle: mismos bloques que el detalle real */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{LL.adminFormDetailPreviewLabel()}</p>
                        <div>
                            <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">{categoria}</span>
                            <h5 className="text-sm font-black text-gray-900">{nombre || LL.adminFormNameLabel()}</h5>
                        </div>
                        <p className="text-xs text-gray-500 break-words whitespace-pre-line">
                            {descripcion || LL.adminFormDescriptionFallback()}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-zinc-50 border border-gray-100 p-2 rounded-xl">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{LL.weatherSuggestedLabel()}</span>
                                <div className="text-[11px] font-black text-gray-700">{tagClima === 'Sunny' ? LL.weatherIdealOutdoor() : LL.weatherAllWeatherFit()}</div>
                            </div>
                            <div className="bg-zinc-50 border border-gray-100 p-2 rounded-xl">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{LL.scheduleLabel()}</span>
                                <div className="text-[11px] font-black text-gray-700">
                                    {dias[0]?.franjas[0]?.horaInicio && dias[0]?.franjas[0]?.horaFin
                                        ? LL.openHours({ open: dias[0].franjas[0].horaInicio, close: dias[0].franjas[0].horaFin })
                                        : LL.adminFormScheduleTBD()}
                                </div>
                            </div>
                            <div className="bg-zinc-50 border border-gray-100 p-2 rounded-xl">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{LL.priceLabel()}</span>
                                <div className="text-[11px] font-black text-gray-700">
                                    {precio === '' ? '-' : Number(precio) === 0 ? LL.free() : `$${Number(precio).toLocaleString('es-CL')}`}
                                </div>
                                <span className="text-[8px] text-gray-400">{LL.serviceFeeNote()}</span>
                            </div>
                            <div className="bg-zinc-50 border border-gray-100 p-2 rounded-xl">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{LL.addressLabel()}</span>
                                <div className="text-[11px] font-black text-gray-700 break-words">{direccion || LL.adminFormNoAddressValue()}</div>
                            </div>
                        </div>
                        <div>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{LL.placeMapLabel()}</span>
                            <div className="w-full h-20 bg-zinc-100 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400 text-center px-2">
                                {LL.adminFormMapPlaceholderText()}
                            </div>
                        </div>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                        {LL.adminFormDistanceNote()}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default CreatePanoramaForm;
