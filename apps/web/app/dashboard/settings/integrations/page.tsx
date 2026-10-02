"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/auth-context";
import { SkeletonCard } from "../../../lib/components/Skeleton";
import { useToast } from "../../../lib/components/Toast";
import styles from "./page.module.css";

interface Integration {
  id: string;
  type: string;
  isActive: boolean;
  config: any;
}

const APPS = [
  {
    id: "SHOPIFY",
    name: "Shopify",
    description: "Sync products, trigger abandoned cart flows, and send order updates via WhatsApp.",
    icon: "ðŸ›ï¸",
  },
  {
    id: "WOOCOMMERCE",
    name: "WooCommerce",
    description: "Connect your WordPress store to manage orders and engage customers.",
    icon: "ðŸ›’",
  },
  {
    id: "ZAPIER",
    name: "Zapier",
    description: "Connect TickerPro to 5000+ apps. Trigger workflows and send automated messages.",
    icon: "âš¡",
  },
  {
    id: "MAKE",
    name: "Make (Integromat)",
    description: "Visual automation platform to build complex workflows with TickerPro.",
    icon: "âš™ï¸",
  },
  {
    id: "HUBSPOT",
    name: "HubSpot",
    description: "Sync contacts, track conversation activity, and trigger HubSpot workflows via WhatsApp.",
    icon: "ðŸ§¡",
  },
  {
    id: "SALESFORCE",
    name: "Salesforce",
    description: "Keep your Salesforce CRM up-to-date with WhatsApp chat logs and lead creation.",
    icon: "â˜ï¸",
  },
  {
    id: "ZOHO",
    name: "Zoho CRM",
    description: "Native integration with Zoho CRM to manage leads and automate follow-ups.",
    icon: "ðŸŸ©",
  },
  {
    id: "PIPEDRIVE",
    name: "Pipedrive",
    description: "Create deals and track WhatsApp communications natively in Pipedrive pipelines.",
    icon: "ðŸŸ¢",
  }
];

export default function IntegrationsPage() {
  const { workspaces } = useAuth();
  const currentWorkspace = workspaces[0];
  const { addToast: toast } = useToast();
  
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuringApp, setConfiguringApp] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (!currentWorkspace) return;
    
    const fetchIntegrations = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/integrations?workspaceId=${currentWorkspace.id}`);
        if (res.ok && res.data.integrations) {
          setIntegrations(res.data.integrations);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchIntegrations();
  }, [currentWorkspace]);

  const handleConnect = async (appId: string) => {
    if (!currentWorkspace) return;
    
    // For MVP, we'll just mock saving an API key for Zapier, or a store URL for Shopify
    let mockConfig: any = {};
    if (appId === "ZAPIER" || appId === "MAKE") {
      mockConfig = { apiKey: `tk_live_${Math.random().toString(36).substring(2, 15)}` };
    } else if (["HUBSPOT", "SALESFORCE", "ZOHO", "PIPEDRIVE"].includes(appId)) {
      mockConfig = { accessToken: `mock_oauth_${appId.toLowerCase()}_${Math.random().toString(36).substring(2, 10)}`, connectedAt: new Date().toISOString() };
    } else {
      mockConfig = { storeUrl: "mystore.myshopify.com" };
    }

    try {
      const res = await apiFetch(`/api/integrations?workspaceId=${currentWorkspace.id}`, {
        method: "POST",
        body: JSON.stringify({
          type: appId,
          isActive: true,
          config: mockConfig
        })
      });

      if (res.ok) {
        setIntegrations(prev => {
          const exists = prev.find(i => i.type === appId);
          if (exists) return prev.map(i => i.type === appId ? res.data.integration : i);
          return [res.data.integration, ...prev];
        });
        toast(`Successfully connected ${appId}!`, "success");
      }
    } catch (err) {
      console.error(err);
      toast("Failed to connect app", "error");
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!currentWorkspace) return;
    if (!confirm("Are you sure you want to disconnect this app?")) return;

    try {
      const res = await apiFetch(`/api/integrations/${id}?workspaceId=${currentWorkspace.id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setIntegrations(prev => prev.filter(i => i.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentWorkspace) return (
    <div style={{ padding: 40, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height={200} />)}
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>App Integrations</h1>
        <p className={styles.subtitle}>Connect TickerPro with your favorite tools to automate your workflow.</p>
      </div>

      <div className={styles.grid}>
        {APPS.map(app => {
          const integration = integrations.find(i => i.type === app.id);
          const isActive = integration?.isActive;

          return (
            <div key={app.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.icon}>{app.icon}</div>
                <div className={`${styles.status} ${isActive ? styles.statusActive : styles.statusInactive}`}>
                  {isActive ? "Connected" : "Not Connected"}
                </div>
              </div>
              <div className={styles.appInfo}>
                <h3 className={styles.appName}>{app.name}</h3>
                <p className={styles.appDesc}>{app.description}</p>
              </div>
              
              <div className={styles.actions}>
                {isActive && integration ? (
                  <button 
                    className={styles.manageBtn}
                    onClick={() => handleDisconnect(integration.id)}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button 
                    className={styles.connectBtn}
                    onClick={() => handleConnect(app.id)}
                  >
                    Connect
                  </button>
                )}
              </div>
              
              {(isActive && integration?.config?.apiKey) || (isActive && integration?.config?.accessToken) ? (
                <div style={{ marginTop: 16, fontSize: "0.8rem", padding: "8px", background: "var(--tp-bg-secondary)", borderRadius: "var(--tp-radius-sm)", wordBreak: "break-all" }}>
                  <strong>{integration?.config?.accessToken ? "OAuth Token:" : "API Key:"}</strong> <br/>
                  <code style={{ color: "var(--tp-brand-600)" }}>
                    {integration?.config?.accessToken || integration?.config?.apiKey}
                  </code>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
