import React from 'react';
import LoginForm from './components/auth/LoginForm';
import OTPVerify from './components/auth/OTPVerify';
import ActivityCard from './components/ActivityCard';
import AdminDashboard from './components/admin/AdminDashboard';
import './index.css';
import { CategoryFilter } from "@/components/CategoryFilter";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useCategoryFilter } from "@/hooks/useCategoryFilter";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useActivities } from "@/hooks/useActivities";
import { getRecommendedActivities } from "./recommendationService";
import { authClient } from "./lib/auth-client";
import { useT } from "@/i18n/context";
import type { User } from "./types";

type View = 'home' | 'admin';

function getInitialView(): View {
  if (typeof window === 'undefined') return 'home';
  return window.location.pathname === '/admin' ? 'admin' : 'home';
}

export function App() {
  const { data: session, isPending } = authClient.useSession();
  const [jwtToken, setJwtToken] = React.useState('');
  const [view, setView] = React.useState<View>(getInitialView);
  const { activities, loading, error } = useActivities();
  const { preferredCategory, setPreferredCategory } = useUserPreferences(session?.user?.id);
  const { t } = useT();

  // Sincroniza el estado con el boton "Atras" del browser
  React.useEffect(() => {
    const onPopState = () => setView(getInitialView());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (next: View) => {
    const path = next === 'admin' ? '/admin' : '/';
    window.history.pushState({}, '', path);
    setView(next);
  };

  const currentUser: User = {
    id: session?.user?.id ?? "anon",
    name: session?.user?.name ?? "Usuario",
    preferences: preferredCategory ? [preferredCategory] : [],
    currentLocation: { lat: -33.4569, lng: -70.6483 },
  };

  const recommendedActivities = getRecommendedActivities(currentUser, activities);
  const { selectedCategory, setSelectedCategory, filteredActivities } = useCategoryFilter(recommendedActivities, preferredCategory);

  const handleSelectCategory = (category: typeof selectedCategory) => {
    setSelectedCategory(category);
    if (category !== null) {
      setPreferredCategory(category);
    }
  };

  // a) Verificando sesión
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
        <p className="font-black italic text-gray-400 animate-pulse">{t('loading')}</p>
      </div>
    );
  }

  // b) Sin sesión → Login
  if (!session) return <LoginForm />;

  // c) Sesión sin OTP → Verificar OTP
  if (session.user && !(session.user as any).otpVerified) {
    return (
      <OTPVerify
        userId={session.user.id}
        email={session.user.email}
        onVerified={(token) => { setJwtToken(token); window.location.reload(); }}
      />
    );
  }

  // d) Vista admin
  if (view === 'admin') {
    return <AdminDashboard onBack={() => navigate('home')} userEmail={session?.user?.email} />;
  }

  // e) Cargando actividades desde DB
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
        <p className="text-gray-400 font-bold tracking-widest uppercase text-sm">{t('loadingPanoramas')}</p>
      </div>
    );
  }

  // f) Error en la DB
  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
        <p className="text-red-400 font-bold tracking-widest uppercase text-sm text-center">{t('errorPrefix')}: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pb-20">
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5 mb-8 sm:mb-12">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 italic">
            PANORAMAS
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => navigate('admin')}
              className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-gray-900 transition-colors whitespace-nowrap px-2 py-1 border border-gray-200 rounded"
            >
              {t('adminAccessLink')}
            </button>
            <LanguageToggle />
            <span className="hidden md:inline text-[10px] font-bold text-gray-400 uppercase tracking-tighter truncate max-w-[160px] lg:max-w-[240px]">
              {session?.user?.email}
            </span>
            <button
              onClick={() => authClient.signOut()}
              className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-red-400 transition-colors whitespace-nowrap"
            >
              {t('logout')}
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 border-2 border-white shadow-md flex-shrink-0"></div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 sm:mb-10 flex flex-col gap-3">
          <CategoryFilter
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
          <div className="px-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-200/50 py-1 px-3 rounded-full">
              {filteredActivities.length} {filteredActivities.length === 1 ? t('panoramaFound') : t('panoramasFound')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
          {filteredActivities.length === 0 ? (
            <p className="text-muted-foreground col-span-full text-center py-8">
              {t('emptyState')}
            </p>
          ) : (
            filteredActivities.map((act) => (
              <ActivityCard key={act.id} activity={act} />
            ))
          )}
        </div>
      </main>

      <footer className="mt-16 sm:mt-20 text-center opacity-20 font-black text-[10px] tracking-[0.5em] uppercase px-4">
        Grupo Frontera • 2026
      </footer>
    </div>
  );
}

export default App;
