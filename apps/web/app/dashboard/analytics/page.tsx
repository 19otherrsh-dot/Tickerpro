"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth, apiFetch } from "../../lib/auth-context";
import { SkeletonDashboard } from "../../lib/components/Skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import styles from "./page.module.css";

const funnelData = [
  { label: "Sent", value: 12450, color: "var(--tp-brand-600)" },
  { label: "Delivered", value: 12100, color: "var(--tp-brand-500)" },
  { label: "Read", value: 8940, color: "var(--tp-success)" },
  { label: "Replied", value: 1230, color: "#059669" },
  { label: "Converted", value: 340, color: "#047857" },
];

export default function AnalyticsPage() {
  const { workspaces } = useAuth();
  const currentWorkspace = workspaces[0];

  const [stats, setStats] = useState<any[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<any[]>([]);
  const [campaignMetrics, setCampaignMetrics] = useState<any[]>([]);
  const [adsMetrics, setAdsMetrics] = useState<any[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;
    
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [overviewRes, agentsRes, campaignsRes, adsRes, volumeRes] = await Promise.all([
          apiFetch(`/api/analytics/overview?workspaceId=${currentWorkspace.id}`),
          apiFetch(`/api/analytics/agents?workspaceId=${currentWorkspace.id}`),
          apiFetch(`/api/analytics/campaigns?workspaceId=${currentWorkspace.id}`),
          apiFetch(`/api/analytics/ads?workspaceId=${currentWorkspace.id}`),
          apiFetch(`/api/analytics/volume?workspaceId=${currentWorkspace.id}`)
        ]);

        if (overviewRes.ok) setStats(overviewRes.data.stats || []);
        if (agentsRes.ok) setAgentPerformance(agentsRes.data.agentPerformance || []);
        if (campaignsRes.ok) setCampaignMetrics(campaignsRes.data.campaignMetrics || []);
        if (adsRes.ok) setAdsMetrics(adsRes.data.adsMetrics || []);
        if (volumeRes.ok && volumeRes.data.volume) {
          const formattedVolume = volumeRes.data.volume.map((v: any) => ({
            ...v,
            timeLabel: new Date(v.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          setVolumeData(formattedVolume);
        }
      } catch (error) {
        console.error("Failed to load analytics", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [currentWorkspace]);

  // P4: Export to CSV
  const handleExportCSV = () => {
    const rows = [
      ["Metric", "Value", "Change"],
      ...stats.map(s => [s.label, s.value, s.change]),
      [],
      ["Agent", "Avg Response", "Resolved", "CSAT", "Messages"],
      ...agentPerformance.map(a => [a.name, a.avgResponse, a.resolved, a.csat, a.messages]),
      [],
      ["Campaign", "Sent", "Delivered", "Read", "Revenue"],
      ...campaignMetrics.map(c => [c.name, c.sent, c.delivered, c.read, c.converted]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickerpro-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxFunnel = funnelData[0]?.value || 1;

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Analytics</h1>
          <p className={styles.pageSubtitle}>Real-time insights across your WhatsApp operations</p>
        </div>
        <div className={styles.topbarActions}>
          <Link href="/dashboard/analytics/leaderboard" style={{ padding: "8px 16px", background: "var(--tp-brand-50)", color: "var(--tp-brand-700)", border: "1px solid var(--tp-brand-200)", borderRadius: "var(--tp-radius-md)", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            🏆 Leaderboard
          </Link>
          <select className={styles.selectBtn}>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This year</option>
          </select>
          <button className={styles.exportBtn} onClick={handleExportCSV}>↓ Export CSV</button>
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <SkeletonDashboard />
        ) : (
          <>
            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
              {stats.map((s, i) => (
                <div key={s.label} className={styles.kpiCard} style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className={styles.kpiIcon}>{s.icon}</div>
                  <div className={styles.kpiBody}>
                    <div className={styles.kpiValue}>{s.value}</div>
                    <div className={styles.kpiLabel}>{s.label}</div>
                  </div>
                  <span className={`${styles.kpiChange} ${s.up ? styles.up : styles.down}`}>{s.change}</span>
                </div>
              ))}
            </div>

            {/* Message Volume Over Time (ClickHouse) */}
            <div className={styles.card} style={{ marginBottom: 24 }}>
              <div className={styles.cardHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 className={styles.cardTitle} style={{ margin: 0 }}>Message Volume (24h)</h3>
                <span className={styles.statusPill} style={{ background: "var(--tp-brand-100)", color: "var(--tp-brand-700)", padding: "4px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 }}>POWERED BY CLICKHOUSE</span>
              </div>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <AreaChart data={volumeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--tp-brand-500)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--tp-brand-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--tp-border)" />
                    <XAxis dataKey="timeLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--tp-text-tertiary)" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--tp-text-tertiary)" }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      labelStyle={{ color: "var(--tp-text-secondary)", fontWeight: 600, marginBottom: 4 }}
                    />
                    <Area type="monotone" dataKey="totalMessages" name="Messages" stroke="var(--tp-brand-500)" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Funnel Visualization */}
            <div className={styles.card} style={{ marginBottom: 24 }}>
              <h3 className={styles.cardTitle}>📊 Broadcast Funnel</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                {funnelData.map((step, i) => {
                  const pct = Math.round((step.value / maxFunnel) * 100);
                  return (
                    <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 90, textAlign: "right", fontSize: "0.85rem", fontWeight: 600, color: "var(--tp-text-secondary)" }}>{step.label}</div>
                      <div style={{ flex: 1, background: "var(--tp-bg-tertiary)", borderRadius: 8, height: 32, overflow: "hidden", position: "relative" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: step.color, borderRadius: 8, transition: "width 0.8s ease", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12 }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "white" }}>{step.value.toLocaleString()}</span>
                        </div>
                      </div>
                      <div style={{ width: 50, fontSize: "0.8rem", color: "var(--tp-text-tertiary)" }}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.gridTwoCol}>
              {/* Agent Performance */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Agent Performance</h3>
                <table className={styles.miniTable}>
                  <thead>
                    <tr><th>Agent</th><th>Avg Response</th><th>Resolved</th><th>CSAT</th><th>Messages</th></tr>
                  </thead>
                  <tbody>
                    {agentPerformance.map((a) => (
                      <tr key={a.name}>
                        <td className={styles.bold}>{a.name}</td>
                        <td>{a.avgResponse}</td>
                        <td>{a.resolved}</td>
                        <td><span className={styles.csatPill}>⭐ {a.csat}</span></td>
                        <td>{a.messages}</td>
                      </tr>
                    ))}
                    {agentPerformance.length === 0 && (
                      <tr><td colSpan={5} style={{textAlign: "center", color: "#6b7280"}}>No agents found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Campaign Performance */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Campaign Performance</h3>
                <table className={styles.miniTable}>
                  <thead>
                    <tr><th>Campaign</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Revenue</th></tr>
                  </thead>
                  <tbody>
                    {campaignMetrics.map((c) => (
                      <tr key={c.name}>
                        <td className={styles.bold}>{c.name}</td>
                        <td>{c.sent}</td>
                        <td>{c.delivered}</td>
                        <td>{c.read}</td>
                        <td className={styles.revenue}>{c.converted}</td>
                      </tr>
                    ))}
                    {campaignMetrics.length === 0 && (
                      <tr><td colSpan={5} style={{textAlign: "center", color: "#6b7280"}}>No campaigns found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.gridTwoCol} style={{ marginTop: "24px" }}>
              {/* Ads ROI Dashboard */}
              <div className={styles.card}>
                <div className={styles.cardHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 className={styles.cardTitle} style={{ margin: 0 }}>Click-to-WhatsApp Ads ROI</h3>
                  <span className={styles.statusPill} style={{ background: "var(--tp-brand-100)", color: "var(--tp-brand-700)", padding: "4px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 }}>LIVE SYNC</span>
                </div>
                <table className={styles.miniTable} style={{ marginTop: "16px" }}>
                  <thead>
                    <tr><th>Ad Title</th><th>Source</th><th>CTWA Clicks</th><th>Conversations</th><th>ROAS</th></tr>
                  </thead>
                  <tbody>
                    {adsMetrics.map((ad) => (
                      <tr key={ad.adId}>
                        <td className={styles.bold}>{ad.title}</td>
                        <td>{ad.source}</td>
                        <td>{ad.clicks}</td>
                        <td>{ad.conversations}</td>
                        <td className={styles.revenue} style={{ color: "var(--tp-success)" }}>{ad.roas}</td>
                      </tr>
                    ))}
                    {adsMetrics.length === 0 && (
                      <tr><td colSpan={5} style={{textAlign: "center", color: "#6b7280"}}>No ads data found. Connect Meta Ads.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sentiment Overview */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Conversation Sentiment Distribution</h3>
              <div className={styles.sentimentBar}>
                <div className={styles.sentimentSegment} style={{ width: "58%", background: "var(--tp-success)" }} title="Positive: 58%">
                  <span>Positive 58%</span>
                </div>
                <div className={styles.sentimentSegment} style={{ width: "28%", background: "var(--tp-gray-400)" }} title="Neutral: 28%">
                  <span>Neutral 28%</span>
                </div>
                <div className={styles.sentimentSegment} style={{ width: "10%", background: "var(--tp-danger)" }} title="Negative: 10%">
                  <span>10%</span>
                </div>
                <div className={styles.sentimentSegment} style={{ width: "4%", background: "var(--tp-warning)" }} title="Churn Risk: 4%">
                </div>
              </div>
              <div className={styles.sentimentLegend}>
                <span><span className={styles.dot} style={{ background: "var(--tp-success)" }} /> Positive</span>
                <span><span className={styles.dot} style={{ background: "var(--tp-gray-400)" }} /> Neutral</span>
                <span><span className={styles.dot} style={{ background: "var(--tp-danger)" }} /> Negative</span>
                <span><span className={styles.dot} style={{ background: "var(--tp-warning)" }} /> Churn Risk</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
