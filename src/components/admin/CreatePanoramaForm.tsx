import React, { useState } from 'react';
import { Plus, Trash2, MapPin, Image as ImageIcon, Clock, Ticket, Users, Info } from 'lucide-react';
import { Category } from '@/types';
import { useT } from '@/i18n/context';

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

export function CreatePanoramaForm() {
    const { LL } = useT();
    const [imageUrl, setImageUrl] = useState('');
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [categoria, setCategoria] = useState<Category>(Category.CINE);
    const [direccion, setDireccion] = useState('');
    const [tagClima, setTagClima] = useState<'All' | 'Sunny'>('All');
    const [precio, setPrecio] = useState<string>('');
    const [cuposPorDia, setCuposPorDia] = useState<string>('');
    const [dias, setDias] = useState<DiaHorario[]>([
        { fecha: '', franjas: [{ horaInicio: '', horaFin: '' }] },
    ]);
    const [preview, setPreview] = useState<any>(null);
    const [imgError, setImgError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Objeto que (en la próxima etapa) se enviará a POST /api/admin/activities
        const payload = {
            name: nombre,
            description: descripcion,
            category: categoria,
            address: direccion,
            tag_clima: tagClima,
            price: precio === '' ? null : Number(precio),
            cupos_por_dia: cuposPorDia === '' ? null : Number(cuposPorDia),
            image_url: imageUrl || null,
            schedules: dias
                .filter((d) => d.fecha)
                .map((d) => ({
                    fecha: d.fecha,
                    franjas: d.franjas.filter((f) => f.horaInicio || f.horaFin),
                })),
            // lat/lng se calcularán en el backend geocodificando "address"
            coordinates: null,
        };
        setPreview(payload);
        setSaving(true);
        setResultMsg(null);
        try {
            const res = await fetch('/api/admin/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || LL.adminFormErrorCreating());
            setResultMsg({
                ok: true,
                text: data.geocoded
                    ? LL.adminFormSuccessGeocoded()
                    : LL.adminFormSuccessNotGeocoded(),
            });
        } catch (err: any) {
            setResultMsg({ ok: false, text: err?.message || LL.adminFormSaveErrorGeneric() });
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
                                    <option key={c} value={c}>{c}</option>
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
                    <input
                        type="text"
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                        placeholder={LL.adminFormAddressPlaceholder()}
                        className={inputCls}
                    />
                    <div className="mt-3 flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-xl p-3">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-[12px] text-blue-700 leading-relaxed">
                            <span dangerouslySetInnerHTML={{ __html: LL.adminFormGeoInfoHtml() }} />
                            <span className="block text-blue-400 mt-1">{LL.adminFormGeoInfoHint()}</span>
                        </p>
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
                                        <input type="date" value={dia.fecha}
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

                                    <button type="button" onClick={() => addFranja(di)}
                                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-black transition mt-1">
                                        <Plus className="w-3 h-3" /> {LL.adminFormAddSlotCta()}
                                    </button>
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
                    </div>
                </section>

                {/* Submit */}
                <div className="flex items-center gap-4 flex-wrap">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 bg-black text-white text-sm font-bold px-6 py-3 rounded-2xl hover:bg-gray-800 transition shadow-sm disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" /> {saving ? LL.adminFormSavingCta() : LL.adminFormSubmitCta()}
                    </button>
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
