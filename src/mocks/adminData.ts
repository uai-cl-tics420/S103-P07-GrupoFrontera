/**
 * Mock data para el dashboard de admin.
 * Mientras Persona 1 y Persona 2 terminan el backend de admin,
 * la UI usa estos datos para que la presentación se vea poblada.
 */

import { Category } from '@/types';

export interface MockUser {
    id: string;
    email: string;
    role: 'admin' | 'user';
    status: 'active' | 'pending';
    joinedAt: string; // ISO date
}

export const MOCK_STATS = {
    totalUsers: 24,
    totalActivities: 6,
    otpsSentToday: 12,
    topCategory: Category.PARQUE,
};

export const MOCK_RECENT_USERS: MockUser[] = [
    { id: '1', email: 'maria.gonzalez@uai.cl', role: 'user', status: 'active', joinedAt: '2026-05-18' },
    { id: '2', email: 'admin@panoramas.cl', role: 'admin', status: 'active', joinedAt: '2026-05-17' },
    { id: '3', email: 'jorge.silva@uai.cl', role: 'user', status: 'pending', joinedAt: '2026-05-17' },
    { id: '4', email: 'sofia.rojas@uai.cl', role: 'user', status: 'active', joinedAt: '2026-05-16' },
    { id: '5', email: 'pedro.diaz@uai.cl', role: 'user', status: 'active', joinedAt: '2026-05-16' },
    { id: '6', email: 'lucia.fernandez@uai.cl', role: 'user', status: 'pending', joinedAt: '2026-05-15' },
];

export const MOCK_ACTIVITIES_BY_CATEGORY: Array<{ category: Category; count: number }> = [
    { category: Category.PARQUE, count: 8 },
    { category: Category.CINE, count: 6 },
    { category: Category.RESTAURANTE, count: 5 },
    { category: Category.MUSEO, count: 4 },
    { category: Category.TEATRO, count: 3 },
];
