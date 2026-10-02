"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, apiFetch } from "../lib/auth-context";
import styles from "./page.module.css";

export default function OnboardingWizard() {
  const router = useRouter();
  const { activeWorkspace, refreshUser } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 2: Number Setup
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [wabaId, setWabaId] = useState("");
  
  const handleNext = () => setStep(s => s + 1);
  
  const handleFinish = async () => {
    setLoading(true);
    // In a real implementation, we would save the WhatsApp number here
    // For MVP, just redirect to dashboard
    await refreshUser();
    router.push("/dashboard");
  };

  return (
    <div className={styles.onboardingPage}>
      <div className={styles.onboardingBg}>
        <div className={styles.glow1} />
        <div className={styles.glow2} />
      </div>

      <div className={styles.onboardingCard}>
        <div className={styles.stepper}>
          <div className={`${styles.step} ${step >= 1 ? styles.stepActive : ""}`}>1. Welcome</div>
          <div className={styles.stepDivider} />
          <div className={`${styles.step} ${step >= 2 ? styles.stepActive : ""}`}>2. Connect WhatsApp</div>
          <div className={styles.stepDivider} />
          <div className={`${styles.step} ${step >= 3 ? styles.stepActive : ""}`}>3. Ready</div>
        </div>

        {step === 1 && (
          <div className={styles.stepContent}>
            <div className={styles.iconWrapper}>👋</div>
            <h1 className={styles.title}>Welcome to {activeWorkspace?.name || "TickerPro"}!</h1>
            <p className={styles.subtitle}>Let's get your workspace set up so you can start chatting with your customers.</p>
            
            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <span className={styles.featureCheck}>✓</span> Shared Team Inbox
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureCheck}>✓</span> Meta Cloud API Integration
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureCheck}>✓</span> Automated Broadcasts
              </div>
            </div>

            <button onClick={handleNext} className={styles.primaryBtn}>Get Started</button>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <div className={styles.iconWrapper}>📱</div>
            <h1 className={styles.title}>Connect WhatsApp</h1>
            <p className={styles.subtitle}>Enter your WhatsApp Business Account (WABA) details to start sending and receiving messages.</p>
            
            <div className={styles.formGroup}>
              <label>Phone Number</label>
              <input type="text" placeholder="+1 234 567 8900" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>Display Name</label>
              <input type="text" placeholder="Acme Support" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>WABA ID</label>
              <input type="text" placeholder="123456789012345" value={wabaId} onChange={e => setWabaId(e.target.value)} />
            </div>

            <div className={styles.btnRow}>
              <button onClick={() => setStep(1)} className={styles.secondaryBtn}>Back</button>
              <button onClick={handleNext} className={styles.primaryBtn} disabled={!phoneNumber || !displayName || !wabaId}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={styles.stepContent}>
            <div className={styles.iconWrapper}>🎉</div>
            <h1 className={styles.title}>You're all set!</h1>
            <p className={styles.subtitle}>Your workspace is ready. You can now invite team members and start managing conversations.</p>
            
            <button onClick={handleFinish} className={styles.primaryBtn} disabled={loading}>
              {loading ? "Loading..." : "Go to Dashboard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
