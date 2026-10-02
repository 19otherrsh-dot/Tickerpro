"use client";

import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { useTranslations } from "../lib/i18n";
import styles from "./page.module.css";

export default function LoginPage() {
  const { login, isLoading: authLoading } = useAuth();
  const { t } = useTranslations();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || "Login failed");
    }

    setLoading(false);
  }

  if (authLoading) {
    return (
      <div className={styles.authPage}>
        <div className={styles.authBg}>
          <div className={styles.glow1} />
          <div className={styles.glow2} />
        </div>
        <div className={styles.loadingSpinner}>{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authBg}>
        <div className={styles.glow1} />
        <div className={styles.glow2} />
      </div>

      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.logo}>
            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#grad)" />
              <path d="M8 14.5L12 18.5L20 10.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 11.5L15 15.5L23 7.5" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="grad" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#25D366" /></linearGradient></defs>
            </svg>
          </div>
          <h1 className={styles.authTitle}>Welcome back</h1>
          <p className={styles.authSubtitle}>Sign in to your TickerPro account</p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.field}>
            <label htmlFor="email">{t("auth.email")}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">{t("auth.password")}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : t("auth.login")}
          </button>
        </form>

        <div style={{ textAlign: "right", marginTop: -8, marginBottom: 8 }}>
          <a href="/forgot-password" style={{ fontSize: "0.8rem", color: "var(--tp-brand-600)", fontWeight: 500 }}>
            {t("auth.forgotPassword")}
          </a>
        </div>

        <p className={styles.authFooter}>
          Don&apos;t have an account? <a href="/signup">Start free trial</a>
        </p>
      </div>
    </div>
  );
}
