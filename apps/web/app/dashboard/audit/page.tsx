"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import styles from "../flows/page.module.css";

interface AuditEntry {
  id: string;
  action: string;
  details: any;
  userId: string | null;
  user?: { firstName: string; lastName: string; email: string } | null;
  createdAt: string;
}

const MOCK_AUDIT_DATA: AuditEntry[] = [
  { id: "1", action: "USER_LOGIN", details: { ip: "192.168.1.10", browser: "Chrome" }, userId: "u1", user: { firstName: "Arjun", lastName: "Singh", email: "arjun@tickerpro.com" }, createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: "2", action: "BROADCAST_SENT", details: { broadcastId: "bc_abc", recipients: 1250 }, userId: "u1", user: { firstName: "Arjun", lastName: "Singh", email: "arjun@tickerpro.com" }, createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: "3", action: "CONTACT_EXPORTED", details: { format: "CSV", count: 5420 }, userId: "u2", user: { firstName: "Priya", lastName: "Sharma", email: "priya@tickerpro.com" }, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: "4", action: "TEMPLATE_SUBMITTED", details: { templateName: "order_confirmation", status: "PENDING" }, userId: "u1", user: { firstName: "Arjun", lastName: "Singh", email: "arjun@tickerpro.com" }, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "5", action: "WEBHOOK_CREATED", details: { url: "https://hooks.zapier.com/abc123" }, userId: "u2", user: { firstName: "Priya", lastName: "Sharma", email: "priya@tickerpro.com" }, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "6", action: "ROLE_CHANGED", details: { targetUser: "agent@tickerpro.com", from: "AGENT", to: "MANAGER" }, userId: "u1", user: { firstName: "Arjun", lastName: "Singh", email: "arjun@tickerpro.com" }, createdAt: new Date(Date.now() - 14400000).toISOString() },
  { id: "7", action: "SLA_BREACH", details: { conversationId: "conv_xyz", waitTime: "18 min" }, userId: null, user: null, createdAt: new Date(Date.now() - 21600000).toISOString() },
  { id: "8", action: "BILLING_UPDATED", details: { plan: "Pro", amount: "$99/mo" }, userId: "u1", user: { firstName: "Arjun", lastName: "Singh", email: "arjun@tickerpro.com" }, createdAt: new Date(Date.now() - 43200000).toISOString() },
  { id: "9", action: "INTEGRATION_CONNECTED", details: { type: "SHOPIFY", store: "mystore.myshopify.com" }, userId: "u2", user: { firstName: "Priya", lastName: "Sharma", email: "priya@tickerpro.com" }, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "10", action: "FLOW_PUBLISHED", details: { flowName: "Lead Qualification", metaFlowId: "flow_abc" }, userId: "u1", user: { firstName: "Arjun", lastName: "Singh", email: "arjun@tickerpro.com" }, createdAt: new Date(Date.now() - 172800000).toISOString() },
];

const actionColors: Record<string, string> = {
  USER_LOGIN: "#6366F1",
  BROADCAST_SENT: "#10B981",
  CONTACT_EXPORTED: "#F59E0B",
  TEMPLATE_SUBMITTED: "#8B5CF6",
  WEBHOOK_CREATED: "#3B82F6",
  ROLE_CHANGED: "#EC4899",
  SLA_BREACH: "#EF4444",
  BILLING_UPDATED: "#14B8A6",
  INTEGRATION_CONNECTED: "#F97316",
  FLOW_PUBLISHED: "#06B6D4",
};

export default function AuditPage() {
  const { activeWorkspace } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>(MOCK_AUDIT_DATA);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const allActions = [...new Set(MOCK_AUDIT_DATA.map(e => e.action))];

  const filtered = entries.filter(e => {
    const matchesSearch = !search || 
      e.action.toLowerCase().includes(search.toLowerCase()) || 
      e.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(e.details).toLowerCase().includes(search.toLowerCase());
    const matchesAction = !filterAction || e.action === filterAction;
    return matchesSearch && matchesAction;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Log</h1>
          <p className={styles.subtitle}>Track every security-relevant action across your workspace</p>
        </div>
      </div>

      <div className={styles.searchRow}>
        <input
          type="text"
          className={styles.input}
          placeholder="Search by action, user, or details..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
        <select
          className={styles.input}
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">All Actions</option>
          {allActions.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>No audit entries found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div style={{ overflow: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: "0.85rem", color: "var(--tp-text-tertiary)" }}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span 
                      className={styles.actionBadge} 
                      style={{ 
                        color: actionColors[entry.action] || "#6B7280",
                        borderColor: `${actionColors[entry.action] || "#6B7280"}40`,
                        background: `${actionColors[entry.action] || "#6B7280"}10`,
                      }}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.88rem" }}>
                    {entry.user ? (
                      <span>{entry.user.firstName} {entry.user.lastName}</span>
                    ) : (
                      <span style={{ color: "var(--tp-text-tertiary)", fontStyle: "italic" }}>System</span>
                    )}
                  </td>
                  <td>
                    <code style={{ fontSize: "0.78rem", color: "var(--tp-text-secondary)", background: "var(--tp-bg-secondary)", padding: "2px 8px", borderRadius: 4 }}>
                      {JSON.stringify(entry.details)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
