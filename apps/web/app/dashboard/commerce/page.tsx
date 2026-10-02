"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "../../lib/auth-context";
import { SkeletonCard, SkeletonTable } from "../../lib/components/Skeleton";
import { useToast } from "../../lib/components/Toast";
import styles from "./page.module.css";

interface Contact {
  id: string;
  name: string | null;
  phoneNumber: string;
}

interface EcomOrder {
  id: string;
  externalOrderId: string;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  contact?: Contact | null;
}

interface MetaCatalog {
  id: string;
  metaCatalogId: string;
  name: string;
  createdAt: string;
  _count: {
    products: number;
  }
}

export default function CommercePage() {
  const { workspaces } = useAuth();
  const currentWorkspace = workspaces[0];
  const { addToast: toast } = useToast();

  const [activeTab, setActiveTab] = useState<"orders" | "payments" | "catalogs">("orders");
  const [orders, setOrders] = useState<EcomOrder[]>([]);
  const [catalogs, setCatalogs] = useState<MetaCatalog[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [payContactId, setPayContactId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDesc, setPayDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentWorkspace) return;
      try {
        const [contactsRes, ordersRes, paymentsRes, catalogsRes] = await Promise.all([
          apiFetch(`/api/contacts?workspaceId=${currentWorkspace.id}`),
          apiFetch(`/api/commerce/orders?workspaceId=${currentWorkspace.id}`),
          apiFetch(`/api/commerce/payment-history?workspaceId=${currentWorkspace.id}`),
          apiFetch(`/api/commerce/catalogs`)
        ]);

        if (contactsRes.ok) setContacts(contactsRes.data.contacts || []);
        if (ordersRes.ok) setOrders(ordersRes.data.orders || []);
        if (paymentsRes.ok) setPayments(paymentsRes.data.payments || []);
        if (catalogsRes.ok) setCatalogs(catalogsRes.data.catalogs || []);
        
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentWorkspace]);

  const handleSendPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setSubmitting(true);

    try {
      const res = await apiFetch(`/api/payments/links?workspaceId=${currentWorkspace.id}`, {
        method: "POST",
        body: JSON.stringify({
          contactId: payContactId,
          amount: parseFloat(payAmount) * 100, // Assuming smallest unit
          currency: "USD",
          description: payDesc
        })
      });

      if (res.ok) {
        toast("Payment link sent successfully via WhatsApp!", "success");
        setIsModalOpen(false);
        setPayAmount("");
        setPayDesc("");
      } else {
        toast(res.data?.error || "Failed to send payment link. Do you have Stripe/Razorpay connected?", "error");
      }
    } catch (err) {
      toast("Error sending payment link", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentWorkspace) return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonTable rows={5} columns={6} />
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Commerce Manager</h1>
          <p className={styles.subtitle}>Sync Shopify orders and send Stripe/Razorpay payment links via WhatsApp.</p>
        </div>
        <button className={styles.submitBtn} onClick={() => setIsModalOpen(true)}>
          + Create Payment Link
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>Total Revenue</div>
          <div className={styles.statValue}>$1,249.00</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>Recovered Carts</div>
          <div className={styles.statValue}>14</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>Pending Payments</div>
          <div className={styles.statValue}>3</div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === "orders" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          Synced Orders (Shopify)
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === "payments" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("payments")}
        >
          Payment Links
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === "catalogs" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("catalogs")}
        >
          Meta Catalogs
        </button>
      </div>

      {activeTab === "orders" && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Payment Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>No orders found. Integrate your store.</td></tr>
              )}
              {orders.map(order => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 600 }}>{order.externalOrderId}</td>
                  <td>{order.contact?.name || order.contact?.phoneNumber || "Unknown"}</td>
                  <td>{order.totalAmount.toFixed(2)} {order.currency}</td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`status${order.status.charAt(0) + order.status.slice(1).toLowerCase()}`] || ""}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "payments" && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Reference ID</th>
                <th>Provider</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "var(--tp-text-tertiary)" }}>No payment history. Use 'Create Payment Link' to generate one.</td></tr>
              )}
              {payments.map(payment => (
                <tr key={payment.id}>
                  <td style={{ fontWeight: 600 }}>{payment.externalId}</td>
                  <td>{payment.provider}</td>
                  <td>{(payment.amount / 100).toFixed(2)} {payment.currency}</td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`status${payment.status.charAt(0) + payment.status.slice(1).toLowerCase()}`] || ""}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "catalogs" && (
        <div className={styles.tableContainer}>
          <div style={{ padding: "16px", display: "flex", justifyContent: "flex-end", borderBottom: "1px solid #eaeaea" }}>
            <button 
              className={styles.submitBtn} 
              onClick={async () => {
                const name = prompt("Enter catalog name:");
                if (!name) return;
                try {
                  const res = await apiFetch("/api/commerce/sync-catalog", {
                    method: "POST",
                    body: JSON.stringify({ catalogName: name })
                  });
                  if (res.ok) {
                    toast("Catalog synced to Meta successfully!", "success");
                    // refresh
                    const catRes = await apiFetch("/api/commerce/catalogs");
                    if (catRes.ok) setCatalogs(catRes.data.catalogs);
                  } else {
                    toast(res.data?.error || "Failed to sync catalog", "error");
                  }
                } catch (e) {
                  toast("Error syncing catalog", "error");
                }
              }}
            >
              Sync New Catalog
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Catalog Name</th>
                <th>Meta ID</th>
                <th>Products</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {catalogs.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: "20px", color: "var(--tp-text-tertiary)" }}>No Meta catalogs synced. Click 'Sync New Catalog' to start.</td></tr>
              )}
              {catalogs.map(catalog => (
                <tr key={catalog.id}>
                  <td style={{ fontWeight: 600 }}>{catalog.name}</td>
                  <td>{catalog.metaCatalogId}</td>
                  <td>{catalog._count?.products || 0}</td>
                  <td>{new Date(catalog.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {/* Payment Link Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.title} style={{ marginBottom: 24 }}>Send Payment Link</h2>
            <form onSubmit={handleSendPayment}>
              <div className={styles.formGroup}>
                <label>Select Customer</label>
                <select 
                  className={styles.select} 
                  required 
                  value={payContactId} 
                  onChange={e => setPayContactId(e.target.value)}
                >
                  <option value="">-- Choose Contact --</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.phoneNumber}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Amount (USD)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className={styles.input} 
                  required 
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="e.g. 50.00"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Description</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  required 
                  value={payDesc} 
                  onChange={e => setPayDesc(e.target.value)}
                  placeholder="e.g. Consulting Services"
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting || !payContactId}>
                  {submitting ? "Sending..." : "Send via WhatsApp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
