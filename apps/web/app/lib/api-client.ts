/**
 * TickerPro API Client
 *
 * Type-safe wrapper around fetch for all API endpoints.
 * Automatically handles auth headers, error responses, and request serialization.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ── Core Fetch ────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tp_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<{ ok: boolean; data: T; status: number }> {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json();
  return { ok: res.ok, data, status: res.status };
}

// ── Contacts ──────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  leadStage: string;
  tags: string[];
  customFields: Record<string, any>;
  lastMessageAt: string | null;
  createdAt: string;
}

export const contactsAPI = {
  list: (params?: { search?: string; stage?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.stage) qs.set("stage", params.stage);
    if (params?.page) qs.set("page", params.page.toString());
    if (params?.limit) qs.set("limit", params.limit.toString());
    return request<{ contacts: Contact[]; total: number }>(`/api/contacts?${qs.toString()}`);
  },

  get: (id: string) => request<Contact>(`/api/contacts/${id}`),

  create: (data: { phone: string; name?: string; email?: string; tags?: string[] }) =>
    request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Contact>) =>
    request<Contact>(`/api/contacts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/api/contacts/${id}`, { method: "DELETE" }),

  import: (contacts: Array<{ phone: string; name?: string; email?: string }>) =>
    request<{ imported: number; skipped: number }>("/api/contacts/import", { method: "POST", body: JSON.stringify({ contacts }) }),
};

// ── Conversations ─────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  contactId: string;
  contact: Contact;
  assignedTo: string | null;
  status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
  lastMessageAt: string | null;
  unreadCount: number;
  tags: string[];
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
}

export const conversationsAPI = {
  list: (params?: { status?: string; assignedTo?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.assignedTo) qs.set("assignedTo", params.assignedTo);
    if (params?.search) qs.set("search", params.search);
    return request<{ conversations: Conversation[]; total: number }>(`/api/conversations?${qs.toString()}`);
  },

  get: (id: string) => request<Conversation>(`/api/conversations/${id}`),

  assign: (id: string, agentId: string) =>
    request<Conversation>(`/api/conversations/${id}/assign`, { method: "POST", body: JSON.stringify({ agentId }) }),

  close: (id: string) =>
    request<Conversation>(`/api/conversations/${id}/close`, { method: "POST" }),

  reopen: (id: string) =>
    request<Conversation>(`/api/conversations/${id}/reopen`, { method: "POST" }),
};

// ── Messages ──────────────────────────────────────────────────────────

export interface Message {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  type: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO" | "TEMPLATE" | "INTERACTIVE";
  body: string | null;
  mediaUrl: string | null;
  status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  waMessageId: string | null;
  createdAt: string;
}

export const messagesAPI = {
  list: (conversationId: string, params?: { before?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.before) qs.set("before", params.before);
    if (params?.limit) qs.set("limit", params.limit.toString());
    return request<{ messages: Message[]; hasMore: boolean }>(`/api/messages/${conversationId}?${qs.toString()}`);
  },

  send: (conversationId: string, data: { type: string; body?: string; mediaUrl?: string; templateName?: string }) =>
    request<Message>(`/api/messages/${conversationId}/send`, { method: "POST", body: JSON.stringify(data) }),
};

// ── Broadcasts ────────────────────────────────────────────────────────

export interface Broadcast {
  id: string;
  name: string;
  templateId: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "COMPLETED" | "FAILED";
  totalRecipients: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const broadcastsAPI = {
  list: () => request<{ broadcasts: Broadcast[]; total: number }>("/api/broadcasts"),

  get: (id: string) => request<Broadcast>(`/api/broadcasts/${id}`),

  create: (data: { name: string; templateId: string; segmentId: string; scheduledAt?: string }) =>
    request<Broadcast>("/api/broadcasts", { method: "POST", body: JSON.stringify(data) }),

  cancel: (id: string) =>
    request<{ success: boolean }>(`/api/broadcasts/${id}/cancel`, { method: "POST" }),
};

// ── Templates ─────────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  body: string;
  header: string | null;
  footer: string | null;
  buttons: any[];
  status: "APPROVED" | "PENDING" | "REJECTED" | "DRAFT";
  createdAt: string;
}

export const templatesAPI = {
  list: (params?: { category?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.status) qs.set("status", params.status);
    return request<{ templates: Template[]; total: number }>(`/api/templates?${qs.toString()}`);
  },

  get: (id: string) => request<Template>(`/api/templates/${id}`),

  create: (data: { name: string; category: string; language: string; body: string; header?: string; footer?: string }) =>
    request<Template>("/api/templates", { method: "POST", body: JSON.stringify(data) }),

  submit: (id: string) =>
    request<Template>(`/api/templates/${id}/submit`, { method: "POST" }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/api/templates/${id}`, { method: "DELETE" }),
};

// ── Chatbot Flows ─────────────────────────────────────────────────────

export interface ChatbotFlow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: "KEYWORD" | "FIRST_MESSAGE" | "EVENT" | "WEBHOOK" | "AD_CLICK";
  triggerValue: string | null;
  flowData: any;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export const chatbotsAPI = {
  list: (workspaceId: string) => request<{ flows: ChatbotFlow[] }>(`/api/chatbots?workspaceId=${workspaceId}`),

  get: (id: string, workspaceId: string) => request<{ flow: ChatbotFlow }>(`/api/chatbots/${id}?workspaceId=${workspaceId}`),

  create: (workspaceId: string, data: Partial<ChatbotFlow>) =>
    request<{ flow: ChatbotFlow }>(`/api/chatbots?workspaceId=${workspaceId}`, { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, workspaceId: string, data: Partial<ChatbotFlow>) =>
    request<{ flow: ChatbotFlow }>(`/api/chatbots/${id}?workspaceId=${workspaceId}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string, workspaceId: string) =>
    request<{ success: boolean }>(`/api/chatbots/${id}?workspaceId=${workspaceId}`, { method: "DELETE" }),
};

// ── Analytics ─────────────────────────────────────────────────────────

export const analyticsAPI = {
  overview: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    return request<{
      activeConversations: number;
      messagesToday: number;
      broadcastsSent: number;
      revenueAttributed: number;
    }>(`/api/analytics/overview?${qs.toString()}`);
  },

  agentPerformance: () =>
    request<Array<{ agentId: string; name: string; avgResponse: number; resolved: number; csat: number; messages: number }>>("/api/analytics/agents"),

  campaignPerformance: () =>
    request<Array<{ broadcastId: string; name: string; sent: number; delivered: number; read: number; replied: number; revenue: number }>>("/api/analytics/campaigns"),

  sentimentDistribution: () =>
    request<{ positive: number; neutral: number; negative: number; churnRisk: number }>("/api/analytics/sentiment"),
};

// ── Workspace / Team ──────────────────────────────────────────────────

export const workspaceAPI = {
  get: () => request<{ id: string; name: string; plan: string; slug: string }>("/api/workspaces/current"),

  update: (data: { name?: string; website?: string; industry?: string; timezone?: string }) =>
    request<any>("/api/workspaces/current", { method: "PATCH", body: JSON.stringify(data) }),

  members: () =>
    request<Array<{ id: string; name: string; email: string; role: string; status: string }>>("/api/workspaces/members"),

  inviteMember: (data: { email: string; role: string }) =>
    request<any>("/api/workspaces/members/invite", { method: "POST", body: JSON.stringify(data) }),

  updateMember: (memberId: string, data: { role?: string }) =>
    request<any>(`/api/workspaces/members/${memberId}`, { method: "PATCH", body: JSON.stringify(data) }),

  removeMember: (memberId: string) =>
    request<{ success: boolean }>(`/api/workspaces/members/${memberId}`, { method: "DELETE" }),
};
