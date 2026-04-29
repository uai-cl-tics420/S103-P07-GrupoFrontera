import { useState, useMemo } from 'react';
import { type Activity, Category } from '../types';

/**
 * Función pura que filtra actividades por categoría.
 * Extraída del hook para poder testearse sin React.
 */
export function filterActivitiesByCategory(
    activities: Activity[],
    category: Category | null
): Activity[] {
    if (!category) return activities;
    return activities.filter(act => act.category === category);
}

/**
 * Hook que filtra actividades por categoría.
 * Acepta una categoría inicial (viene de localStorage via useUserPreferences).
 */
export function useCategoryFilter(activities: Activity[], initialCategory: Category | null = null) {
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(initialCategory);

    const filteredActivities = useMemo(
        () => filterActivitiesByCategory(activities, selectedCategory),
        [activities, selectedCategory]
    );

    return {
        selectedCategory,
        setSelectedCategory,
        filteredActivities
    };
}
