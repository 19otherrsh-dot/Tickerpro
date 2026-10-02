"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../../lib/auth-context";
import { SkeletonTable } from "../../../lib/components/Skeleton";
import { useToast } from "../../../lib/components/Toast";
import styles from "./page.module.css";

interface KnowledgeBase {
  id: string;
  name: string;
  sourceType: "URL" | "PDF" | "TEXT";
  sourceUrl?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  createdAt: string;
}

export default function KnowledgeBasePage() {
  const { workspaces } = useAuth();
  const currentWorkspace = workspaces[0];
  const { addToast } = useToast();

  const [data, setData] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"TEXT" | "URL">("TEXT");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchKB();
    // Polling every 5 seconds to get status updates for chunks processing
    const interval = setInterval(fetchKB, 5000);
    return () => clearInterval(interval);
  }, [currentWorkspace]);

  const fetchKB = async () => {
    if (!currentWorkspace) return;
    try {
      const res = await apiFetch(`/api/knowledge?workspaceId=${currentWorkspace.id}`);
      if (res.ok && res.data.knowledgeBases) {
        setData(res.data.knowledgeBases);
      }
    } catch (err) {
      console.error("Failed to fetch knowledge bases", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setSubmitting(true);

    try {
      const res = await apiFetch(`/api/knowledge?workspaceId=${currentWorkspace.id}`, {
        method: "POST",
        body: JSON.stringify({
          name,
          sourceType,
          content,
          sourceUrl: sourceType === "URL" ? sourceUrl : undefined,
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        // Reset form
        setName("");
        setContent("");
        setSourceUrl("");
        fetchKB(); // Refresh list immediately
      } else {
        addToast("Failed to add knowledge base", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("An error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentWorkspace || !confirm("Delete this document?")) return;
    try {
      await apiFetch(`/api/knowledge/${id}?workspaceId=${currentWorkspace.id}`, { method: "DELETE" });
      setData(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentWorkspace) return (
    <div style={{ padding: 40 }}><SkeletonTable rows={4} columns={5} /></div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Knowledge Base (AI)</h1>
          <p className={styles.subtitle}>Upload documents to train your GenAI chatbot agent.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
          + Add Document
        </button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Date Added</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--tp-text-tertiary)" }}>
                No knowledge base documents found. Add your first document to train your AI!
              </td>
            </tr>
          ) : (
            data.map(item => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td><span className={styles.typePill}>{item.sourceType}</span></td>
                <td>
                  <span className={`${styles.statusPill} ${styles[`status${item.status.charAt(0) + item.status.slice(1).toLowerCase()}`] || ""}`}>
                    {item.status}
                  </span>
                </td>
                <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                <td>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    style={{ color: "var(--tp-brand-600)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Add to Knowledge Base</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>Document Name</label>
                <input 
                  required
                  className={styles.input} 
                  placeholder="e.g. Return Policy 2026"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Source Type</label>
                <select 
                  className={styles.input}
                  value={sourceType}
                  onChange={e => setSourceType(e.target.value as any)}
                >
                  <option value="TEXT">Raw Text / Paste</option>
                  <option value="URL">Website URL (MVP: Copy Paste content)</option>
                </select>
              </div>

              {sourceType === "URL" && (
                <div className={styles.formGroup}>
                  <label>URL</label>
                  <input 
                    className={styles.input} 
                    placeholder="https://..."
                    value={sourceUrl}
                    onChange={e => setSourceUrl(e.target.value)}
                  />
                  <small style={{ color: "var(--tp-text-tertiary)", marginTop: 4, display: "block" }}>
                    Note: For MVP, auto-scraping is disabled. Please paste the text content below.
                  </small>
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Content</label>
                <textarea 
                  required
                  className={styles.textarea} 
                  placeholder="Paste the text content here..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? "Processing..." : "Add Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
