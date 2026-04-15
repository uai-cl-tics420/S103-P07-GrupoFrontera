import { type Activity, type User } from './types/index';

export const getRecommendedActivities = (user: User, activities: Activity[]): Activity[] => {
    return [...activities].sort((a, b) => {
        const aEsFavorito = user.preferences.includes(a.category);
        const bEsFavorito = user.preferences.includes(b.category);

        if (aEsFavorito && !bEsFavorito) return -1;
        if (!aEsFavorito && bEsFavorito) return 1;
        return 0;
    });
};

