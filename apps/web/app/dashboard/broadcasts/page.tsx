"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../contacts/page.module.css";

const mockBroadcasts = [
  { id: "1", name: "Diwali Sale — Flash Offer 🎉", status: "completed", date: "Oct 28, 2026", sent: 12450, delivered: 12100, read: 8940, replied: 1230, preview: "🪔 Happy Diwali! Get 40% OFF on all plans for the next 48 hours. Use code DIWALI40. Reply NOW to claim!" },
  { id: "2", name: "Product Launch — Growth AI", status: "sending", date: "Today", sent: 4200, delivered: 3890, read: 1020, replied: 180, preview: "🚀 Introducing AI Reply Suggestions — now live on the Growth plan! Your agents can respond 3x faster. Try it today →" },
  { id: "3", name: "Black Friday — Early Access", status: "scheduled", date: "Nov 24, 2026", sent: 0, delivered: 0, read: 0, replied: 0, preview: "⚡ Black Friday is HERE! Early access for our loyal customers. 50% OFF Enterprise plan — only 100 slots available." },
  { id: "4", name: "Monthly Newsletter — Oct", status: "completed", date: "Oct 1, 2026", sent: 9800, delivered: 9650, read: 6230, replied: 890, preview: "📰 What's new at TickerPro: Multi-language chatbot support, Shopify integration, and more. Read the full update →" },
  { id: "5", name: "Re-engagement — Silent leads", status: "draft", date: "—", sent: 0, delivered: 0, read: 0, replied: 0, preview: "Hey {{name}}! We noticed you haven't been active lately. Here's an exclusive offer to get back: 20% OFF your next month." },
  { id: "6", name: "Webinar Invite — WhatsApp Growth", status: "completed", date: "Sep 15, 2026", sent: 5600, delivered: 5480, read: 3210, replied: 520, preview: "🎓 Free Webinar: 10x Your Sales on WhatsApp. Join our CEO this Thursday at 4 PM IST. Limited spots — register now!" },
];

const statusStyles: Record<string, string | undefined> = {
  completed: styles.statusCompleted,
  sending: styles.statusSending,
  scheduled: styles.statusScheduled,
  draft: styles.statusDraft,
};

export default function BroadcastsPage() {
  const [search, setSearch] = useState("");

  const filtered = mockBroadcasts.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Broadcasts</h1>
          <p className={styles.pageSubtitle}>{mockBroadcasts.length} campaigns</p>
        </div>
        <div className={styles.topbarActions}>
          <div className={styles.searchBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input placeholder="Search broadcasts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className={styles.primaryBtn}>+ New Broadcast</button>
        </div>
      </div>

      <div className={styles.cardGrid}>
        {filtered.map((b, i) => (
          <Link href={`/dashboard/broadcasts/${b.id}`} key={b.id} className={styles.broadcastCard} style={{ animationDelay: `${i * 0.05}s`, textDecoration: 'none', color: 'inherit' }}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>{b.name}</div>
                <div className={styles.cardDate}>{b.date}</div>
              </div>
              <span className={`${styles.cardStatus} ${statusStyles[b.status]}`}>
                {b.status}
              </span>
            </div>

            <div className={styles.cardPreview}>{b.preview}</div>

            <div className={styles.cardStats}>
              <div className={styles.cardStat}>
                <div className={styles.cardStatValue}>{b.sent > 0 ? (b.sent / 1000).toFixed(1) + "k" : "—"}</div>
                <div className={styles.cardStatLabel}>Sent</div>
              </div>
              <div className={styles.cardStat}>
                <div className={styles.cardStatValue}>{b.delivered > 0 ? Math.round((b.delivered / b.sent) * 100) + "%" : "—"}</div>
                <div className={styles.cardStatLabel}>Delivered</div>
              </div>
              <div className={styles.cardStat}>
                <div className={styles.cardStatValue}>{b.read > 0 ? Math.round((b.read / b.delivered) * 100) + "%" : "—"}</div>
                <div className={styles.cardStatLabel}>Read</div>
              </div>
              <div className={styles.cardStat}>
                <div className={styles.cardStatValue}>{b.replied > 0 ? Math.round((b.replied / b.read) * 100) + "%" : "—"}</div>
                <div className={styles.cardStatLabel}>Replied</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
