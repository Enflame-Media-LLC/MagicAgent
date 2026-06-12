/**
 * Vue I18n Configuration
 *
 * Provides internationalization support for the Happy Vue web application.
 * Supports 7 languages migrated from happy-app:
 * - English (en) - Default
 * - Spanish (es)
 * - Russian (ru)
 * - Polish (pl)
 * - Portuguese (pt)
 * - Catalan (ca)
 * - Chinese Simplified (zh-Hans)
 *
 * Features:
 * - Dynamic language switching without page reload
 * - System language detection
 * - Persistent language preference (localStorage)
 * - RTL preparation for future Arabic/Hebrew support
 * - Locale-aware date/time/number formatting
 */

import { createI18n } from "vue-i18n";

// Import locale messages
import en from "./locales/en.json";
import es from "./locales/es.json";
import ru from "./locales/ru.json";
import pl from "./locales/pl.json";
import pt from "./locales/pt.json";
import ca from "./locales/ca.json";
import zhHans from "./locales/zh-Hans.json";

/**
 * Supported language codes
 */
export type SupportedLanguage = "en" | "es" | "ru" | "pl" | "pt" | "ca" | "zh-Hans";

/**
 * Language metadata
 */
export interface LanguageInfo {
  code: SupportedLanguage;
  nativeName: string;
  englishName: string;
  /** RTL languages will have this set to true */
  rtl?: boolean;
}

/**
 * All supported languages with their metadata
 */
export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  en: {
    code: "en",
    nativeName: "English",
    englishName: "English",
  },
  es: {
    code: "es",
    nativeName: "Español",
    englishName: "Spanish",
  },
  ru: {
    code: "ru",
    nativeName: "Русский",
    englishName: "Russian",
  },
  pl: {
    code: "pl",
    nativeName: "Polski",
    englishName: "Polish",
  },
  pt: {
    code: "pt",
    nativeName: "Português",
    englishName: "Portuguese",
  },
  ca: {
    code: "ca",
    nativeName: "Català",
    englishName: "Catalan",
  },
  "zh-Hans": {
    code: "zh-Hans",
    nativeName: "中文(简体)",
    englishName: "Chinese (Simplified)",
  },
} as const;

/**
 * Array of all supported language codes
 */
export const SUPPORTED_LANGUAGE_CODES = Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[];

/**
 * Default language
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

/**
 * LocalStorage key for persisted language preference
 */
const STORAGE_KEY = "happy-locale";

/**
 * Check if running in browser environment (not Cloudflare Workers)
 */
const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined";

/**
 * Detect the user's preferred language from browser/system settings
 */
export function detectSystemLocale(): SupportedLanguage {
  // Return default if not in browser (e.g., Cloudflare Workers)
  if (!isBrowser || typeof navigator === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  // Try navigator.language first (most specific)
  const browserLang = navigator.language;

  // Check for exact match (e.g., zh-Hans)
  if (isSupportedLanguage(browserLang)) {
    return browserLang;
  }

  // Try base language (e.g., 'zh' from 'zh-CN')
  const baseLang = browserLang.split("-")[0] ?? "";

  // Special handling for Chinese variants
  if (baseLang === "zh") {
    // Simplified Chinese regions
    const simplified = ["CN", "SG", "MY", "Hans"];
    const region = browserLang.split("-")[1] ?? "";
    if (simplified.some((s) => region.includes(s))) {
      return "zh-Hans";
    }
    // Default Chinese to Simplified
    return "zh-Hans";
  }

  if (isSupportedLanguage(baseLang)) {
    return baseLang;
  }

  // Fallback: check navigator.languages array
  for (const lang of navigator.languages) {
    const base = lang.split("-")[0] ?? "";
    if (isSupportedLanguage(base)) {
      return base;
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Type guard for supported languages
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGE_CODES.includes(lang as SupportedLanguage);
}

/**
 * Get the persisted locale from localStorage, or detect system locale
 */
export function getInitialLocale(): SupportedLanguage {
  // Return default if not in browser (e.g., Cloudflare Workers)
  if (!isBrowser) {
    return DEFAULT_LANGUAGE;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isSupportedLanguage(stored)) {
    return stored;
  }
  return detectSystemLocale();
}

/**
 * Persist locale preference to localStorage
 */
export function persistLocale(locale: SupportedLanguage): void {
  if (isBrowser) {
    localStorage.setItem(STORAGE_KEY, locale);
  }
}

/**
 * Check if a language uses RTL (right-to-left) text direction
 * Prepared for future Arabic/Hebrew support
 */
export function isRtlLanguage(locale: SupportedLanguage): boolean {
  // Currently no RTL languages supported, but structure is ready
  const rtlLanguages: SupportedLanguage[] = [];
  return rtlLanguages.includes(locale);
}

/**
 * Get language info by code
 */
export function getLanguageInfo(code: SupportedLanguage): LanguageInfo {
  return SUPPORTED_LANGUAGES[code];
}

/**
 * Vue I18n instance
 *
 * Configured with Composition API mode (legacy: false) for Vue 3.
 * Messages are typed with MessageSchema for type-safe translations.
 */
export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LANGUAGE,
  messages: {
    en,
    es,
    ru,
    pl,
    pt,
    ca,
    "zh-Hans": zhHans,
  },
  // Enable missing key warnings in development
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
});

export default i18n;
