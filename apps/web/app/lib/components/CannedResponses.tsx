"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────
interface CannedResponse {
  id: string;
  shortcut: string; // e.g. "/hello"
  text: string;
}

const STORAGE_KEY = "tp_canned_responses";

function loadResponses(): CannedResponse[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveResponses(items: CannedResponse[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ── Styles ─────────────────────────────────────────────────────────────
const s = {
  overlay: { position: "fixed" as const, inset: 0, zIndex: 999 },
  container: {
    position: "absolute" as const,
    bottom: "100%",
    left: "50px",
    marginBottom: "8px",
    width: "380px",
    maxHeight: "420px",
    background: "var(--tp-bg-primary)",
    border: "1px solid var(--tp-border)",
    borderRadius: "var(--tp-radius-lg)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    zIndex: 1000,
    animation: "emojiSlideIn 0.15s ease-out",
  },
  header: {
    padding: "12px 16px",
    borderBottom: "1px solid var(--tp-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "var(--tp-text-primary)",
  },
  addBtn: {
    padding: "4px 12px",
    fontSize: "0.75rem",
    fontWeight: 600,
    background: "var(--tp-brand-600)",
    color: "white",
    border: "none",
    borderRadius: "var(--tp-radius-md)",
    cursor: "pointer",
  },
  list: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "4px 0",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 16px",
    cursor: "pointer",
    transition: "background 0.12s",
    border: "none",
    background: "none",
    width: "100%",
    textAlign: "left" as const,
    fontFamily: "var(--tp-font-sans)",
  },
  shortcut: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "var(--tp-brand-600)",
    background: "var(--tp-brand-50)",
    padding: "2px 8px",
    borderRadius: "var(--tp-radius-md)",
    flexShrink: 0,
    fontFamily: "monospace",
  },
  text: {
    fontSize: "0.82rem",
    color: "var(--tp-text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flex: 1,
  },
  deleteBtn: {
    padding: "2px 6px",
    fontSize: "0.7rem",
    background: "none",
    border: "none",
    color: "var(--tp-text-tertiary)",
    cursor: "pointer",
    borderRadius: "var(--tp-radius-md)",
    flexShrink: 0,
  },
  form: {
    padding: "12px 16px",
    borderTop: "1px solid var(--tp-border)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  input: {
    padding: "8px 12px",
    border: "1px solid var(--tp-border)",
    borderRadius: "var(--tp-radius-md)",
    fontSize: "0.82rem",
    fontFamily: "var(--tp-font-sans)",
    background: "var(--tp-bg-secondary)",
    color: "var(--tp-text-primary)",
    outline: "none",
  },
  textarea: {
    padding: "8px 12px",
    border: "1px solid var(--tp-border)",
    borderRadius: "var(--tp-radius-md)",
    fontSize: "0.82rem",
    fontFamily: "var(--tp-font-sans)",
    background: "var(--tp-bg-secondary)",
    color: "var(--tp-text-primary)",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "60px",
  },
  formRow: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
  },
  cancelBtn: {
    padding: "6px 14px",
    fontSize: "0.78rem",
    background: "var(--tp-bg-tertiary)",
    color: "var(--tp-text-secondary)",
    border: "none",
    borderRadius: "var(--tp-radius-md)",
    cursor: "pointer",
  },
  saveBtn: {
    padding: "6px 14px",
    fontSize: "0.78rem",
    background: "var(--tp-brand-600)",
    color: "white",
    border: "none",
    borderRadius: "var(--tp-radius-md)",
    cursor: "pointer",
    fontWeight: 600,
  },
  empty: {
    padding: "32px 16px",
    textAlign: "center" as const,
    color: "var(--tp-text-tertiary)",
    fontSize: "0.82rem",
  },
};

interface CannedResponsesProps {
  onSelect: (text: string) => void;
  onClose: () => void;
}

export default function CannedResponses({ onSelect, onClose }: CannedResponsesProps) {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newShortcut, setNewShortcut] = useState("");
  const [newText, setNewText] = useState("");

  useEffect(() => {
    setResponses(loadResponses());
  }, []);

  const handleAdd = () => {
    if (!newShortcut.trim() || !newText.trim()) return;
    const item: CannedResponse = {
      id: Date.now().toString(),
      shortcut: newShortcut.startsWith("/") ? newShortcut : `/${newShortcut}`,
      text: newText,
    };
    const updated = [...responses, item];
    setResponses(updated);
    saveResponses(updated);
    setNewShortcut("");
    setNewText("");
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = responses.filter((r) => r.id !== id);
    setResponses(updated);
    saveResponses(updated);
  };

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.container}>
        <div style={s.header}>
          <span style={s.title}>Quick Replies</span>
          <button style={s.addBtn} onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>

        {showForm && (
          <div style={s.form}>
            <input
              style={s.input}
              placeholder="Shortcut (e.g. /hello)"
              value={newShortcut}
              onChange={(e) => setNewShortcut(e.target.value)}
            />
            <textarea
              style={s.textarea}
              placeholder="Response text..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
            <div style={s.formRow}>
              <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={s.saveBtn} onClick={handleAdd}>Save</button>
            </div>
          </div>
        )}

        <div style={s.list}>
          {responses.length === 0 ? (
            <div style={s.empty}>
              <p>No quick replies yet.</p>
              <p style={{ marginTop: 4, fontSize: "0.75rem" }}>Click "+ Add" to create your first canned response.</p>
            </div>
          ) : (
            responses.map((r) => (
              <div
                key={r.id}
                style={s.item}
                onClick={() => onSelect(r.text)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--tp-bg-secondary)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={s.shortcut}>{r.shortcut}</span>
                <span style={s.text}>{r.text}</span>
                <button
                  style={s.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--tp-text-tertiary)")}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
