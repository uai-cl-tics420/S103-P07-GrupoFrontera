/**
* Definición de categorías (enums)
* Esto limita las opciones a solo las permitidas por el sistema.
*/

export enum Category {
  CINE = 'Cine',
  TEATRO = 'Teatro',
  PARQUE = 'Parque',
  MUSEO = 'Museo',
  RESTAURANTE = 'Restaurante',
  MIRADORES = 'Miradores'
}

/**
* Interfaz del usuario
* Define la estructura de los datos de quien usa la app.
*/
export interface User {
  id: string; // ID único
  name: string; // Nombre del usuario
  preferences: Category[]; // Lista de gustos o preferencias
  currentLocation: { // Ubicación actual
    lat: number;
    lng: number;
  };
  history?: {
    favorites: string[]; // IDs de actividades favoritas
    reservations: string[]; // IDs de actividades reservadas
  };
}

/**
* Interfaz de actividad
* Define qué datos tiene cada panorama recomendado.
*/
export interface Activity {
  id: string // Agregué esta línea!!
  name: string; // Nombre de la actividad
  category: Category; // Categoría (Cine, Parque, etc.)
  tagClima: string; // Indica qué clima le favorece
  coordinates: { // Coordenadas para Google Maps
    lat: number;
    lng: number;
  };
  openingHour?: string; // Formato "HH:MM"
  closingHour?: string; // Formato "HH:MM"
  occupancy?: "Low" | "Medium" | "High";
  vicinity?: string;
  imageUrl?: string;
  description?: string;
  price?: number;
  schedules?: { fecha: string; horaInicio: string | null; horaFin: string | null }[];
}

