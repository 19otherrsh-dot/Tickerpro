"use client";

import { useEffect, useState } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import styles from "./page.module.css";

export default function KnowledgeBasePage() {
  const { activeWorkspace, workspaces } = useAuth();
  const currentWorkspace = activeWorkspace || workspaces[0];
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchKBs = async () => {
    if (!currentWorkspace) return;
    try {
      const res = await apiFetch(`/api/knowledge?workspaceId=${currentWorkspace.id}`);
      if (res.ok) {
        setKnowledgeBases(res.data.knowledgeBases);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKBs();
    // Poll for status updates if any are pending/processing
    const interval = setInterval(() => {
      fetchKBs();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentWorkspace]);

  const handleSave = async () => {
    if (!currentWorkspace || !name || !url) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/knowledge?workspaceId=${currentWorkspace.id}`, {
        method: "POST",
        body: JSON.stringify({
          name,
          sourceType: "URL",
          sourceUrl: url,
          content: "URL_INGESTION" // Mock content to bypass MVP validation
        })
      });

      if (res.ok) {
        setShowModal(false);
        setName("");
        setUrl("");
        fetchKBs();
      } else {
        alert("Failed to add Knowledge Base");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding Knowledge Base");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentWorkspace) return;
    if (!confirm("Are you sure you want to delete this knowledge base?")) return;

    try {
      const res = await apiFetch(`/api/knowledge/${id}?workspaceId=${currentWorkspace.id}`, {
        method: "DELETE"
      });
      if (res.ok) fetchKBs();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading Knowledge Base...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Knowledge Base</h1>
          <p className={styles.subtitle}>Train your AI to answer customer questions automatically using your own data.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          + Add Source
        </button>
      </div>

      <div className={styles.cardList}>
        {knowledgeBases.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
            No knowledge sources added yet. Click "Add Source" to begin!
          </div>
        ) : (
          knowledgeBases.map((kb) => (
            <div key={kb.id} className={styles.card}>
              <div className={styles.iconWrapper}>ðŸŒ </div>
              <div className={styles.cardContent}>
                <h3 className={styles.kbName}>{kb.name}</h3>
                <a href={kb.sourceUrl} target="_blank" rel="noreferrer" className={styles.kbUrl}>
                  {kb.sourceUrl}
                </a>
              </div>
              <div className={`${styles.statusBadge} ${styles[`status${kb.status}`]}`}>
                {kb.status}
              </div>
              <button className={styles.deleteBtn} onClick={() => handleDelete(kb.id)}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Add Website URL</h2>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Name</label>
              <input 
                className={styles.formInput} 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Return Policy FAQ" 
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Website URL</label>
              <input 
                className={styles.formInput} 
                type="url"
                value={url} 
                onChange={e => setUrl(e.target.value)} 
                placeholder="https://example.com/faq" 
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </button>
              <button className={styles.addBtn} onClick={handleSave} disabled={saving || !name || !url}>
                {saving ? "Ingesting..." : "Save & Sync"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
