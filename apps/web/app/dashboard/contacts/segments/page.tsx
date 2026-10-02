"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../../lib/auth-context";
import { useToast } from "../../../lib/components/Toast";
import styles from "./page.module.css";

interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

interface Segment {
  id: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  matchType: string;
}

export default function SegmentsPage() {
  const { activeWorkspace, workspaces } = useAuth();
  const currentWorkspace = activeWorkspace || workspaces[0];
  const { addToast } = useToast();

  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matchType, setMatchType] = useState("ALL");
  const [rules, setRules] = useState<SegmentRule[]>([{ field: "leadStage", operator: "EQUALS", value: "WON" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) fetchSegments();
  }, [currentWorkspace]);

  const fetchSegments = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/segments?workspaceId=${currentWorkspace.id}`);
      if (res.ok && res.data) {
        setSegments(res.data.segments || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = () => {
    setRules([...rules, { field: "leadStage", operator: "EQUALS", value: "" }]);
  };

  const handleUpdateRule = (index: number, key: keyof SegmentRule, val: string) => {
    const newRules = [...rules];
    const target = newRules[index];
    if (target) target[key] = val;
    setRules(newRules);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSaveSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/segments?workspaceId=${currentWorkspace.id}`, {
        method: "POST",
        body: JSON.stringify({ name, description, matchType, rules })
      });
      if (res.ok) {
        addToast("Segment created successfully!", "success");
        setIsModalOpen(false);
        fetchSegments();
        // Reset form
        setName("");
        setDescription("");
        setRules([{ field: "leadStage", operator: "EQUALS", value: "WON" }]);
      } else {
        addToast(res.data?.error || "Failed to create segment", "error");
      }
    } catch (e) {
      addToast("Error creating segment", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this segment?")) return;
    if (!currentWorkspace) return;
    try {
      const res = await apiFetch(`/api/segments/${id}?workspaceId=${currentWorkspace.id}`, { method: "DELETE" });
      if (res.ok) {
        addToast("Segment deleted", "success");
        fetchSegments();
      }
    } catch (e) {
      addToast("Failed to delete segment", "error");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Smart Audience Segments</h1>
          <p className={styles.subtitle}>Build dynamic rules to automatically filter contacts for targeted broadcasts.</p>
        </div>
        <button className={styles.createBtn} onClick={() => setIsModalOpen(true)}>
          + Create Segment
        </button>
      </div>

      {loading ? (
        <div>Loading segments...</div>
      ) : (
        <div className={styles.segmentsGrid}>
          {segments.map(seg => (
            <div key={seg.id} className={styles.segmentCard}>
              <div className={styles.segmentHeader}>
                <div>
                  <h3 className={styles.segmentName}>{seg.name}</h3>
                  <p className={styles.segmentDesc}>{seg.description}</p>
                </div>
                <button className={styles.deleteBtn} onClick={() => handleDelete(seg.id)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
              <div style={{ marginTop: "auto" }}>
                {seg.rules.map((r, i) => (
                  <span key={i} className={styles.rulePill}>
                    {r.field} {r.operator} {r.value}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {segments.length === 0 && (
            <div style={{ color: "#6B7280", fontStyle: "italic", gridColumn: "1 / -1" }}>
              No segments created yet. Build your first audience to start sending targeted campaigns.
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.title} style={{ marginBottom: 24 }}>Create Segment</h2>
            <form onSubmit={handleSaveSegment}>
              <div className={styles.formGroup}>
                <label>Segment Name</label>
                <input 
                  type="text" 
                  required 
                  className={styles.input} 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. VIP Customers"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Description</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="e.g. Customers who have won deals"
                />
              </div>

              <div className={styles.ruleBuilder}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <label style={{ fontWeight: 600 }}>Rules</label>
                  <select className={styles.select} style={{ width: "auto", padding: "4px 8px" }} value={matchType} onChange={e => setMatchType(e.target.value)}>
                    <option value="ALL">Match ALL Rules (AND)</option>
                    <option value="ANY">Match ANY Rule (OR)</option>
                  </select>
                </div>
                
                {rules.map((rule, idx) => (
                  <div key={idx} className={styles.ruleRow}>
                    <select className={styles.select} value={rule.field} onChange={e => handleUpdateRule(idx, "field", e.target.value)}>
                      <option value="leadStage">Lead Stage</option>
                      <option value="tag">Tag</option>
                      <option value="language">Language</option>
                    </select>
                    <select className={styles.select} value={rule.operator} onChange={e => handleUpdateRule(idx, "operator", e.target.value)}>
                      <option value="EQUALS">Equals</option>
                      <option value="NOT_EQUALS">Does Not Equal</option>
                      <option value="CONTAINS">Contains</option>
                    </select>
                    <input 
                      type="text" 
                      className={styles.input} 
                      value={rule.value} 
                      onChange={e => handleUpdateRule(idx, "value", e.target.value)} 
                      placeholder="Value"
                      required
                    />
                    <button type="button" className={styles.deleteBtn} onClick={() => handleRemoveRule(idx)}>
                      &times;
                    </button>
                  </div>
                ))}
                
                <button type="button" className={styles.addRuleBtn} onClick={handleAddRule}>
                  + Add another rule
                </button>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.createBtn} disabled={saving || rules.length === 0}>
                  {saving ? "Saving..." : "Save Segment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
