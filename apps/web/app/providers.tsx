"use client";

import { AuthProvider } from "./lib/auth-context";
import { ToastProvider } from "./lib/components/Toast";
import { I18nProvider } from "./lib/i18n";

import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light">
      <I18nProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
