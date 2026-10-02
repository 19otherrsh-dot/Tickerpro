"use client";

import { useState } from "react";
import styles from "./page.module.css";

type Step = "audience" | "content" | "schedule" | "review";

const steps: { id: Step; label: string; icon: string }[] = [
  { id: "audience", label: "Audience", icon: "👥" },
  { id: "content", label: "Content", icon: "✍️" },
  { id: "schedule", label: "Schedule", icon: "📅" },
  { id: "review", label: "Review", icon: "🚀" },
];

const savedSegments = [
  { id: "s1", name: "All Active Contacts", count: 12450, icon: "📋" },
  { id: "s2", name: "VIP Customers", count: 890, icon: "⭐" },
  { id: "s3", name: "Leads — Last 30 days", count: 2340, icon: "🎯" },
  { id: "s4", name: "Shopify Customers", count: 5670, icon: "🛍️" },
  { id: "s5", name: "Churned — 90 days inactive", count: 430, icon: "⚠️" },
];

const messageTemplates = [
  { id: "t1", name: "welcome_message", preview: "Hi {{name}}! Welcome to..." },
  { id: "t2", name: "abandoned_cart_reminder", preview: "Hey {{name}}, you left some items..." },
  { id: "t3", name: "diwali_sale_2026", preview: "🪔 Happy Diwali, {{name}}!..." },
  { id: "t4", name: "feedback_request", preview: "We'd love to hear about your..." },
];

export default function CampaignsPage() {
  const [currentStep, setCurrentStep] = useState<Step>("audience");
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const stepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Create Campaign</h1>
          <p className={styles.pageSubtitle}>Launch a targeted WhatsApp broadcast</p>
        </div>
      </div>

      {/* Stepper */}
      <div className={styles.stepper}>
        {steps.map((s, i) => (
          <div key={s.id} className={`${styles.step} ${i <= stepIndex ? styles.stepDone : ""} ${s.id === currentStep ? styles.stepActive : ""}`} onClick={() => setCurrentStep(s.id)}>
            <div className={styles.stepIcon}>{i < stepIndex ? "✓" : s.icon}</div>
            <span className={styles.stepLabel}>{s.label}</span>
            {i < steps.length - 1 && <div className={styles.stepLine} />}
          </div>
        ))}
      </div>

      <div className={styles.content}>
        {/* Step 1: Audience */}
        {currentStep === "audience" && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Select your audience</h2>
            <p className={styles.stepDesc}>Choose a saved segment or create a new one</p>

            <div className={styles.segmentGrid}>
              {savedSegments.map((seg) => (
                <button key={seg.id} className={`${styles.segmentCard} ${selectedSegment === seg.id ? styles.segmentSelected : ""}`} onClick={() => setSelectedSegment(seg.id)}>
                  <span className={styles.segmentIcon}>{seg.icon}</span>
                  <div className={styles.segmentBody}>
                    <span className={styles.segmentName}>{seg.name}</span>
                    <span className={styles.segmentCount}>{seg.count.toLocaleString()} contacts</span>
                  </div>
                  {selectedSegment === seg.id && <span className={styles.checkmark}>✓</span>}
                </button>
              ))}
            </div>

            <div className={styles.stepActions}>
              <button className={styles.nextBtn} disabled={!selectedSegment} onClick={() => setCurrentStep("content")}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {currentStep === "content" && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Compose your message</h2>
            <p className={styles.stepDesc}>Use an approved template or create a new one</p>

            <div className={styles.fieldGroup}>
              <label>Campaign Name</label>
              <input className={styles.textInput} placeholder="e.g. Diwali Sale Blast" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            </div>

            <div className={styles.fieldGroup}>
              <label>Select Template</label>
              <div className={styles.templatePicker}>
                {messageTemplates.map((t) => (
                  <button key={t.id} className={`${styles.templateOption} ${selectedTemplate === t.id ? styles.templateSelected : ""}`} onClick={() => setSelectedTemplate(t.id)}>
                    <code className={styles.templateName}>{t.name}</code>
                    <span className={styles.templatePreview}>{t.preview}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.stepActions}>
              <button className={styles.backBtn} onClick={() => setCurrentStep("audience")}>← Back</button>
              <button className={styles.nextBtn} disabled={!selectedTemplate || !campaignName} onClick={() => setCurrentStep("schedule")}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: Schedule */}
        {currentStep === "schedule" && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>When to send?</h2>
            <p className={styles.stepDesc}>Schedule your broadcast or send immediately</p>

            <div className={styles.scheduleOptions}>
              <button className={`${styles.scheduleOption} ${scheduleType === "now" ? styles.scheduleSelected : ""}`} onClick={() => setScheduleType("now")}>
                <span className={styles.scheduleIcon}>⚡</span>
                <div>
                  <span className={styles.scheduleName}>Send Now</span>
                  <span className={styles.scheduleDesc}>Broadcast immediately to all contacts</span>
                </div>
              </button>
              <button className={`${styles.scheduleOption} ${scheduleType === "later" ? styles.scheduleSelected : ""}`} onClick={() => setScheduleType("later")}>
                <span className={styles.scheduleIcon}>📅</span>
                <div>
                  <span className={styles.scheduleName}>Schedule Later</span>
                  <span className={styles.scheduleDesc}>Pick a date and time for delivery</span>
                </div>
              </button>
            </div>

            {scheduleType === "later" && (
              <div className={styles.dateTimeRow}>
                <div className={styles.fieldGroup}>
                  <label>Date</label>
                  <input type="date" className={styles.textInput} value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Time (IST)</label>
                  <input type="time" className={styles.textInput} value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
              </div>
            )}

            <div className={styles.stepActions}>
              <button className={styles.backBtn} onClick={() => setCurrentStep("content")}>← Back</button>
              <button className={styles.nextBtn} onClick={() => setCurrentStep("review")}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === "review" && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Review & Launch</h2>
            <p className={styles.stepDesc}>Double-check everything before sending</p>

            <div className={styles.reviewCard}>
              <div className={styles.reviewRow}><span>Campaign</span><strong>{campaignName || "Untitled"}</strong></div>
              <div className={styles.reviewRow}><span>Audience</span><strong>{savedSegments.find(s => s.id === selectedSegment)?.name || "—"} ({savedSegments.find(s => s.id === selectedSegment)?.count.toLocaleString() || 0} contacts)</strong></div>
              <div className={styles.reviewRow}><span>Template</span><strong><code>{messageTemplates.find(t => t.id === selectedTemplate)?.name || "—"}</code></strong></div>
              <div className={styles.reviewRow}><span>Schedule</span><strong>{scheduleType === "now" ? "Send Immediately" : `${scheduleDate} at ${scheduleTime}`}</strong></div>
              <div className={styles.reviewRow}><span>Est. Cost</span><strong>₹{((savedSegments.find(s => s.id === selectedSegment)?.count || 0) * 0.48).toLocaleString()} (₹0.48/msg)</strong></div>
            </div>

            <div className={styles.warningBanner}>
              ⚠️ This will send messages to {savedSegments.find(s => s.id === selectedSegment)?.count.toLocaleString() || 0} contacts. This action cannot be undone.
            </div>

            <div className={styles.stepActions}>
              <button className={styles.backBtn} onClick={() => setCurrentStep("schedule")}>← Back</button>
              <button className={styles.launchBtn}>🚀 Launch Campaign</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
