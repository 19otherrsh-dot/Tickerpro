"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import styles from "./page.module.css";

interface Flow {
  id: string;
  name: string;
  status: string;
  metaFlowId: string | null;
  screens: any;
  createdAt: string;
  updatedAt: string;
}

export default function FlowsPage() {
  const { activeWorkspace } = useAuth();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    fetchFlows();
  }, [activeWorkspace]);

  const fetchFlows = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/flows?workspaceId=${activeWorkspace!.id}`);
      if (res.ok) setFlows(res.data.flows || []);
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch(`/api/flows?workspaceId=${activeWorkspace!.id}`, {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          screens: [
            {
              id: "screen_1",
              title: "Welcome",
              fields: [
                { type: "text_input", label: "Your Name", required: true },
                { type: "text_input", label: "Email", required: false },
              ]
            }
          ]
        })
      });
      if (res.ok) {
        setFlows([res.data.flow, ...flows]);
        setNewName("");
        setShowCreate(false);
      }
    } catch { /* silent */ }
    setCreating(false);
  };

  const handlePublish = async (id: string) => {
    try {
      const res = await apiFetch(`/api/flows/${id}/publish?workspaceId=${activeWorkspace!.id}`, {
        method: "POST",
      });
      if (res.ok) fetchFlows();
    } catch { /* silent */ }
  };

  const statusColors: Record<string, string> = {
    DRAFT: "#F59E0B",
    PUBLISHED: "#10B981",
    DEPRECATED: "#EF4444",
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>WhatsApp Flows</h1>
          <p className={styles.subtitle}>Build native multi-screen forms inside WhatsApp conversations</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setShowCreate(true)}>
          + New Flow
        </button>
      </div>

      {showCreate && (
        <div className={styles.createCard}>
          <h3>Create a new Flow</h3>
          <p className={styles.createHint}>Flows allow you to build multi-step forms that users interact with directly inside WhatsApp.</p>
          <div className={styles.createRow}>
            <input
              type="text"
              placeholder="e.g. Lead Qualification Form"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
              className={styles.input}
            />
            <button className={styles.primaryBtn} onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create"}
            </button>
            <button className={styles.ghostBtn} onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.emptyState}>Loading flows...</div>
      ) : flows.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="8" height="6" rx="1" /><rect x="14" y="16" width="8" height="6" rx="1" />
              <path d="M6 8v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" /><path d="M18 12v4" />
            </svg>
          </div>
          <h3>No flows yet</h3>
          <p>Create your first WhatsApp Flow to collect structured data from customers without them ever leaving the chat.</p>
          <button className={styles.primaryBtn} onClick={() => setShowCreate(true)}>Create your first Flow</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {flows.map(flow => (
            <div key={flow.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{flow.name}</h3>
                <span className={styles.statusBadge} style={{ background: `${statusColors[flow.status] || "#6B7280"}20`, color: statusColors[flow.status] || "#6B7280" }}>
                  {flow.status}
                </span>
              </div>
              <div className={styles.cardMeta}>
                <span>{(flow.screens as any[])?.length || 0} screen(s)</span>
                <span>•</span>
                <span>{new Date(flow.updatedAt).toLocaleDateString()}</span>
              </div>
              {flow.metaFlowId && (
                <div className={styles.cardMeta} style={{ marginTop: 4 }}>
                  <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>Meta ID: {flow.metaFlowId}</span>
                </div>
              )}
              <div className={styles.cardActions}>
                {flow.status === "DRAFT" && (
                  <button className={styles.primaryBtn} onClick={() => handlePublish(flow.id)}>Publish to Meta</button>
                )}
                <button className={styles.ghostBtn}>Edit Screens</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
