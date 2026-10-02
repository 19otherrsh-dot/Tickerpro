"use client";

import { useState } from "react";
import { useAuth, apiFetch } from "../../../lib/auth-context";
import styles from "./page.module.css";

export default function BillingPage() {
  const { workspaces } = useAuth();
  const currentWorkspace = workspaces[0];
  const [loading, setLoading] = useState(false);

  // Fetch plan from the auth context workspace data
  const currentPlan = ((currentWorkspace as any)?.plan || "growth").toLowerCase();
  const status = (currentWorkspace as any)?.isActive ? "Active" : "Past Due";
  
  const handleManageBilling = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/payments/subscription/billing-portal?workspaceId=${currentWorkspace.id}`, {
        method: "POST"
      });
      if (res.ok && res.data.portalUrl) {
        window.open(res.data.portalUrl, "_blank");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to open billing portal");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/payments/subscription/create-checkout-session?workspaceId=${currentWorkspace.id}`, {
        method: "POST",
        body: JSON.stringify({ planId })
      });
      if (res.ok && res.data.checkoutUrl) {
        window.open(res.data.checkoutUrl, "_blank");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to open checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.billingContainer}>
      <h1 className={styles.pageTitle}>Billing & Subscriptions</h1>
      <p className={styles.pageSubtitle}>Manage your TickerPro plan, limits, and payment methods.</p>

      <div className={styles.currentPlanCard}>
        <div className={styles.planHeader}>
          <div>
            <h2 className={styles.planTitle}>Current Plan: {currentPlan.toUpperCase()}</h2>
            <div className={styles.statusBadge}>{status}</div>
          </div>
          <button className={styles.secondaryBtn} onClick={handleManageBilling} disabled={loading}>
            Manage Billing
          </button>
        </div>
        
        <div className={styles.usageSection}>
          <h3 className={styles.usageTitle}>Monthly Usage</h3>
          <div className={styles.progressContainer}>
            <div className={styles.progressHeader}>
              <span>Marketing Broadcasts (Meta API)</span>
              <span>12,450 / 50,000 limits</span>
            </div>
            <div className={styles.progressBarBg}>
              <div className={styles.progressBarFill} style={{ width: "25%" }} />
            </div>
          </div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Available Plans</h2>
      <div className={styles.pricingGrid}>
        
        {/* Growth Plan */}
        <div className={`${styles.pricingCard} ${currentPlan === 'growth' ? styles.activeCard : ''}`}>
          <h3 className={styles.planName}>Growth</h3>
          <div className={styles.planPrice}>$99<span>/mo</span></div>
          <ul className={styles.featureList}>
            <li>✔️ Unlimited Agent Seats</li>
            <li>✔️ 50,000 Marketing Messages</li>
            <li>✔️ ClickHouse Real-time Analytics</li>
            <li>✔️ CRM Sync (Shopify/HubSpot)</li>
          </ul>
          <button 
            className={currentPlan === 'growth' ? styles.disabledBtn : styles.primaryBtn}
            onClick={() => handleUpgrade('price_growth_monthly')}
            disabled={currentPlan === 'growth' || loading}
          >
            {currentPlan === 'growth' ? 'Current Plan' : 'Upgrade to Growth'}
          </button>
        </div>

        {/* Enterprise Plan */}
        <div className={`${styles.pricingCard} ${currentPlan === 'enterprise' ? styles.activeCard : ''}`}>
          <h3 className={styles.planName}>Enterprise</h3>
          <div className={styles.planPrice}>$299<span>/mo</span></div>
          <ul className={styles.featureList}>
            <li>✔️ Everything in Growth</li>
            <li>✔️ 500,000 Marketing Messages</li>
            <li>✔️ Dedicated Success Manager</li>
            <li>✔️ Custom SLA & SOC2 Report</li>
          </ul>
          <button 
            className={currentPlan === 'enterprise' ? styles.disabledBtn : styles.primaryBtn}
            onClick={() => handleUpgrade('price_enterprise_monthly')}
            disabled={currentPlan === 'enterprise' || loading}
          >
            {currentPlan === 'enterprise' ? 'Current Plan' : 'Upgrade to Enterprise'}
          </button>
        </div>

      </div>
    </div>
  );
}
