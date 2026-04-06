import { useState, useMemo } from 'react';
import { type Activity, Category } from '../types';

export function useCategoryFilter(activities: Activity[]) {
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

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
