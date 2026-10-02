"use client";

import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import styles from "../login/page.module.css";

export default function SignupPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    workspaceName: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await register(form);
    if (!result.success) {
      setError(result.error || "Registration failed");
    }

    setLoading(false);
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
          <h1 className={styles.authTitle}>Create your account</h1>
          <p className={styles.authSubtitle}>Start your 14-day free trial — no credit card required</p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="firstName">First name</label>
              <input id="firstName" type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="John" required autoFocus />
            </div>
            <div className={styles.field}>
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" type="text" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Doe" required />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="workspaceName">Business name</label>
            <input id="workspaceName" type="text" value={form.workspaceName} onChange={(e) => update("workspaceName", e.target.value)} placeholder="Acme Corp" required />
          </div>

          <div className={styles.field}>
            <label htmlFor="email">Work email</label>
            <input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" required />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Min. 8 characters" required minLength={8} />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : "Create Account"}
          </button>
        </form>

        <p className={styles.authFooter}>
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
