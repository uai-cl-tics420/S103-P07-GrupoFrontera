import { useState, useMemo } from 'react';
import { type Activity, Category } from '../types';

/**
 * Hook que filtra actividades por categoría.
 * Acepta una categoría inicial (viene de localStorage via useUserPreferences).
 */
export function useCategoryFilter(activities: Activity[], initialCategory: Category | null = null) {
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(initialCategory);

    const filteredActivities = useMemo(() => {
        if (!selectedCategory) return activities;
        return activities.filter(act => act.category === selectedCategory);
    }, [activities, selectedCategory]);

    return {
        selectedCategory,
        setSelectedCategory,
        filteredActivities
    };
}
