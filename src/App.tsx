import ActivityCard from './components/ActivityCard';
import { MOCK_ACTIVITIES } from './mockActivities';
import './index.css';
import { CategoryFilter } from "@/components/CategoryFilter";
import { useCategoryFilter } from "@/hooks/useCategoryFilter";
import { useUserPreferences } from "@/hooks/useUserPreferences";

export function App() {
  // Leemos la preferencia guardada en localStorage (si existe)
  const { preferredCategory, setPreferredCategory } = useUserPreferences();

  // Le pasamos la preferencia como categoría inicial al filtro
  const { selectedCategory, setSelectedCategory, filteredActivities } = useCategoryFilter(MOCK_ACTIVITIES, preferredCategory);

  // Cuando el usuario cambia el filtro, actualizamos ambos: el estado local y el localStorage
  const handleSelectCategory = (category: typeof selectedCategory) => {
    setSelectedCategory(category);
    setPreferredCategory(category);
  };

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

        {/* Aquí insertamos tu filtro visual conectándolo al cerebro */}
        <div className="mb-10">
          <CategoryFilter
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
        </div>

        {/* Aquí conectamos los componentes diseñados por FAu con TUS arrays ya procesados */}
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
