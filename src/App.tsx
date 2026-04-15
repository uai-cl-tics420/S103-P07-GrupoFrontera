import ActivityCard from './components/ActivityCard';
import './index.css';
import { CategoryFilter } from "@/components/CategoryFilter";
import { useCategoryFilter } from "@/hooks/useCategoryFilter";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useActivities } from "@/hooks/useActivities";
import { getRecommendedActivities } from "./recommendationService";
import type { User } from "./types";
// useActivities reemplaza el import de MOCK_ACTIVITIES: en vez de leer datos
// hardcodeados del archivo mockActivities.ts, ahora los pedimos a la DB via API.

export function App() {
  // Cargamos las actividades desde la base de datos real (no del mock).
  // Mientras carga, loading=true. Si falla la petición, error tiene el mensaje.
  const { activities, loading, error } = useActivities();

  // Leemos la categoría preferida guardada en localStorage (si existe)
  const { preferredCategory, setPreferredCategory } = useUserPreferences();

  // Usuario mock hasta que #32 (auth) mergee y tengamos un userId real.
  // Las preferencias vienen del hook useUserPreferences (localStorage).
  const mockUser: User = {
    id: "mock-user-1",
    name: "Usuario",
    preferences: preferredCategory ? [preferredCategory] : [],
    currentLocation: { lat: -33.4569, lng: -70.6483 }, // Santiago, Chile
  };

  // Ordena las actividades poniendo primero las que coinciden con las preferencias.
  // Cuando no hay preferencia seleccionada, el orden no cambia.
  const recommendedActivities = getRecommendedActivities(mockUser, activities);

  // Le pasamos las actividades YA ORDENADAS por preferencia al filtro de categorías
  const { selectedCategory, setSelectedCategory, filteredActivities } = useCategoryFilter(recommendedActivities, preferredCategory);

  const handleSelectCategory = (category: typeof selectedCategory) => {
    setSelectedCategory(category);
    setPreferredCategory(category);
  };

  // Mientras la API responde, mostramos una pantalla de carga en vez de 0 resultados
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <p className="text-gray-400 font-bold tracking-widest uppercase text-sm">Cargando panoramas…</p>
      </div>
    );
  }

  // Si la API falló (ej. DB apagada), mostramos el error en vez de romper la app
  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <p className="text-red-400 font-bold tracking-widest uppercase text-sm">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pb-20">
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 p-6 mb-12">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 italic">
            PANORAMAS
          </h1>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 border-2 border-white shadow-md"></div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-8">
        <div className="mb-10 flex flex-col gap-3">
          <CategoryFilter
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
          <div className="px-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-200/50 py-1 px-3 rounded-full">
              {filteredActivities.length} {filteredActivities.length === 1 ? 'Panorama encontrado' : 'Panoramas encontrados'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredActivities.length === 0 ? (
            <p className="text-muted-foreground col-span-3 text-center py-8">
              No hay actividades publicadas para esta categoría todavía.
            </p>
          ) : (
            filteredActivities.map((act) => (
              <ActivityCard key={act.id} activity={act} />
            ))
          )}
        </div>
      </main>

      <footer className="mt-20 text-center opacity-20 font-black text-[10px] tracking-[0.5em] uppercase">
        Grupo Frontera • 2026
      </footer>
    </div>
  );
}

export default App;

