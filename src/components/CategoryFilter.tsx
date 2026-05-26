import { Button } from "./ui/button";
import { Category } from "../types";
import { Tent, Clapperboard, Drama, Landmark, Grid2X2, Utensils, Mountain } from "lucide-react";
import { useT } from "@/i18n/context";
import type { TranslationKey } from "@/i18n/translations";

interface CategoryFilterProps {
    selectedCategory: Category | null;
    onSelectCategory: (category: Category | null) => void;
}

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
    const { t } = useT();

    // Cada categoría con su valor, clave de traducción y ícono
    const categories: Array<{ value: Category | null; key: TranslationKey; icon: typeof Grid2X2 }> = [
        { value: null, key: 'categoryAll', icon: Grid2X2 },
        { value: Category.CINE, key: 'categoryCine', icon: Clapperboard },
        { value: Category.PARQUE, key: 'categoryParque', icon: Tent },
        { value: Category.TEATRO, key: 'categoryTeatro', icon: Drama },
        { value: Category.MUSEO, key: 'categoryMuseo', icon: Landmark },
        { value: Category.RESTAURANTE, key: 'categoryRestaurante', icon: Utensils },
        { value: Category.MIRADORES, key: 'categoryMiradores', icon: Mountain },
    ];

    return (
        <div className="flex w-full items-center gap-3 overflow-x-auto pb-4 pt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {categories.map((cat) => {
                const isActive = selectedCategory === cat.value;
                const Icon = cat.icon;
                const label = t(cat.key);

                return (
                    <Button
                        key={cat.key}
                        variant={isActive ? "default" : "secondary"}
                        className={`rounded-full px-5 transition-all duration-300 font-medium whitespace-nowrap ${isActive
                            ? 'shadow-lg shadow-primary/20 scale-105'
                            : 'hover:scale-105 opacity-80 hover:bg-secondary/80'
                            }`}
                        onClick={() => onSelectCategory(cat.value)}
                    >
                        <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                        {label}
                    </Button>
                );
            })}
        </div>
    );
}
