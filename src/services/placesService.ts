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

/**
 * Consulta la API de Google Places, crea las tarjetas para los lugares reales
 * y las fusiona con tus lugares de la Base de Datos.
 */
export async function enrichWithPlacesAPI(activities: Activity[], lat: number, lng: number): Promise<Activity[]> {
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
    const typesToFetch = [
      { gType: 'movie_theater', cat: Category.CINE, keyword: '' },
      { gType: 'movie_theater', cat: Category.CINE, keyword: 'cinemark' }, 
      { gType: 'movie_theater', cat: Category.CINE, keyword: 'cinepolis' }, 
      { gType: 'park', cat: Category.PARQUE, keyword: '' },
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

    console.log("Consultando Google Places API en vivo con radio ciudad completo y peticiones múltiples...");
    
    // Hacemos las peticiones a Google en paralelo para mayor velocidad
    const fetchPromises = typesToFetch.map(async ({ gType, cat, keyword }) => {
      // Busca lugares en un radio de 50km (50000m) para abarcar toda la región
      let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=50000&key=${apiKey}`;
      if (gType) url += `&type=${gType}`;
      if (keyword) {
        url += `&keyword=${keyword}`;
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
        const badTypes = ['electronics_store', 'home_goods_store', 'store', 'lodging', 'cemetery'];
        if (p.types && p.types.some((t: string) => badTypes.includes(t))) return false;

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
