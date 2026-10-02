"use client";

import { useState } from "react";
import { useToast } from "../lib/components/Toast";
import styles from "../login/page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ForgotPasswordPage() {
  const { addToast: toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
        toast("Reset instructions sent! Check your email.", "success");
        // In dev mode, auto-fill the token
        if (data._devToken) {
          setResetToken(data._devToken);
        }
      } else {
        toast(data.error || "Failed to send reset email", "error");
      }
    } catch {
      toast("Unable to connect to server", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast("Passwords do not match", "error");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Password reset successfully! Redirecting to login...", "success");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        toast(data.error || "Failed to reset password", "error");
      }
    } catch {
      toast("Unable to connect to server", "error");
    } finally {
      setResetting(false);
    }
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
          <h1 className={styles.authTitle}>
            {sent ? "Reset your password" : "Forgot your password?"}
          </h1>
          <p className={styles.authSubtitle}>
            {sent
              ? "Enter the reset token and your new password"
              : "Enter your email and we'll send you reset instructions"}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleRequestReset} className={styles.authForm}>
            <div className={styles.field}>
              <label htmlFor="email">Email address</label>
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

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : "Send Reset Link"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className={styles.authForm}>
            <div className={styles.field}>
              <label htmlFor="token">Reset token</label>
              <input
                id="token"
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Paste your reset token"
                required
                style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                required
                minLength={8}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                required
                minLength={8}
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={resetting}>
              {resetting ? <span className={styles.spinner} /> : "Reset Password"}
            </button>
          </form>
        )}

        <p className={styles.authFooter}>
          Remember your password? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
