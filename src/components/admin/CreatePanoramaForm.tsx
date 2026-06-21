import React, { useState, useRef } from 'react';
import { Plus, Trash2, MapPin, Image as ImageIcon, Clock, Ticket, Users, Info } from 'lucide-react';
import { Category } from '@/types';
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

export function CreatePanoramaForm() {
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
    const { showToast } = useToast();
    const [placeId, setPlaceId] = useState<string | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [suggestions, setSuggestions] = useState<{ placeId: string; description: string }[]>([]);
    const [showSug, setShowSug] = useState(false);
    const acTimer = useRef<any>(null);

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
        if (!nombre.trim()) errores.push('El nombre es obligatorio.');
        if (precio !== '' && Number(precio) < 0) errores.push('El precio no puede ser negativo.');
        if (cuposPorDia !== '' && Number(cuposPorDia) < 0) errores.push('Los cupos no pueden ser negativos.');
        for (const d of dias) {
            if (!d.fecha) continue;
            for (const f of d.franjas) {
                if (f.horaInicio && f.horaFin && f.horaInicio >= f.horaFin) {
                    errores.push(`En la fecha ${d.fecha}, la hora de inicio debe ser anterior a la de fin.`);
                    break;
                }
            }
        }
        if (errores.length > 0) {
            showToast(errores[0], 'error');
            setResultMsg({ ok: false, text: errores[0] });
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
            const res = await fetch('/api/admin/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Error al crear el panorama');
            const okText = data.geocoded
                ? 'Panorama creado y guardado. Direccion geocodificada.'
                : 'Panorama creado y guardado (sin geocodificar; la direccion no se pudo ubicar).';
            setResultMsg({ ok: true, text: okText });
            showToast(okText, 'success');
        } catch (err: any) {
            const errText = err?.message || 'No se pudo guardar el panorama.';
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
                        Datos del panorama
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Imagen URL */}
                        <div className="sm:col-span-2">
                            <label className={labelCls}>
                                <span className="inline-flex items-center gap-1.5"><ImageIcon className="w-3 h-3" /> Imagen (URL)</span>
                            </label>
                            <input
                                type="url"
                                value={imageUrl}
                                onChange={(e) => { setImageUrl(e.target.value); setImgError(false); }}
                                placeholder="https://...  URL directa de imagen (.jpg/.png) o blob de Azure"
                                className={inputCls}
                            />
                            <p className="text-[11px] text-gray-400 mt-1">
                                Se guarda como URL para poder cambiar la imagen en Azure sin tocar el código.
                            </p>
                        </div>

                        {/* Nombre */}
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Nombre del panorama</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Ej. Festival de Jazz en el Parque"
                                className={inputCls}
                                required
                            />
                        </div>

                        {/* Descripción */}
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Descripción</label>
                            <textarea
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                placeholder="Cuenta de qué se trata el panorama..."
                                rows={3}
                                className={inputCls + ' resize-none'}
                            />
                        </div>

                        {/* Categoría */}
                        <div>
                            <label className={labelCls}>Categoría</label>
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
                            <label className={labelCls}>Etiqueta de clima</label>
                            <select
                                value={tagClima}
                                onChange={(e) => setTagClima(e.target.value as 'All' | 'Sunny')}
                                className={inputCls + ' cursor-pointer'}
                            >
                                <option value="All">Disponible para todo clima</option>
                                <option value="Sunny">Solo días despejados</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Dirección + nota de distancia */}
                <section className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <h2 className="text-lg font-black tracking-tighter text-gray-900 mb-6">
                        Ubicación
                    </h2>
                    <label className={labelCls}>
                        <span className="inline-flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Dirección o localidad real</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={direccion}
                            onChange={(e) => onDireccionChange(e.target.value)}
                            onFocus={() => suggestions.length > 0 && setShowSug(true)}
                            placeholder="Escribe y elige una direccion de Google..."
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
                        <p className="text-[11px] text-emerald-600 font-bold mt-1">✓ Ubicacion seleccionada de Google (coordenadas capturadas).</p>
                    )}
                    <div className="mt-3 flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-xl p-3">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-[12px] text-blue-700 leading-relaxed">
                            Escribe la direccion y <strong>elige una sugerencia de Google</strong> para capturar el placeId y las
                            <strong> coordenadas exactas</strong>. Si no eliges sugerencia, el backend geocodifica el texto al guardar.
                            La distancia se calcula con esas coordenadas y se muestra en la tarjeta.
                        </p>
                    </div>
                </section>

                {/* Horarios */}
                <section className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black tracking-tighter text-gray-900">
                            <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4" /> Horarios y fechas</span>
                        </h2>
                        <button
                            type="button"
                            onClick={addDia}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest bg-black text-white px-3 py-2 rounded-xl hover:bg-gray-800 transition"
                        >
                            <Plus className="w-3 h-3" /> Agregar fecha
                        </button>
                    </div>

                    <div className="space-y-4">
                        {dias.map((dia, di) => (
                            <div key={di} className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40">
                                {/* Fecha */}
                                <div className="grid grid-cols-12 gap-2 items-end mb-3">
                                    <div className="col-span-11">
                                        <label className={labelCls}>Fecha</label>
                                        <input type="date" value={dia.fecha}
                                            onChange={(e) => updateFecha(di, e.target.value)}
                                            className={inputCls} />
                                    </div>
                                    <div className="col-span-1 flex justify-center pb-1">
                                        <button type="button" onClick={() => removeDia(di)}
                                            className="text-gray-300 hover:text-red-500 transition p-1"
                                            title="Quitar fecha">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Franjas horarias de esa fecha */}
                                <div className="space-y-2">
                                    {dia.franjas.map((f, fi) => (
                                        <div key={fi} className="grid grid-cols-12 gap-2 items-end">
                                            <div className="col-span-5">
                                                <label className={labelCls}>Inicio</label>
                                                <input type="time" value={f.horaInicio}
                                                    onChange={(e) => updateFranja(di, fi, 'horaInicio', e.target.value)}
                                                    className={inputCls} />
                                            </div>
                                            <div className="col-span-5">
                                                <label className={labelCls}>Fin</label>
                                                <input type="time" value={f.horaFin}
                                                    onChange={(e) => updateFranja(di, fi, 'horaFin', e.target.value)}
                                                    className={inputCls} />
                                            </div>
                                            <div className="col-span-2 flex justify-center pb-1">
                                                <button type="button" onClick={() => removeFranja(di, fi)}
                                                    className="text-gray-300 hover:text-red-500 transition p-1"
                                                    title="Quitar horario">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <button type="button" onClick={() => addFranja(di)}
                                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-black transition mt-1">
                                        <Plus className="w-3 h-3" /> Agregar horario a esta fecha
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Precio + Cupos */}
                <section className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <h2 className="text-lg font-black tracking-tighter text-gray-900 mb-6">
                        Precio y disponibilidad
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelCls}>
                                <span className="inline-flex items-center gap-1.5"><Ticket className="w-3 h-3" /> Precio (CLP)</span>
                            </label>
                            <input type="number" min="0" value={precio}
                                onChange={(e) => setPrecio(e.target.value)}
                                placeholder="0 = gratis"
                                className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>
                                <span className="inline-flex items-center gap-1.5"><Users className="w-3 h-3" /> Cupos por día</span>
                            </label>
                            <input type="number" min="0" value={cuposPorDia}
                                onChange={(e) => setCuposPorDia(e.target.value)}
                                placeholder="Ej. 50"
                                className={inputCls} />
                            <p className="text-[11px] text-gray-400 mt-1">
                                Cupos que entrega el convenio cada día. Se descuentan con cada reserva/compra y se reinician al día siguiente.
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
                        <Plus className="w-4 h-4" /> {saving ? 'Guardando...' : 'Crear panorama'}
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
                            Datos que se enviarán al backend (próxima etapa)
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
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vista previa</p>

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
                                    {tagClima === 'Sunny' ? 'Despejado' : 'Todo clima'}
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
                                {nombre || 'Nombre del panorama'}
                            </h4>
                            <div className="flex flex-col gap-1.5 text-xs text-gray-600 font-medium mb-2">
                                <div className="flex items-center gap-2">
                                    <span>🕒</span> Abierto: {dias[0]?.franjas[0]?.horaInicio && dias[0]?.franjas[0]?.horaFin
                                        ? `${dias[0].franjas[0].horaInicio} - ${dias[0].franjas[0].horaFin}`
                                        : 'por definir'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                    <span>Afluencia: Media</span>
                                </div>
                            </div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Precio base</span>
                            <div className="text-2xl font-black text-gray-900 tracking-tighter">
                                {precio === '' ? '-' : Number(precio) === 0 ? 'Gratis' : `$${Number(precio).toLocaleString('es-CL')}`}
                            </div>
                        </div>
                    </div>

                    {/* Mini-preview del detalle: mismos bloques que el detalle real */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Detalle (al tocar "Ver evento")</p>
                        <div>
                            <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">{categoria}</span>
                            <h5 className="text-sm font-black text-gray-900">{nombre || 'Nombre del panorama'}</h5>
                        </div>
                        <p className="text-xs text-gray-500 break-words whitespace-pre-line">
                            {descripcion || 'Aqui aparecera la descripcion que escribas.'}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-zinc-50 border border-gray-100 p-2 rounded-xl">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Clima sugerido</span>
                                <div className="text-[11px] font-black text-gray-700">{tagClima === 'Sunny' ? 'Ideal Exterior' : 'Apto Todo Clima'}</div>
                            </div>
                            <div className="bg-zinc-50 border border-gray-100 p-2 rounded-xl">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Horario</span>
                                <div className="text-[11px] font-black text-gray-700">
                                    {dias[0]?.franjas[0]?.horaInicio && dias[0]?.franjas[0]?.horaFin
                                        ? `${dias[0].franjas[0].horaInicio} - ${dias[0].franjas[0].horaFin}`
                                        : 'por definir'}
                                </div>
                            </div>
                            <div className="bg-zinc-50 border border-gray-100 p-2 rounded-xl">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Precio base</span>
                                <div className="text-[11px] font-black text-gray-700">
                                    {precio === '' ? '-' : Number(precio) === 0 ? 'Gratis' : `$${Number(precio).toLocaleString('es-CL')}`}
                                </div>
                                <span className="text-[8px] text-gray-400">+ costo de servicio al pagar</span>
                            </div>
                            <div className="bg-zinc-50 border border-gray-100 p-2 rounded-xl">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Direccion</span>
                                <div className="text-[11px] font-black text-gray-700 break-words">{direccion || 'Sin direccion'}</div>
                            </div>
                        </div>
                        <div>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Mapa del lugar</span>
                            <div className="w-full h-20 bg-zinc-100 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-[10px] text-gray-400 text-center px-2">
                                Aquí se mostrará el mapa de Google del lugar
                            </div>
                        </div>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                        El badge ~2,4 km es donde se mostrara la distancia real al usuario (calculada desde la direccion geocodificada). El numero es de ejemplo hasta conectar la geocodificacion.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default CreatePanoramaForm;
