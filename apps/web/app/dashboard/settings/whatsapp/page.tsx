"use client";

import { useState } from "react";
import { useAuth } from "../../../lib/auth-context";
import { useToast } from "../../../lib/components/Toast";
import styles from "./page.module.css";

export default function GreenTickWizardPage() {
  const { activeWorkspace } = useAuth();
  const { addToast } = useToast();
  
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    businessName: "",
    website: "",
    facebookPage: "",
    wabaId: "",
  });

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setStep(4); // Success state
      addToast("Application submitted to Meta!", "success");
    }, 1500);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <div className={styles.greenTick}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          Official Business Account (Green Tick)
        </h1>
        <p className={styles.subtitle}>Apply for WhatsApp's Official Business Account verification to get the green tick next to your display name.</p>
      </div>

      <div className={styles.wizardCard}>
        {step < 4 && (
          <div className={styles.steps}>
            <div className={`${styles.step} ${step === 1 ? styles.stepActive : ''} ${step > 1 ? styles.stepCompleted : ''}`}>1. Business Details</div>
            <div className={`${styles.step} ${step === 2 ? styles.stepActive : ''} ${step > 2 ? styles.stepCompleted : ''}`}>2. Meta Connectivity</div>
            <div className={`${styles.step} ${step === 3 ? styles.stepActive : ''}`}>3. Press Mentions</div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: 16 }}>Verify Business Identity</h3>
            <div className={styles.formGroup}>
              <label>Official Business Name</label>
              <input 
                type="text" 
                placeholder="e.g. Acme Corporation" 
                value={formData.businessName}
                onChange={e => setFormData({...formData, businessName: e.target.value})}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Business Website</label>
              <input 
                type="url" 
                placeholder="https://acme.com" 
                value={formData.website}
                onChange={e => setFormData({...formData, website: e.target.value})}
              />
            </div>
            <div className={styles.actions}>
              <div></div>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNext}>Next Step</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: 16 }}>Connect Meta Assets</h3>
            <div className={styles.formGroup}>
              <label>Facebook Page URL</label>
              <input 
                type="url" 
                placeholder="https://facebook.com/acmecorp" 
                value={formData.facebookPage}
                onChange={e => setFormData({...formData, facebookPage: e.target.value})}
              />
            </div>
            <div className={styles.formGroup}>
              <label>WhatsApp Business Account (WABA) ID</label>
              <input 
                type="text" 
                placeholder="e.g. 123456789012345" 
                value={formData.wabaId}
                onChange={e => setFormData({...formData, wabaId: e.target.value})}
              />
            </div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handlePrev}>Back</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNext}>Next Step</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: 16 }}>Submit Proof of Notability</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--tp-text-secondary)', marginBottom: 24 }}>
              Meta requires your business to have notable press mentions (not paid or promotional content). Upload links to news articles about your business.
            </p>
            <div className={styles.formGroup}>
              <label>Article Link 1 (Required)</label>
              <input type="url" placeholder="https://techcrunch.com/article" />
            </div>
            <div className={styles.formGroup}>
              <label>Article Link 2 (Optional)</label>
              <input type="url" placeholder="https://forbes.com/article" />
            </div>
            <div className={styles.formGroup}>
              <label>Article Link 3 (Optional)</label>
              <input type="url" placeholder="https://bloomberg.com/article" />
            </div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handlePrev} disabled={submitting}>Back</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className={`${styles.successState} animate-fade-in`}>
            <div className={styles.successIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h2>Application Submitted!</h2>
            <p style={{ color: 'var(--tp-text-secondary)', marginTop: 12, maxWidth: 500, margin: '12px auto 0' }}>
              We've securely forwarded your details to Meta. Verification typically takes 2-4 business days. We'll notify you via email and in your dashboard once approved.
            </p>
            <button className={`${styles.btn} ${styles.btnSecondary}`} style={{ marginTop: 32 }} onClick={() => window.location.href = '/dashboard'}>
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
