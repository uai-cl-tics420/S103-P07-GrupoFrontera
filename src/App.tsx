import React from 'react';
import LoginForm from './components/auth/LoginForm';
import OTPVerify from './components/auth/OTPVerify';
import ActivityCard from './components/ActivityCard';
import AdminDashboard from './components/admin/AdminDashboard';
import UserReservationsView from './components/UserReservationsView';
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
import { useToast } from './context/ToastContext';
import { WeatherSkeleton, ActivityCardSkeleton, RecommendationSkeleton } from './components/Skeletons';

//mapeador dinámico de condiciones climáticas a íconos de Lucide
const weatherIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'Clear': Sun,
  'Clouds': Cloud,
  'Rain': CloudRain,
  'Thunderstorm': CloudLightning,
  'Drizzle': CloudDrizzle,
  'Snow': Snowflake,
};

type View = 'home' | 'admin' | 'reservations';

function getInitialView(): View {
  if (typeof window === 'undefined') return 'home';
  const p = window.location.pathname;
  if (p === '/admin') return 'admin';
  if (p === '/mis-reservas') return 'reservations';
  return 'home';
}

export function App() {
  const { showToast } = useToast();
  const { data: session, isPending } = authClient.useSession();
  const [jwtToken, setJwtToken] = React.useState('');
  const [view, setView] = React.useState<View>(getInitialView);

  //estados para capturar las coordenadas reales del navegador
  const [coords, setCoords] = React.useState({ lat: -33.4372, lng: -70.6506 }); //Stgo. centro por defecto
  const [weatherInfo, setWeatherInfo] = React.useState<{ condition: string; temperature: number; cityName?: string; reliable?: boolean } | null>(null);

  //estado local para guardar los panoramas que traemos dinámicamente
  const [dynamicActivities, setDynamicActivities] = React.useState<any[]>([]);
  const [loadingWeather, setLoadingWeather] = React.useState(true);


  //estado para la tarjeta de detalles
  const [selectedActivityForDetail, setSelectedActivityForDetail] = React.useState<any | null>(null);

  //estado local para la planificación de recomendaciones futuras
  const [planningState, setPlanningState] = React.useState<{
    date: string;
    time?: string;
    weather?: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Estados temporales del formulario de planificación
  const [planningDateType, setPlanningDateType] = React.useState<'today' | 'future'>('today');
  const [planningTimeType, setPlanningTimeType] = React.useState<'any' | 'specific'>('any');
  const [dateValue, setDateValue] = React.useState<string>(new Date().toISOString().split('T')[0] as string);
  const [timeValue, setTimeValue] = React.useState("20:00");

  //estado local para los filtros de búsqueda en servidor
  const [apiFilters, setApiFilters] = React.useState({
    radius: 50000,
    priceSort: '' as '' | 'asc' | 'desc',
    priceMin: '',
    priceMax: '',
    filterDate: '',   // 'YYYY-MM-DD', filtro de navegación (independiente de "Recomendar Panoramas")
    filterTime: '',   // 'HH:MM', solo aplica si filterDate está seteado
  });

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
    const path = next === 'admin' ? '/admin' : next === 'reservations' ? '/mis-reservas' : '/';
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

  const [userHistory, setUserHistory] = React.useState<{ favorites: string[], reservations: string[] }>({ favorites: [], reservations: [] });

  const [activeReservations, setActiveReservations] = React.useState<Record<string, { id: string; status: string }>>({});
  const historyLoadedRef = React.useRef(false);

  // Pide /api/reservations/:userId y arma el map de reservas activas
  const refreshReservations = React.useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/reservations/${session.user.id}`, { credentials: 'include' });
      if (!res.ok) return;
      const list = await res.json();
      if (!Array.isArray(list)) return;
      // Ordenar por createdAt asc para que la mas reciente sobreescriba en el map
      const sorted = [...list].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const map: Record<string, { id: string; status: string }> = {};
      for (const r of sorted) {
        if (r.status === 'cancelado') {
          // Si la mas reciente esta cancelada, remover de map (vuelve a 'reservable')
          delete map[r.activityId];
        } else {
          map[r.activityId] = { id: r.id, status: r.status };
        }
      }
      setActiveReservations(map);
    } catch (err) {
      console.error('Error fetching reservations:', err);
    }
  }, [session?.user?.id]);

  React.useEffect(() => {
    refreshReservations();
  }, [refreshReservations]);

  const fetchFilteredActivities = async (categoryOverride?: string | null, filtersOverride?: typeof apiFilters) => {
    try {
      setLoadingWeather(true);
      const activeFilters = filtersOverride || apiFilters;
      const activeCat = categoryOverride !== undefined ? categoryOverride : selectedCategory;

      let url = `/api/activities?lat=${coords.lat}&lng=${coords.lng}&radius=${activeFilters.radius}`;
      if (activeFilters.priceSort) url += `&priceSort=${activeFilters.priceSort}`;
      if (activeFilters.priceMin !== '') url += `&priceMin=${activeFilters.priceMin}`;
      if (activeFilters.priceMax !== '') url += `&priceMax=${activeFilters.priceMax}`;
      // Filtro de fecha/hora del toolbar: independiente de "planningState" (no dispara el banner
      // de recomendación ni el modo curado Top-6, solo acota la grilla normal)
      if (activeFilters.filterDate) {
        url += `&filterDate=${activeFilters.filterDate}`;
        if (activeFilters.filterTime) url += `&filterTime=${activeFilters.filterTime}`;
      }

      // Inyectar parámetros de planificación de fecha futura si están activos
      if (planningState) {
        url += `&date=${planningState.date}`;
        if (planningState.time) {
          url += `&time=${planningState.time}`;
        }
      }

      // Si hay una categoría seleccionada y no es "Todas" (Filtro inteligente de Barros)
      if (activeCat && activeCat !== 'Todas') {
        url += `&category=${activeCat}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data && data.activities) {
        setDynamicActivities(data.activities);
        setWeatherInfo(data.currentWeather);

        if (data.userHistory && !historyLoadedRef.current) {
          setUserHistory(prev => ({
            favorites: data.userHistory.favorites || [],
            reservations: Array.from(new Set([
              ...(data.userHistory.reservations || []),
              ...prev.reservations
            ]))
          }));
          historyLoadedRef.current = true;

        }
      }
    } catch (err) {
      console.error("Error cargando panoramas dinámicos:", err);
      showToast("No se pudo conectar con el servicio meteorológico.", "error");


    } finally {
      setLoadingWeather(false);
    }
  };

  React.useEffect(() => {
    if (session) {
      historyLoadedRef.current = false; // Permitir recarga limpia al cambiar usuario, ubicación o planificación
      fetchFilteredActivities(preferredCategory, apiFilters);
    }
  }, [coords, session, planningState, preferredCategory]); // Se ejecuta al cambiar ubicación, sesión o preferencia

  const handleToggleFavorite = async (activityId: string) => {
    const isFav = userHistory.favorites.includes(activityId);


    const activity = actualActivitiesList.find(a => a.id === activityId);


    if (isFav) {
      showToast("Eliminado de tus favoritos.", "info");
    } else {
      showToast("¡Panorama guardado en tus favoritos!", "success");
    }

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
          body: JSON.stringify({ activityId, activity })
        });
      }
    } catch (err) {
      console.error("Error toggling favorite", err);
    }
  };

  // Refresca el estado de reservas tras crear, pagar o cancelar
  const handleReservationChanged = async () => {
    await refreshReservations();
  };

  let actualActivitiesList: any[] = [];

  // Mantener lo ya cargado aunque haya una recarga en segundo plano (evita que la lista
  // se vacie al volver a la pestana / al revalidar la sesion). Solo usamos el fallback
  // provisorio si todavia no se ha cargado ningun panorama.
  if (dynamicActivities.length > 0) {
    actualActivitiesList = dynamicActivities;
  } else if (!loadingWeather) {
    actualActivitiesList = dynamicActivities;
  } else if (activities) {
    if (Array.isArray(activities)) {
      actualActivitiesList = activities;
    } else if ((activities as any).activities && Array.isArray((activities as any).activities)) {
      actualActivitiesList = (activities as any).activities;
    }
  }

  // Panoramas ya realizados (comprados/pagados): cuentan como interés para la similitud,
  // pero el panorama en sí NO debe recomendarse de nuevo (ya se hizo).
  const purchasedIds = Object.entries(activeReservations)
    .filter(([, r]) => r.status === 'pagado' || r.status === 'comprado')
    .map(([id]) => id);

  const currentUser: User = {
    id: session?.user?.id ?? "anon",
    name: session?.user?.name ?? "Usuario",
    preferences: [], // Eliminamos la preferencia fija heredada para usar el modelo 100% dinámico basado en likes, reservas, clima y distancia
    currentLocation: coords,
    history: { ...userHistory, purchased: purchasedIds }
  };

  // Parámetros avanzados de clima y tiempo
  // El clima solo se usa para ordenar/penalizar si el pronóstico es confiable (fecha <= 5 días).
  // Para fechas lejanas el clima es solo informativo, así que no condiciona la recomendación.
  const weatherTag = (weatherInfo && weatherInfo.reliable !== false)
    ? ((weatherInfo.condition === 'Clear' || weatherInfo.condition === 'Clouds') ? 'Sunny' : 'Rainy')
    : undefined;
  const activeWeather = weatherTag;
  const activeTime = planningState
    ? (planningState.date === 'today' ? undefined : (planningState.time || 'any'))
    : undefined;

  // Motor de recomendaciones optimizado con las variables de tus compañeros
  const recommendedActivities = getRecommendedActivities(currentUser, actualActivitiesList, activeWeather, activeTime);

  // Inicializamos la categoría usando preferredCategory pero con el resguardo de filtrado dinámico
  const { selectedCategory, setSelectedCategory, filteredActivities } = useCategoryFilter(recommendedActivities, preferredCategory || null);

  // Al volver a la pestaña (o recuperar el foco), recargamos la vista ACTUAL para que la
  // lista no quede vacia tras la revalidacion de sesion de better-auth.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && session) {
        fetchFilteredActivities(selectedCategory, apiFilters);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, apiFilters, coords, planningState, session]);

  // Manejador unificado de pestañas con tus Toasts y el reseteo de filtros de los chicos
  const handleSelectCategory = (category: typeof selectedCategory) => {
    setSelectedCategory(category);
    if (category !== null) {
      setPreferredCategory(category);
      showToast(`Mostrando ${category}.`, "info");
    }

    // Reiniciar los filtros locales para que sean independientes por categoría (Lógica de Barros/Daniel)
    const resetFilters = { radius: 50000, priceSort: '' as '' | 'asc' | 'desc', priceMin: '', priceMax: '', filterDate: '', filterTime: '' };
    setApiFilters(resetFilters);

    // Disparar búsqueda inmediatamente para que cargue los panoramas de la nueva pestaña

    fetchFilteredActivities(category, resetFilters);
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

  // d.2) Vista de Mis Reservas (cualquier usuario logueado)
  if (view === 'reservations') {
    return (
      <UserReservationsView
        userId={session.user.id}
        userEmail={session?.user?.email}
        onBack={() => navigate('home')}
        onReservationChanged={handleReservationChanged}
      />
    );
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

  //Función para manejar el signout
  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      showToast("Sesión cerrada correctamente. ¡Vuelve pronto!", "info");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      showToast("Hubo un problema al cerrar tu sesión.", "error");
    }
  };

  //Función para manejar las reservas por ahora
  const handleReserve = async (activityId: string) => {
    showToast("¡Reserva completada con éxito!", "success");
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
            PanoramApp
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {loadingWeather ? (
              <WeatherSkeleton />
            ) : weatherInfo ? (
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
            ) : null}

            <button
              onClick={() => navigate('reservations')}
              className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-gray-900 transition-colors whitespace-nowrap px-2 py-1 border border-gray-200 rounded"
            >
              {t('myReservationsLink')}
            </button>

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
              onClick={handleSignOut}
              className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-red-400 transition-colors whitespace-nowrap"
            >
              {t('logout')}
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 border-2 border-white shadow-md flex-shrink-0"></div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Acá debería ir lo de la pestaña de recomentaciones porsiaca, pero el skeleton ya está hecho */}
        {loading ? (
          <RecommendationSkeleton />
        ) : (
          null
        )}

        <div className="mb-8 sm:mb-10 flex flex-col gap-3">
          <CategoryFilter
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />

          {/* Banner de Recomendación Asistida / Planificación (solo en pestaña Todas) */}
          {!selectedCategory && !planningState && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gradient-to-r from-orange-500/10 to-fuchsia-600/10 border border-orange-500/20 rounded-2xl shadow-sm mb-2 animate-fade-in">
              <div className="flex flex-col gap-1 text-center sm:text-left">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-gray-900 leading-tight">
                  🧠 ¿No sabes qué hacer? ¡Te recomendamos panoramas!
                </h3>
                <p className="text-xs text-gray-600 font-medium">
                  Encuentra las mejores opciones según el clima y horarios de hoy o de cualquier fecha que elijas.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-fuchsia-600 hover:from-orange-600 hover:to-fuchsia-700 text-white text-xs font-black px-6 py-3 rounded-xl transition-all active:scale-[0.97] shadow-md shadow-orange-500/10 uppercase tracking-wider whitespace-nowrap cursor-pointer"
              >
                Recomendar Panoramas
              </button>
            </div>
          )}

          {!selectedCategory && planningState && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl shadow-sm mb-2 animate-fade-in">
              <div className="flex flex-col gap-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-emerald-950 leading-tight">
                    {planningState.date === 'today' ? '📅 Recomendación para Hoy Activa' : '📅 Recomendación Planificada Activa'}
                  </h3>
                </div>
                <p className="text-xs text-emerald-800 font-semibold mt-1">
                  {planningState.date === 'today' ? (
                    <>
                      Mostrando panoramas ideales para <span className="font-bold underline">hoy</span> en tiempo real. Clima detectado por API: <span className="font-bold underline">{weatherInfo?.condition === 'Clear' ? '☀️ Despejado' : weatherInfo?.condition === 'Clouds' ? '☁️ Nublado' : '🌧️ Lluvioso'} ({weatherInfo?.temperature.toFixed(1)}°C)</span>.
                    </>
                  ) : (
                    <>
                      Mostrando panoramas para el día <span className="font-bold underline">{planningState.date}</span> {planningState.time ? <>a las <span className="font-bold underline">{planningState.time}</span></> : 'a cualquier hora'}.{' '}
                      {weatherInfo?.reliable === false ? (
                        <span className="font-bold">El clima no se considera para esta fecha (fuera del pronóstico de 5 días).</span>
                      ) : (
                        <>Clima estimado por API: <span className="font-bold underline">{weatherInfo?.condition === 'Clear' ? '☀️ Despejado' : weatherInfo?.condition === 'Clouds' ? '☁️ Nublado' : '🌧️ Lluvioso'} ({weatherInfo?.temperature.toFixed(1)}°C)</span>.</>
                      )}
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setPlanningState(null)}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-3 rounded-xl transition-all active:scale-[0.97] shadow-md shadow-emerald-600/10 uppercase tracking-wider whitespace-nowrap cursor-pointer"
              >
                🔄 Volver al Tiempo Real
              </button>
            </div>
          )}

          {/* Toolbar de Filtros: visible siempre, tanto en "Todas" como en una categoría específica */}
          <div className="flex flex-wrap items-center gap-3 px-2 py-3 bg-white/50 border border-gray-100 rounded-xl shadow-sm animate-fade-in">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mr-2">{t('filters')}:</span>


            <select
              className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              value={apiFilters.radius}
              onChange={(e) => setApiFilters({ ...apiFilters, radius: Number(e.target.value) })}
            >
              <option value={50000}>Toda la región</option>
              <option value={10000}>A menos de 10km</option>
              <option value={5000}>A menos de 5km</option>
              <option value={2000}>A menos de 2km</option>
            </select>

            <button
              type="button"
              onClick={() => setApiFilters({ ...apiFilters, radius: 2000 })}
              className="text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
            >
              📍 Cerca de ti
            </button>

            <select
              className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              value={apiFilters.priceSort}
              onChange={(e) => setApiFilters({ ...apiFilters, priceSort: e.target.value as '' | 'asc' | 'desc' })}
            >
              <option value="">Precio: sin orden</option>
              <option value="asc">Precio: menor a mayor</option>
              <option value="desc">Precio: mayor a menor</option>
            </select>

            <input
              type="number"
              min={0}
              placeholder="Mín $"
              value={apiFilters.priceMin}
              onChange={(e) => setApiFilters({ ...apiFilters, priceMin: e.target.value })}
              className="w-20 text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              min={0}
              placeholder="Máx $"
              value={apiFilters.priceMax}
              onChange={(e) => setApiFilters({ ...apiFilters, priceMax: e.target.value })}
              className="w-20 text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={apiFilters.filterDate}
              onChange={(e) => setApiFilters({ ...apiFilters, filterDate: e.target.value, filterTime: e.target.value ? apiFilters.filterTime : '' })}
              className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="time"
              disabled={!apiFilters.filterDate}
              value={apiFilters.filterTime}
              onChange={(e) => setApiFilters({ ...apiFilters, filterTime: e.target.value })}
              className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            {apiFilters.filterDate && (
              <button
                type="button"
                onClick={() => setApiFilters({ ...apiFilters, filterDate: '', filterTime: '' })}
                className="text-xs font-medium text-gray-400 hover:text-gray-600"
              >
                ✕ Quitar fecha
              </button>
            )}

            <button
              onClick={() => fetchFilteredActivities(selectedCategory, apiFilters)}
              disabled={loadingWeather}
              className="ml-auto text-xs font-bold text-white bg-gray-900 px-4 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loadingWeather ? (
                <span className="animate-pulse">Buscando...</span>
              ) : (
                "Aplicar Filtros"
              )}
            </button>
          </div>

          {/* Mostramos el contador de panoramas, cambiando a modo curado si hay planificación activa */}
          <div className="px-2 mt-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-200/50 py-1 px-3 rounded-full">
              {planningState
                ? `${Math.min(6, filteredActivities.length)} ${t('panoramasFound')}`
                : `${filteredActivities.length} ${filteredActivities.length === 1 ? t('panoramaFound') : t('panoramasFound')}`
              }
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
          {((loading || loadingWeather) && actualActivitiesList.length === 0) ? (
            //Si la base de datos está cargando, pintamos 6 tarjetas fantasma c/ animación de pulso
            Array.from({ length: 6 }).map((_, index) => (
              <ActivityCardSkeleton key={`main-skeleton-${index}`} />
            ))
          ) : filteredActivities.length === 0 ? (
            <p className="text-muted-foreground col-span-full text-center py-8">
              {t('emptyState')}
            </p>
          ) : (
            (planningState ? filteredActivities.slice(0, 6) : filteredActivities).map((act, index) => (
              <ActivityCard
                key={act.id}
                activity={act}

                isFavorite={userHistory.favorites.includes(act.id)}
                reservation={activeReservations[act.id] as any}
                onToggleFavorite={handleToggleFavorite}
                onSeeDetails={(activity) => setSelectedActivityForDetail(activity)}
                onReservationChanged={handleReservationChanged}
                userCoords={coords}
                isRecommended={!!planningState}
                rank={index + 1}
              />
            ))
          )}
        </div>

        <ActivityDetailModal
          activity={selectedActivityForDetail}
          onClose={() => setSelectedActivityForDetail(null)}
          isReserved={selectedActivityForDetail ? userHistory.reservations.includes(selectedActivityForDetail.id) : false}
          onReserve={handleReserve}
          onReservationChanged={handleReservationChanged}
          userCoords={coords}
        />
      </main>

      <footer className="mt-16 sm:mt-20 text-center opacity-20 font-black text-[10px] tracking-[0.5em] uppercase px-4">
        Grupo Frontera • 2026
      </footer>

      {/* MODAL DE PLANIFICACIÓN DE RECOMENDACIÓN FUTURA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 flex flex-col gap-5 relative animate-scale-up">

            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 text-lg font-bold p-1 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="flex flex-col gap-2 text-center sm:text-left">
              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] block">
                Intelligent Assistant
              </span>
              <h2 className="text-2xl font-black text-gray-900 tracking-tighter leading-none">
                Recomendar Panoramas
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Indica cuándo realizarás la actividad para que el sistema calcule las mejores opciones de forma automática.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (planningDateType === 'today') {
                  setPlanningState({ date: 'today', time: undefined });

                } else {
                  setPlanningState({
                    date: dateValue,
                    time: planningTimeType === 'specific' ? timeValue : undefined
                  });
                }
                setIsModalOpen(false);
              }}
              className="flex flex-col gap-5"
            >
              {/* Selector de tipo de fecha */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  ¿Cuándo quieres realizar la actividad?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlanningDateType('today')}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${planningDateType === 'today'
                      ? 'bg-black text-white border-black shadow-md shadow-black/10'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanningDateType('future')}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${planningDateType === 'future'
                      ? 'bg-black text-white border-black shadow-md shadow-black/10'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    Otro día 📅
                  </button>
                </div>
              </div>

              {/* Campos para fecha futura */}
              {planningDateType === 'future' && (
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Selecciona la fecha
                    </label>
                    <input
                      type="date"
                      required
                      value={dateValue}
                      onChange={(e) => setDateValue(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-700"
                    />
                  </div>

                  {/* Selector de tipo de hora */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      ¿A qué hora estimas ir?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPlanningTimeType('any')}
                        className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${planningTimeType === 'any'
                          ? 'bg-gray-800 text-white border-gray-800'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                      >
                        Cualquier hora 🕒
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlanningTimeType('specific')}
                        className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${planningTimeType === 'specific'
                          ? 'bg-gray-800 text-white border-gray-800'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                      >
                        Hora específica
                      </button>
                    </div>
                  </div>

                  {planningTimeType === 'specific' && (
                    <div className="flex flex-col gap-1 animate-fade-in">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Define la hora específica
                      </label>
                      <input
                        type="time"
                        required
                        value={timeValue}
                        onChange={(e) => setTimeValue(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-700"
                      />
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-fuchsia-600 hover:from-orange-600 hover:to-fuchsia-700 text-white text-xs font-black py-4 rounded-2xl transition-all active:scale-[0.97] uppercase tracking-widest shadow-lg shadow-orange-500/10 cursor-pointer mt-2"
              >
                Obtener Recomendación
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
