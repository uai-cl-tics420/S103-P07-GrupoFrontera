import React from 'react';
import { Users, MapPin, Mail, TrendingUp, ArrowLeft } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useT } from '@/i18n/context';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MOCK_STATS, MOCK_RECENT_USERS, MOCK_ACTIVITIES_BY_CATEGORY } from '@/mocks/adminData';
import { Category } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

interface AdminDashboardProps {
    onBack: () => void;
    userEmail?: string;
}

// Mapeo de Category enum -> clave del diccionario
const categoryKeys: Record<Category, TranslationKey> = {
    [Category.CINE]: 'categoryCine',
    [Category.PARQUE]: 'categoryParque',
    [Category.TEATRO]: 'categoryTeatro',
    [Category.MUSEO]: 'categoryMuseo',
    [Category.RESTAURANTE]: 'categoryRestaurante',
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
    const { t } = useT();

    const topCategoryLabel = t(categoryKeys[MOCK_STATS.topCategory]);
    const maxCount = Math.max(...MOCK_ACTIVITIES_BY_CATEGORY.map(c => c.count));

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
                            <span className="hidden sm:inline">{t('adminGoBack')}</span>
                        </button>
                        <span className="bg-black text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest">
                            {t('adminBadge')}
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
                            {t('logout')}
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <header className="mb-10">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-gray-900 mb-2">
                        {t('adminPanel')}
                    </h1>
                    <p className="text-gray-400 text-sm">Grupo Frontera • 2026</p>
                </header>

                {/* Stat Cards */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
                    <StatCard
                        icon={Users}
                        label={t('statTotalUsers')}
                        value={MOCK_STATS.totalUsers}
                        accent="bg-gradient-to-tr from-blue-500 to-cyan-400"
                    />
                    <StatCard
                        icon={MapPin}
                        label={t('statTotalActivities')}
                        value={MOCK_STATS.totalActivities}
                        accent="bg-gradient-to-tr from-orange-500 to-yellow-400"
                    />
                    <StatCard
                        icon={Mail}
                        label={t('statOtpsSent')}
                        value={MOCK_STATS.otpsSentToday}
                        accent="bg-gradient-to-tr from-fuchsia-500 to-pink-400"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label={t('statTopCategory')}
                        value={topCategoryLabel}
                        accent="bg-gradient-to-tr from-emerald-500 to-teal-400"
                    />
                </section>

                {/* Recent users + Categories chart */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Users table - takes 2 cols on lg */}
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                        <h2 className="text-lg font-black tracking-tighter text-gray-900 mb-6">
                            {t('sectionRecentUsers')}
                        </h2>
                        <div className="overflow-x-auto -mx-2">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left">
                                        <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-2">{t('tableEmail')}</th>
                                        <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-2">{t('tableRole')}</th>
                                        <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-2 hidden sm:table-cell">{t('tableJoined')}</th>
                                        <th className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-2">{t('tableStatus')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MOCK_RECENT_USERS.map(u => (
                                        <tr key={u.id} className="border-t border-gray-50">
                                            <td className="py-3 px-2 text-gray-900 font-medium truncate max-w-[180px]">{u.email}</td>
                                            <td className="py-3 px-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                                                    u.role === 'admin'
                                                        ? 'bg-black text-white'
                                                        : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {u.role === 'admin' ? t('roleAdmin') : t('roleUser')}
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
                                                    {u.status === 'active' ? t('statusActive') : t('statusPending')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bar chart */}
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                        <h2 className="text-lg font-black tracking-tighter text-gray-900 mb-6">
                            {t('sectionActivityByCategory')}
                        </h2>
                        <div className="flex flex-col gap-4">
                            {MOCK_ACTIVITIES_BY_CATEGORY.map(({ category, count }) => {
                                const percent = (count / maxCount) * 100;
                                const label = t(categoryKeys[category]);
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
            </main>

            <footer className="mt-16 sm:mt-20 text-center opacity-20 font-black text-[10px] tracking-[0.5em] uppercase px-4">
                Grupo Frontera • 2026
            </footer>
        </div>
    );
}

export default AdminDashboard;
