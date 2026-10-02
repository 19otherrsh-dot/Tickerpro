"use client";

import { useEffect, useState } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import styles from "./page.module.css";

interface DripStep {
  delayHours: number;
  templateName: string;
}

export default function DripCampaignsPage() {
  const { activeWorkspace, workspaces } = useAuth();
  const currentWorkspace = activeWorkspace || workspaces[0];
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("TAG_ADDED");
  const [triggerTag, setTriggerTag] = useState("");
  const [steps, setSteps] = useState<DripStep[]>([{ delayHours: 0, templateName: "" }]);

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

  useEffect(() => {
    fetchCampaigns();
  }, [currentWorkspace]);

  const handleSave = async () => {
    if (!currentWorkspace) return;
    if (!name.trim()) return alert("Please enter a campaign name.");
    if (triggerType === "TAG_ADDED" && !triggerTag.trim()) return alert("Please enter a tag name to trigger this campaign.");
    if (steps.length === 0) return alert("Please add at least one step.");
    
    for (const [idx, step] of steps.entries()) {
      if (step.delayHours < 0) return alert(`Step ${idx + 1}: Delay cannot be negative.`);
      if (!step.templateName.trim()) return alert(`Step ${idx + 1}: Template name is required.`);
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/drips", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          name,
          triggerType,
          triggerData: { tag: triggerTag },
          steps
        })
      });

      if (res.ok) {
        setShowModal(false);
        setName("");
        setTriggerTag("");
        setSteps([{ delayHours: 0, templateName: "" }]);
        fetchCampaigns();
      }
    } catch (err) {
      console.error(err);
      alert("Error saving campaign");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (!currentWorkspace) return;
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

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value } as DripStep;
    setSteps(newSteps);
  };

  const addStep = () => setSteps([...steps, { delayHours: 24, templateName: "" }]);

  if (loading) return <div style={{ padding: 40 }}>Loading Campaigns...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Drip Campaigns</h1>
          <p className={styles.subtitle}>Automate multi-day messaging sequences for your customers.</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setShowModal(true)}>
          + Create Campaign
        </button>
      </div>

      <div className={styles.cardList}>
        {campaigns.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
            No campaigns found. Create one to get started!
          </div>
        ) : (
          campaigns.map(camp => (
            <div key={camp.id} className={styles.card}>
              <div className={styles.cardLeft}>
                <div className={styles.cardTitle}>{camp.name}</div>
                <div className={styles.cardMeta}>
                  Trigger: {camp.triggerType} ({camp.triggerData?.tag || "N/A"}) â€¢ {camp.steps.length} Steps â€¢ {camp._count?.enrollments || 0} Enrolled
                </div>
              </div>
              <div className={styles.cardRight}>
                <div className={`${styles.statusBadge} ${styles[`status${camp.status}`]}`}>
                  {camp.status}
                </div>
                <button className={styles.secondaryBtn} onClick={() => toggleStatus(camp.id, camp.status)}>
                  {camp.status === "ACTIVE" ? "Pause" : "Activate"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>New Drip Campaign</h2>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Campaign Name</label>
              <input 
                className={styles.formInput} 
                value={name} onChange={e => setName(e.target.value)} 
                placeholder="e.g. Abandoned Cart Recovery" 
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Trigger</label>
              <select className={styles.formSelect} value={triggerType} onChange={e => setTriggerType(e.target.value)}>
                <option value="TAG_ADDED">When Tag is Added</option>
                <option value="NEW_CONTACT">When New Contact Created</option>
              </select>
            </div>

            {triggerType === "TAG_ADDED" && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tag Name</label>
                <input 
                  className={styles.formInput} 
                  value={triggerTag} onChange={e => setTriggerTag(e.target.value)} 
                  placeholder="e.g. Abandoned Cart" 
                />
              </div>
            )}

            <div className={styles.stepsContainer}>
              <label className={styles.formLabel}>Message Sequence</label>
              {steps.map((step, idx) => (
                <div key={idx} className={styles.stepItem}>
                  <div className={styles.stepInputGroup}>
                    <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Wait (Hours)</label>
                    <input 
                      type="number" 
                      className={styles.formInput} 
                      value={step.delayHours} 
                      onChange={e => updateStep(idx, "delayHours", parseInt(e.target.value) || 0)} 
                    />
                  </div>
                  <div className={styles.stepInputGroup} style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>WhatsApp Template Name</label>
                    <input 
                      className={styles.formInput} 
                      value={step.templateName} 
                      onChange={e => updateStep(idx, "templateName", e.target.value)} 
                      placeholder="hello_world"
                    />
                  </div>
                </div>
              ))}
              <button className={styles.addStepBtn} onClick={addStep}>+ Add Message Step</button>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </button>
              <button className={styles.primaryBtn} onClick={handleSave} disabled={saving || !name || !steps[0]?.templateName}>
                {saving ? "Saving..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
