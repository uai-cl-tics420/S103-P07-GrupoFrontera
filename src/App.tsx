import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APITester } from "./APITester";
import "./index.css";
import logo from "./logo.svg";
import reactLogo from "./react.svg";

// 1. IMPORTAMOS NUESTRAS 3 PIEZAS CREADAS:
import { CategoryFilter } from "@/components/CategoryFilter";
import { useCategoryFilter } from "@/hooks/useCategoryFilter";
import { MOCK_ACTIVITIES } from "@/mockActivities";

export function App() {
  // 2. INICIAMOS EL CEREBRO pasándole la lista entera de Fau.
  // Nos devuelve qué categoría seleccionó el usuario y la lista ya cortada.
  const { selectedCategory, setSelectedCategory, filteredActivities } = useCategoryFilter(MOCK_ACTIVITIES);

  return (
    <div className="container mx-auto p-8 text-center relative z-10 max-w-4xl">
      <div className="flex justify-center items-center gap-8 mb-8">
        <img src={logo} alt="Bun Logo" className="h-16 transition-all drop-shadow-[0_0_2em_#646cffaa]" />
        <img src={reactLogo} alt="React Logo" className="h-16 transition-all drop-shadow-[0_0_2em_#61dafbaa] [animation:spin_20s_linear_infinite]" />
      </div>

      <Card className="text-left border-primary/20 shadow-lg">
        <CardHeader className="gap-2">
          <CardTitle className="text-3xl font-bold flex items-center justify-between">
            <span>Explorar Panoramas</span>
            <span className="text-sm font-normal text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {filteredActivities.length} resultados
            </span>
          </CardTitle>
          <CardDescription>
            ¡Prueba nuestra nueva barra de filtros del Issue #14!
          </CardDescription>

          {/* 3. COLOCAMOS EL DISEÑO VISUAL AQUÍ y le pasamos los datos del cerebro */}
          <div className="mt-4 border-b border-border/50 pb-2">
            <CategoryFilter
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* 4. DIBUJAMOS LOS PANORAMAS: Si la lista cortada viene vacía, mostramos que no hay nada */}
            {filteredActivities.length === 0 ? (
              <p className="text-muted-foreground col-span-2 text-center py-8">
                No hay actividades publicadas para esta categoría todavía.
              </p>
            ) : (
              // Si sí hay, mapeamos las tarjetas de actividades
              filteredActivities.map((act) => (
                <div key={act.id} className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-colors">
                  <h3 className="font-semibold text-lg">{act.name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {act.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Dependencia del Clima: ({act.tagClima})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-12 pt-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground mb-4 text-center">Para verificar que la API de base (APITester) sigue viva y no la rompimos:</p>
            <APITester />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
