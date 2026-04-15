import React from 'react';
import LoginForm from './components/auth/LoginForm';
import OTPVerify from './components/auth/OTPVerify';
import ActivityCard from './components/ActivityCard';
import { MOCK_ACTIVITIES } from './mockActivities';
import './index.css';
import { CategoryFilter } from "./components/CategoryFilter";
import { useCategoryFilter } from "./hooks/useCategoryFilter";
import { useUserPreferences } from "./hooks/useUserPreferences";
import { authClient } from "./lib/auth-client";

export function App() {
  //Lógica de sesión con betterauth
  const { data: session, isPending } = authClient.useSession();

  // Leemos la preferencia guardada (si existe)
  const { preferredCategory, setPreferredCategory } = useUserPreferences();

  // Le pasamos la preferencia como categoría inicial al filtro
  const { selectedCategory, setSelectedCategory, filteredActivities } = useCategoryFilter(MOCK_ACTIVITIES, preferredCategory);

  // Cuando el usuario cambia el filtro, actualizamos ambos: el estado local y el localStorage
  const handleSelectCategory = (category: typeof selectedCategory) => {
    setSelectedCategory(category);
    setPreferredCategory(category);
  };

  //Renderizado condicional
  //a) mientras verifica si hay sesión
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <p className="font-black italic text-gray-400 animate-pulse">Cargando...</p>
      </div>
    );
  }

  //b) Pantalla de Login (si no hay nadie logueado)
  if (!session) {
    return <LoginForm />;
  }

  //c) pantalla de verificación OTP (si hay sesión pero no está verificado)
  if (session.user && !(session.user as any).otpVerified) {
    return (
      <OTPVerify
        userId={session.user.id}
        onVerified={() => window.location.reload()}
      />
    );
  }


  //App principal (dashboard panoramas)
  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pb-20">
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 p-6 mb-12">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 italic">
            PANORAMAS
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
              {session.user.email}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 border-2 border-white shadow-md"></div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-8">

        {/* Aquí insertamos tu filtro visual conectándolo al cerebro */}
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
