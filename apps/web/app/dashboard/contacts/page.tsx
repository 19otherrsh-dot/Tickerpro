"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import { SkeletonTable } from "../../lib/components/Skeleton";
import { useToast } from "../../lib/components/Toast";
import styles from "./page.module.css";

interface Contact {
  id: string;
  name: string | null;
  phoneNumber: string;
  email: string | null;
  leadStage: string;
  updatedAt: string;
}

const stageColors: Record<string, { bg: string; color: string }> = {
  New: { bg: "#EEF2FF", color: "#4F46E5" },
  Contacted: { bg: "#FFF7ED", color: "#EA580C" },
  Qualified: { bg: "#F0FDF4", color: "#16A34A" },
  Proposal: { bg: "#FFFBEB", color: "#D97706" },
  Negotiation: { bg: "#FDF2F8", color: "#DB2777" },
  Won: { bg: "#ECFDF5", color: "#059669" },
  Lost: { bg: "#FEF2F2", color: "#DC2626" },
};

export default function ContactsPage() {
  const { workspaces } = useAuth();
  const currentWorkspace = workspaces[0];
  const { addToast: toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(l => l.trim().length > 0);
        if (lines.length === 0) return;
        
        // Assuming CSV header: name, phoneNumber, email
        // Or at least just phone numbers. We'll extract basic data
        const headers = lines[0]!.split(",").map(h => h.trim().toLowerCase());
        const phoneIdx = headers.indexOf("phonenumber") > -1 ? headers.indexOf("phonenumber") : headers.indexOf("phone");
        const nameIdx = headers.indexOf("name");
        const emailIdx = headers.indexOf("email");

        if (phoneIdx === -1) {
          toast("CSV must contain a 'phone' or 'phoneNumber' column", "error");
          setImporting(false);
          return;
        }

        const parsedContacts = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          const row = line.split(",");
          if (!row[phoneIdx]) continue;
          parsedContacts.push({
            phoneNumber: row[phoneIdx].trim(),
            name: nameIdx !== -1 ? row[nameIdx]?.trim() : null,
            email: emailIdx !== -1 ? row[emailIdx]?.trim() : null,
          });
        }

        const res = await apiFetch("/api/contacts/import", {
          method: "POST",
          body: JSON.stringify({ workspaceId: currentWorkspace.id, contacts: parsedContacts }),
        });

        if (res.ok) {
          toast(`Successfully imported ${res.data.count} contacts!`, "success");
          setIsImportModalOpen(false);
          // Refresh list
          const refreshRes = await apiFetch(`/api/contacts?workspaceId=${currentWorkspace.id}`);
          if (refreshRes.ok) {
            setContacts(refreshRes.data.contacts);
            setTotal(refreshRes.data.total);
          }
        } else {
          toast("Import failed: " + (res.data?.error || "Unknown error"), "error");
        }
      } catch (err) {
        console.error("Parse error", err);
        toast("Failed to parse CSV", "error");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const fetchContacts = async () => {
      if (!currentWorkspace) return;
      try {
        setLoading(true);
        const res = await apiFetch(`/api/contacts?workspaceId=${currentWorkspace.id}`);
        if (res.ok) {
          setContacts(res.data.contacts);
          setTotal(res.data.total);
        }
      } catch (err) {
        console.error("Failed to fetch contacts", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchContacts();
  }, [currentWorkspace]);

  const filtered = contacts.filter(
    (c) => (c.name || "").toLowerCase().includes(search.toLowerCase()) || c.phoneNumber.includes(search)
  );

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Contacts</h1>
          <p className={styles.pageSubtitle}>{total} total contacts</p>
        </div>
        <div className={styles.topbarActions}>
          <div className={styles.searchBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button 
            className={styles.primaryBtn}
            style={{ background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", border: "1px solid var(--tp-border)" }}
            onClick={() => {
              if (!currentWorkspace) return;
              window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/contacts/export?workspaceId=${currentWorkspace.id}`, '_blank');
            }}
          >
            ↓ Export CSV
          </button>
          <button className={styles.primaryBtn} onClick={() => setIsImportModalOpen(true)}>+ Import Contacts</button>
        </div>
      </div>

      {isImportModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ width: 400, padding: 24, background: "white", borderRadius: 8 }}>
            <h2 style={{ marginBottom: 16 }}>Import Contacts (CSV)</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--tp-text-secondary)", marginBottom: 16 }}>
              Upload a CSV file with columns: <strong>name, phone, email</strong>. Only phone is required.
            </p>
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              disabled={importing}
              style={{ display: "block", marginBottom: 24 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 6, background: "var(--tp-gray-100)", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button 
                disabled={importing}
                style={{ padding: "8px 16px", borderRadius: 6, background: "var(--tp-primary)", color: "white", border: "none", opacity: importing ? 0.7 : 1 }}
              >
                {importing ? "Importing..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Phone</th>
              <th>Stage</th>
              <th>Tags</th>
              <th>Last Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 0 }}><SkeletonTable rows={8} columns={5} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>No contacts found.</td></tr>
            ) : filtered.map((c) => {
              const avatar = c.name ? c.name.substring(0, 2).toUpperCase() : "?";
              const lastActive = new Date(c.updatedAt).toLocaleDateString();
              
              return (
              <tr key={c.id}>
                <td>
                  <div className={styles.contactCell}>
                    <div className={styles.avatar}>{avatar}</div>
                    <div>
                      <div className={styles.contactName}>{c.name || "Unknown"}</div>
                      <div className={styles.contactEmail}>{c.email || ""}</div>
                    </div>
                  </div>
                </td>
                <td className={styles.mono}>{c.phoneNumber}</td>
                <td>
                  <span className={styles.pill} style={{ background: stageColors[c.leadStage]?.bg || "#EEF2FF", color: stageColors[c.leadStage]?.color || "#4F46E5" }}>
                    {c.leadStage}
                  </span>
                </td>
                <td>
                  <div className={styles.tagList}>
                    <span className={styles.tag}>WhatsApp</span>
                  </div>
                </td>
                <td className={styles.muted}>{lastActive}</td>
                <td>
                  <button className={styles.actionBtn} title="Open conversation">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  </button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
