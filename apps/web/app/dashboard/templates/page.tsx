"use client";

import { useState } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import styles from "./page.module.css";

const mockTemplates = [
  { id: "1", name: "welcome_message", language: "en", category: "MARKETING", status: "APPROVED", body: "Hi {{1}}! Welcome to {{2}}. We're thrilled to have you on board. 🎉\n\nExplore our features and reach out anytime for help!", header: "TEXT", lastUsed: "2h ago", uses: 4520 },
  { id: "2", name: "order_confirmation", language: "en", category: "UTILITY", status: "APPROVED", body: "Your order #{{1}} has been confirmed! 📦\n\nEstimated delivery: {{2}}\nTotal: ₹{{3}}\n\nTrack your order anytime by replying 'track'.", header: "IMAGE", lastUsed: "15m ago", uses: 12300 },
  { id: "3", name: "abandoned_cart_reminder", language: "en", category: "MARKETING", status: "APPROVED", body: "Hey {{1}}, you left some items in your cart! 🛒\n\nComplete your purchase now and get 10% OFF with code SAVE10.\n\nYour cart expires in 24 hours.", header: "IMAGE", lastUsed: "1h ago", uses: 8900 },
  { id: "4", name: "appointment_reminder", language: "en", category: "UTILITY", status: "APPROVED", body: "Reminder: You have an appointment with {{1}} on {{2}} at {{3}}.\n\nReply:\n1️⃣ Confirm\n2️⃣ Reschedule\n3️⃣ Cancel", header: "TEXT", lastUsed: "3h ago", uses: 3400 },
  { id: "5", name: "diwali_sale_2026", language: "en", category: "MARKETING", status: "PENDING", body: "🪔 Happy Diwali, {{1}}!\n\nCelebrate with FLAT 40% OFF on all plans!\nUse code: DIWALI40\n\nOffer valid till {{2}}. Don't miss out!", header: "IMAGE", lastUsed: "—", uses: 0 },
  { id: "6", name: "feedback_request", language: "hi", category: "UTILITY", status: "APPROVED", body: "नमस्ते {{1}}! 🙏\n\nआपके हालिया अनुभव के बारे में हम जानना चाहेंगे।\n\n1 से 5 तक रेटिंग दें:\n⭐ = खराब, ⭐⭐⭐⭐⭐ = बहुत बढ़िया", header: "TEXT", lastUsed: "5h ago", uses: 1200 },
  { id: "7", name: "payment_receipt", language: "en", category: "UTILITY", status: "REJECTED", body: "Payment of ₹{{1}} received! ✅\n\nTransaction ID: {{2}}\nDate: {{3}}\n\nThank you for your purchase.", header: "TEXT", lastUsed: "—", uses: 0 },
];

const statusColors: Record<string, { bg: string; color: string }> = {
  APPROVED: { bg: "#ECFDF5", color: "#059669" },
  PENDING: { bg: "#FFFBEB", color: "#D97706" },
  REJECTED: { bg: "#FEF2F2", color: "#DC2626" },
  DRAFT: { bg: "#F3F4F6", color: "#6B7280" },
};

const categoryColors: Record<string, { bg: string; color: string }> = {
  MARKETING: { bg: "#EEF2FF", color: "#4F46E5" },
  UTILITY: { bg: "#F0FDF4", color: "#16A34A" },
  AUTHENTICATION: { bg: "#FFF7ED", color: "#EA580C" },
};

export default function TemplatesPage() {
  const { activeWorkspace } = useAuth();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selected, setSelected] = useState<typeof mockTemplates[0] | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  // Template Builder state
  const [builderName, setBuilderName] = useState("");
  const [builderCategory, setBuilderCategory] = useState("MARKETING");
  const [builderLanguage, setBuilderLanguage] = useState("en");
  const [builderHeader, setBuilderHeader] = useState("TEXT");
  const [builderHeaderText, setBuilderHeaderText] = useState("");
  const [builderBody, setBuilderBody] = useState("");
  const [builderFooter, setBuilderFooter] = useState("");
  const [builderButtons, setBuilderButtons] = useState<{ type: string; text: string; url?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const filtered = mockTemplates.filter((t) => {
    if (search && !t.name.includes(search.toLowerCase()) && !t.body.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Message Templates</h1>
          <p className={styles.pageSubtitle}>{mockTemplates.length} templates · {mockTemplates.filter(t => t.status === "APPROVED").length} approved</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.searchBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className={styles.filterGroup}>
            {["all", "MARKETING", "UTILITY"].map((f) => (
              <button key={f} className={`${styles.filterBtn} ${filterCategory === f ? styles.filterActive : ""}`} onClick={() => setFilterCategory(f)}>
                {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <button className={styles.primaryBtn} onClick={() => { setShowBuilder(true); setSubmitResult(null); }}>+ New Template</button>
        </div>
      </div>

      <div className={styles.splitView}>
        <div className={styles.templateList}>
          {filtered.map((t) => (
            <div key={t.id} className={`${styles.templateRow} ${selected?.id === t.id ? styles.templateActive : ""}`} onClick={() => setSelected(t)}>
              <div className={styles.templateRowTop}>
                <code className={styles.templateCode}>{t.name}</code>
                <span className={styles.pill} style={statusColors[t.status]}>{t.status}</span>
              </div>
              <div className={styles.templateRowMeta}>
                <span className={styles.pill} style={categoryColors[t.category]}>{t.category}</span>
                <span className={styles.langBadge}>{t.language.toUpperCase()}</span>
                <span className={styles.metaText}>{t.uses > 0 ? t.uses.toLocaleString() + " uses" : "Not used"}</span>
              </div>
            </div>
          ))}
        </div>

        {selected ? (
          <div className={styles.preview}>
            <div className={styles.previewHeader}>
              <h3>{selected.name}</h3>
              <div className={styles.previewMeta}>
                <span className={styles.pill} style={statusColors[selected.status]}>{selected.status}</span>
                <span className={styles.pill} style={categoryColors[selected.category]}>{selected.category}</span>
              </div>
            </div>
            <div className={styles.phoneFrame}>
              <div className={styles.phoneHeader}>
                <div className={styles.phoneHeaderDot} />
                <span>WhatsApp Preview</span>
              </div>
              <div className={styles.phoneBubble}>
                {selected.header === "IMAGE" && <div className={styles.imageBlock}>📷 Image Header</div>}
                <p className={styles.bubbleText}>{selected.body}</p>
              </div>
            </div>
            <div className={styles.previewStats}>
              <div className={styles.previewStat}><span className={styles.previewStatVal}>{selected.uses > 0 ? selected.uses.toLocaleString() : "—"}</span><span>Total Uses</span></div>
              <div className={styles.previewStat}><span className={styles.previewStatVal}>{selected.lastUsed}</span><span>Last Used</span></div>
              <div className={styles.previewStat}><span className={styles.previewStatVal}>{selected.language.toUpperCase()}</span><span>Language</span></div>
            </div>
          </div>
        ) : (
          <div className={styles.emptyPreview}>Select a template to preview</div>
        )}
      </div>

      {/* ── Template Builder Modal ──────────────────────────────────── */}
      {showBuilder && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998 }} onClick={() => setShowBuilder(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 900, maxHeight: "90vh", overflow: "auto", background: "var(--tp-bg-primary)", borderRadius: 16, padding: 0, zIndex: 9999, boxShadow: "0 20px 80px rgba(0,0,0,0.3)", display: "flex" }}>
            {/* Left side: Form */}
            <div style={{ flex: 1, padding: 32, borderRight: "1px solid var(--tp-border)", overflow: "auto" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", color: "var(--tp-text-primary)" }}>Template Builder</h2>
              <p style={{ fontSize: "0.88rem", color: "var(--tp-text-tertiary)", margin: "0 0 24px" }}>Design your template and submit it to Meta for approval.</p>

              {submitResult && (
                <div style={{ padding: 12, borderRadius: 8, marginBottom: 16, background: submitResult.success ? "#ECFDF5" : "#FEF2F2", color: submitResult.success ? "#059669" : "#DC2626", fontSize: "0.88rem", fontWeight: 600 }}>
                  {submitResult.message}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--tp-text-secondary)", marginBottom: 6 }}>Template Name</label>
                  <input value={builderName} onChange={e => setBuilderName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="e.g. order_update" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--tp-border)", borderRadius: 8, background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", fontSize: "0.9rem", fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--tp-text-secondary)", marginBottom: 6 }}>Category</label>
                  <select value={builderCategory} onChange={e => setBuilderCategory(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--tp-border)", borderRadius: 8, background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", fontSize: "0.9rem" }}>
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--tp-text-secondary)", marginBottom: 6 }}>Language</label>
                  <select value={builderLanguage} onChange={e => setBuilderLanguage(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--tp-border)", borderRadius: 8, background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", fontSize: "0.9rem" }}>
                    <option value="en">English</option>
                    <option value="en_US">English (US)</option>
                    <option value="hi">Hindi</option>
                    <option value="es">Spanish</option>
                    <option value="pt_BR">Portuguese (BR)</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--tp-text-secondary)", marginBottom: 6 }}>Header Type</label>
                  <select value={builderHeader} onChange={e => setBuilderHeader(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--tp-border)", borderRadius: 8, background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", fontSize: "0.9rem" }}>
                    <option value="NONE">None</option>
                    <option value="TEXT">Text</option>
                    <option value="IMAGE">Image</option>
                    <option value="VIDEO">Video</option>
                    <option value="DOCUMENT">Document</option>
                  </select>
                </div>
              </div>

              {builderHeader === "TEXT" && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--tp-text-secondary)", marginBottom: 6 }}>Header Text</label>
                  <input value={builderHeaderText} onChange={e => setBuilderHeaderText(e.target.value)} placeholder="e.g. Order Update" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--tp-border)", borderRadius: 8, background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", fontSize: "0.9rem" }} />
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--tp-text-secondary)", marginBottom: 6 }}>Body <span style={{ fontWeight: 400, color: "var(--tp-text-tertiary)" }}>(use {`{{1}}`}, {`{{2}}`} for variables)</span></label>
                <textarea value={builderBody} onChange={e => setBuilderBody(e.target.value)} placeholder={"Hi {{1}}! Your order #{{2}} is ready for pickup."} rows={5} style={{ width: "100%", padding: "12px", border: "1px solid var(--tp-border)", borderRadius: 8, background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", fontSize: "0.9rem", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--tp-text-secondary)", marginBottom: 6 }}>Footer <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input value={builderFooter} onChange={e => setBuilderFooter(e.target.value)} placeholder="Reply STOP to unsubscribe" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--tp-border)", borderRadius: 8, background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", fontSize: "0.9rem" }} />
              </div>

              {/* Buttons */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--tp-text-secondary)", marginBottom: 6 }}>Buttons <span style={{ fontWeight: 400 }}>(max 3)</span></label>
                {builderButtons.map((btn, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <select value={btn.type} onChange={e => { const nb = [...builderButtons]; nb[i]!.type = e.target.value; setBuilderButtons(nb); }} style={{ padding: "8px", border: "1px solid var(--tp-border)", borderRadius: 6, background: "var(--tp-bg-secondary)", fontSize: "0.85rem" }}>
                      <option value="QUICK_REPLY">Quick Reply</option>
                      <option value="URL">URL</option>
                      <option value="PHONE_NUMBER">Phone</option>
                    </select>
                    <input value={btn.text} onChange={e => { const nb = [...builderButtons]; nb[i]!.text = e.target.value; setBuilderButtons(nb); }} placeholder="Button text" style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--tp-border)", borderRadius: 6, background: "var(--tp-bg-secondary)", fontSize: "0.85rem" }} />
                    <button onClick={() => setBuilderButtons(builderButtons.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontWeight: 700, fontSize: "1.1rem" }}>✕</button>
                  </div>
                ))}
                {builderButtons.length < 3 && (
                  <button onClick={() => setBuilderButtons([...builderButtons, { type: "QUICK_REPLY", text: "" }])} style={{ padding: "6px 14px", background: "var(--tp-bg-secondary)", border: "1px solid var(--tp-border)", borderRadius: 6, cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "var(--tp-text-secondary)" }}>+ Add Button</button>
                )}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button
                  disabled={submitting || !builderName || !builderBody}
                  onClick={async () => {
                    setSubmitting(true);
                    setSubmitResult(null);
                    try {
                      const components: any[] = [];
                      if (builderHeader === "TEXT" && builderHeaderText) {
                        components.push({ type: "HEADER", format: "TEXT", text: builderHeaderText });
                      } else if (builderHeader !== "NONE") {
                        components.push({ type: "HEADER", format: builderHeader });
                      }
                      components.push({ type: "BODY", text: builderBody });
                      if (builderFooter) components.push({ type: "FOOTER", text: builderFooter });
                      if (builderButtons.length > 0) {
                        components.push({ type: "BUTTONS", buttons: builderButtons.map(b => ({ type: b.type, text: b.text, ...(b.url ? { url: b.url } : {}) })) });
                      }

                      const res = await apiFetch(`/api/templates?workspaceId=${activeWorkspace?.id}`, {
                        method: "POST",
                        body: JSON.stringify({ name: builderName, category: builderCategory, language: builderLanguage, components }),
                      });

                      if (res.ok) {
                        setSubmitResult({ success: true, message: `Template "${builderName}" submitted to Meta for approval!` });
                      } else {
                        setSubmitResult({ success: false, message: res.data?.error || "Failed to submit template" });
                      }
                    } catch {
                      setSubmitResult({ success: false, message: "Network error" });
                    }
                    setSubmitting(false);
                  }}
                  style={{ padding: "12px 24px", background: "linear-gradient(135deg, #6366F1, #818CF8)", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", opacity: submitting || !builderName || !builderBody ? 0.5 : 1 }}
                >
                  {submitting ? "Submitting to Meta..." : "Submit for Approval"}
                </button>
                <button onClick={() => setShowBuilder(false)} style={{ padding: "12px 24px", background: "transparent", border: "1px solid var(--tp-border)", borderRadius: 8, fontWeight: 600, cursor: "pointer", color: "var(--tp-text-secondary)" }}>Cancel</button>
              </div>
            </div>

            {/* Right side: Live Phone Preview */}
            <div style={{ width: 320, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", background: "var(--tp-bg-secondary)" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "0.95rem", color: "var(--tp-text-secondary)", fontWeight: 600 }}>Live Preview</h3>
              <div className={styles.phoneFrame}>
                <div className={styles.phoneHeader}>
                  <div className={styles.phoneHeaderDot} />
                  <span>WhatsApp Preview</span>
                </div>
                <div className={styles.phoneBubble}>
                  {builderHeader === "IMAGE" && <div className={styles.imageBlock}>📷 Image Header</div>}
                  {builderHeader === "VIDEO" && <div className={styles.imageBlock}>🎬 Video Header</div>}
                  {builderHeader === "DOCUMENT" && <div className={styles.imageBlock}>📄 Document Header</div>}
                  {builderHeader === "TEXT" && builderHeaderText && <div style={{ fontWeight: 700, marginBottom: 8 }}>{builderHeaderText}</div>}
                  <p className={styles.bubbleText}>
                    {builderBody || <span style={{ color: "#aaa", fontStyle: "italic" }}>Your message body will appear here...</span>}
                  </p>
                  {builderFooter && <div style={{ fontSize: "0.75rem", color: "#999", marginTop: 8 }}>{builderFooter}</div>}
                </div>
                {builderButtons.length > 0 && (
                  <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {builderButtons.map((btn, i) => (
                      <div key={i} style={{ textAlign: "center", padding: "8px", border: "1px solid #25D36644", borderRadius: 8, color: "#25D366", fontWeight: 600, fontSize: "0.82rem" }}>
                        {btn.text || `Button ${i + 1}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 16, textAlign: "center", fontSize: "0.78rem", color: "var(--tp-text-tertiary)" }}>
                Variables like {`{{1}}`} will be replaced with real data at send time.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
