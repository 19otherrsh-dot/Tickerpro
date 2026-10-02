"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import { SkeletonCard } from "../../lib/components/Skeleton";
import { useToast } from "../../lib/components/Toast";
import styles from "./page.module.css";

interface DripStep {
  delayHours: number;
  templateName: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  steps: DripStep[];
  _count: { enrollments: number };
}

export default function DripsPage() {
  const { workspaces } = useAuth();
  const currentWorkspace = workspaces[0];
  const { addToast: toast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("NEW_CONTACT");
  const [steps, setSteps] = useState<DripStep[]>([{ delayHours: 24, templateName: "welcome_message" }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, [currentWorkspace]);

  const fetchCampaigns = async () => {
    if (!currentWorkspace) return;
    try {
      const res = await apiFetch(`/api/drips?workspaceId=${currentWorkspace.id}`);
      if (res.ok) setCampaigns(res.data.campaigns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!currentWorkspace || !newName) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/drips", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          name: newName,
          triggerType: newTrigger,
          triggerData: {},
          steps
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setNewName("");
        setSteps([{ delayHours: 24, templateName: "welcome_message" }]);
        fetchCampaigns();
      } else {
        toast(res.data?.error || "Failed to create campaign", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await apiFetch(`/api/drips/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchCampaigns();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Drip Campaigns</h1>
          <p className={styles.pageSubtitle}>Automated multi-step message sequences.</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setIsModalOpen(true)}>
          + Create Sequence
        </button>
      </div>

      <div className={styles.cardGrid}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} height={180} />)}
          </div>
        ) : campaigns.length === 0 ? <p>No sequences found.</p> : (
          campaigns.map(c => (
            <div key={c.id} className={styles.dripCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>{c.name}</span>
                <span className={`${styles.statusPill} ${styles[c.status]}`}>{c.status}</span>
              </div>
              
              <div style={{ fontSize: "0.85rem", color: "var(--tp-text-tertiary)", marginBottom: "16px" }}>
                Trigger: <strong>{c.triggerType}</strong>
              </div>

              <div style={{ fontSize: "0.85rem", color: "var(--tp-text-secondary)" }}>
                {c.steps.length} Steps Sequence:
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  {c.steps.map((s, idx) => (
                    <li key={idx}>Wait {s.delayHours}h âž Send <em>{s.templateName}</em></li>
                  ))}
                </ul>
              </div>

              <div className={styles.cardStats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{c._count.enrollments}</span>
                  <span className={styles.statLabel}>Enrolled</span>
                </div>
                <div style={{ flex: 1 }} />
                <button 
                  onClick={() => toggleStatus(c.id, c.status)}
                  className={styles.secondaryBtn} 
                  style={{ alignSelf: "center", padding: "4px 10px", fontSize: "0.75rem" }}
                >
                  {c.status === "ACTIVE" ? "Pause" : "Activate"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>New Drip Sequence</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>Ã—</button>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Campaign Name</label>
              <input 
                className={styles.formInput} 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                placeholder="e.g. Welcome Series" 
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Trigger</label>
              <select className={styles.formInput} value={newTrigger} onChange={e => setNewTrigger(e.target.value)}>
                <option value="NEW_CONTACT">When new contact is added</option>
                <option value="MANUAL">Manual enrollment</option>
                <option value="TAG_ADDED">When specific tag is added</option>
              </select>
            </div>

            <label className={styles.formLabel}>Sequence Steps</label>
            {steps.map((s, i) => (
              <div key={i} className={styles.stepBox}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.7rem", color: "var(--tp-text-tertiary)" }}>Delay (Hours)</label>
                    <input 
                      type="number" 
                      className={styles.formInput} 
                      value={s.delayHours} 
                      onChange={e => {
                        const newSteps = [...steps];
                        newSteps[i]!.delayHours = parseInt(e.target.value) || 0;
                        setSteps(newSteps);
                      }} 
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: "0.7rem", color: "var(--tp-text-tertiary)" }}>Template Name</label>
                    <input 
                      className={styles.formInput} 
                      value={s.templateName} 
                      onChange={e => {
                        const newSteps = [...steps];
                        newSteps[i]!.templateName = e.target.value;
                        setSteps(newSteps);
                      }} 
                    />
                  </div>
                </div>
              </div>
            ))}

            <button 
              className={styles.addStepBtn} 
              onClick={() => setSteps([...steps, { delayHours: 24, templateName: "" }])}
            >
              + Add Another Step
            </button>

            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className={styles.primaryBtn} onClick={handleCreate} disabled={submitting || !newName}>
                {submitting ? "Saving..." : "Save Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
