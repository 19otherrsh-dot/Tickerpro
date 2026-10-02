"use client";

import Link from "next/link";
import styles from "./page.module.css";

const mockLeaderboard = [
  { name: "Priya Sharma", initials: "PS", resolved: 142, avgResponse: "1m 23s", csat: 4.9, messages: 1820, fast: true },
  { name: "Rahul Mehta", initials: "RM", resolved: 128, avgResponse: "2m 05s", csat: 4.7, messages: 1540, fast: true },
  { name: "Anita Desai", initials: "AD", resolved: 115, avgResponse: "2m 48s", csat: 4.6, messages: 1320, fast: true },
  { name: "Vikram Singh", initials: "VS", resolved: 98, avgResponse: "3m 12s", csat: 4.5, messages: 1180, fast: false },
  { name: "Neha Patel", initials: "NP", resolved: 87, avgResponse: "3m 45s", csat: 4.3, messages: 960, fast: false },
  { name: "Arjun Kumar", initials: "AK", resolved: 72, avgResponse: "4m 10s", csat: 4.1, messages: 840, fast: false },
];

export default function LeaderboardPage() {
  const top3 = mockLeaderboard.slice(0, 3);
  const rest = mockLeaderboard.slice(3);

  return (
    <div className={styles.page}>
      <Link href="/dashboard/analytics" className={styles.backLink}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Analytics
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🏆 Agent Leaderboard</h1>
          <p className={styles.subtitle}>Performance rankings for the last 30 days</p>
        </div>
      </div>

      {/* Podium */}
      <div className={styles.podium}>
        {/* Silver - 2nd */}
        <div className={`${styles.podiumItem} ${styles.silver}`} style={{ minHeight: 180 }}>
          <div className={styles.rank}>🥈</div>
          <div className={styles.avatar}>{top3[1]?.initials}</div>
          <div className={styles.agentName}>{top3[1]?.name}</div>
          <div className={styles.agentStat}>{top3[1]?.resolved} resolved · ⭐ {top3[1]?.csat}</div>
        </div>
        {/* Gold - 1st */}
        <div className={`${styles.podiumItem} ${styles.gold}`} style={{ minHeight: 220 }}>
          <div className={styles.rank}>🥇</div>
          <div className={styles.avatar} style={{ width: 64, height: 64, fontSize: "1.4rem" }}>{top3[0]?.initials}</div>
          <div className={styles.agentName}>{top3[0]?.name}</div>
          <div className={styles.agentStat}>{top3[0]?.resolved} resolved · ⭐ {top3[0]?.csat}</div>
        </div>
        {/* Bronze - 3rd */}
        <div className={`${styles.podiumItem} ${styles.bronze}`} style={{ minHeight: 160 }}>
          <div className={styles.rank}>🥉</div>
          <div className={styles.avatar}>{top3[2]?.initials}</div>
          <div className={styles.agentName}>{top3[2]?.name}</div>
          <div className={styles.agentStat}>{top3[2]?.resolved} resolved · ⭐ {top3[2]?.csat}</div>
        </div>
      </div>

      {/* Full Table */}
      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Agent</th>
              <th>Resolved</th>
              <th>Avg. Response</th>
              <th>CSAT</th>
              <th>Messages</th>
              <th>Speed</th>
            </tr>
          </thead>
          <tbody>
            {mockLeaderboard.map((agent, i) => (
              <tr key={agent.name}>
                <td style={{ fontWeight: 700 }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{agent.name}</td>
                <td>{agent.resolved}</td>
                <td>{agent.avgResponse}</td>
                <td><span className={styles.csatPill}>⭐ {agent.csat}</span></td>
                <td>{agent.messages.toLocaleString()}</td>
                <td>
                  <span className={`${styles.badge} ${agent.fast ? styles.badgeFast : styles.badgeSlow}`}>
                    {agent.fast ? "⚡ Fast" : "🐢 Needs Improvement"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
