"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import styles from "./page.module.css";

export default function AdsManagerPage() {
  const { workspaces } = useAuth();
  const currentWorkspace = workspaces[0];
  
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("500");
  const [audience, setAudience] = useState("Broad");
  const [copy, setCopy] = useState("Get 20% off your first order! Click here to chat with us on WhatsApp.");
  const [loading, setLoading] = useState(false);
  const [createdAd, setCreatedAd] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentWorkspace) return;
      try {
        const res = await apiFetch(`/api/ads/analytics?workspaceId=${currentWorkspace.id}`);
        if (res.ok) setAnalytics(res.data.analytics || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAnalytics();
  }, [currentWorkspace]);

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;

    setLoading(true);
    try {
      const res = await apiFetch(`/api/ads/create?workspaceId=${currentWorkspace.id}`, {
        method: "POST",
        body: JSON.stringify({ name, budget: parseInt(budget), audience, copy })
      });

      if (res.ok) {
        setCreatedAd(res.data.ad);
      } else {
        alert("Failed to create ad: " + res.data.error);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>AI Ads Manager</h1>
        <p className={styles.subtitle}>Create Click-to-WhatsApp Ads powered by AI.</p>
      </div>

      <div className={styles.grid}>
        <div className={styles.formCard}>
          <h2 className={styles.cardTitle}>New Ad Campaign</h2>
          <form onSubmit={handleCreateAd} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Campaign Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g., Summer Sale 2024"
                required
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>Daily Budget (USD)</label>
              <input 
                type="number" 
                value={budget} 
                onChange={e => setBudget(e.target.value)} 
                min="10"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Target Audience</label>
              <select value={audience} onChange={e => setAudience(e.target.value)}>
                <option value="Broad">Broad (AI Optimized)</option>
                <option value="Retargeting">Retargeting (Past Customers)</option>
                <option value="Lookalike">Lookalike (Similar to Best Customers)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Ad Copy</label>
              <textarea 
                value={copy} 
                onChange={e => setCopy(e.target.value)} 
                rows={4}
                required
              />
              <button type="button" className={styles.aiAssistBtn}>✨ Generate Copy with AI</button>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading || !name}>
              {loading ? "Publishing to Meta..." : "Launch Campaign"}
            </button>
          </form>
        </div>

        <div className={styles.previewCard}>
          <h2 className={styles.cardTitle}>Ad Preview</h2>
          <div className={styles.mockPhone}>
            <div className={styles.mockFbPost}>
              <div className={styles.mockFbHeader}>
                <div className={styles.mockFbAvatar}></div>
                <div className={styles.mockFbName}>Your Brand <br/><span>Sponsored</span></div>
              </div>
              <div className={styles.mockFbText}>{copy || "Your ad copy will appear here."}</div>
              <div className={styles.mockFbImage}>
                <span className={styles.imagePlaceholderText}>Image / Video Creative</span>
              </div>
              <div className={styles.mockFbFooter}>
                <div className={styles.mockFbFooterText}>CHAT ON WHATSAPP</div>
                <button className={styles.mockFbBtn}>Send Message</button>
              </div>
            </div>
          </div>

          {createdAd && (
            <div className={styles.successBanner}>
              <strong>✅ Campaign Launched!</strong>
              <p>Ad ID: {createdAd.id}</p>
              <p>Status: {createdAd.status}</p>
              <p>Revenue attribution is now active.</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <h2 className={styles.cardTitle}>Real-time ROAS Performance</h2>
        <div className={styles.tableContainer} style={{ background: "white", borderRadius: 12, border: "1px solid #eaeaea", overflow: "hidden" }}>
          <table className={styles.table} style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead style={{ background: "#f9fafb", borderBottom: "1px solid #eaeaea" }}>
              <tr>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--tp-text-secondary)" }}>Ad Campaign</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--tp-text-secondary)" }}>Status</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--tp-text-secondary)" }}>Spend (Budget)</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--tp-text-secondary)" }}>Revenue Attributed</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--tp-text-secondary)" }}>Conversions</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--tp-text-secondary)" }}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {analytics.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>Loading performance data...</td></tr>
              )}
              {analytics.map((ad, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eaeaea" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600 }}>{ad.name}</div>
                    <div style={{ fontSize: 12, color: "var(--tp-text-tertiary)" }}>{ad.id}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "4px 8px", background: "#ecfdf5", color: "#065f46", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{ad.status}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>${Number(ad.budget).toFixed(2)}</td>
                  <td style={{ padding: "12px 16px", color: "var(--tp-success)", fontWeight: 600 }}>${Number(ad.revenue).toFixed(2)}</td>
                  <td style={{ padding: "12px 16px" }}>{ad.conversions}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700 }}>{ad.roas}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
