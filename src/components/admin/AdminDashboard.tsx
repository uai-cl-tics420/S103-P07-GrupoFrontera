import React, { useState, useEffect } from 'react';
import { Users, MapPin, Mail, TrendingUp, ArrowLeft, LayoutDashboard, PlusCircle, Heart, CalendarCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useT } from '@/i18n/context';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MOCK_STATS, MOCK_RECENT_USERS, MOCK_ACTIVITIES_BY_CATEGORY } from '@/mocks/adminData';
import { Category } from '@/types';
type CategoryKey = 'categoryCine' | 'categoryParque' | 'categoryTeatro' | 'categoryMuseo' | 'categoryRestaurante' | 'categoryMiradores';
import { CreatePanoramaForm } from './CreatePanoramaForm';
import { ManagePanoramasView } from './ManagePanoramasView';

interface AdminDashboardProps {
    onBack: () => void;
    userEmail?: string;
}

// Mapeo de Category enum -> clave del diccionario
const categoryKeys: Record<Category, CategoryKey> = {
    [Category.CINE]: 'categoryCine',
    [Category.PARQUE]: 'categoryParque',
    [Category.TEATRO]: 'categoryTeatro',
    [Category.MUSEO]: 'categoryMuseo',
    [Category.RESTAURANTE]: 'categoryRestaurante',
    [Category.MIRADORES]: 'categoryMiradores'
};

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent: string }) {
    return (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accent}`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-3xl font-black tracking-tighter text-gray-900">{value}</p>
        </div>
    );
}

export function AdminDashboard({ onBack, userEmail }: AdminDashboardProps) {
    const { LL } = useT();
    const [realData, setRealData] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'crear' | 'gestionar'>('dashboard');
    const [metrics, setMetrics] = useState<any>(null);
    const [loadingMetrics, setLoadingMetrics] = useState(true);

    useEffect(() => {
        console.log("GATILLANDO FETCH DE MÉTRICAS ALOOOOOO");
        fetch('/api/admin/metrics')
            .then(res => {
                if (!res.ok) throw new Error('Falló la consulta de métricas');
                return res.json();
            })
            .then(response => {
                console.log("DATOS RECIBIDOS DEL BE:", response);
                if (response.success) setMetrics(response.data);
                setLoadingMetrics(false);
            })
            .catch(err => {
                console.warn("Error cargando métricas dinámicas:", err);
                setLoadingMetrics(false);
            });
    }, []);

    useEffect(() => {
        fetch('/api/admin/stats')
            .then(res => {
                if (!res.ok) throw new Error('Falló la consulta API');
                return res.json();
            })
            .then(data => {
                setRealData(data);
                setLoadingData(false);
            })
            .catch(err => {
                console.warn("Usando datos mockeados en Admin (modo offline/fallback):", err);
                setLoadingData(false);
            });
    }, []);

    const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
        try {
            const res = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            if (!res.ok) throw new Error('Falló al cambiar el rol');
            
            // Recargar silenciosamente los datos reales del backend
            const statsRes = await fetch('/api/admin/stats');
            if (statsRes.ok) {
                const data = await statsRes.json();
                setRealData(data);
            }
        } catch (err) {
            console.error("Error al actualizar rol del usuario:", err);
            alert(LL.roleUpdateError());
        }
    };

    // Datos dinámicos con fallback a mock
    const stats = realData?.stats || MOCK_STATS;
    
    // Si la DB tiene usuarios reales, los muestra. Si está vacía o hay error, cae al mock poblado.
    const displayUsers = (realData?.recentUsers && realData.recentUsers.length > 0)
        ? realData.recentUsers
        : MOCK_RECENT_USERS;

    const displayActivitiesByCategory = (realData?.activitiesByCategory && realData.activitiesByCategory.length > 0)
        ? realData.activitiesByCategory
        : MOCK_ACTIVITIES_BY_CATEGORY;

    const topCategoryKey: CategoryKey = categoryKeys[stats.topCategory as Category] || 'categoryParque';
    const topCategoryLabel = LL[topCategoryKey]();
    const maxCount = Math.max(...displayActivitiesByCategory.map((c: any) => c.count), 1);

    const admins = displayUsers.filter((u: any) => u.role === 'admin');
    const standardUsers = displayUsers.filter((u: any) => u.role === 'user');

    const renderUserRow = (u: any) => (
        <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/30 transition-colors">
            <td className="py-3 px-2 text-gray-900 font-medium truncate max-w-[180px]">{u.email}</td>
            <td className="py-3 px-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                    u.role === 'admin'
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-600'
                }`}>
                    {u.role === 'admin' ? LL.roleAdmin() : LL.roleUser()}
                </span>
            </td>
            <td className="py-3 px-2 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">{u.joinedAt}</td>
            <td className="py-3 px-2">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${
                    u.status === 'active' ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                        u.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}></span>
                    {u.status === 'active' ? LL.statusActive() : LL.statusPending()}
                </span>
            </td>
            <td className="py-3 px-2 text-xs">
                {u.email !== userEmail ? (
                    <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as 'user' | 'admin')}
                        className="text-[10px] font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-black cursor-pointer"
                    >
                        <option value="user">Usuario</option>
                        <option value="admin">Admin</option>
                    </select>
                ) : (
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest px-2 py-1 select-none">
                        Actual
                    </span>
                )}
            </td>
        </tr>
    );

    return (
        <div className="min-h-screen bg-[#FAFAFA] font-sans pb-20">
            <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5 mb-8 sm:mb-12">
                <div className="max-w-6xl mx-auto flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-tighter hover:text-gray-900 transition-colors whitespace-nowrap"
                        >
                            <ArrowLeft className="w-3 h-3" />
                            <span className="hidden sm:inline">{LL.adminGoBack()}</span>
                        </button>
                        <span className="bg-black text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest">
                            {LL.adminBadge()}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <LanguageToggle />
                        <span className="hidden md:inline text-[10px] font-bold text-gray-400 uppercase tracking-tighter truncate max-w-[180px]">
                            {userEmail}
                        </span>
                        <button
                            onClick={() => authClient.signOut()}
                            className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-red-400 transition-colors whitespace-nowrap"
                        >
                            {LL.logout()}
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <header className="mb-10">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-gray-900 mb-2">
                        {LL.adminPanel()}
                    </h1>
                    <p className="text-gray-400 text-sm">Grupo Frontera • 2026</p>
                </header>

                {/* Pestañas del panel admin */}
                <div className="flex items-center gap-2 mb-8 border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-bold tracking-tight border-b-2 -mb-px transition ${activeTab === 'dashboard' ? 'border-black text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('crear')}
                        className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-bold tracking-tight border-b-2 -mb-px transition ${activeTab === 'crear' ? 'border-black text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <PlusCircle className="w-4 h-4" /> Crear panorama
                    </button>
                    <button
                        onClick={() => setActiveTab('gestionar')}
                        className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-bold tracking-tight border-b-2 -mb-px transition ${activeTab === 'gestionar' ? 'border-black text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <MapPin className="w-4 h-4" /> Administrar panoramas
                    </button>
                </div>

                {activeTab === 'dashboard' && (
                <>
                {/* Stat Cards */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-12">
                    <StatCard
                        icon={Users}
                        label={LL.statTotalUsers()}
                        value={stats.totalUsers}
                        accent="bg-gradient-to-tr from-blue-500 to-cyan-400"
                    />
                    <StatCard
                        icon={MapPin}
                        label={LL.statTotalActivities()}
                        value={stats.totalActivities}
                        accent="bg-gradient-to-tr from-orange-500 to-yellow-400"
                    />
                    <StatCard
                        icon={Mail}
                        label={LL.statOtpsSent()}
                        value={stats.otpsSentToday}
                        accent="bg-gradient-to-tr from-fuchsia-500 to-pink-400"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label={LL.statTopCategory()}
                        value={topCategoryLabel}
                        accent="bg-gradient-to-tr from-emerald-500 to-teal-400"
                    />

                    <StatCard
                        icon={Heart}
                        label="Panorama Más Popular (Likes)"
                        value={metrics?.popular?.name || "Cargando datos..."}
                        accent='bg-gradient-to-tr from-pink-500 to-rose-400'
                    />

                    <StatCard
                        icon={CalendarCheck}
                        label="Evento en Tendencia"
                        value={metrics?.tendencia?.name || LL.calculatingTrend()}
                        accent="bg-gradient-to-tr from-orange-500 to-amber-400"
                    />
                </section>

                {/* Recent users + Categories chart */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Users table - takes 2 cols on lg */}
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                        <h2 className="text-lg font-black tracking-tighter text-gray-900 mb-6">
                            {LL.sectionRecentUsers()}
                        </h2>
                        <div className="overflow-x-auto -mx-2">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left">
                                        <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-2">{LL.tableEmail()}</th>
                                        <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-2">{LL.tableRole()}</th>
                                        <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-2 hidden sm:table-cell">{LL.tableJoined()}</th>
                                        <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-2">{LL.tableStatus()}</th>
                                        <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-2">{LL.tableAction()}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* 1. SECCIÓN: ADMINISTRADORES */}
                                    {admins.length > 0 && (
                                        <>
                                            <tr className="bg-gray-50/40">
                                                <td colSpan={5} className="py-2 px-2 text-[9px] font-black text-gray-400 uppercase tracking-wider select-none">
                                                    ⚡ {LL.recentAdmins()}
                                                </td>
                                            </tr>
                                            {admins.map(renderUserRow)}
                                        </>
                                    )}

                                    {/* 2. SECCIÓN: USUARIOS COMUNES */}
                                    {standardUsers.length > 0 && (
                                        <>
                                            <tr className="bg-gray-50/40">
                                                <td colSpan={5} className="py-2 px-2 text-[9px] font-black text-gray-400 uppercase tracking-wider select-none pt-4">
                                                    👤 {LL.recentStandardUsers()}
                                                </td>
                                            </tr>
                                            {standardUsers.map(renderUserRow)}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bar chart */}
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                        <h2 className="text-lg font-black tracking-tighter text-gray-900 mb-6">
                            {LL.sectionActivityByCategory()}
                        </h2>
                        <div className="flex flex-col gap-4">
                            {displayActivitiesByCategory.map(({ category, count }: any) => {
                                const percent = (count / maxCount) * 100;
                                const catKey = categoryKeys[category as Category];
                                const label = catKey ? LL[catKey]() : category;
                                return (
                                    <div key={category}>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-xs font-bold text-gray-700">{label}</span>
                                            <span className="text-xs font-black tracking-tighter text-gray-900">{count}</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-gray-900 to-gray-700 rounded-full transition-all duration-500"
                                                style={{ width: `${percent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
                </>
                )}

                {activeTab === 'crear' && <CreatePanoramaForm />}
                {activeTab === 'gestionar' && <ManagePanoramasView />}
            </main>

            <footer className="mt-16 sm:mt-20 text-center opacity-20 font-black text-[10px] tracking-[0.5em] uppercase px-4">
                Grupo Frontera • 2026
            </footer>
        </div>
    );
}

export default AdminDashboard;
