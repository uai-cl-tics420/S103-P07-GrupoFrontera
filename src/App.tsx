import ActivityCard from './components/ActivityCard'; 
import { MOCK_ACTIVITIES } from './mockActivities';

function App() {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {MOCK_ACTIVITIES.map((act) => (
            <ActivityCard key={act.id} activity={act} />
          ))}
        </div>
      </main>
      
      <footer className="mt-20 text-center opacity-20 font-black text-[10px] tracking-[0.5em] uppercase">
        Grupo Frontera • 2026
      </footer>
    </div>
  );
}

export default App;