import { Button } from "@/components/ui/button";
import { Category } from "@/types";
import { Tent, Clapperboard, Drama, Landmark, Grid2X2 } from "lucide-react";

// 1. "Props": Qué le debemos pasar al componente para que funcione
interface CategoryFilterProps {
    selectedCategory: Category | null;
    onSelectCategory: (category: Category | null) => void;
}

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
    // 2. Un arreglo con cada botón, su valor interno, y el ícono que queremos mostrar
    const categories = [
        { value: null, label: 'Todas', icon: Grid2X2 },
        { value: Category.CINE, label: Category.CINE, icon: Clapperboard },
        { value: Category.PARQUE, label: Category.PARQUE, icon: Tent },
        { value: Category.TEATRO, label: Category.TEATRO, icon: Drama },
        { value: Category.MUSEO, label: Category.MUSEO, icon: Landmark },
    ];

    return (
        // 3. El contenedor flexbox. Las clases feas del final son para ocultar la barra de scroll nativa del navegador.
        <div className="flex w-full items-center gap-3 overflow-x-auto pb-4 pt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {categories.map((cat) => {
                // ¿Este botón en el que estamos recorriendo es el "activo"?
                const isActive = selectedCategory === cat.value;
                const Icon = cat.icon;

                return (
                    <Button
                        key={cat.label}
                        variant={isActive ? "default" : "secondary"}
                        className={`rounded-full px-5 transition-all duration-300 font-medium ${isActive
                                ? 'shadow-lg shadow-primary/20 scale-105'
                                : 'hover:scale-105 opacity-80 hover:bg-secondary/80'
                            }`}
                        onClick={() => onSelectCategory(cat.value)}
                    >
                        <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                        {cat.label}
                    </Button>
                );
            })}
        </div>
    );
}
