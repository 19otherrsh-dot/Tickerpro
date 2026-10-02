"use client";

import { useEffect, useState } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import styles from "./page.module.css";

interface IntegrationConfig {
  type: string;
  isActive: boolean;
}

export default function IntegrationsPage() {
  const { activeWorkspace, workspaces } = useAuth();
  const currentWorkspace = activeWorkspace || workspaces[0];
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [activeApp, setActiveApp] = useState<any>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchIntegrations = async () => {
    if (!currentWorkspace) return;
    try {
      const res = await apiFetch(`/api/integrations?workspaceId=${currentWorkspace.id}`);
      if (res.ok) {
        setIntegrations(res.data.integrations);
      }
    } catch (err) {
      console.error("Failed to fetch integrations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [currentWorkspace]);

  const apps = [
    {
      id: "HUBSPOT",
      name: "HubSpot",
      icon: "â¬¡ï¸",
      iconClass: styles.hubspotIcon,
      description: "Sync WhatsApp contacts and conversation history automatically to HubSpot CRM.",
    },
    {
      id: "SALESFORCE",
      name: "Salesforce",
      icon: "â˜ï¸",
      iconClass: styles.salesforceIcon,
      description: "Connect WhatsApp to Salesforce to create leads, contacts, and log cases.",
    },
    {
      id: "SHOPIFY",
      name: "Shopify",
      icon: "ðŸ›ï¸",
      iconClass: styles.shopifyIcon,
      description: "Recover abandoned carts, send order updates, and sync customer data.",
    },
    {
      id: "ZAPIER",
      name: "Zapier",
      icon: "âš¡",
      iconClass: styles.zapierIcon,
      description: "Connect TickerPro to 5,000+ apps using Zapier workflows and triggers.",
    },
  ];

  const handleConnect = (app: any) => {
    setActiveApp(app);
    setApiKey("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace || !activeApp || !apiKey) return;
    
    setSaving(true);
    try {
      const res = await apiFetch(`/api/integrations?workspaceId=${currentWorkspace.id}`, {
        method: "POST",
        body: JSON.stringify({
          type: activeApp.id,
          config: { apiKey },
          isActive: true
        })
      });

      if (res.ok) {
        await fetchIntegrations();
        setShowModal(false);
      } else {
        alert("Failed to save integration");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving integration");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (appId: string) => {
    if (!currentWorkspace) return;
    if (!confirm("Are you sure you want to disconnect this integration?")) return;

    try {
      const res = await apiFetch(`/api/integrations/${appId}?workspaceId=${currentWorkspace.id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        await fetchIntegrations();
      }
    } catch (err) {
      console.error("Failed to disconnect", err);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading integrations...</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>App Marketplace</h1>
      <p className={styles.subtitle}>Connect TickerPro with your favorite tools to automate your workflows.</p>

      <div className={styles.grid}>
        {apps.map((app) => {
          const isConnected = integrations.some(i => i.type === app.id && i.isActive);

          return (
            <div key={app.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={`${styles.icon} ${app.iconClass}`}>{app.icon}</div>
                <div className={styles.appName}>{app.name}</div>
                <div className={`${styles.statusBadge} ${isConnected ? styles.statusConnected : styles.statusDisconnected}`}>
                  {isConnected ? "Connected" : "Not Connected"}
                </div>
              </div>
              <p className={styles.description}>{app.description}</p>
              
              {isConnected ? (
                <button className={styles.secondaryBtn} onClick={() => handleDisconnect(app.id)}>
                  Disconnect
                </button>
              ) : (
                <button className={styles.primaryBtn} onClick={() => handleConnect(app)}>
                  Connect {app.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showModal && activeApp && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Connect {activeApp.name}</h2>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Private App Access Token (API Key)</label>
              <input 
                type="password" 
                className={styles.formInput} 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Paste your ${activeApp.name} key here`}
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </button>
              <button className={styles.primaryBtn} onClick={handleSave} disabled={saving || !apiKey}>
                {saving ? "Saving..." : "Save Connection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
