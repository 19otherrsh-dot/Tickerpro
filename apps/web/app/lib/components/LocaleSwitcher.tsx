"use client";

import { useTranslations } from "../i18n";
import type { Locale } from "../i18n/messages";

const LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  hi: "हिन्दी",
};

/** Compact language picker backed by the i18n provider. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, locales } = useTranslations();
  return (
    <select
      className={className}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Language"
      style={{
        background: "transparent",
        border: "1px solid var(--tp-border, #e5e7eb)",
        borderRadius: 6,
        padding: "4px 8px",
        fontSize: "0.8rem",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {LABELS[l] ?? l}
        </option>
      ))}
    </select>
  );
}
