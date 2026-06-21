import type { BaseTranslation } from '../i18n-types'

const es = {
	// Common
	loading: 'Cargando...',
	loadingPanoramas: 'Cargando panoramas…',
	errorPrefix: 'Error',
	serverError: 'Error de conexión con el servidor',

	// Auth - tabs / buttons
	signIn: 'Iniciar Sesión',
	register: 'Registrarse',
	createAccount: 'Crear Cuenta',
	continueWithGoogle: 'Continuar con Google',
	or: 'o',
	secureAuth: 'Autenticación Segura (SSO + OTP)',

	// Auth - form labels / placeholders
	name: 'Nombre',
	email: 'Email',
	password: 'Contraseña',

	// Auth - errors
	loginGoogleFailed: 'Hubo un problema al conectar con Google.',
	badCredentials: 'Credenciales incorrectas',
	createAccountError: 'Error al crear la cuenta',

	// Password requirements
	pwdMin8: 'Mínimo 8 caracteres',
	pwdUppercase: 'Al menos 1 mayúscula',
	pwdNumber: 'Al menos 1 número',
	pwdSpecial: 'Al menos 1 carácter especial',

	// OTP
	otpTitle: 'Verificación de Seguridad',
	otpInstructions: 'Ingresa el código de 6 dígitos para confirmar tu identidad.',
	otpVerify: 'Verificar Código',
	otpVerifying: 'Verificando...',
	otpInvalid: 'Código incorrecto o expirado',
	otpBackToLogin: 'Volver al inicio de sesión',

	// Home
	logout: 'Cerrar sesión',
	panoramaFound: 'Panorama encontrado',
	panoramasFound: 'Panoramas encontrados',
	emptyState: 'No hay actividades publicadas para esta categoría todavía.',
	filters: 'Filtros',

	// Card
	seeDetails: 'Ver detalles',
	weatherSunny: '☀️ SOLEADO',
	weatherAll: '✨ TODO CLIMA',

	// Categories
	categoryAll: 'Todas',
	categoryCine: 'Cine',
	categoryTeatro: 'Teatro',
	categoryParque: 'Parque',
	categoryMuseo: 'Museo',
	categoryRestaurante: 'Restaurante',
	categoryMiradores: 'Miradores',

	// Admin Dashboard
	adminPanel: 'Panel de Administrador',
	adminGoBack: '← Volver al inicio',
	adminBadge: 'ADMIN',
	adminAccessLink: 'Admin',
	statTotalUsers: 'Usuarios totales',
	statTotalActivities: 'Actividades publicadas',
	statOtpsSent: 'OTPs enviados hoy',
	statTopCategory: 'Categoría líder',
	sectionRecentUsers: 'Usuarios recientes',
	recentAdmins: 'Admins recientes',
	recentStandardUsers: 'Usuarios recientes',
	sectionActivityByCategory: 'Actividades por categoría',
	tableEmail: 'Email',
	tableRole: 'Rol',
	tableJoined: 'Registro',
	tableStatus: 'Estado',
	roleAdmin: 'Admin',
	roleUser: 'Usuario',
	statusActive: 'Verificado',
	statusPending: 'Pendiente',
	roleUpdateError: 'Error al actualizar el rol en la base de datos.',
	calculatingTrend: 'Calculando tendencias...',

	// Reservas (issues #25, #26, #28)
	seeDetailsCta: 'Reservar',
	reservationModalTitle: 'Confirmar reserva',
	reservationModalDescription: 'Vas a reservar este panorama. El pago se procesa al instante.',
	reservationConfirmPay: 'Confirmar y pagar',
	reservationProcessing: 'Procesando pago…',
	reservationSuccess: '¡Reserva confirmada!',
	reservationSuccessHint: 'Podés verla en Mis Reservas.',
	reservationFailed: 'No pudimos procesar tu pago.',
	reservationCancel: 'Cancelar',
	reservationClose: 'Cerrar',
	transactionLabel: 'ID Transacción',

	// Vista de Mis Reservas (issue #26)
	myReservationsLink: 'Mis Reservas',
	myReservationsTitle: 'Mis Reservas',
	myReservationsEmpty: 'Todavía no tenés reservas. Buscá un panorama y reservá.',
	myReservationsLoading: 'Cargando reservas…',
	reservationStatusComprado: 'Comprado',
	reservationStatusCancelado: 'Cancelado',
	reservationStatusPendiente: 'Pendiente',
	reservationDate: 'Fecha de reserva',
	reservationCancelAction: 'Cancelar reserva',
	reservationCancelConfirm: '¿Seguro que querés cancelar esta reserva?',

	// Refactor flujo reserva (v2)
	viewEventCta: 'Ver evento',
	reserveOnlyCta: 'Reservar',
	payNowCta: 'Pagar ahora',
	payButton: 'Pagar',
	rebookCta: 'Reservar de nuevo',
	reservationCreatedPending: '¡Reserva creada! Pendiente de pago.',
	reservationCreatedPaid: '¡Reserva confirmada y pagada!',
	detailsModalTitle: 'Detalle del evento',
	detailsCategoryLabel: 'Categoría',
	detailsWeatherLabel: 'Clima recomendado',
	detailsHoursLabel: 'Horario',
	detailsCoordsLabel: 'Ubicación',
	reservationStatusPagado: 'Pagado',
	cardStatusPending: 'Reservado (pendiente de pago)',
	cardStatusPaid: 'Comprado',

	// Card: badges, ocupacion, precio (nueva-logica-panoramas)
	badgePopular: 'Popular',
	badgeTendencia: 'Tendencia',
	openHours: 'Abierto: {open} - {close}',
	occupancyLabel: 'Afluencia: {level}',
	occupancyHigh: 'Alta',
	occupancyMedium: 'Media',
	occupancyLow: 'Baja',
	priceLabel: 'Precio base',
	free: 'Gratis',

	// ActivityDetailModal
	availabilityLoadError: 'No se pudo cargar la disponibilidad.',
	weatherSuggestedLabel: 'Clima Sugerido',
	weatherIdealOutdoor: 'Ideal Exterior',
	weatherAllWeatherFit: 'Apto Todo Clima',
	scheduleLabel: 'Horario',
	serviceFeeNote: '+ costo de servicio al pagar',
	drivingDistanceLabel: 'Distancia en auto',
	straightDistanceLabel: 'Distancia aproximada',
	byRoad: 'por carretera',
	straightLine: 'en línea recta',
	addressLabel: 'Dirección',
	placeMapLabel: 'Mapa del Lugar',
	noLocation: 'Sin ubicación',
	chooseDateTime: 'Elige fecha y horario',
	loadingAvailability: 'Cargando disponibilidad...',
	noDatesAvailable: 'Este panorama no tiene fechas cargadas todavía.',
	slotsFree: 'cupos libres',
	soldOut: 'agotado',
	slotsCount: '{n} cupos',
	checkDateTime: 'Consultar fecha y hora',
	payRightNowCta: 'Pagar al tiro',
	backToDetailCta: 'Volver al detalle',
	doneCta: 'Listo',
	reservationFailedGeneric: 'No se pudo reservar',
	paymentDoneConfirmed: '¡Pago realizado! Reserva confirmada y cupo descontado.',
	reservationPendingSpotTaken: 'Reserva creada (pendiente de pago). Cupo descontado.',
	reservationErrorGeneric: 'Error al reservar',

	// App.tsx: banner de recomendacion asistida
	recommendBannerTitle: '🧠 ¿Quieres recomendaciones personalizadas de panoramas?',
	recommendBannerText: 'Encuentra las mejores opciones según el clima y horarios de hoy o de cualquier fecha que elijas.',
	recommendBannerCta: '✨ Recomendar Panoramas',

	// App.tsx: banner de planificacion activa
	planningActiveTodayTitle: '📅 Recomendación para Hoy Activa',
	planningActiveFutureTitle: '📅 Recomendación Planificada Activa',
	planningTodayIntro: 'Mostrando panoramas ideales para',
	today: 'hoy',
	inRealTime: 'en tiempo real.',
	weatherDetectedBy: 'Clima detectado por API:',
	planningFutureIntro: 'Mostrando panoramas para el día',
	atTime: 'a las',
	anyTimeText: 'a cualquier hora',
	weatherEstimatedBy: 'Clima estimado por API:',
	weatherClear: '☀️ Despejado',
	weatherCloudy: '☁️ Nublado',
	weatherRainy: '🌧️ Lluvioso',
	backToRealTimeCta: '🔄 Volver al Tiempo Real',

	// App.tsx: toolbar de filtros
	filterRadiusAll: 'Toda la región',
	filterRadius10: 'A menos de 10km',
	filterRadius5: 'A menos de 5km',
	filterRadius2: 'A menos de 2km',
	filterAnyPrice: 'Cualquier precio',
	filterPriceCheap: 'Económico ($)',
	filterPriceModerate: 'Moderado ($$)',
	filterPriceExpensive: 'Costoso ($$$)',
	filterPriceVeryExpensive: 'Muy Costoso ($$$$)',
	filterFreePrice: 'Gratis ($0)',
	filterPaidPrice: 'De pago',
	filterOpenNow: 'Solo Abiertos Ahora',
	searching: 'Buscando...',
	applyFilters: 'Aplicar Filtros',

	// App.tsx: toasts
	toastWeatherError: 'No se pudo conectar con el servicio meteorológico.',
	toastFavRemoved: 'Eliminado de tus favoritos.',
	toastFavAdded: '¡Panorama guardado en tus favoritos!',
	toastPrefsSaved: 'Preferencias guardadas: Mostrando {category}.',
	toastSignoutSuccess: 'Sesión cerrada correctamente. ¡Vuelve pronto!',
	toastSignoutError: 'Hubo un problema al cerrar tu sesión.',
	toastReservationSuccess: '¡Reserva completada con éxito!',

	// App.tsx: modal de planificacion
	planningModalKicker: 'Intelligent Assistant',
	planningModalTitle: 'Recomendar Panoramas',
	planningModalDescription: 'Indica cuándo realizarás la actividad para que el sistema calcule las mejores opciones de forma automática.',
	whenQuestion: '¿Cuándo quieres realizar la actividad?',
	todayOptionCta: 'Hoy ☀️',
	otherDayOptionCta: 'Otro día 📅',
	selectDateLabel: 'Selecciona la fecha',
	whatTimeQuestion: '¿A qué hora estimas ir?',
	anyTimeOptionCta: 'Cualquier hora 🕒',
	specificTimeOptionCta: 'Hora específica ⚡',
	specificTimeLabel: 'Define la hora específica',
	getRecommendationCta: 'Obtener Recomendación 🚀',

	// Card: ranking de recomendados
	rank1Label: '#1 Recomendado',
	rank2Label: '#2 Recomendado',
	rank3Label: '#3 Recomendado',
	recommendedLabel: 'Recomendado',
} satisfies BaseTranslation

export default es
