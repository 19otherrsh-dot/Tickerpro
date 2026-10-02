"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../../lib/auth-context";
import styles from "./page.module.css";

export default function WidgetSettingsPage() {
  const { activeWorkspace, workspaces } = useAuth();
  const currentWorkspace = activeWorkspace || workspaces[0];
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [themeColor, setThemeColor] = useState("#4F46E5");
  const [welcomeMessage, setWelcomeMessage] = useState("Hi there! 👋 How can we help you today?");
  
  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchWidgetConfig();
    }
  }, [currentWorkspace]);

  const fetchWidgetConfig = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/workspaces/${currentWorkspace.id}/widget-config`);
      if (res.ok && res.data) {
        setThemeColor(res.data.themeColor || "#4F46E5");
        setWelcomeMessage(res.data.welcomeMessage || "Hi there! 👋 How can we help you today?");
      }
    } catch (error) {
      console.error("Failed to fetch widget config", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    try {
      const config = { themeColor, welcomeMessage };
      const res = await apiFetch(`/api/workspaces/${currentWorkspace.id}/widget-config`, {
        method: "PUT",
        body: JSON.stringify(config)
      });
      if (res.ok) {
        alert("Widget settings saved successfully!");
      }
    } catch (error) {
      console.error("Failed to save widget config", error);
      alert("Failed to save widget settings.");
    } finally {
      setSaving(false);
    }
  };

  const widgetUrl = `http://localhost:5173/widget.js?workspaceId=${currentWorkspace?.id}`;
  const embedCode = `<script src="${widgetUrl}" defer></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    alert("Embed code copied to clipboard!");
  };

  if (loading) return <div>Loading widget settings...</div>;

  return (
    <div className={styles.widgetContainer}>
      <h1 className={styles.pageTitle}>Website Chat Widget</h1>
      <p className={styles.pageSubtitle}>Configure the chat widget that will appear on your website to capture leads directly into TickerPro.</p>

      <div className={styles.settingsCard}>
        <div className={styles.formGroup}>
          <label>Theme Color</label>
          <div className={styles.colorPicker}>
            <input 
              type="color" 
              className={styles.colorInput}
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
            />
            <span>{themeColor}</span>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Welcome Message</label>
          <input 
            type="text" 
            className={styles.inputField}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="e.g. Hi there! 👋 How can we help you today?"
          />
        </div>

        <button 
          className={styles.saveBtn} 
          onClick={handleSave} 
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className={styles.embedCard}>
        <h3>Installation Code</h3>
        <p>Copy and paste this snippet into the <code>&lt;head&gt;</code> of your website to install the widget.</p>
        <div className={styles.codeBlock}>
          {embedCode}
        </div>
        <button className={styles.copyBtn} onClick={copyToClipboard}>
          Copy Embed Code
        </button>
      </div>
    </div>
  );
}
