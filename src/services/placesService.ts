import { type Activity, Category } from '../types';

/**
 * Simula el nivel de ocupación dependiendo de la hora actual.
 */
export function getSimulatedOccupancy(): "Low" | "Medium" | "High" {
  const currentHour = new Date().getHours();
  const rand = Math.random();
  
  if (currentHour >= 18 && currentHour <= 22) {
    return rand > 0.3 ? "High" : "Medium"; 
  } else if (currentHour >= 12 && currentHour <= 17) {
    return rand > 0.4 ? "Medium" : "Low";
  } else {
    return rand > 0.8 ? "Medium" : "Low";
  }
}

interface PlacesOptions {
  filterCategory?: string;
  radius?: number;
  exactPrice?: number;
  openNow?: boolean;
}

/**
 * Consulta la API de Google Places, crea las tarjetas para los lugares reales
 * y las fusiona con tus lugares de la Base de Datos.
 */
export async function enrichWithPlacesAPI(activities: Activity[], lat: number, lng: number, options: PlacesOptions = {}): Promise<Activity[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  // Enriquecemos los lugares de tu base de datos local
  const enrichedLocal = activities.map(act => ({
    ...act,
    occupancy: getSimulatedOccupancy()
  }));

  // Si no hay llave aún, retornamos solo la base de datos
  if (!apiKey) {
    console.log("Aviso: No hay GOOGLE_PLACES_API_KEY. Usando solo la BD local.");
    return enrichedLocal;
  }

  try {
    // Mapeo múltiple para burlar el límite de 20 de Google y conseguir más lugares por categoría
    let typesToFetch = [
      { gType: 'movie_theater', cat: Category.CINE, keyword: '' },
      { gType: 'movie_theater', cat: Category.CINE, keyword: 'cinemark' }, 
      { gType: 'movie_theater', cat: Category.CINE, keyword: 'cinepolis' }, 
      { gType: 'park', cat: Category.PARQUE, keyword: '' },
      { gType: 'park', cat: Category.PARQUE, keyword: 'parque' },
      { gType: 'restaurant', cat: Category.RESTAURANTE, keyword: '' },
      { gType: 'restaurant', cat: Category.RESTAURANTE, keyword: 'restobar' },
      { gType: 'museum', cat: Category.MUSEO, keyword: '' },
      // Omitimos el tipo estricto en estos y usamos solo palabras clave para que encuentre lugares icónicos exactos
      { gType: '', cat: Category.MIRADORES, keyword: 'mirador' },
      { gType: '', cat: Category.MIRADORES, keyword: 'cerro san cristobal' },
      { gType: '', cat: Category.MIRADORES, keyword: 'cerro carbon' },
      { gType: '', cat: Category.MIRADORES, keyword: 'sky costanera' },
      { gType: '', cat: Category.TEATRO, keyword: 'teatro' }
    ];

    // Si el usuario pidió una categoría específica, SOLO consultamos esa para ahorrar llamadas a la API
    if (options.filterCategory && options.filterCategory !== 'Todas') {
      typesToFetch = typesToFetch.filter(t => t.cat === options.filterCategory);
    } else {
      // Si estamos en la categoría general "Todas", consultamos exactamente una búsqueda principal
      // por categoría para mostrar un mix representativo sin saturar la cuota de la API (solo 6 llamadas en paralelo).
      typesToFetch = [
        { gType: 'movie_theater', cat: Category.CINE, keyword: '' },
        { gType: 'park', cat: Category.PARQUE, keyword: '' },
        { gType: 'restaurant', cat: Category.RESTAURANTE, keyword: '' },
        { gType: 'museum', cat: Category.MUSEO, keyword: '' },
        { gType: '', cat: Category.MIRADORES, keyword: 'mirador' },
        { gType: '', cat: Category.TEATRO, keyword: 'teatro' }
      ];
    }

    console.log("Consultando Google Places API en vivo con radio ciudad completo y peticiones múltiples...");
    
    // Hacemos las peticiones a Google en paralelo para mayor velocidad
    const fetchPromises = typesToFetch.map(async ({ gType, cat, keyword }) => {
      const searchRadius = options.radius || 50000;
      let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${searchRadius}&key=${apiKey}`;
      
      if (gType) url += `&type=${gType}`;
      if (keyword) {
        url += `&keyword=${keyword}`;
      }
      // Solo enviamos minprice y maxprice a la API de Google si la categoría es Restaurante.
      // Para las demás categorías, Google no tiene registradas etiquetas de precio, y si
      // filtramos a nivel de URL, Google nos devolverá 0 resultados.
      if (options.exactPrice !== undefined && cat === Category.RESTAURANTE) {
        url += `&minprice=${options.exactPrice}&maxprice=${options.exactPrice}`;
      }
      if (options.openNow) {
        url += `&opennow=true`;
      }
      const res = await fetch(url);
      const data = await res.json();
      
      if (!data.results) return [];

      // Filtros rigurosos de calidad y categorías erróneas
      const validPlaces = data.results.filter((p: any) => {
        // Ajustamos el nivel de exigencia según la categoría para equilibrar los resultados
        let minReviews = 50;
        if (cat === Category.PARQUE) minReviews = 300;
        
        if (!p.user_ratings_total || p.user_ratings_total < minReviews) return false;

        // Descartar lugares que Google etiqueta mal (tiendas, hoteles, cementerios)
        // Además, si NO estamos buscando un Restaurante, descartamos cualquier lugar que sea comida o bar,
        // evitando que aparezcan restaurantes (ej. "Tip y Tap" o "Restaurant el Mirador") en categorías como Miradores.
        const badTypes = ['electronics_store', 'home_goods_store', 'store', 'lodging', 'cemetery'];
        if (cat !== Category.RESTAURANTE) {
          badTypes.push('restaurant', 'food', 'cafe', 'bar', 'meal_takeaway');
        }
        if (p.types && p.types.some((t: string) => badTypes.includes(t))) return false;

        // Excluir parques de perros (dog parks) y plazas locales pequeñas (plazas) de la categoría Parques,
        // ya que no son acordes para un panorama de paseo/recreación familiar principal
        if (cat === Category.PARQUE) {
          const lowerName = p.name.toLowerCase();
          const dogParkKeywords = ["canino", "canina", "dog park", "mascota", "perro", "plaza canina", "zona canina"];
          if (dogParkKeywords.some(keyword => lowerName.includes(keyword))) return false;
          
          // Excluir plazas de barrio pequeñas, permitiendo únicamente la Plaza de Armas por su relevancia histórica
          if (lowerName.includes("plaza") && !lowerName.includes("plaza de armas")) return false;
        }

        // Filtro estricto de PRECIO manual (porque la API nativa de Google deja pasar lugares sin etiqueta)
        if (options.exactPrice !== undefined) {
          if (p.price_level !== undefined) {
            // Google a veces devuelve cosas fuera de rango pese al &minprice &maxprice
            if (p.price_level !== options.exactPrice) return false;
          } else {
            // Si Google NO sabe el precio, aplicamos reglas de sentido común según la categoría
            if (options.exactPrice === 0) {
              // Restaurantes, cines y teatros comerciales NUNCA son gratis
              if (cat === Category.RESTAURANTE || cat === Category.CINE || cat === Category.TEATRO) return false;
              // Mirador comercial de pago (Sky Costanera) no es gratis
              if (cat === Category.MIRADORES && p.name.toLowerCase().includes("sky costanera")) return false;
              // Museos de pago conocidos no son gratis (bilingüe)
              const paidMuseums = [
                "precolombino", "pre-columbian", "precolombian",
                "interactivo mirador", "interactive museum",
                "chascona", "taller", "de cera", "wax museum",
                "merced", "cousiño", "cousino", "artequin",
                "casa colorada", "colorada", "mui"
              ];
              if (cat === Category.MUSEO && paidMuseums.some(m => p.name.toLowerCase().includes(m))) return false;
            } else if (options.exactPrice > 0) {
              // Parques públicos normales no son pagados
              if (cat === Category.PARQUE) return false;
              // Cerros públicos y miradores naturales no son de pago
              if (cat === Category.MIRADORES && !p.name.toLowerCase().includes("sky costanera")) return false;
              // Museos nacionales públicos y gratuitos de Santiago no se muestran si pides "De pago" (bilingüe)
              const freeMuseums = [
                "bellas artes", "fine arts", 
                "nacional de bellas artes",
                "arte contemporáneo", "contemporary art",
                "histórico nacional", "national history of chile", "museo histórico",
                "memoria", "memory", "human rights",
                "militar", "military", "natural history",
                "gabriela mistral", "cultural centre", "cultural center",
                "popular", "folk art",
                "lo matta", "matta cultural"
              ];
              if (cat === Category.MUSEO && options.exactPrice >= 1 && freeMuseums.some(m => p.name.toLowerCase().includes(m))) return false;
            }
          }
        }

        // Filtros estrictos para Restaurantes (comida rápida y calidad)
        if (cat === Category.RESTAURANTE) {
          // Exigimos nota sobre 4.5 para asegurar alta calidad
          if (!p.rating || p.rating < 4.5) return false;

          const fastFoodBrands = ['mcdonald', 'burger king', 'kfc', 'wendy', 'taco bell', 'dogis', 'pizza hut', 'papa john', 'subway', 'little caesars', 'domino'];
          const lowerName = p.name.toLowerCase();
          if (fastFoodBrands.some(brand => lowerName.includes(brand))) return false;
        }

        return true;
      });

      return validPlaces.map((place: any) => {
        // Parques al aire libre son Sunny, el resto All (sirve en cualquier clima)
        const tagClima = cat === Category.PARQUE ? 'Sunny' : 'All';
        
        let imageUrl = undefined;
        if (place.photos && place.photos.length > 0) {
          const photoRef = place.photos[0].photo_reference;
          // Codificamos la referencia por si acaso, para evitar imágenes rotas
          imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
        }
        
        // Simulador de horarios lógicos por categoría para llenar el vacío de la API gratuita
        let openH = "09:00", closeH = "21:00";
        if (cat === Category.CINE) { openH = "11:00"; closeH = "23:00"; }
        if (cat === Category.PARQUE) { openH = "08:00"; closeH = "20:00"; }
        if (cat === Category.RESTAURANTE) { openH = "12:30"; closeH = "01:00"; }
        if (cat === Category.MUSEO) { openH = "10:00"; closeH = "18:00"; }
        if (cat === Category.TEATRO) { openH = "18:00"; closeH = "23:30"; }
        if (cat === Category.MIRADORES) { openH = "09:00"; closeH = "20:00"; }
        
        return {
          id: place.place_id, // Usamos el ID real de Google
          name: place.name,
          category: cat,
          tagClima: tagClima,
          coordinates: { lat: place.geometry.location.lat, lng: place.geometry.location.lng },
          occupancy: getSimulatedOccupancy(),
          vicinity: place.vicinity,
          imageUrl: imageUrl,
          openingHour: openH,
          closingHour: closeH
        } as Activity;
      });
    });

    const googleResults = await Promise.all(fetchPromises);
    const googleActivities = googleResults.flat();

    // EXCLUIMOS LOS MOCKS: Ahora solo mostramos lugares reales obtenidos desde Google
    const allActivities = [...googleActivities];
    
    // Filtramos para evitar duplicados por nombre
    const uniqueActivities = Array.from(new Map(allActivities.map(item => [item.name, item])).values());

    return uniqueActivities;
  } catch (error) {
    console.error("Error consultando Google Places:", error);
    return enrichedLocal;
  }
}
