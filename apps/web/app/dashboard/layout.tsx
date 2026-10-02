"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth, apiFetch } from "../lib/auth-context";
import { getWSClient } from "../lib/ws-client";
import { useTheme } from "next-themes";
import { useTranslations } from "../lib/i18n";
import type { MessageKey } from "../lib/i18n/messages";
import { LocaleSwitcher } from "../lib/components/LocaleSwitcher";
import styles from "./layout.module.css";

type NavItem = { id: string; label: string; icon: string; href: string; hasBadge?: boolean; labelKey?: MessageKey };

const navItems: NavItem[] = [
  { id: "inbox", label: "Inbox", icon: "inbox", href: "/dashboard", hasBadge: true, labelKey: "nav.inbox" },
  { id: "contacts", label: "Contacts", icon: "users", href: "/dashboard/contacts", labelKey: "nav.contacts" },
  { id: "broadcasts", label: "Broadcasts", icon: "megaphone", href: "/dashboard/broadcasts", labelKey: "nav.broadcasts" },
  { id: "chatbots", label: "Bot Studio", icon: "bot", href: "/dashboard/chatbots" },
  { id: "drips", label: "Drip Campaigns", icon: "rocket", href: "/dashboard/drips" },
  { id: "flows", label: "WhatsApp Flows", icon: "flows", href: "/dashboard/flows" },
  { id: "analytics", label: "Analytics", icon: "chart", href: "/dashboard/analytics", labelKey: "nav.analytics" },
  { id: "commerce", label: "Commerce", icon: "shopping", href: "/dashboard/commerce" },
  { id: "templates", label: "Templates", icon: "template", href: "/dashboard/templates" },
  { id: "webhooks", label: "Webhooks", icon: "webhook", href: "/dashboard/webhooks" },
];

const bottomItems: NavItem[] = [
  { id: "audit", label: "Audit Log", icon: "shield", href: "/dashboard/audit" },
  { id: "settings", label: "Settings", icon: "settings", href: "/dashboard/settings", labelKey: "nav.settings" },
];

function NavIcon({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    inbox: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
    users: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    megaphone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
    bot: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
      </svg>
    ),
    rocket: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
    chart: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
    template: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="3" x2="21" y1="9" y2="9" /><line x1="9" x2="9" y1="21" y2="9" />
      </svg>
    ),
    shopping: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
      </svg>
    ),
    flows: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="8" height="6" rx="1" /><rect x="14" y="16" width="8" height="6" rx="1" />
        <path d="M6 8v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" /><path d="M18 12v4" />
      </svg>
    ),
    webhook: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
        <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
        <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8H12" />
      </svg>
    ),
    shield: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    settings: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  };
  return <>{icons[icon] || null}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, activeWorkspace, logout, isLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, setTheme } = useTheme();
  const { t } = useTranslations();
  const navLabel = (item: NavItem) => (item.labelKey ? t(item.labelKey) : item.label);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Fetch real unread count from conversations API
  const fetchUnread = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const res = await apiFetch(`/api/conversations?workspaceId=${activeWorkspace.id}`);
      if (res.ok && res.data.conversations) {
        const total = res.data.conversations.reduce(
          (acc: number, c: any) => acc + (c.unreadCount || 0), 0
        );
        setUnreadCount(total);
      }
    } catch { /* silent */ }
  }, [activeWorkspace]);

  // Initial load + real-time refresh. Instead of polling every 30s, recompute
  // the unread badge whenever a relevant WebSocket event arrives.
  useEffect(() => {
    fetchUnread();
    const ws = getWSClient();
    const unsubs = [
      ws.on("message:new", fetchUnread),
      ws.on("conversation:new", fetchUnread),
      ws.on("conversation:update", fetchUnread),
    ];
    return () => unsubs.forEach((off) => off());
  }, [fetchUnread]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const displayName = user ? `${user.firstName} ${user.lastName}` : "Loading...";
  const displayRole = activeWorkspace?.role?.replace("_", " ") || "Agent";
  const initial = user?.firstName?.[0] || "T";

  return (
    <div className={styles.dashboard}>
      {/* ── Mobile Overlay ───────────────────────────────────── */}
      {mobileOpen && <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />}

      {/* ── Mobile Hamburger ─────────────────────────────────── */}
      <button className={styles.hamburger} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {mobileOpen ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>}
        </svg>
      </button>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""} ${mobileOpen ? styles.mobileOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <a href="/dashboard" className={styles.brand}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#gs)" />
              <path d="M8 14.5L12 18.5L20 10.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 11.5L15 15.5L23 7.5" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="gs" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#25D366" /></linearGradient></defs>
            </svg>
            {!collapsed && <span className={styles.brandText}>TickerPro</span>}
          </a>
          <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? <><path d="m9 18 6-6-6-6" /></> : <><path d="m15 18-6-6 6-6" /></>}
            </svg>
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navGroup}>
            {navItems.map((item) => {
              const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
              return (
                <a key={item.id} href={item.href} className={`${styles.navItem} ${isActive ? styles.navActive : ""}`} title={collapsed ? navLabel(item) : undefined}>
                  <NavIcon icon={item.icon} />
                  {!collapsed && <span className={styles.navLabel}>{navLabel(item)}</span>}
                  {!collapsed && item.hasBadge && unreadCount > 0 && <span className={styles.navBadge}>{unreadCount}</span>}
                </a>
              );
            })}
          </div>

          <div className={styles.navGroup}>
            {bottomItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <a key={item.id} href={item.href} className={`${styles.navItem} ${isActive ? styles.navActive : ""}`} title={collapsed ? navLabel(item) : undefined}>
                  <NavIcon icon={item.icon} />
                  {!collapsed && <span className={styles.navLabel}>{navLabel(item)}</span>}
                </a>
              );
            })}
          </div>
        </nav>

        {!collapsed && (
          <div className={styles.sidebarFooter}>
            {mounted && (
              <button 
                className={styles.themeToggle} 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
              </button>
            )}
            <LocaleSwitcher />
            <div className={styles.userPill} onClick={logout} title="Click to sign out">
              <div className={styles.userAvatar}>{initial}</div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{displayName}</span>
                <span className={styles.userRole}>{displayRole}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Content ────────────────────────────────────── */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
