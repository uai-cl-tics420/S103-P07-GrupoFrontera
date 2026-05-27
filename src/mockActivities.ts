import { type Activity, Category } from './types/index';

export const MOCK_ACTIVITIES: Activity[] = [
    {
        id: 'act-01',
        name: 'Cine Hoyts La Reina',
        category: Category.CINE,
        tagClima: 'Any',
        coordinates: { lat: -33.45, lng: -70.66 },
        openingHour: '10:00',
        closingHour: '23:30'
    },
    {
        id: 'act-02',
        name: 'Parque Araucano',
        category: Category.PARQUE,
        tagClima: 'Sunny',
        coordinates: { lat: -33.40, lng: -70.57 },
        openingHour: '06:00',
        closingHour: '21:00'
    },
    {
        id: 'act-03',
        name: 'Teatro Municipal de Santiago',
        category: Category.TEATRO,
        tagClima: 'Any',
        coordinates: { lat: -33.44, lng: -70.64 },
        openingHour: '18:00',
        closingHour: '23:00'
    },
    {
        id: 'act-04',
        name: 'Museo Nacional de Bellas Artes',
        category: Category.MUSEO,
        tagClima: 'Any',
        coordinates: { lat: -33.43, lng: -70.64 },
        openingHour: '10:00',
        closingHour: '18:30'
    },
    {
        id: 'act-05',
        name: 'Parque Bicentenario Vitacura',
        category: Category.PARQUE,
        tagClima: 'Sunny',
        coordinates: { lat: -33.39, lng: -70.59 },
        openingHour: '06:00',
        closingHour: '22:00'
    },
    {
        id: 'act-06',
        name: 'Bocanáriz',
        category: Category.RESTAURANTE,
        tagClima: 'Any',
        coordinates: { lat: -33.43, lng: -70.64 },
        openingHour: '12:30',
        closingHour: '00:00'
    },
    {
        id: 'act-07',
        name: 'Liguria Lastarria',
        category: Category.RESTAURANTE,
        tagClima: 'Any',
        coordinates: { lat: -33.43, lng: -70.64 },
        openingHour: '12:00',
        closingHour: '01:00'
    }
];