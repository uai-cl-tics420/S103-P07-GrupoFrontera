export function isOutdoorFriendly(weatherCondition: string | null | undefined): boolean {
    if (!weatherCondition) return false; //si viene vacío/nulo/indef. fallback seguro a false

    const cleanCondition = weatherCondition.trim().toLowerCase(); //limpiamos espacios y estandarizamos a minúsculas

    const outdoorFriendlyConditions = new Set(["clear", "clouds"]); //búsqueda para condiciones óptimas

    return outdoorFriendlyConditions.has(cleanCondition); //evaluamos si la condición limpia pertenece a las aprobadas
}