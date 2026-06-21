import type { Translation } from '../i18n-types'

const en = {
	// Common
	loading: 'Loading...',
	loadingPanoramas: 'Loading activities…',
	errorPrefix: 'Error',
	serverError: 'Server connection error',

	// Auth - tabs / buttons
	signIn: 'Sign In',
	register: 'Register',
	createAccount: 'Create Account',
	continueWithGoogle: 'Continue with Google',
	or: 'or',
	secureAuth: 'Secure Authentication (SSO + OTP)',

	// Auth - form labels / placeholders
	name: 'Name',
	email: 'Email',
	password: 'Password',

	// Auth - errors
	loginGoogleFailed: 'There was a problem connecting with Google.',
	badCredentials: 'Invalid credentials',
	createAccountError: 'Error creating account',

	// Password requirements
	pwdMin8: 'Minimum 8 characters',
	pwdUppercase: 'At least 1 uppercase letter',
	pwdNumber: 'At least 1 number',
	pwdSpecial: 'At least 1 special character',

	// OTP
	otpTitle: 'Security Verification',
	otpInstructions: 'Enter the 6-digit code to confirm your identity.',
	otpVerify: 'Verify Code',
	otpVerifying: 'Verifying...',
	otpInvalid: 'Invalid or expired code',
	otpBackToLogin: 'Back to login',

	// Home
	logout: 'Sign out',
	panoramaFound: 'Activity found',
	panoramasFound: 'Activities found',
	emptyState: 'No activities published in this category yet.',
	filters: 'Filters',

	// Card
	seeDetails: 'See details',
	weatherSunny: '☀️ SUNNY',
	weatherAll: '✨ ALL WEATHER',

	// Categories
	categoryAll: 'All',
	categoryCine: 'Cinema',
	categoryTeatro: 'Theater',
	categoryParque: 'Park',
	categoryMuseo: 'Museum',
	categoryRestaurante: 'Restaurant',
	categoryMiradores: 'Viewpoints',

	// Admin Dashboard
	adminPanel: 'Admin Panel',
	adminGoBack: '← Back to home',
	adminBadge: 'ADMIN',
	adminAccessLink: 'Admin',
	statTotalUsers: 'Total users',
	statTotalActivities: 'Published activities',
	statOtpsSent: 'OTPs sent today',
	statTopCategory: 'Top category',
	sectionRecentUsers: 'Recent users',
	recentAdmins: 'Recent admins',
	recentStandardUsers: 'Recent users',
	sectionActivityByCategory: 'Activities by category',
	tableEmail: 'Email',
	tableRole: 'Role',
	tableJoined: 'Joined',
	tableStatus: 'Status',
	roleAdmin: 'Admin',
	roleUser: 'User',
	statusActive: 'Verified',
	statusPending: 'Pending',
	roleUpdateError: 'Error updating role in the database.',
	calculatingTrend: 'Calculating trends...',

	// Reservas (issues #25, #26, #28)
	seeDetailsCta: 'Book',
	reservationModalTitle: 'Confirm booking',
	reservationModalDescription: 'You are about to book this activity. Payment is processed instantly.',
	reservationConfirmPay: 'Confirm and pay',
	reservationProcessing: 'Processing payment…',
	reservationSuccess: 'Booking confirmed!',
	reservationSuccessHint: 'You can see it in My Bookings.',
	reservationFailed: 'We could not process your payment.',
	reservationCancel: 'Cancel',
	reservationClose: 'Close',
	transactionLabel: 'Transaction ID',

	// Vista de Mis Reservas (issue #26)
	myReservationsLink: 'My Bookings',
	myReservationsTitle: 'My Bookings',
	myReservationsEmpty: 'You have no bookings yet. Browse activities and book one.',
	myReservationsLoading: 'Loading bookings…',
	reservationStatusComprado: 'Booked',
	reservationStatusCancelado: 'Cancelled',
	reservationStatusPendiente: 'Pending',
	reservationDate: 'Booking date',
	reservationCancelAction: 'Cancel booking',
	reservationCancelConfirm: 'Are you sure you want to cancel this booking?',

	// Refactor flujo reserva (v2)
	viewEventCta: 'View event',
	reserveOnlyCta: 'Book',
	payNowCta: 'Pay now',
	payButton: 'Pay',
	rebookCta: 'Book again',
	reservationCreatedPending: 'Booking created! Pending payment.',
	reservationCreatedPaid: 'Booking confirmed and paid!',
	detailsModalTitle: 'Event details',
	detailsCategoryLabel: 'Category',
	detailsWeatherLabel: 'Recommended weather',
	detailsHoursLabel: 'Schedule',
	detailsCoordsLabel: 'Location',
	reservationStatusPagado: 'Paid',
	cardStatusPending: 'Booked (pending payment)',
	cardStatusPaid: 'Paid',

	// Card: badges, ocupacion, precio (nueva-logica-panoramas)
	badgePopular: 'Popular',
	badgeTendencia: 'Trending',
	openHours: 'Open: {open} - {close}',
	occupancyLabel: 'Occupancy: {level}',
	occupancyHigh: 'High',
	occupancyMedium: 'Medium',
	occupancyLow: 'Low',
	priceLabel: 'Base price',
	free: 'Free',

	// ActivityDetailModal
	availabilityLoadError: 'Could not load availability.',
	weatherSuggestedLabel: 'Suggested Weather',
	weatherIdealOutdoor: 'Ideal Outdoors',
	weatherAllWeatherFit: 'All-Weather',
	scheduleLabel: 'Schedule',
	serviceFeeNote: '+ service fee on payment',
	drivingDistanceLabel: 'Driving distance',
	straightDistanceLabel: 'Approximate distance',
	byRoad: 'by road',
	straightLine: 'in a straight line',
	addressLabel: 'Address',
	placeMapLabel: 'Location Map',
	noLocation: 'No location',
	chooseDateTime: 'Choose date and time',
	loadingAvailability: 'Loading availability...',
	noDatesAvailable: 'This activity has no dates loaded yet.',
	slotsFree: 'spots left',
	soldOut: 'sold out',
	slotsCount: '{n} spots',
	checkDateTime: 'Check date and time',
	payRightNowCta: 'Pay right now',
	backToDetailCta: 'Back to detail',
	doneCta: 'Done',
	reservationFailedGeneric: 'Could not complete booking',
	paymentDoneConfirmed: 'Payment completed! Booking confirmed and spot deducted.',
	reservationPendingSpotTaken: 'Booking created (payment pending). Spot deducted.',
	reservationErrorGeneric: 'Error booking',

	// App.tsx: banner de recomendacion asistida
	recommendBannerTitle: '🧠 Want personalized activity recommendations?',
	recommendBannerText: 'Find the best options based on the weather and schedule for today or any date you choose.',
	recommendBannerCta: '✨ Recommend Activities',

	// App.tsx: banner de planificacion activa
	planningActiveTodayTitle: '📅 Recommendation for Today Active',
	planningActiveFutureTitle: '📅 Planned Recommendation Active',
	planningTodayIntro: 'Showing ideal activities for',
	today: 'today',
	inRealTime: 'in real time.',
	weatherDetectedBy: 'Weather detected by API:',
	planningFutureIntro: 'Showing activities for',
	atTime: 'at',
	anyTimeText: 'at any time',
	weatherEstimatedBy: 'Weather estimated by API:',
	weatherClear: '☀️ Clear',
	weatherCloudy: '☁️ Cloudy',
	weatherRainy: '🌧️ Rainy',
	backToRealTimeCta: '🔄 Back to Real Time',

	// App.tsx: toolbar de filtros
	filterRadiusAll: 'Entire region',
	filterRadius10: 'Within 10km',
	filterRadius5: 'Within 5km',
	filterRadius2: 'Within 2km',
	filterAnyPrice: 'Any price',
	filterPriceCheap: 'Cheap ($)',
	filterPriceModerate: 'Moderate ($$)',
	filterPriceExpensive: 'Expensive ($$$)',
	filterPriceVeryExpensive: 'Very Expensive ($$$$)',
	filterFreePrice: 'Free ($0)',
	filterPaidPrice: 'Paid',
	filterOpenNow: 'Open Now Only',
	searching: 'Searching...',
	applyFilters: 'Apply Filters',

	// App.tsx: toasts
	toastWeatherError: 'Could not connect to the weather service.',
	toastFavRemoved: 'Removed from your favorites.',
	toastFavAdded: 'Activity saved to your favorites!',
	toastPrefsSaved: 'Preferences saved: Showing {category}.',
	toastSignoutSuccess: 'Signed out successfully. See you soon!',
	toastSignoutError: 'There was a problem signing you out.',
	toastReservationSuccess: 'Booking completed successfully!',

	// App.tsx: modal de planificacion
	planningModalKicker: 'Intelligent Assistant',
	planningModalTitle: 'Recommend Activities',
	planningModalDescription: 'Tell us when you plan to do the activity so the system can calculate the best options automatically.',
	whenQuestion: 'When do you want to do the activity?',
	todayOptionCta: 'Today ☀️',
	otherDayOptionCta: 'Other day 📅',
	selectDateLabel: 'Select the date',
	whatTimeQuestion: 'What time do you plan to go?',
	anyTimeOptionCta: 'Any time 🕒',
	specificTimeOptionCta: 'Specific time ⚡',
	specificTimeLabel: 'Set the specific time',
	getRecommendationCta: 'Get Recommendation 🚀',

	// Card: recommended ranking
	rank1Label: '#1 Recommended',
	rank2Label: '#2 Recommended',
	rank3Label: '#3 Recommended',
	recommendedLabel: 'Recommended',
} satisfies Translation

export default en
