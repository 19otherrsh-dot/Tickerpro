"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "../../../lib/components/Toast";
import styles from "./page.module.css";

// Reusing same mock data from broadcasts/page.tsx
const mockBroadcast = { 
  id: "1", 
  name: "Diwali Sale — Flash Offer 🎉", 
  status: "completed", 
  date: "Oct 28, 2026", 
  sent: 12450, 
  delivered: 12100, 
  read: 8940, 
  replied: 1230, 
  preview: "🪔 Happy Diwali! Get 40% OFF on all plans for the next 48 hours. Use code DIWALI40. Reply NOW to claim!" 
};

export default function BroadcastDetailsPage({ params }: { params: { id: string } }) {
  const { addToast } = useToast();
  const [retargeting, setRetargeting] = useState(false);

  const handleRetarget = () => {
    setRetargeting(true);
    setTimeout(() => {
      setRetargeting(false);
      addToast("Retargeting campaign drafted", "success");
    }, 1200);
  };

  const unengagedCount = mockBroadcast.read - mockBroadcast.replied;

  return (
    <div className={styles.page}>
      <Link href="/dashboard/broadcasts" className={styles.backBtn}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Broadcasts
      </Link>

      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>{mockBroadcast.name}</h1>
          <p className={styles.pageSubtitle}>Sent on {mockBroadcast.date} • {mockBroadcast.status}</p>
        </div>
        <div className={styles.topbarActions}>
          <button className={styles.primaryBtn}>Export Report</button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{(mockBroadcast.sent / 1000).toFixed(1)}k</div>
          <div className={styles.statLabel}>Sent</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{Math.round((mockBroadcast.delivered / mockBroadcast.sent) * 100)}%</div>
          <div className={styles.statLabel}>Delivered</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{Math.round((mockBroadcast.read / mockBroadcast.delivered) * 100)}%</div>
          <div className={styles.statLabel}>Read</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{Math.round((mockBroadcast.replied / mockBroadcast.read) * 100)}%</div>
          <div className={styles.statLabel}>Replied</div>
        </div>
      </div>

      <div className={styles.retargetSection}>
        <div className={styles.retargetHeader}>
          <div className={styles.retargetIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.02l5.04 4.04"/>
            </svg>
          </div>
          <h2 className={styles.retargetTitle}>Smart Retargeting</h2>
        </div>
        <p className={styles.retargetDesc}>
          There are <strong>{unengagedCount.toLocaleString()}</strong> contacts who read your message but didn't reply. 
          Send a targeted follow-up to re-engage them.
        </p>
        <button 
          className={styles.retargetBtn} 
          onClick={handleRetarget}
          disabled={retargeting}
        >
          {retargeting ? "Drafting..." : "Draft Follow-Up Broadcast"}
          {!retargeting && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
        </button>
      </div>
    </div>
  );
}
