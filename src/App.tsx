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
import { getScoredActivities } from "./recommendationService";
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

// Valor por defecto de los filtros del toolbar de navegación. 30km es el radio más amplio
// disponible (antes decía "Toda la región" con un valor de 50km que no era coherente con
// las demás opciones del propio dropdown).
const DEFAULT_API_FILTERS = {
  radius: 30000,
  dateSort: '' as '' | 'asc' | 'desc', // misma logica que priceSort: ordena por fecha mas proxima del panorama
  priceSort: '' as '' | 'asc' | 'desc' | 'range', // 'range' = solo activa Mín/Máx, sin ordenar
  priceMin: '',
  priceMax: '',
  filterDate: '',
  filterTime: '',
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
  const [profileOpen, setProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const { LL } = useT();

  // Cerrar el menu de perfil al hacer click fuera o presionar Escape
  React.useEffect(() => {
    if (!profileOpen) return;
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  const todayStr = React.useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const maxDateStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Interceptor global para capturar errores 401 y 403 de la API
  React.useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = (async (input: any, init: any) => {
      const response = await originalFetch(input, init);
      if (response.status === 401) {
        const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
        // Evitamos interceptar las llamadas del sistema de sesión de better-auth para no causar bucles infinitos
        if (!urlStr.includes('/api/auth/')) {
          console.warn("Sesión expirada o no válida (401). Redirigiendo a login...");
          authClient.signOut().then(() => {
            showToast(LL.sessionExpiredToast(), "error");
          }).catch(() => {
            showToast(LL.sessionExpiredRetryToast(), "error");
          });
        }
      } else if (response.status === 403) {
        showToast(LL.noPermissionToast(), "error");
      }
      return response;
    }) as any;
    return () => {
      window.fetch = originalFetch;
    };
  }, [showToast, LL]);

  //estados para capturar las coordenadas reales del navegador
  const [coords, setCoords] = React.useState({ lat: -33.4372, lng: -70.6506 }); //Stgo. centro por defecto
  const [weatherInfo, setWeatherInfo] = React.useState<{ condition: string; temperature: number; cityName?: string; reliable?: boolean } | null>(null);
  // Pronostico real de los proximos 5 dias (hoy + 4), se corre solo dia a dia (lo calcula el backend
  // desde "hoy" en cada request, asi que manana automaticamente es 27..31, sin logica extra aqui).
  const [forecast5Days, setForecast5Days] = React.useState<{ fecha: string; condition: string; temperature: number; reliable: boolean }[]>([]);

  //estado local para guardar los panoramas que traemos dinámicamente
  const [dynamicActivities, setDynamicActivities] = React.useState<any[]>([]);
  const [loadingWeather, setLoadingWeather] = React.useState(true);


  //estado para la tarjeta de detalles
  const [selectedActivityForDetail, setSelectedActivityForDetail] = React.useState<any | null>(null);

  // Recomendacion por historial: ya no depende de fecha/clima (eso es un filtro aparte), asi
  // que es un simple on/off -- "Recomendar Panoramas" la activa de inmediato, sin modal.
  const [recommendActive, setRecommendActive] = React.useState(false);

  //estado local para los filtros de búsqueda en servidor
  const [apiFilters, setApiFilters] = React.useState(DEFAULT_API_FILTERS);
  //estado aplicado de los filtros
  const [appliedFilters, setAppliedFilters] = React.useState(DEFAULT_API_FILTERS);
  // Filtro de "sugerencia por clima": independiente de la recomendacion por historial. Es
  // 100% client-side (cada panorama ya trae su propio clima real por fecha en la respuesta).
  const [weatherFilterActive, setWeatherFilterActive] = React.useState(false);

  const { activities, loading, error } = useActivities();
  const { preferredCategory, setPreferredCategory, role } = useUserPreferences(session?.user?.id);

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
    // Usamos session?.user?.id (primitivo estable) en vez del objeto `session` completo:
    // el objeto que devuelve useSession() puede cambiar de referencia entre renders
    // aunque los datos sean los mismos, lo que disparaba este efecto en loop infinito
    // (geolocalización -> setCoords -> re-render -> fetch a /api/activities -> ...)
    // y terminaba agotando la conexión a Postgres.
  }, [session?.user?.id]);

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
      const activeFilters = filtersOverride || appliedFilters;
      const activeCat = categoryOverride !== undefined ? categoryOverride : selectedCategory;

      let url = `/api/activities?lat=${coords.lat}&lng=${coords.lng}&radius=${activeFilters.radius}`;
      // "range" solo habilita Mín/Máx en el frontend; al backend solo le interesa ordenar
      // cuando el modo es realmente asc/desc.
      if (activeFilters.priceSort === 'asc' || activeFilters.priceSort === 'desc') {
        url += `&priceSort=${activeFilters.priceSort}`;
      }
      if (activeFilters.priceSort) {
        if (activeFilters.priceMin !== '') url += `&priceMin=${activeFilters.priceMin}`;
        if (activeFilters.priceMax !== '') url += `&priceMax=${activeFilters.priceMax}`;
      }
      // Filtro de fecha/hora del toolbar: independiente de "planningState" (no dispara el banner
      // de recomendación ni el modo curado Top-6, solo acota la grilla normal)
      if (activeFilters.filterDate) {
        url += `&filterDate=${activeFilters.filterDate}`;
        if (activeFilters.filterTime) url += `&filterTime=${activeFilters.filterTime}`;
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
        if (Array.isArray(data.forecast5Days)) setForecast5Days(data.forecast5Days);

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
      showToast(LL.toastWeatherError(), "error");


    } finally {
      setLoadingWeather(false);
    }
  };

  React.useEffect(() => {
    if (session) {
      historyLoadedRef.current = false; // Permitir recarga limpia al cambiar usuario o ubicación
      fetchFilteredActivities(preferredCategory, appliedFilters);
    }
    // session?.user?.id en vez de session completo: misma razón que el efecto de geolocalización.
  }, [coords, session?.user?.id, preferredCategory]); // Se ejecuta al cambiar ubicación, sesión o preferencia

  const handleToggleFavorite = async (activityId: string) => {
    const isFav = userHistory.favorites.includes(activityId);


    const activity = actualActivitiesList.find(a => a.id === activityId);


    if (isFav) {
      showToast(LL.toastFavRemoved(), "info");
    } else {
      showToast(LL.toastFavAdded(), "success");
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

  // Horarios reales que existen para la fecha elegida en el filtro (en vez de dejar que el
  // usuario escriba cualquier hora a ciegas, solo se ofrecen las franjas que de verdad tienen
  // panoramas agendados ese día).
  const availableHorarios = React.useMemo(() => {
    if (!apiFilters.filterDate) return [];
    const set = new Set<string>();
    actualActivitiesList.forEach((a: any) => {
      (a.schedules || []).forEach((s: any) => {
        if (s.fecha === apiFilters.filterDate && s.horaInicio) set.add(s.horaInicio);
      });
    });
    return Array.from(set).sort();
  }, [apiFilters.filterDate, actualActivitiesList]);

  // Panoramas ya realizados (comprados/pagados): cuentan como interés para la similitud,
  // pero el panorama en sí NO debe recomendarse de nuevo (ya se hizo).
  const purchasedIds = Object.entries(activeReservations)
    .filter(([, r]) => r.status === 'pagado' || r.status === 'comprado')
    .map(([id]) => id);

  const currentUser: User = {
    id: session?.user?.id ?? "anon",
    name: session?.user?.name ?? "Usuario",
    currentLocation: coords,
    history: { ...userHistory, purchased: purchasedIds }
  };

  // Parámetros avanzados de clima y tiempo
  // El clima solo se usa para ordenar/penalizar si el pronóstico es confiable (fecha <= 5 días).
  const hasExplicitSort = appliedFilters.priceSort === 'asc' || appliedFilters.priceSort === 'desc' || appliedFilters.radius !== 30000 || !!appliedFilters.dateSort;

  // Motor de recomendaciones: SOLO historial (likes/reservas/compras) + distancia + disponibilidad.
  // El clima ya no participa aqui -- es un filtro aparte (ver toolbar).
  // Si "Recomendar" esta activo, los filtros (precio/fecha/radio) NO apagan la recomendacion --
  // se integran como criterio adicional (filtran el universo y/o desempatan dentro del puntaje),
  // en vez de remplazarla por completo. Si NO esta activo, los filtros funcionan independientes,
  // igual que siempre (orden por precio/fecha real, sin tocar el motor de historial).
  const scoredActivities = (hasExplicitSort && !recommendActive)
    ? actualActivitiesList.map((a: any) => ({ activity: a, score: 0 }))
    : getScoredActivities(currentUser, actualActivitiesList);
  const scoreById = new Map(scoredActivities.map(s => [s.activity.id, s.score]));
  const recommendedActivities = scoredActivities.map(s => s.activity);

  // Inicializamos la categoría usando preferredCategory pero con el resguardo de filtrado dinámico
  const { selectedCategory, setSelectedCategory, filteredActivities: filteredByCategoryActivities } = useCategoryFilter(recommendedActivities, preferredCategory || null);

  // Coherencia climatica de un panorama: 'match' (clima real confirma que calza), 'mismatch'
  // (clima real confirma que NO calza) o 'unknown' (fuera del rango de pronostico, ~5 dias --
  // no hay como confirmar ni descartar). Solo se oculta lo confirmado como mismatch; lo
  // desconocido no desaparece, solo no cuenta como "confirmado" (ver split Recomendados/Otros).
  function weatherCoherence(a: any): 'match' | 'mismatch' | 'unknown' {
    if (a.weatherReliable === false) return 'unknown';
    return (a.tagClima === 'All' || a.weatherTag === 'Sunny') ? 'match' : 'mismatch';
  }

  // Que tan optimo es este panorama PARA el clima real de su propia fecha (no solo "calza/no
  // calza"): mas alto = mejor sugerencia. Sol/despejado favorece a los panoramas al aire libre
  // (Parque/Miradores); nublado/lluvia favorece a los de interior. Esto es lo que convierte el
  // filtro en una SUGERENCIA (ordena por lo mas optimo) y no solo un descarte binario.
  function weatherFitScore(a: any): number {
    if (a.weatherReliable === false) return 0; // desconocido: neutro, ni se premia ni se castiga
    const outdoor = a.category === 'Parque' || a.category === 'Miradores';
    let score = a.tagClima === 'All' ? 5 : (a.weatherTag === 'Sunny' ? 15 : -25);
    if (outdoor) {
      score += a.weatherCondition === 'Clear' ? 15 : a.weatherCondition === 'Clouds' ? 0 : -15;
    } else {
      score += (a.weatherCondition === 'Clear' || a.weatherCondition === 'Clouds') ? 0 : 10;
    }
    return score;
  }

  // Filtro de sugerencia por clima (aparte de la recomendacion por historial): OCULTA lo que
  // sabemos con certeza que no calza (dato real); lo desconocido se deja (cae a "Otros" mas
  // abajo). Lo que queda se reordena por weatherFitScore, de mas a menos optimo -- por eso es
  // una sugerencia y no solo un filtro binario.
  // Los destacados (Popular/Tendencia) NUNCA se ocultan por el filtro de clima: si no calzan,
  // no desaparecen, solo caen "al medio" (weatherFitScore bajo los manda mas abajo, y en el
  // split de recomendacion quedan en "Otros"). El resto si se oculta si es mismatch confirmado.
  let filteredActivities = weatherFilterActive
    ? filteredByCategoryActivities
        .filter((a: any) => a.isPopular || a.isTendencia || weatherCoherence(a) !== 'mismatch')
        .sort((a: any, b: any) => weatherFitScore(b) - weatherFitScore(a))
    : filteredByCategoryActivities;

  // Ordenar por fecha (misma logica que el ordenamiento de precio): mas reciente o mas lejana
  // primero. Los panoramas sin fecha (entrada libre, sin schedule) quedan siempre al final.
  if (appliedFilters.dateSort) {
    filteredActivities = [...filteredActivities].sort((a: any, b: any) => {
      if (!a.nearestDate && !b.nearestDate) return 0;
      if (!a.nearestDate) return 1;
      if (!b.nearestDate) return -1;
      return appliedFilters.dateSort === 'asc'
        ? a.nearestDate.localeCompare(b.nearestDate)
        : b.nearestDate.localeCompare(a.nearestDate);
    });
  }

  // Al volver a la pestaña (o recuperar el foco), recargamos la vista ACTUAL para que la
  // lista no quede vacia tras la revalidacion de sesion de better-auth.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && session) {
        fetchFilteredActivities(selectedCategory, appliedFilters);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, appliedFilters, coords, session]);

  // Manejador unificado de pestañas con tus Toasts y el reseteo de filtros de los chicos
  const handleSelectCategory = (category: typeof selectedCategory) => {
    setSelectedCategory(category);
    if (category !== null) {
      setPreferredCategory(category);

      showToast(LL.toastShowingCategory({ category: category as string }), "info");

    }

    // Reiniciar los filtros locales para que sean independientes por categoría (Lógica de Barros/Daniel)
    setApiFilters(DEFAULT_API_FILTERS);
    setAppliedFilters(DEFAULT_API_FILTERS);

    // Disparar búsqueda inmediatamente para que cargue los panoramas de la nueva pestaña

    fetchFilteredActivities(category, DEFAULT_API_FILTERS);
  };

  // a) Verificando sesión
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
        <p className="font-black italic text-gray-400 animate-pulse">{LL.loading()}</p>
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
        <p className="text-gray-400 font-bold tracking-widest uppercase text-sm">{LL.loadingPanoramas()}</p>
      </div>
    );
  }

  // f) Error en la DB
  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
        <p className="text-red-400 font-bold tracking-widest uppercase text-sm text-center">{LL.errorPrefix()}: {error}</p>
      </div>
    );
  }

  //Función para manejar el signout
  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      showToast(LL.toastSignoutSuccess(), "info");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      showToast(LL.toastSignoutError(), "error");
    }
  };

  //Función para manejar las reservas por ahora
  const handleReserve = async (activityId: string) => {
    showToast(LL.toastReservationSuccess(), "success");
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

  const handleActivateAdmin = async () => {
    const choice = prompt(LL.adminActivatePromptChoice());

    if (!choice) return;

    const trimmedChoice = choice.trim();
    if (trimmedChoice !== '1' && trimmedChoice !== '2') {
      showToast(LL.adminActivateInvalidChoice(), "error");
      return;
    }

    let codeToSend = "";

    if (trimmedChoice === '1') {
      // Método 1: OTP por Correo
      try {
        showToast(LL.adminOtpRequestingToast(), "info");
        const reqResponse = await fetch('/api/request-admin-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const reqData = await reqResponse.json();
        if (!reqResponse.ok) {
          showToast(reqData.error || LL.adminOtpRequestError(), "error");
          return;
        }

        showToast(reqData.message || LL.adminOtpSentSuccess(), "success");

        const code = prompt(LL.adminOtpEnterCodePrompt());
        if (!code) return;
        codeToSend = code.trim();
      } catch (err) {
        console.error("Error al solicitar OTP:", err);
        showToast(LL.adminOtpConnectionError(), "error");
        return;
      }
    } else {
      // Método 2: TOTP Manual del Administrador
      const code = prompt(LL.adminTotpManualPrompt());
      if (!code) return;
      codeToSend = code.trim();
    }

    if (codeToSend.length !== 6 || Number.isNaN(Number(codeToSend))) {
      showToast(LL.adminCodeInvalidLength(), "error");
      return;
    }

    try {
      const response = await fetch('/api/activate-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: codeToSend })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const methodMsg = data.method === 'email' ? LL.adminMethodEmail() : LL.adminMethodTotp();
        showToast(LL.adminActivateSuccess({ method: methodMsg }), "success");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast(data.error || LL.adminCodeIncorrectOrExpired(), "error");
      }
    } catch (err) {
      console.error("Error al activar administrador:", err);
      showToast(LL.adminActivateConnectionError(), "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pb-20 overflow-x-hidden">
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5 mb-8 sm:mb-12">
        <div className="w-full mx-auto flex justify-between items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 italic">
            PanoramApp
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {loadingWeather ? (
              <WeatherSkeleton />
            ) : weatherInfo ? (
              <div className='flex items-center gap-1.5 sm:gap-2 bg-zinc-50 border border-gray-100 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm select-none transition-all duration-300 hover:bg-zinc-100 animate-fade-in'>
                <span className='hidden sm:flex text-xs font-black text-gray-500 uppercase tracking-wider items-center gap-1'>
                  <span>📍</span> {weatherInfo.cityName || "Santiago"}
                </span>

                <span className='hidden sm:inline text-gray-300'>|</span>

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

                {/* Pronostico real de los proximos dias (hoy ya esta arriba): se integra en la
                    misma barra del header, junto al nombre/comuna, en vez de una fila aparte.
                    Se oculta en pantallas chicas para no saturar el header movil. */}
                {forecast5Days.slice(1).map((d) => {
                  const IconComponent = weatherIconMap[d.condition] || Cloud;
                  const [, m, day] = d.fecha.split('-');
                  return (
                    <span key={d.fecha} className='hidden lg:flex items-center gap-1 pl-2 border-l border-gray-200'>
                      <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider'>{day}/{m}</span>
                      <IconComponent className='w-3.5 h-3.5 text-zinc-400' />
                      <span className='text-xs font-bold text-gray-700'>{Math.round(d.temperature)}°C</span>
                    </span>
                  );
                })}
              </div>
            ) : null}

            <LanguageToggle />

            {/* Menu de perfil: consolida correo, reservas, admin y cierre de sesion para
                no saturar la barra (clave para que no desborde / haga zoom en movil) */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                aria-label={LL.myAccountLabel()}
                aria-expanded={profileOpen}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 border-2 border-white shadow-md flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
              ></button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in flex flex-col">
                  <div className="px-4 py-2 border-b border-gray-50">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{LL.myAccountLabel()}</p>
                    <p className="text-xs font-bold text-gray-700 truncate">{session?.user?.email}</p>
                  </div>

                  <button
                    onClick={() => { setProfileOpen(false); navigate('reservations'); }}
                    className="text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {LL.myReservationsLink()}
                  </button>

                  {/* "Activar Admin" se oculta a propósito para cuentas no-admin: a ojos de un MVP es
                      una puerta de entrada visible para intrusos (pedido explícito del profesor).
                      El endpoint sigue activo (sigue protegido por TOTP), solo se quita el acceso visual. */}
                  {role === 'admin' && (
                    <button
                      onClick={() => { setProfileOpen(false); navigate('admin'); }}
                      className="text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {LL.adminAccessLink()}
                    </button>
                  )}

                  <button
                    onClick={() => { setProfileOpen(false); handleSignOut(); }}
                    className="text-left px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors border-t border-gray-50 mt-1"
                  >
                    {LL.logout()}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8">
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


          {/* Banner de Recomendación por Historial (solo en pestaña Todas). Ya no depende de
              fecha/clima -- es un on/off inmediato, sin modal. */}
          {!selectedCategory && !recommendActive && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gradient-to-r from-orange-500/10 to-fuchsia-600/10 border border-orange-500/20 rounded-2xl shadow-sm mb-2 animate-fade-in">
              <div className="flex flex-col gap-1 text-center sm:text-left">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-gray-900 leading-tight">
                  {LL.recommendBannerTitle()}
                </h3>
                <p className="text-xs text-gray-600 font-medium">
                  {LL.recommendBannerText()}
                </p>
              </div>
              <button
                onClick={() => setRecommendActive(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-fuchsia-600 hover:from-orange-600 hover:to-fuchsia-700 text-white text-xs font-black px-6 py-3 rounded-xl transition-all active:scale-[0.97] shadow-md shadow-orange-500/10 uppercase tracking-wider whitespace-nowrap cursor-pointer"
              >
                {LL.recommendBannerCta()}
              </button>
            </div>
          )}

          {!selectedCategory && recommendActive && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl shadow-sm mb-2 animate-fade-in">
              <div className="flex flex-col gap-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-emerald-950 leading-tight">
                    {LL.recommendActiveTitle()}
                  </h3>
                </div>
                <p className="text-xs text-emerald-800 font-semibold mt-1">
                  {LL.recommendActiveText()}
                </p>
              </div>
              <button
                onClick={() => setRecommendActive(false)}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-3 rounded-xl transition-all active:scale-[0.97] shadow-md shadow-emerald-600/10 uppercase tracking-wider whitespace-nowrap cursor-pointer"
              >
                {LL.backToRealTimeCta()}
              </button>
            </div>
          )}

          {/* Toolbar de Filtros: visible siempre, tanto en "Todas" como en una categoría específica */}
          <div className="flex flex-wrap items-center gap-3 px-2 py-3 bg-white/50 border border-gray-100 rounded-xl shadow-sm animate-fade-in">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mr-2">{LL.filters()}:</span>


            {apiFilters.radius === 30000 ? (
              <button
                type="button"
                onClick={() => {
                  const newFilters = { ...apiFilters, radius: 5000 };
                  setApiFilters(newFilters);
                  setAppliedFilters(newFilters);
                  fetchFilteredActivities(selectedCategory, newFilters);
                }}
                className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 rounded-lg px-3 py-1.5 font-bold transition flex items-center gap-1 cursor-pointer"
              >
                📍 {LL.filterNearbyRadius()}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <select
                  className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-bold text-gray-700"
                  value={apiFilters.radius}
                  onChange={(e) => setApiFilters({ ...apiFilters, radius: Number(e.target.value) })}
                >
                  <option value={20000}>{LL.radius20km()}</option>
                  <option value={10000}>{LL.radius10km()}</option>
                  <option value={7000}>{LL.radius7km()}</option>
                  <option value={5000}>{LL.radius5km()}</option>
                  <option value={2000}>{LL.radius2km()}</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const newFilters = { ...apiFilters, radius: 30000 };
                    setApiFilters(newFilters);
                    setAppliedFilters(newFilters);
                    fetchFilteredActivities(selectedCategory, newFilters);
                  }}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 ml-0.5 cursor-pointer"
                  title="Quitar filtro de distancia"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Sugerencia por clima: filtro aparte de la recomendacion por historial. Solo deja
                panoramas cuyo clima real (de su propia fecha, dentro de los ~5 dias de pronostico)
                calza con lo que necesitan, y los ordena de mas a menos optimo. */}
            <button
              type="button"
              onClick={() => setWeatherFilterActive(v => !v)}
              className={`text-xs rounded-lg px-3 py-1.5 font-bold transition flex items-center gap-1 cursor-pointer border ${weatherFilterActive ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-200'}`}
            >
              ☁️ {LL.weatherFilterCta()}
            </button>

            {/* Fecha: orden (misma logica que precio) + filtro exacto de fecha/horario */}
            <select
              className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              value={apiFilters.dateSort}
              onChange={(e) => setApiFilters({ ...apiFilters, dateSort: e.target.value as '' | 'asc' | 'desc' })}
            >
              <option value="">{LL.dateSortNone()}</option>
              <option value="asc">{LL.dateSortAsc()}</option>
              <option value="desc">{LL.dateSortDesc()}</option>
            </select>

            <input
              type="date"
              min={todayStr}
              value={apiFilters.filterDate}
              onChange={(e) => setApiFilters({ ...apiFilters, filterDate: e.target.value, filterTime: '' })}
              className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {apiFilters.filterDate && (
              <select
                value={apiFilters.filterTime}
                onChange={(e) => setApiFilters({ ...apiFilters, filterTime: e.target.value })}
                className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">{LL.anyTimeText()}</option>
                {availableHorarios.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            )}

            {apiFilters.filterDate && (
              <button
                type="button"
                onClick={() => setApiFilters({ ...apiFilters, filterDate: '', filterTime: '' })}
                className="text-xs font-medium text-gray-400 hover:text-gray-600"
              >
                {LL.removeDateLink()}
              </button>
            )}

            {/* Precio */}
            <select
              className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              value={apiFilters.priceSort}
              onChange={(e) => setApiFilters({ ...apiFilters, priceSort: e.target.value as '' | 'asc' | 'desc' | 'range' })}
            >
              <option value="">{LL.priceSortNone()}</option>
              <option value="asc">{LL.priceSortAsc()}</option>
              <option value="desc">{LL.priceSortDesc()}</option>
              <option value="range">{LL.priceSortRange()}</option>
            </select>

            {apiFilters.priceSort && (
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1">
                <input
                  type="number"
                  min={0}
                  placeholder={LL.priceMinPlaceholder()}
                  value={apiFilters.priceMin}
                  onChange={(e) => setApiFilters({ ...apiFilters, priceMin: e.target.value })}
                  className="w-16 text-xs focus:outline-none"
                />
                <span className="text-gray-300">—</span>
                <input
                  type="number"
                  min={0}
                  placeholder={LL.priceMaxPlaceholder()}
                  value={apiFilters.priceMax}
                  onChange={(e) => setApiFilters({ ...apiFilters, priceMax: e.target.value })}
                  className="w-16 text-xs focus:outline-none"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setApiFilters(DEFAULT_API_FILTERS);
                setAppliedFilters(DEFAULT_API_FILTERS);
                setWeatherFilterActive(false);
                fetchFilteredActivities(selectedCategory, DEFAULT_API_FILTERS);
              }}
              className="text-xs font-medium text-gray-400 hover:text-gray-600"
            >
              {LL.resetFiltersLink()}
            </button>

            <button
              onClick={() => {
                setAppliedFilters(apiFilters);
                fetchFilteredActivities(selectedCategory, apiFilters);
              }}
              disabled={loadingWeather}
              className="ml-auto text-xs font-bold text-white bg-gray-900 px-4 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loadingWeather ? (
                <span className="animate-pulse">{LL.searching()}</span>
              ) : (
                LL.applyFilters()
              )}
            </button>
          </div>

          {/* Contador de panoramas encontrados */}
          <div className="px-2 mt-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-200/50 py-1 px-3 rounded-full">
              {`${filteredActivities.length} ${filteredActivities.length === 1 ? LL.panoramaFound() : LL.panoramasFound()}`}
            </span>
          </div>
        </div>

        {(() => {
          if ((loading || loadingWeather) && actualActivitiesList.length === 0) {
            return (
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-5 lg:gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ActivityCardSkeleton key={`main-skeleton-${index}`} />
                ))}
              </div>
            );
          }
          if (filteredActivities.length === 0) {
            return <p className="text-muted-foreground text-center py-8">{LL.emptyState()}</p>;
          }

          const renderGrid = (items: any[], opts?: { recommended?: boolean; rankOffset?: number }) => (
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-5 lg:gap-6">
              {items.map((act, index) => (
                <ActivityCard
                  key={act.id}
                  activity={act}
                  isFavorite={userHistory.favorites.includes(act.id)}
                  reservation={activeReservations[act.id] as any}
                  onToggleFavorite={handleToggleFavorite}
                  onSeeDetails={(activity) => setSelectedActivityForDetail(activity)}
                  userCoords={coords}
                  isRecommended={!!opts?.recommended}
                  rank={opts?.recommended ? (opts.rankOffset ?? 0) + index + 1 : undefined}
                />
              ))}
            </div>
          );

          // Con el filtro de clima activo, un panorama cuya fecha esta fuera del pronostico (~5 dias)
          // no tiene como evaluarse: en vez de mezclarlo, queda en su propia seccion con un aviso.
          const esSinClima = (a: any) => weatherFilterActive && weatherCoherence(a) === 'unknown';
          const renderSinClimaSection = (items: any[]) => items.length > 0 && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1 px-2">{LL.weatherUnknownSectionTitle()}</h3>
              <p className="text-[11px] text-gray-400 mb-4 px-2">{LL.weatherUnknownSectionHint()}</p>
              {renderGrid(items)}
            </section>
          );

          // Los destacados (Popular/Tendencia) solo van arriba como seccion aparte cuando NO hay
          // nada activo. Si se recomienda o se usa cualquier filtro, dejan de ir aparte y se
          // mezclan entre los recomendados/filtrados y "otros" segun el mismo criterio de orden.
          const algoActivo =
            recommendActive ||
            hasExplicitSort ||
            weatherFilterActive ||
            appliedFilters.priceSort === 'range' ||
            !!appliedFilters.priceMin ||
            !!appliedFilters.priceMax ||
            !!appliedFilters.filterDate ||
            !!appliedFilters.filterTime;
          const destacados = algoActivo
            ? []
            : filteredActivities.filter((a: any) => a.isPopular || a.isTendencia);
          const sinDestacados = algoActivo
            ? filteredActivities
            : filteredActivities.filter((a: any) => !(a.isPopular || a.isTendencia));

          return (
            <div className="flex flex-col gap-10">
              {destacados.length > 0 && (
                <section>
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 px-2">{LL.featuredSectionTitle()}</h3>
                  {renderGrid(destacados)}
                </section>
              )}

              {recommendActive ? (() => {
                // Dentro de cada grupo, el orden es por puntaje de recomendacion (mas afin al
                // historial primero) -- la fecha NO entra en el orden del top 3, para que el
                // ranking refleje solo que tan recomendado es, no que tan pronto es.
                // Si hay un orden explicito de fecha/precio activo, no remplaza el puntaje --
                // solo desempata entre panoramas igual de recomendados (se integra, no opaca).
                const desempate = (a: any, b: any) => {
                  if (appliedFilters.dateSort) {
                    if (!a.nearestDate && !b.nearestDate) return 0;
                    if (!a.nearestDate) return 1;
                    if (!b.nearestDate) return -1;
                    return appliedFilters.dateSort === 'asc'
                      ? a.nearestDate.localeCompare(b.nearestDate)
                      : b.nearestDate.localeCompare(a.nearestDate);
                  }
                  if (appliedFilters.priceSort === 'asc' || appliedFilters.priceSort === 'desc') {
                    const pa = a.price ?? 0, pb = b.price ?? 0;
                    return appliedFilters.priceSort === 'asc' ? pa - pb : pb - pa;
                  }
                  return 0;
                };
                const byScoreDesc = (a: any, b: any) => (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0) || desempate(a, b);
                // Con el filtro de clima activo el orden prioriza la sugerencia (mas optimo segun
                // el clima real primero); si no, el orden es por puntaje de recomendacion (con el
                // filtro de fecha/precio como desempate si esta activo).
                const ordenDentroDeGrupo = weatherFilterActive
                  ? (a: any, b: any) => weatherFitScore(b) - weatherFitScore(a)
                  : byScoreDesc;
                // Con el filtro de clima activo, "Recomendados" exige ademas coherencia climatica
                // CONFIRMADA (match real) -- lo desconocido (fuera del rango de pronostico) no se
                // oculta, pero tampoco se cuenta como confirmado: cae a "Otros panoramas".
                const calificaRecomendado = (a: any) =>
                    (scoreById.get(a.id) ?? 0) > 0 && (!weatherFilterActive || weatherCoherence(a) === 'match');
                const recomendados = sinDestacados.filter((a: any) => calificaRecomendado(a) && !esSinClima(a)).sort(ordenDentroDeGrupo);
                // "Sin clima" (fuera del pronostico) va a su propia seccion, no a "Otros".
                const sinClima = sinDestacados.filter(esSinClima).sort(ordenDentroDeGrupo);
                const otros = sinDestacados.filter((a: any) => !calificaRecomendado(a) && !esSinClima(a)).sort(ordenDentroDeGrupo);
                return (
                  <>
                    {recomendados.length > 0 && (
                      <section>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 px-2">{LL.recommendedSectionTitle({ n: recomendados.length })}</h3>
                        {renderGrid(recomendados, { recommended: true })}
                      </section>
                    )}
                    {otros.length > 0 && (
                      <section>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 px-2">{LL.otherActivitiesSectionTitle()}</h3>
                        {renderGrid(otros)}
                      </section>
                    )}
                    {renderSinClimaSection(sinClima)}
                  </>
                );
              })() : weatherFilterActive ? (() => {
                // Sin recomendacion pero con filtro de clima: separamos los que no tienen info de
                // clima (fuera del pronostico) en su propia seccion, igual que en "Otros panoramas".
                const conClima = sinDestacados.filter((a: any) => !esSinClima(a));
                const sinClima = sinDestacados.filter(esSinClima);
                return (
                  <>
                    {conClima.length > 0 && renderGrid(conClima)}
                    {renderSinClimaSection(sinClima)}
                  </>
                );
              })() : (
                renderGrid(sinDestacados)
              )}
            </div>
          );
        })()}

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

    </div>
  );
}

export default App;
