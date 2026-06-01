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
import { Sun, Cloud, CloudRain, CloudLightning, CloudDrizzle, Snowflake, CloudSun, MapPin } from "lucide-react";
import { ActivityDetailModal } from './components/ActivityDetailModal';

//mapeador dinámico de condiciones climáticas a íconos de Lucide
const weatherIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'Clear': Sun,
  'Clouds': Cloud,
  'Rain': CloudRain,
  'Thunderstorm': CloudLightning,
  'Drizzle': CloudDrizzle,
  'Snow': Snowflake,
};

type View = 'home' | 'admin';

function getInitialView(): View {
  if (typeof window === 'undefined') return 'home';
  return window.location.pathname === '/admin' ? 'admin' : 'home';
}

export function App() {
  const { data: session, isPending } = authClient.useSession();
  const [jwtToken, setJwtToken] = React.useState('');
  const [view, setView] = React.useState<View>(getInitialView);

  //estados para capturar las coordenadas reales del navegador
  const [coords, setCoords] = React.useState({ lat: -33.4372, lng: -70.6506 }); //Stgo. centro por defecto
  const [weatherInfo, setWeatherInfo] = React.useState<{ condition: string; temperature: number; cityName?: string } | null>(null);

  //estado local para guardar los panoramas que traemos dinámicamente
  const [dynamicActivities, setDynamicActivities] = React.useState<any[]>([]);
  const [loadingWeather, setLoadingWeather] = React.useState(true);

  //estado para la tarjeta de detalles
  const [selectedActivityForDetail, setSelectedActivityForDetail] = React.useState<any | null>(null);

  const { activities, loading, error } = useActivities();
  const { preferredCategory, setPreferredCategory, role } = useUserPreferences(session?.user?.id);
  const { t } = useT();

  // Sincroniza el estado con el boton "Atras" del browser
  React.useEffect(() => {
    const onPopState = () => {
      const initialView = getInitialView();
      if (initialView === 'admin' && role !== 'admin') {
        window.history.replaceState({}, '', '/');
        setView('home');
      } else {
        setView(initialView);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [role]);

  const navigate = (next: View) => {
    if (next === 'admin' && role !== 'admin') {
      console.warn("Acceso no autorizado a administración.");
      return;
    }
    const path = next === 'admin' ? '/admin' : '/';
    window.history.pushState({}, '', path);
    setView(next);
  };

  //capturamos la geolocalización real apenas el usuario inicia sesión
  React.useEffect(() => {
    if (session) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCoords(newCoords);
          console.log("Coordenadas reales del usuario capturadas:", newCoords)
        },
        (err) => {
          console.warn("Permiso de ubicación denegado o no disponible, usando fallback.");
        }
      );
    }
  }, [session]);

  const [userHistory, setUserHistory] = React.useState<{favorites: string[], reservations: string[]}>({ favorites: [], reservations: [] });

  //lógica dinámica: hacemos la consulta manual al backend inyectando las coordenadas en la url
  React.useEffect(() => {
    async function cargarPanoramasConClima() {
      try {
        setLoadingWeather(true);
        const response = await fetch(`/api/activities?lat=${coords.lat}&lng=${coords.lng}`);
        const data = await response.json();

        if (data && data.activities) {
          setDynamicActivities(data.activities);
          setWeatherInfo(data.currentWeather);
          if (data.userHistory) {
            setUserHistory(prev => ({
              favorites: data.userHistory.favorites || [],
              reservations: Array.from(new Set([
                ...(data.userHistory.reservations || []),
                ...prev.reservations
              ]))
            }));
          }
        }
      } catch (err) {
        console.error("Error cargando panoramas dinámicos:", err);
      } finally {
        setLoadingWeather(false);
      }
    }

    if (session) {
      cargarPanoramasConClima();
    }
  }, [coords, session]);

  const handleToggleFavorite = async (activityId: string) => {
    const isFav = userHistory.favorites.includes(activityId);
    
    // Update local state optimistically
    setUserHistory(prev => ({
      ...prev,
      favorites: isFav 
        ? prev.favorites.filter(id => id !== activityId)
        : [...prev.favorites, activityId]
    }));

    try {
      if (isFav) {
        await fetch('/api/favorites', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId })
        });
      } else {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId })
        });
      }
    } catch (err) {
      console.error("Error toggling favorite", err);
    }
  };

  let actualActivitiesList: any[] = [];

  // Si ya cargó nuestra petición manual con clima, usamos esa
  if (dynamicActivities && dynamicActivities.length > 0) {
    actualActivitiesList = dynamicActivities;
  } 
  // Si no, revisamos el hook original y desempaquetamos con cuidado para que no explote
  else if (activities) {
    if (Array.isArray(activities)) {
      actualActivitiesList = activities;
    } else if ((activities as any).activities && Array.isArray((activities as any).activities)) {
      actualActivitiesList = (activities as any).activities;
    }
  }

  const currentUser: User = {
    id: session?.user?.id ?? "anon",
    name: session?.user?.name ?? "Usuario",
    preferences: preferredCategory ? [preferredCategory] : [],
    currentLocation: coords,
    history: userHistory
  };

  const recommendedActivities = getRecommendedActivities(currentUser, actualActivitiesList);
  const { selectedCategory, setSelectedCategory, filteredActivities } = useCategoryFilter(actualActivitiesList, preferredCategory);
  
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

  // d) Vista admin (sólo si tiene rol de administrador)
  if (view === 'admin' && role === 'admin') {
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

  //Función para manejar las reservas por ahora
  const handleReserve = async (activityId: string) => {
    //Estado optimista inmediato (Se pone verde)
    setUserHistory(prev => {
      if (prev.reservations.includes(activityId)) return prev;
      return {
        ...prev,
        reservations: [...prev.reservations, activityId]
      };
    });

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activityId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log("¡Reserva confirmada con éxito en el servidor!");

    } catch (err) {
      console.error("🚨 Error real en la petición de reserva, revirtiendo estado:", err);
      
      setUserHistory(prev => ({
        ...prev,
        reservations: prev.reservations.filter(id => id !== activityId)
      }));
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pb-20">
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5 mb-8 sm:mb-12">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 italic">
            PANORAMAS
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Componente que muestra el clima satelital en la barra de navegación */}
            {weatherInfo && (
              <div className='flex items-center gap-2 bg-zinc-50 border border-gray-100 px-4 py-2 rounded-full shadow-sm select-none transition-all duration-300 hover:bg-zinc-100 animate-fade-in'>
                <span className='text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1'>
                  <span>📍</span> {weatherInfo.cityName || "Santiago"}
                </span>

                <span className='text-gray-300'>|</span>

                {(() => {
                  const IconComponent = weatherIconMap[weatherInfo.condition] || Cloud;

                  const iconColor =
                    weatherInfo.condition === 'Clear' ? 'text-amber-500 animate-spin-slow' :
                    weatherInfo.condition === 'Rain' || weatherInfo.condition === 'Drizzle' ? 'text-blue-500' :
                    weatherInfo.condition === 'Thunderstorm' ? 'text-purple-600' : 'text-zinc-400';

                  return <IconComponent className={`w-4 h-4 ${iconColor}`} />;
                })()}

                <span className='text-xs font-black text-gray-900 tracking-tighter'>
                  {Math.round(weatherInfo.temperature)}°C
                </span>
              </div>
            )}
            {role === 'admin' && (
              <button
                onClick={() => navigate('admin')}
                className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-gray-900 transition-colors whitespace-nowrap px-2 py-1 border border-gray-200 rounded"
              >
                {t('adminAccessLink')}
              </button>
            )}
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
              <ActivityCard 
                key={act.id} 
                activity={act} 
                isFavorite={userHistory.favorites.includes(act.id)}
                isReserved={userHistory.reservations.includes(act.id)}
                onToggleFavorite={handleToggleFavorite}
                onSeeDetails={(activity) => setSelectedActivityForDetail(activity)}
              />
            ))
          )}
        </div>

        <ActivityDetailModal
          activity={selectedActivityForDetail}
          onClose={() => setSelectedActivityForDetail(null)}
          isReserved={selectedActivityForDetail ? userHistory.reservations.includes(selectedActivityForDetail.id) : false}
          onReserve={handleReserve}
        />
      </main>

      <footer className="mt-16 sm:mt-20 text-center opacity-20 font-black text-[10px] tracking-[0.5em] uppercase px-4">
        Grupo Frontera • 2026
      </footer>
    </div>
  );
}

export default App;
