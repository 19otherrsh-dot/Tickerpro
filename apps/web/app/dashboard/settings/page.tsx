"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import { useToast } from "../../lib/components/Toast";
import styles from "./page.module.css";

type Tab = "profile" | "workspace" | "team" | "whatsapp" | "integrations" | "billing" | "api" | "widget" | "business_hours";

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "profile", label: "My Profile", icon: "ðŸ‘¤" },
  { id: "workspace", label: "Workspace", icon: "ðŸ¢" },
  { id: "business_hours", label: "Business Hours", icon: "ðŸ•’" },
  { id: "widget", label: "Web Widget", icon: "ðŸŒ" },
  { id: "team", label: "Team Members", icon: "ðŸ‘¥" },
  { id: "whatsapp", label: "WhatsApp Numbers", icon: "ðŸ“±" },
  { id: "integrations", label: "Integrations", icon: "ðŸ”—" },
  { id: "billing", label: "Billing", icon: "ðŸ’³" },
  { id: "api", label: "API Keys", icon: "ðŸ”‘" },
];

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

const whatsappNumbers = [
  { id: "1", number: "+91 98765 43210", name: "TickerPro Sales", quality: "HIGH", status: "connected", dailyLimit: 10000, used: 3420 },
  { id: "2", number: "+91 87654 32109", name: "Support Line", quality: "MEDIUM", status: "connected", dailyLimit: 5000, used: 1890 },
  { id: "3", number: "+91 76543 21098", name: "Marketing", quality: "HIGH", status: "disconnected", dailyLimit: 10000, used: 0 },
];

const integrations = [
  { id: "1", name: "Salesforce", icon: "â˜ï¸", status: "connected", description: "Bidirectional CRM sync for leads and contacts" },
  { id: "2", name: "HubSpot", icon: "ðŸ§¡", status: "available", description: "Sync contacts, deals, and conversation history" },
  { id: "3", name: "Shopify", icon: "ðŸ›ï¸", status: "connected", description: "Order notifications and abandoned cart recovery" },
  { id: "4", name: "Razorpay", icon: "ðŸ’°", status: "available", description: "Payment links and transaction notifications" },
  { id: "5", name: "Google Sheets", icon: "ðŸ“Š", status: "connected", description: "Export data and automate reporting" },
  { id: "6", name: "Zapier", icon: "âš¡", status: "available", description: "Connect 5000+ apps with no-code workflows" },
  { id: "7", name: "Slack", icon: "ðŸ’¬", status: "available", description: "Get conversation alerts in Slack channels" },
  { id: "8", name: "Zoho CRM", icon: "ðŸ“‹", status: "available", description: "Full CRM integration with lead scoring" },
];

const roleColors: Record<string, { bg: string; color: string }> = {
  SUPER_ADMIN: { bg: "#FEF3C7", color: "#92400E" },
  ADMIN: { bg: "#EEF2FF", color: "#4F46E5" },
  AGENT: { bg: "#F0FDF4", color: "#16A34A" },
  VIEWER: { bg: "#F3F4F6", color: "#6B7280" },
};

const qualityColors: Record<string, string> = {
  HIGH: "#059669",
  MEDIUM: "#D97706",
  LOW: "#DC2626",
};

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { addToast: toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("AGENT");
  const [inviting, setInviting] = useState(false);

  // Initialize profile fields from user
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
    }
  }, [user]);

  // Fetch team members
  useEffect(() => {
    if (activeTab === "team") {
      setTeamLoading(true);
      apiFetch("/api/workspaces/members")
        .then((res) => {
          if (res.ok && Array.isArray(res.data)) {
            setTeamMembers(res.data);
          }
        })
        .catch(console.error)
        .finally(() => setTeamLoading(false));
    }
  }, [activeTab]);

  // Profile handlers
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const res = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName }),
      });
      if (res.ok) {
        toast("Profile updated successfully", "success");
        refreshUser();
      } else {
        toast(res.data.error || "Failed to update profile", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast("Passwords do not match", "error");
      return;
    }
    if (newPassword.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast("Password changed successfully", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast(res.data.error || "Failed to change password", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setPasswordSaving(false);
    }
  };

  // Invite handler
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await apiFetch("/api/workspaces/members/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        toast(`Invite sent to ${inviteEmail}`, "success");
        setInviteEmail("");
        setShowInviteModal(false);
        // Refresh team list
        const refreshRes = await apiFetch("/api/workspaces/members");
        if (refreshRes.ok && Array.isArray(refreshRes.data)) {
          setTeamMembers(refreshRes.data);
        }
      } else {
        toast(res.data.error || "Failed to invite member", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setInviting(false);
    }
  };

  const initial = user?.firstName?.[0]?.toUpperCase() || "T";

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>Settings</h1>
      </div>

      <div className={styles.settingsBody}>
        <nav className={styles.settingsNav}>
          {tabs.map((t) => (
            <button key={t.id} className={`${styles.navBtn} ${activeTab === t.id ? styles.navActive : ""}`} onClick={() => setActiveTab(t.id)}>
              <span className={styles.navIcon}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className={styles.settingsContent}>

          {/* â”€â”€ Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "profile" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>My Profile</h2>

              {/* Avatar + info */}
              <div className={styles.profileHeader}>
                <div className={styles.profileAvatar}>{initial}</div>
                <div>
                  <div className={styles.profileName}>{user?.firstName} {user?.lastName}</div>
                  <div className={styles.profileEmail}>{user?.email}</div>
                </div>
              </div>

              {/* Edit name */}
              <h3 className={styles.subTitle}>Personal Information</h3>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>First Name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <button className={styles.saveBtn} onClick={handleSaveProfile} disabled={profileSaving} style={{ marginBottom: 40 }}>
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>

              {/* Change password */}
              <h3 className={styles.subTitle}>Change Password</h3>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Current Password</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className={styles.field} />
                <div className={styles.field}>
                  <label>New Password</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <button className={styles.saveBtn} onClick={handleChangePassword} disabled={passwordSaving || !currentPassword || !newPassword}>
                {passwordSaving ? "Changing..." : "Change Password"}
              </button>
            </div>
          )}

          {/* â”€â”€ Workspace â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "workspace" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Workspace Settings</h2>
              <div className={styles.formGrid}>
                <div className={styles.field}><label>Workspace Name</label><input defaultValue="TickerPro Demo" /></div>
                <div className={styles.field}><label>Business Website</label><input defaultValue="https://tickerpro.com" /></div>
                <div className={styles.field}><label>Industry</label>
                  <select defaultValue="saas"><option value="saas">SaaS</option><option value="ecommerce">E-Commerce</option><option value="healthcare">Healthcare</option><option value="education">Education</option></select>
                </div>
              </div>
              <div className={styles.fieldFull} style={{ marginTop: 24 }}>
                <label>Default Reply SLA</label>
                <div className={styles.slaRow}>
                  <input type="number" defaultValue={5} className={styles.slaInput} />
                  <span>minutes</span>
                </div>
              </div>

              <div className={styles.fieldFull} style={{ marginTop: 24 }}>
                <label>Agent Routing</label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked={true} /> Enable Auto-Assignment (Round-Robin)
                  </label>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--tp-text-tertiary)", marginTop: "8px" }}>Automatically assigns new conversations to agents with the least active workload.</p>
              </div>

              <button className={styles.saveBtn} style={{ marginTop: 32 }}>Save Changes</button>
            </div>
          )}

          {/* â”€â”€ Business Hours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "business_hours" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Business Hours & Away Messages</h2>
              <div className={styles.fieldFull}>
                <label>Timezone</label>
                <select defaultValue="ist"><option value="ist">Asia/Kolkata (IST)</option><option value="utc">UTC</option><option value="pst">US/Pacific (PST)</option></select>
              </div>

              <div className={styles.fieldFull} style={{ marginTop: 24 }}>
                <label>Schedule</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                    <div key={day} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ width: "100px", fontWeight: 500 }}>{day}</div>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" defaultChecked={day !== "Sunday"} /> Open
                      </label>
                      <input type="time" defaultValue="09:00" style={{ padding: "6px", border: "1px solid var(--tp-gray-200)", borderRadius: "4px" }} />
                      <span>to</span>
                      <input type="time" defaultValue="18:00" style={{ padding: "6px", border: "1px solid var(--tp-gray-200)", borderRadius: "4px" }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.fieldFull} style={{ marginTop: 24 }}>
                <label>Away Message</label>
                <p style={{ fontSize: "0.875rem", color: "var(--tp-text-tertiary)", marginBottom: "8px" }}>This message will automatically be sent to customers who message outside of your business hours.</p>
                <textarea 
                  defaultValue="Hi there! We are currently closed. Our business hours are Mon-Sat, 9AM to 6PM IST. We will get back to you as soon as we open!"
                  style={{ width: "100%", height: "100px", padding: "12px", border: "1px solid var(--tp-gray-200)", borderRadius: "6px", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>

              <button className={styles.saveBtn} style={{ marginTop: 24 }}>Save Business Hours</button>
            </div>
          )}

          {/* â”€â”€ Web Widget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "widget" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Click-to-Chat Widget</h2>
              <p style={{ fontSize: "0.875rem", color: "var(--tp-text-tertiary)", marginBottom: "24px" }}>Embed a WhatsApp chat widget directly on your website to capture leads seamlessly.</p>

              <div className={styles.fieldFull}>
                <label>Theme Color</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <input type="color" defaultValue="#10B981" style={{ width: '48px', height: '48px', padding: '2px', borderRadius: '4px', border: '1px solid var(--tp-gray-200)' }} />
                  <div style={{ alignSelf: 'center', fontSize: '0.9rem', color: 'var(--tp-text-secondary)' }}>Pick a brand color for the widget</div>
                </div>
              </div>

              <div className={styles.fieldFull} style={{ marginTop: 24 }}>
                <label>Embed Snippet</label>
                <p style={{ fontSize: "0.875rem", color: "var(--tp-text-tertiary)", marginBottom: "8px" }}>Copy and paste this code just before the closing <code>&lt;/body&gt;</code> tag on your website.</p>
                <div style={{ position: 'relative' }}>
                  <textarea 
                    readOnly
                    value={`<!-- TickerPro Widget -->\n<script \n  src="http://localhost:5173/widget.js" \n  data-workspace-id="demo-workspace" \n  data-color="#10B981"\n  defer\n></script>`}
                    style={{ width: "100%", height: "120px", padding: "12px", border: "1px solid var(--tp-gray-200)", borderRadius: "6px", resize: "none", fontFamily: "monospace", fontSize: "0.85rem", backgroundColor: "var(--tp-bg-secondary)" }}
                  />
                  <button 
                    onClick={() => { navigator.clipboard.writeText(`<!-- TickerPro Widget -->\n<script src="http://localhost:5173/widget.js" data-workspace-id="demo-workspace" data-color="#10B981" defer></script>`); toast("Copied to clipboard!", "success"); }}
                    style={{ position: 'absolute', top: '12px', right: '12px', padding: '4px 12px', background: 'var(--tp-brand-100)', color: 'var(--tp-brand-600)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className={styles.fieldFull} style={{ marginTop: 24 }}>
                <label>Preview</label>
                <div style={{ marginTop: '12px', border: '1px solid var(--tp-gray-200)', borderRadius: '8px', padding: '32px', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <p style={{ color: 'var(--tp-text-tertiary)', fontSize: '0.85rem' }}>Widget preview will appear here.</p>
                </div>
              </div>
            </div>
          )}

          {/* â”€â”€ Team â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "team" && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Team Members</h2>
                <button className={styles.addBtn} onClick={() => setShowInviteModal(true)}>+ Invite Member</button>
              </div>

              {/* Invite Modal */}
              {showInviteModal && (
                <>
                  <div className={styles.modalOverlay} onClick={() => setShowInviteModal(false)} />
                  <div className={styles.modal}>
                    <div className={styles.modalHeader}>
                      <h3 className={styles.modalTitle}>Invite Team Member</h3>
                      <button className={styles.modalClose} onClick={() => setShowInviteModal(false)}>âœ•</button>
                    </div>
                    <div className={styles.modalBody}>
                      <div className={styles.field}>
                        <label>Email Address</label>
                        <input
                          type="email"
                          placeholder="colleague@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className={styles.field} style={{ marginTop: 16 }}>
                        <label>Role</label>
                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                          <option value="AGENT">Agent â€” Can chat with contacts</option>
                          <option value="ADMIN">Admin â€” Full management access</option>
                          <option value="VIEWER">Viewer â€” Read-only access</option>
                        </select>
                      </div>
                      <p className={styles.modalHint}>
                        An invitation email will be sent. They can set their password on first login.
                      </p>
                    </div>
                    <div className={styles.modalFooter}>
                      <button className={styles.editBtn} onClick={() => setShowInviteModal(false)}>Cancel</button>
                      <button className={styles.addBtn} onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                        {inviting ? "Sending..." : "Send Invite"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <table className={styles.table}>
                <thead><tr><th>Member</th><th>Role</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {teamMembers.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className={styles.memberCell}>
                          <div className={styles.avatar}>{m.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2)}</div>
                          <div><div className={styles.memberName}>{m.name}</div><div className={styles.memberEmail}>{m.email}</div></div>
                        </div>
                      </td>
                      <td><span className={styles.pill} style={roleColors[m.role] || roleColors.AGENT}>{m.role.replace("_", " ")}</span></td>
                      <td><span className={`${styles.statusDot} ${m.status === "active" ? styles.dotActive : styles.dotPending}`} />{m.status === "active" ? "Active" : "Invited"}</td>
                      <td><button className={styles.editBtn}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* â”€â”€ WhatsApp Numbers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "whatsapp" && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>WhatsApp Numbers</h2>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className={styles.addBtn} style={{ background: '#1877F2', color: 'white', border: 'none' }}
                    onClick={() => {
                      // Meta Embedded Signup - opens Meta Business Manager popup
                      const appId = '123456789'; // Replace with real Meta App ID
                      const configId = '987654321'; // Replace with real config
                      const redirectUri = encodeURIComponent(`${window.location.origin}/api/integrations/meta/oauth`);
                      window.open(
                        `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&config_id=${configId}&redirect_uri=${redirectUri}&response_type=code&scope=whatsapp_business_management,whatsapp_business_messaging`,
                        'meta_signup',
                        'width=600,height=700,scrollbars=yes'
                      );
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ marginRight: 6 }}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Connect via Meta
                  </button>
                  <button className={styles.addBtn}>+ Connect Number</button>
                </div>
              </div>
              <div className={styles.numberGrid}>
                {whatsappNumbers.map((n) => (
                  <div key={n.id} className={styles.numberCard}>
                    <div className={styles.numberHeader}>
                      <div>
                        <div className={styles.numberValue}>{n.number}</div>
                        <div className={styles.numberName}>{n.name}</div>
                      </div>
                      <span className={`${styles.connStatus} ${n.status === "connected" ? styles.connected : styles.disconnected}`}>{n.status}</span>
                    </div>
                    <div className={styles.numberStats}>
                      <div className={styles.qualityRow}>
                        <span>Quality Rating</span>
                        <span style={{ color: qualityColors[n.quality], fontWeight: 700 }}>{n.quality}</span>
                      </div>
                      <div className={styles.qualityRow}>
                        <span>Daily Usage</span>
                        <span>{n.used.toLocaleString()} / {n.dailyLimit.toLocaleString()}</span>
                      </div>
                      <div className={styles.usageBar}>
                        <div className={styles.usageFill} style={{ width: `${(n.used / n.dailyLimit) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* â”€â”€ Integrations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "integrations" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Integrations</h2>
              <div className={styles.intGrid}>
                {integrations.map((int) => (
                  <div key={int.id} className={styles.intCard}>
                    <div className={styles.intIcon}>{int.icon}</div>
                    <div className={styles.intBody}>
                      <div className={styles.intName}>{int.name}</div>
                      <div className={styles.intDesc}>{int.description}</div>
                    </div>
                    <button className={`${styles.intBtn} ${int.status === "connected" ? styles.intConnected : ""}`}>
                      {int.status === "connected" ? "âœ“ Connected" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* â”€â”€ Billing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "billing" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Billing & Plan</h2>
              <div className={styles.planCard}>
                <div className={styles.planBadge}>CURRENT PLAN</div>
                <div className={styles.planName}>Growth Plan</div>
                <div className={styles.planPrice}>â‚¹3,499<span>/month</span></div>
                <div className={styles.planFeatures}>
                  <div>âœ… 15 agents</div>
                  <div>âœ… 5 WhatsApp numbers</div>
                  <div>âœ… AI Reply Suggestions</div>
                  <div>âœ… AI Sentiment Analysis</div>
                  <div>âœ… All CRM integrations</div>
                </div>
                <div className={styles.planActions}>
                  <button className={styles.upgradeBtn}>Upgrade to Enterprise</button>
                  <button className={styles.editBtn}>Manage Billing</button>
                </div>
              </div>

              <h3 className={styles.subTitle}>Conversation Credits Wallet</h3>
              <div style={{ background: 'linear-gradient(135deg, #6366F120, #818CF820)', border: '1px solid #6366F140', borderRadius: 12, padding: 24, marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--tp-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wallet Balance</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366F1', marginTop: 4 }}>$24.50</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--tp-text-tertiary)', marginTop: 2 }}>≈ 816 business-initiated conversations</div>
                  </div>
                  <button style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #6366F1, #818CF8)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>+ Top Up</button>
                </div>
                <div style={{ marginTop: 16, fontSize: '0.82rem', color: 'var(--tp-text-tertiary)' }}>
                  Meta charges per 24-hour conversation window: <strong>$0.005</strong> for user-initiated, <strong>$0.03</strong> for business-initiated.
                </div>
              </div>

              <h3 className={styles.subTitle}>Usage This Month</h3>
              <div className={styles.usageGrid}>
                <div className={styles.usageCard}><span className={styles.usageValue}>8,942</span><span>Messages Sent</span><span className={styles.usageLimit}>of 50,000</span></div>
                <div className={styles.usageCard}><span className={styles.usageValue}>4</span><span>Active Agents</span><span className={styles.usageLimit}>of 15</span></div>
                <div className={styles.usageCard}><span className={styles.usageValue}>2</span><span>Connected Numbers</span><span className={styles.usageLimit}>of 5</span></div>
              </div>
            </div>
          )}

          {/* â”€â”€ API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "api" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>API Keys</h2>
              <p className={styles.sectionDesc}>Use API keys to integrate TickerPro with your applications.</p>

              <div className={styles.apiKeyCard}>
                <div className={styles.apiKeyHeader}><span>Production Key</span><span className={styles.statusDot + " " + styles.dotActive} /> Active</div>
                <div className={styles.apiKeyValue}>
                  <code>tp_live_â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢mK4x</code>
                  <button className={styles.copyBtn}>Copy</button>
                </div>
                <div className={styles.apiKeyMeta}>Created May 1, 2026 Â· Last used 2 hours ago</div>
              </div>

              <div className={styles.apiKeyCard}>
                <div className={styles.apiKeyHeader}><span>Test Key</span><span className={styles.statusDot + " " + styles.dotActive} /> Active</div>
                <div className={styles.apiKeyValue}>
                  <code>tp_test_â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢nR7w</code>
                  <button className={styles.copyBtn}>Copy</button>
                </div>
                <div className={styles.apiKeyMeta}>Created May 1, 2026 Â· Last used 5 hours ago</div>
              </div>

              <button className={styles.addBtn}>+ Generate New Key</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
