// Translation dictionaries. Add a locale by adding a key here; every locale
// should mirror the shape of `en`. Kept dependency-free intentionally — swap in
// next-intl/react-intl later without changing the call sites that use t().

export const messages = {
  en: {
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.loading": "Loading…",
    "auth.login": "Log in",
    "auth.signup": "Sign up",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.forgotPassword": "Forgot password?",
    "nav.inbox": "Inbox",
    "nav.contacts": "Contacts",
    "nav.broadcasts": "Broadcasts",
    "nav.analytics": "Analytics",
    "nav.settings": "Settings",
  },
  es: {
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.loading": "Cargando…",
    "auth.login": "Iniciar sesión",
    "auth.signup": "Registrarse",
    "auth.email": "Correo electrónico",
    "auth.password": "Contraseña",
    "auth.forgotPassword": "¿Olvidaste tu contraseña?",
    "nav.inbox": "Bandeja de entrada",
    "nav.contacts": "Contactos",
    "nav.broadcasts": "Difusiones",
    "nav.analytics": "Analíticas",
    "nav.settings": "Configuración",
  },
  hi: {
    "common.save": "सहेजें",
    "common.cancel": "रद्द करें",
    "common.delete": "हटाएं",
    "common.loading": "लोड हो रहा है…",
    "auth.login": "लॉग इन करें",
    "auth.signup": "साइन अप करें",
    "auth.email": "ईमेल",
    "auth.password": "पासवर्ड",
    "auth.forgotPassword": "पासवर्ड भूल गए?",
    "nav.inbox": "इनबॉक्स",
    "nav.contacts": "संपर्क",
    "nav.broadcasts": "प्रसारण",
    "nav.analytics": "विश्लेषण",
    "nav.settings": "सेटिंग्स",
  },
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof (typeof messages)["en"];

export const SUPPORTED_LOCALES = Object.keys(messages) as Locale[];
export const DEFAULT_LOCALE: Locale = "en";
