"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  messages,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
  type MessageKey,
} from "./messages";

const STORAGE_KEY = "tickerpro.locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a key, with optional {placeholder} interpolation. */
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  locales: Locale[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  const browser = window.navigator.language?.slice(0, 2) as Locale | undefined;
  return browser && SUPPORTED_LOCALES.includes(browser) ? browser : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Resolve the persisted/browser locale after mount to avoid hydration mismatch.
  useEffect(() => {
    setLocaleState(resolveInitialLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      const dict = messages[locale] ?? messages[DEFAULT_LOCALE];
      let str: string = dict[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, locales: SUPPORTED_LOCALES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslations(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslations must be used within <I18nProvider>");
  return ctx;
}
