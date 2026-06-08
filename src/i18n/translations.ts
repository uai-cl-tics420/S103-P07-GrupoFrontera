export type Locale = 'es' | 'en';

type TranslationEntry = { es: string; en: string };

export const translations = {
    // Common
    loading: { es: 'Cargando...', en: 'Loading...' },
    loadingPanoramas: { es: 'Cargando panoramas…', en: 'Loading activities…' },
    errorPrefix: { es: 'Error', en: 'Error' },
    serverError: { es: 'Error de conexión con el servidor', en: 'Server connection error' },

    // Auth - tabs / buttons
    signIn: { es: 'Iniciar Sesión', en: 'Sign In' },
    register: { es: 'Registrarse', en: 'Register' },
    createAccount: { es: 'Crear Cuenta', en: 'Create Account' },
    continueWithGoogle: { es: 'Continuar con Google', en: 'Continue with Google' },
    or: { es: 'o', en: 'or' },
    secureAuth: { es: 'Autenticación Segura (SSO + OTP)', en: 'Secure Authentication (SSO + OTP)' },

    // Auth - form labels / placeholders
    name: { es: 'Nombre', en: 'Name' },
    email: { es: 'Email', en: 'Email' },
    password: { es: 'Contraseña', en: 'Password' },

    // Auth - errors
    loginGoogleFailed: { es: 'Hubo un problema al conectar con Google.', en: 'There was a problem connecting with Google.' },
    badCredentials: { es: 'Credenciales incorrectas', en: 'Invalid credentials' },
    createAccountError: { es: 'Error al crear la cuenta', en: 'Error creating account' },

    // Password requirements
    pwdMin8: { es: 'Mínimo 8 caracteres', en: 'Minimum 8 characters' },
    pwdUppercase: { es: 'Al menos 1 mayúscula', en: 'At least 1 uppercase letter' },
    pwdNumber: { es: 'Al menos 1 número', en: 'At least 1 number' },
    pwdSpecial: { es: 'Al menos 1 carácter especial', en: 'At least 1 special character' },

    // OTP
    otpTitle: { es: 'Verificación de Seguridad', en: 'Security Verification' },
    otpInstructions: { es: 'Ingresa el código de 6 dígitos para confirmar tu identidad.', en: 'Enter the 6-digit code to confirm your identity.' },
    otpVerify: { es: 'Verificar Código', en: 'Verify Code' },
    otpVerifying: { es: 'Verificando...', en: 'Verifying...' },
    otpInvalid: { es: 'Código incorrecto o expirado', en: 'Invalid or expired code' },
    otpBackToLogin: { es: 'Volver al inicio de sesión', en: 'Back to login' },

    // Home
    logout: { es: 'Cerrar sesión', en: 'Sign out' },
    panoramaFound: { es: 'Panorama encontrado', en: 'Activity found' },
    panoramasFound: { es: 'Panoramas encontrados', en: 'Activities found' },
    emptyState: { es: 'No hay actividades publicadas para esta categoría todavía.', en: 'No activities published in this category yet.' },
    filters: { es: 'Filtros', en: 'Filters' },

    // Card
    seeDetails: { es: 'Ver detalles', en: 'See details' },
    weatherSunny: { es: '☀️ SOLEADO', en: '☀️ SUNNY' },
    weatherAll: { es: '✨ TODO CLIMA', en: '✨ ALL WEATHER' },

    // Categories
    categoryAll: { es: 'Todas', en: 'All' },
    categoryCine: { es: 'Cine', en: 'Cinema' },
    categoryTeatro: { es: 'Teatro', en: 'Theater' },
    categoryParque: { es: 'Parque', en: 'Park' },
    categoryMuseo: { es: 'Museo', en: 'Museum' },
    categoryRestaurante: { es: 'Restaurante', en: 'Restaurant' },
    categoryMiradores: { es: 'Miradores', en: 'Viewpoints' },

    // Admin Dashboard
    adminPanel: { es: 'Panel de Administrador', en: 'Admin Panel' },
    adminGoBack: { es: '← Volver al inicio', en: '← Back to home' },
    adminBadge: { es: 'ADMIN', en: 'ADMIN' },
    adminAccessLink: { es: 'Admin', en: 'Admin' },
    statTotalUsers: { es: 'Usuarios totales', en: 'Total users' },
    statTotalActivities: { es: 'Actividades publicadas', en: 'Published activities' },
    statOtpsSent: { es: 'OTPs enviados hoy', en: 'OTPs sent today' },
    statTopCategory: { es: 'Categoría líder', en: 'Top category' },
    sectionRecentUsers: { es: 'Usuarios recientes', en: 'Recent users' },
    recentAdmins: { es: 'Admins recientes', en: 'Recent admins' },
    recentStandardUsers: { es: 'Usuarios recientes', en: 'Recent users' },
    sectionActivityByCategory: { es: 'Actividades por categoría', en: 'Activities by category' },
    tableEmail: { es: 'Email', en: 'Email' },
    tableRole: { es: 'Rol', en: 'Role' },
    tableJoined: { es: 'Registro', en: 'Joined' },
    tableStatus: { es: 'Estado', en: 'Status' },
    roleAdmin: { es: 'Admin', en: 'Admin' },
    roleUser: { es: 'Usuario', en: 'User' },
    statusActive: { es: 'Verificado', en: 'Verified' },
    statusPending: { es: 'Pendiente', en: 'Pending' },
} satisfies Record<string, TranslationEntry>;

export type TranslationKey = keyof typeof translations;
