"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import styles from "../flows/page.module.css";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  isActive: boolean;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  "message.received",
  "message.sent",
  "message.delivered",
  "message.read",
  "conversation.created",
  "conversation.closed",
  "contact.created",
  "contact.updated",
  "lead.stage_changed",
  "broadcast.completed",
  "payment.received",
  "*",
];

export default function WebhooksPage() {
  const { activeWorkspace } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["*"]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    fetchWebhooks();
  }, [activeWorkspace]);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/outbound-webhooks?workspaceId=${activeWorkspace!.id}`);
      if (res.ok) {
        setWebhooks(res.data.webhooks || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newUrl.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch(`/api/outbound-webhooks?workspaceId=${activeWorkspace!.id}`, {
        method: "POST",
        body: JSON.stringify({
          url: newUrl,
          events: selectedEvents,
          secret: newSecret || undefined,
        }),
      });
      if (res.ok) {
        setWebhooks([res.data.webhook, ...webhooks]);
        setNewUrl("");
        setNewSecret("");
        setSelectedEvents(["*"]);
        setShowCreate(false);
      }
    } catch { /* silent */ }
    setCreating(false);
  };

  const toggleEvent = (event: string) => {
    if (event === "*") {
      setSelectedEvents(["*"]);
      return;
    }
    const filtered = selectedEvents.filter(e => e !== "*");
    if (filtered.includes(event)) {
      setSelectedEvents(filtered.filter(e => e !== event));
    } else {
      setSelectedEvents([...filtered, event]);
    }
  };

  const toggleActive = async (id: string) => {
    try {
      await apiFetch(`/api/outbound-webhooks/${id}/toggle?workspaceId=${activeWorkspace!.id}`, { method: "PATCH" });
      setWebhooks(webhooks.map(w => w.id === id ? { ...w, isActive: !w.isActive } : w));
    } catch { /* silent */ }
  };

  const deleteWebhook = async (id: string) => {
    try {
      await apiFetch(`/api/outbound-webhooks/${id}?workspaceId=${activeWorkspace!.id}`, { method: "DELETE" });
      setWebhooks(webhooks.filter(w => w.id !== id));
    } catch { /* silent */ }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Outbound Webhooks</h1>
          <p className={styles.subtitle}>Deliver real-time events to external services like Zapier, Make, or your own backend</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setShowCreate(true)}>
          + Add Webhook
        </button>
      </div>

      {showCreate && (
        <div className={styles.createCard}>
          <h3>Register a Webhook Endpoint</h3>
          <p className={styles.createHint}>We'll send a POST request with a signed JSON payload to this URL whenever a subscribed event occurs.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className={styles.createRow}>
              <input
                type="url"
                placeholder="https://example.com/webhook"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className={styles.input}
              />
              <input
                type="text"
                placeholder="Signing secret (optional)"
                value={newSecret}
                onChange={e => setNewSecret(e.target.value)}
                className={styles.input}
                style={{ maxWidth: 240 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, color: "var(--tp-text-secondary)" }}>Subscribe to events:</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {AVAILABLE_EVENTS.map(event => (
                  <button
                    key={event}
                    onClick={() => toggleEvent(event)}
                    className={styles.eventTag}
                    style={{
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: selectedEvents.includes(event) ? "#6366F1" : "var(--tp-border)",
                      background: selectedEvents.includes(event) ? "#6366F120" : "transparent",
                      color: selectedEvents.includes(event) ? "#6366F1" : "var(--tp-text-tertiary)",
                    }}
                  >
                    {event === "*" ? "All Events (*)" : event}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className={styles.primaryBtn} onClick={handleCreate} disabled={creating || !newUrl.trim()}>
                {creating ? "Saving..." : "Save Webhook"}
              </button>
              <button className={styles.ghostBtn} onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.emptyState}>Loading webhooks...</div>
      ) : webhooks.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
              <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
              <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8H12" />
            </svg>
          </div>
          <h3>No webhooks configured</h3>
          <p>Add a webhook endpoint to receive real-time event notifications from TickerPro to any external service.</p>
          <button className={styles.primaryBtn} onClick={() => setShowCreate(true)}>Add your first Webhook</button>
        </div>
      ) : (
        <div style={{ overflow: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>URL</th>
                <th>Events</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map(wh => (
                <tr key={wh.id}>
                  <td><span className={styles.webhookUrl}>{wh.url}</span></td>
                  <td>
                    {wh.events.map(e => (
                      <span key={e} className={styles.eventTag}>{e}</span>
                    ))}
                  </td>
                  <td>
                    <button
                      className={styles.toggleActive}
                      style={{
                        background: wh.isActive ? "#10B98120" : "#EF444420",
                        color: wh.isActive ? "#10B981" : "#EF4444",
                      }}
                      onClick={() => toggleActive(wh.id)}
                    >
                      {wh.isActive ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td style={{ fontSize: "0.85rem", color: "var(--tp-text-tertiary)" }}>{new Date(wh.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className={styles.ghostBtn} style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => deleteWebhook(wh.id)}>Delete</button>
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
