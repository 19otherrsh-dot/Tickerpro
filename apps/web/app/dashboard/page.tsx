"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth, apiFetch } from "../lib/auth-context";
import { getWSClient, type WSEvent } from "../lib/ws-client";
import { SkeletonConversationList, Skeleton } from "../lib/components/Skeleton";
import EmojiPicker from "../lib/components/EmojiPicker";
import CannedResponses from "../lib/components/CannedResponses";
import styles from "./page.module.css";

interface Conversation {
  id: string;
  contact: { name: string | null; phoneNumber: string; tags?: string[] };
  assignedAgent?: { id: string; firstName: string; lastName: string } | null;
  status: string;
  lastMessageAt: string;
  unreadCount?: number;
}

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  content: any;
  status: string;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  body: string;
  category: string;
  status: string;
}

const sentimentColors: Record<string, string> = {
  positive: "#16A34A",
  neutral: "#4F46E5",
  negative: "#DC2626",
};

export default function InboxPage() {
  const { user, workspaces, activeWorkspace } = useAuth();
  const currentWorkspace = activeWorkspace || workspaces[0];

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // P1: New state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCannedResponses, setShowCannedResponses] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);

  // P4: New state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [noteInput, setNoteInput] = useState("");
  const [internalNotes, setInternalNotes] = useState<{ id: string; text: string; author: string; createdAt: string }[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAgent, setTransferAgent] = useState("");
  const [transferNote, setTransferNote] = useState("");

  // P1b: Real persisted data (replaces hardcoded notes/tags/AI suggestions)
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  
  // Phase 5: Copilot states
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isInternalMode, setIsInternalMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notifSoundRef = useRef<HTMLAudioElement | null>(null);
  const typingSendRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // P4: Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    // Create audio element for notification sound
    notifSoundRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdXGBgYF0ZWFsd3+CgoB4bGVtd3+CgoB3bGVud3+CgoB3a2RueICCg4B3a2RueICDg4B3a2RueICDg4B3a2RveYCDg4B3a2RveYGDg4B3bGVveYGDgoB3bGVveYGCgoB3bGVweYGCgoB4bGVweYGCgoB4bGVweYGCgn94bGZweYGCgn94bGZweYGBgn94bGZweYGBgX94bGZweYGBgX94bWZxeYGBgX94bWdxeYCBgX94bWdxeX+BgX94bWdxeX+BgX95bWdxeX+AgX95bWdxeX+AgX95bmdxeX+AgX95bmdxeX+AgH95bmdxeX6AgH95bmdxeH6AgH95bmdxeH6AgH95bmdxeH6AgH95bmdxeH6AgH96bmdyeH6AgH96bmdyeH6AgH96bmdyeH6AgH96bmhyeH5/gH96bmhyeH5/gH96bmhyeH5/gH96bmhyeH5/f396bmhyeH5/f396bmhyeH5/f396bmhyeH5/f397bmhyeH5/f397bmhyeH5/f397bmhyeH5/f397bmhyeH5/f397bmhyd35/f397bmhyd35/f397bmhyd35/fn97bmhyd35/fn97bmhyd35/fn97bmhyd35/fn97bmhyd31/fn97bmhyd31/fn97bmhyd31/fn97bmhyd31+fn97bmhyd31+fn97bmhyd31+fn97cGhyd31+fn97cGhyd31+fn97cGhyd31+fn98cGhyd31+fn98cGhyd31+fn98cGhydn1+fn98cGhydn1+fn98cGhydn1+fn98cGhydn1+fn98cGhydn1+fn98cGhydn1+fn98cGhydn1+fn98cGhydn1+fn98cGhydn1+fn98cGhyd31+fn98cGhyd31+fn98cGhyd31+fn98cGhyd31+fn98cGhyd31+fn98cGhyd31+fn98");
  }, []);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!currentWorkspace) return;
      try {
        const res = await apiFetch(`/api/conversations?workspaceId=${currentWorkspace.id}`);
        if (res.ok) {
          setConversations(res.data.conversations);
          if (res.data.conversations.length > 0 && !selectedId) {
            setSelectedId(res.data.conversations[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [currentWorkspace]);

  useEffect(() => {
    if (!selectedId) return;
    const fetchMessages = async () => {
      try {
        const res = await apiFetch(`/api/messages/${selectedId}`);
        if (res.ok) {
          setMessages(res.data.messages);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
  }, [selectedId]);

  // P1b: Load persisted notes, tags, and AI suggestions for the open thread
  useEffect(() => {
    if (!selectedId) {
      setInternalNotes([]);
      setTags([]);
      setAiSuggestions([]);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch(`/api/conversations/${selectedId}/notes`);
        if (!cancelled && res.ok && Array.isArray(res.data.notes)) {
          setInternalNotes(
            res.data.notes.map((n: any) => ({ id: n.id, text: n.content, author: "Note", createdAt: n.createdAt }))
          );
        }
      } catch { /* silent */ }
    })();

    (async () => {
      try {
        const res = await apiFetch(`/api/conversations/${selectedId}/tags`);
        if (!cancelled && res.ok && Array.isArray(res.data.tags)) setTags(res.data.tags);
      } catch { /* silent */ }
    })();

    (async () => {
      try {
        const res = await apiFetch(`/api/conversations/${selectedId}/ai-suggestions`);
        if (!cancelled && res.ok && Array.isArray(res.data.suggestions)) setAiSuggestions(res.data.suggestions);
        else if (!cancelled) setAiSuggestions([]);
      } catch { if (!cancelled) setAiSuggestions([]); }
    })();

    return () => { cancelled = true; };
  }, [selectedId]);

  // Fetch templates for quick-insert
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!currentWorkspace) return;
      try {
        const res = await apiFetch(`/api/templates?workspaceId=${currentWorkspace.id}`);
        if (res.ok && res.data.templates) {
          setTemplates(res.data.templates);
        }
      } catch { /* silent */ }
    };
    fetchTemplates();
  }, [currentWorkspace]);

  // Fetch agents for filter
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await apiFetch("/api/workspaces/members");
        if (res.ok && Array.isArray(res.data)) {
          setAgents(res.data.map((m: any) => ({ id: m.userId, name: m.name })));
        }
      } catch { /* silent */ }
    };
    fetchAgents();
  }, []);

  const handleSendForm = async () => {
    const activeConversation = conversations.find(c => c.id === selectedId);
    if (!activeConversation) return;

    try {
      const res = await apiFetch(`/api/messages`, {
        method: "POST",
        body: JSON.stringify({
          conversationId: activeConversation.id,
          type: "INTERACTIVE",
          content: {
            body: "Please fill out this form",
            type: "flow",
            flow_id: "mock_flow_123",
            flow_cta: "Open Form"
          }
        })
      });
      if (res.ok) {
        setMessages(prev => [...prev, res.data.message]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if ((!messageInput.trim() && !attachment) || !selectedId) return;
    setSending(true);

    // P4: Optimistic update — show message instantly
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      direction: "OUTBOUND",
      type: attachment ? (attachment.type.startsWith("image/") ? "IMAGE" : "DOCUMENT") : "TEXT",
      content: { text: messageInput || (attachment?.name ?? "") },
      status: "SENDING",
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    const savedInput = messageInput;
    setMessageInput("");
    setAttachment(null);
    setAttachmentPreview(null);

    try {
      const body: any = { type: optimisticMsg.type, body: savedInput, isInternal: isInternalMode };
      if (optimisticMsg.type !== "TEXT") {
        body.body = savedInput || attachment?.name;
        body.mediaUrl = attachmentPreview;
      }

      // If it's internal mode, save it as a note instead of sending an external message
      if (isInternalMode) {
        const res = await apiFetch(`/api/conversations/${selectedId}/notes`, {
          method: "POST",
          body: JSON.stringify({ content: savedInput }),
        });
        if (res.ok) {
          setInternalNotes(prev => [...prev, { id: res.data.id, text: res.data.content, author: "Note", createdAt: res.data.createdAt }]);
          // Remove optimistic external message since it's an internal note
          setMessages(prev => prev.filter(m => m.id !== optimisticId));
        }
        setSending(false);
        return;
      }

      const res = await apiFetch(`/api/messages/${selectedId}/send`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // Replace optimistic message with real one
        setMessages(prev => prev.map(m => m.id === optimisticId ? res.data : m));
      } else {
        // Mark as failed
        setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, status: "FAILED" } : m));
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, status: "FAILED" } : m));
    } finally {
      setSending(false);
    }
  };

  // P4: Play sound and show browser notification for new inbound messages
  const playNotificationSound = useCallback(() => {
    if (soundEnabled && notifSoundRef.current) {
      notifSoundRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  }, []);

  // ── Real-time subscriptions ──────────────────────────────────────
  // The shared WS connection is opened by AuthProvider; here we just listen.
  useEffect(() => {
    const ws = getWSClient();

    const onMessageNew = (evt: WSEvent) => {
      const { message, conversationId } = evt.payload || {};
      if (!message || !conversationId) return;

      // Append to the open thread, de-duping our own optimistic/echoed sends.
      if (conversationId === selectedId) {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      }

      // Move the conversation to the top, refresh its timestamp, and bump the
      // unread badge when the thread isn't the one currently open.
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx === -1) return prev;
        const conv = prev[idx];
        if (!conv) return prev;
        const isInbound = message.direction === "INBOUND";
        const updated: Conversation = {
          ...conv,
          lastMessageAt: message.createdAt || new Date().toISOString(),
          unreadCount:
            isInbound && conversationId !== selectedId ? (conv.unreadCount || 0) + 1 : conv.unreadCount,
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });

      // Notify only for inbound messages that land outside the open thread.
      if (message.direction === "INBOUND" && conversationId !== selectedId) {
        playNotificationSound();
        showBrowserNotification("New message", message.content?.text || "You have a new message");
      }
    };

    const onMessageStatus = (evt: WSEvent) => {
      const { messageId, status } = evt.payload || {};
      if (!messageId) return;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status } : m)));
    };

    const onConversationNew = (evt: WSEvent) => {
      const { conversation } = evt.payload || {};
      if (!conversation?.id) return;
      setConversations((prev) =>
        prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]
      );
    };

    const onConversationUpdate = (evt: WSEvent) => {
      const { conversationId, assignedAgentId, status } = evt.payload || {};
      const id = conversationId || evt.payload?.conversation?.id;
      if (!id) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, ...(status ? { status } : {}), ...(assignedAgentId ? { assignedAgent: { ...(c.assignedAgent as any), id: assignedAgentId } } : {}) }
            : c
        )
      );
    };

    const onTyping = (evt: WSEvent) => {
      const { userId, conversationId } = evt.payload || {};
      // Ignore our own typing echo and events for other threads.
      if (userId === user?.id || conversationId !== selectedId) return;
      const isStart = evt.type === "typing:start";
      setIsTyping(isStart);
      if (incomingTypingRef.current) clearTimeout(incomingTypingRef.current);
      if (isStart) {
        incomingTypingRef.current = setTimeout(() => setIsTyping(false), 4000);
      }
    };

    const unsubs = [
      ws.on("message:new", onMessageNew),
      ws.on("message:status", onMessageStatus),
      ws.on("conversation:new", onConversationNew),
      ws.on("conversation:update", onConversationUpdate),
      ws.on("agent:assigned", onConversationUpdate),
      ws.on("typing:start", onTyping),
      ws.on("typing:stop", onTyping),
    ];

    return () => {
      unsubs.forEach((off) => off());
      if (incomingTypingRef.current) clearTimeout(incomingTypingRef.current);
    };
  }, [selectedId, user?.id, playNotificationSound, showBrowserNotification]);

  // Notify other agents that we're typing, with a debounced auto-stop.
  const notifyTyping = useCallback(() => {
    if (!selectedId) return;
    const ws = getWSClient();
    ws.send("typing:start", { conversationId: selectedId });
    if (typingSendRef.current) clearTimeout(typingSendRef.current);
    typingSendRef.current = setTimeout(() => {
      ws.send("typing:stop", { conversationId: selectedId });
    }, 2000);
  }, [selectedId]);

  // P1b: Add note handler — persists to the InternalNote model
  const handleAddNote = async () => {
    if (!noteInput.trim() || !selectedId) return;
    const text = noteInput.trim();
    setNoteInput("");
    try {
      const res = await apiFetch(`/api/conversations/${selectedId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });
      if (res.ok && res.data?.id) {
        setInternalNotes(prev => [...prev, { id: res.data.id, text: res.data.content, author: "Note", createdAt: res.data.createdAt }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // P1b: Tag handlers — persist to Tag / ConversationTag
  const handleAddTag = async () => {
    const name = tagInput.trim();
    if (!name || !selectedId) return;
    setTagInput("");
    try {
      const res = await apiFetch(`/api/conversations/${selectedId}/tags`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (res.ok && res.data?.id) {
        setTags(prev => (prev.some(t => t.id === res.data.id) ? prev : [...prev, res.data]));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedId) return;
    setTags(prev => prev.filter(t => t.id !== tagId));
    try {
      await apiFetch(`/api/conversations/${selectedId}/tags/${tagId}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  // P4: Transfer conversation handler
  const handleTransfer = async () => {
    if (!transferAgent || !selectedId) return;
    try {
      await apiFetch(`/api/conversations/${selectedId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ agentId: transferAgent, note: transferNote }),
      });
      setShowTransferModal(false);
      setTransferAgent("");
      setTransferNote("");
      // Optimistically update UI
      setConversations(prev => prev.map(c =>
        c.id === selectedId ? { ...c, assignedAgent: agents.find(a => a.id === transferAgent) as any } : c
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReaction = async (messageId: string, emoji: string) => {
    if (!selectedId) return;
    try {
      const res = await apiFetch(`/api/messages/${selectedId}/send`, {
        method: "POST",
        body: JSON.stringify({ type: "REACTION", body: emoji, referenceId: messageId }),
      });
      if (res.ok) {
        setMessages([...messages, res.data]);
      } else {
        // Optimistically add it for demo if backend doesn't support REACTION yet
        setMessages([...messages, {
          id: `tmp-${Date.now()}`,
          direction: "OUTBOUND",
          type: "REACTION",
          content: { emoji, referenceId: messageId },
          status: "SENT",
          createdAt: new Date().toISOString()
        } as Message]);
      }
    } catch {
        // Fallback for demo
        setMessages([...messages, {
          id: `tmp-${Date.now()}`,
          direction: "OUTBOUND",
          type: "REACTION",
          content: { emoji, referenceId: messageId },
          status: "SENT",
          createdAt: new Date().toISOString()
        } as Message]);
    }
  };

  const handleCopilotSummarize = async () => {
    if (!selectedId) return;
    setIsSummarizing(true);
    try {
      const res = await apiFetch('/api/copilot/summarize', {
        method: 'POST',
        body: JSON.stringify({ conversationId: selectedId })
      });
      if (res.ok && res.data.summary) {
        setAiSummary(res.data.summary);
      }
    } catch (e) { console.error(e); }
    setIsSummarizing(false);
  };

  const handleCopilotSuggest = async () => {
    if (!selectedId) return;
    setIsSuggesting(true);
    try {
      const res = await apiFetch('/api/copilot/suggest-replies', {
        method: 'POST',
        body: JSON.stringify({ conversationId: selectedId })
      });
      if (res.ok && res.data.replies) {
        setAiSuggestions(res.data.replies);
      }
    } catch (e) { console.error(e); }
    setIsSuggesting(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setAttachmentPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleTemplateInsert = (template: Template) => {
    setMessageInput(template.body);
    setShowTemplatePicker(false);
    inputRef.current?.focus();
  };

  const handleCannedSelect = (text: string) => {
    setMessageInput(text);
    setShowCannedResponses(false);
    inputRef.current?.focus();
  };

  const selected = conversations.find((c) => c.id === selectedId);

  // Advanced filtering
  const filtered = conversations.filter((c) => {
    const name = c.contact.name || c.contact.phoneNumber;
    if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus === "unread" && (c.unreadCount || 0) === 0) return false;
    if (filterStatus === "open" && c.status !== "OPEN") return false;
    if (filterStatus === "closed" && c.status !== "CLOSED") return false;
    if (filterAgent !== "all" && c.assignedAgent?.id !== filterAgent) return false;
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      if (new Date(c.lastMessageAt) < from) return false;
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59);
      if (new Date(c.lastMessageAt) > to) return false;
    }
    return true;
  });

  return (
    <div className={styles.inbox}>
      {/* ── Conversation List Panel ─────────────────────── */}
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>
            Inbox
            <span className={styles.inboxCount}>{conversations.reduce((a, c) => a + (c.unreadCount || 0), 0)}</span>
          </h2>
          <div className={styles.listFilters}>
            <button className={`${styles.filterBtn} ${filterStatus === "all" ? styles.filterActive : ""}`} onClick={() => setFilterStatus("all")}>All</button>
            <button className={`${styles.filterBtn} ${filterStatus === "unread" ? styles.filterActive : ""}`} onClick={() => setFilterStatus("unread")}>Unread</button>
            <button className={`${styles.filterBtn} ${filterStatus === "open" ? styles.filterActive : ""}`} onClick={() => setFilterStatus("open")}>Open</button>
            <button className={`${styles.filterBtn} ${filterStatus === "closed" ? styles.filterActive : ""}`} onClick={() => setFilterStatus("closed")}>Closed</button>
            <button
              className={`${styles.filterBtn} ${showFilters ? styles.filterActive : ""}`}
              onClick={() => setShowFilters(!showFilters)}
              title="Advanced Filters"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Advanced filter panel */}
        {showFilters && (
          <div className={styles.advancedFilters}>
            <div className={styles.filterField}>
              <label>Agent</label>
              <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
                <option value="all">All Agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterDateRow}>
              <div className={styles.filterField}>
                <label>From</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
              </div>
              <div className={styles.filterField}>
                <label>To</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
              </div>
            </div>
            {(filterAgent !== "all" || filterDateFrom || filterDateTo) && (
              <button
                className={styles.clearFiltersBtn}
                onClick={() => { setFilterAgent("all"); setFilterDateFrom(""); setFilterDateTo(""); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        <div className={styles.searchBox}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input type="text" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className={styles.convList}>
          {loading ? (
            <SkeletonConversationList count={8} />
          ) : filtered.length === 0 ? (
            <div className={styles.convEmpty}>
              <div className={styles.convEmptyIcon}>💬</div>
              {searchQuery || filterStatus !== "all" ? (
                <>
                  <p className={styles.convEmptyTitle}>No matching conversations</p>
                  <p className={styles.convEmptyText}>Try clearing your search or filters.</p>
                </>
              ) : (
                <>
                  <p className={styles.convEmptyTitle}>No conversations yet</p>
                  <p className={styles.convEmptyText}>Connect your WhatsApp number and incoming messages will land here.</p>
                  <a href="/dashboard/settings/whatsapp" className={styles.convEmptyBtn}>Connect WhatsApp →</a>
                </>
              )}
            </div>
          ) : filtered.map((conv) => {
            const name = conv.contact.name || conv.contact.phoneNumber;
            const avatar = name.substring(0, 2).toUpperCase();
            
            return (
            <button key={conv.id} className={`${styles.convItem} ${conv.id === selectedId ? styles.convActive : ""}`} onClick={() => setSelectedId(conv.id)}>
              <div className={styles.convAvatar} style={{ background: `linear-gradient(135deg, #10B98188, #10B981)` }}>
                {avatar}
              </div>
              <div className={styles.convBody}>
                <div className={styles.convTop}>
                  <span className={styles.convName}>{name}</span>
                  <span className={styles.convTime}>{new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={styles.convBottom}>
                  <span className={styles.convPreview}>{conv.status}</span>
                  {(conv.unreadCount || 0) > 0 && <span className={styles.convBadge}>{conv.unreadCount}</span>}
                </div>
              </div>
            </button>
          );})}
        </div>
      </div>

      {/* ── Chat Panel ──────────────────────────────────── */}
      <div className={styles.chatPanel}>
        {selected ? (
          <>
            <div className={styles.chatHeader}>
              <div className={styles.chatHeaderLeft}>
                <div className={styles.chatAvatar} style={{ background: `linear-gradient(135deg, #10B98188, #10B981)` }}>
                  {(selected.contact.name || selected.contact.phoneNumber).substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className={styles.chatName}>{selected.contact.name || "Unknown"}</div>
                  <div className={styles.chatPhone}>{selected.contact.phoneNumber}</div>
                </div>
              </div>
              <div className={styles.chatHeaderRight}>
                <button onClick={handleCopilotSummarize} disabled={isSummarizing} className={styles.aiAssistBtn} style={{ marginRight: 8 }}>
                  {isSummarizing ? "⏳ Summarizing..." : "✨ Summarize"}
                </button>
                <button onClick={handleCopilotSuggest} disabled={isSuggesting} className={styles.aiAssistBtn} style={{ marginRight: 16 }}>
                  {isSuggesting ? "⏳ Suggesting..." : "✨ Suggest Replies"}
                </button>
                <span className={styles.stagePill}>{selected.status}</span>
              </div>
            </div>

            <div className={styles.chatMessages}>
              {messages.filter(m => m.type !== "REACTION").map((msg) => {
                const msgReactions = messages.filter(m => m.type === "REACTION" && m.content?.referenceId === msg.id);
                return (
                <div key={msg.id} className={`${styles.message} ${msg.direction === "OUTBOUND" ? styles.msgOut : styles.msgIn}`}>
                  <div className={styles.msgBubble}>
                    {/* Render media if present */}
                    {msg.content?.mediaUrl && msg.type === "IMAGE" && (
                      <img src={msg.content.mediaUrl} alt="Media" className={styles.msgImage} />
                    )}
                    {msg.content?.mediaUrl && msg.type === "DOCUMENT" && (
                      <div className={styles.msgDocument}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        <span>{msg.content.text || "Document"}</span>
                      </div>
                    )}
                    {msg.type === "INTERACTIVE" && msg.content?.type === "flow" ? (
                      <div style={{ background: "rgba(0,0,0,0.05)", padding: 12, borderRadius: 8, marginTop: 4 }}>
                        <strong>📝 {msg.content.body}</strong>
                        <button className={styles.primaryBtn} style={{ marginTop: 8, width: "100%", padding: 6, fontSize: "0.8rem" }}>
                          {msg.content.flow_cta || "Open Form"}
                        </button>
                      </div>
                    ) : (
                      <p className={styles.msgText}>{msg.content?.text || msg.content?.body || "..."}</p>
                    )}
                    <span className={styles.msgTime}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.direction === "OUTBOUND" && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={msg.status === "READ" ? "#3B82F6" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 7 17l-5-5" /><path d="m22 10-9.5 9.5L10 17" />
                        </svg>
                      )}
                    </span>

                    {msgReactions.length > 0 && (
                      <div className={styles.reactionsWrapper}>
                        {msgReactions.map(r => (
                          <span key={r.id} className={styles.reaction}>{r.content?.emoji}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.msgActions}>
                    <button className={styles.reactBtn} title="React" onClick={() => handleSendReaction(msg.id, "👍")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>
                  </div>
                </div>
              )})}

              {isTyping && (
                <div className={`${styles.message} ${styles.msgIn}`}>
                  <div className={`${styles.msgBubble} ${styles.typingBubble}`}>
                    <span className={styles.dot}></span>
                    <span className={styles.dot}></span>
                    <span className={styles.dot}></span>
                  </div>
                </div>
              )}
            </div>

            {/* AI Summary */}
            {aiSummary && (
              <div className={styles.successBanner} style={{ margin: "16px 24px", padding: 16, background: "var(--tp-bg-secondary)", borderRadius: 8, border: "1px solid var(--tp-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--tp-brand-700)" }}>
                    ✨ AI Summary
                  </strong>
                  <button onClick={() => setAiSummary(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tp-text-tertiary)" }}>✕</button>
                </div>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: "0.9rem", color: "var(--tp-text-secondary)" }}>
                  {aiSummary}
                </div>
              </div>
            )}

            {/* AI Suggestions — only shown when the AI service returns any */}
            {aiSuggestions.length > 0 && (
              <div className={styles.aiSuggestions}>
                <div className={styles.aiLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v4m0 14v-4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8M3 12h4m14 0h-4M5.6 18.4l2.8-2.8m7.2-7.2 2.8-2.8" /></svg>
                  AI Suggestions
                </div>
                <div className={styles.aiCards}>
                  {aiSuggestions.map((s, i) => (
                    <button key={i} className={styles.aiCard} onClick={() => setMessageInput(s)}>
                      {s.length > 80 ? `${s.slice(0, 80)}...` : s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attachment Preview */}
            {attachment && (
              <div className={styles.attachmentPreview}>
                {attachmentPreview ? (
                  <img src={attachmentPreview} alt="Preview" className={styles.attachPreviewImg} />
                ) : (
                  <div className={styles.attachPreviewFile}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                    <span>{attachment.name}</span>
                    <span className={styles.attachSize}>{(attachment.size / 1024).toFixed(1)} KB</span>
                  </div>
                )}
                <button className={styles.attachRemove} onClick={() => { setAttachment(null); setAttachmentPreview(null); }} title="Remove">✕</button>
              </div>
            )}

            {/* Composer */}
            <div className={styles.chatComposer} style={isInternalMode ? { background: "#FFFBEB", borderTop: "2px solid #F59E0B" } : {}}>
              <button 
                className={styles.composerBtn} 
                onClick={() => setIsInternalMode(!isInternalMode)} 
                title="Toggle Internal Note"
                style={isInternalMode ? { color: "#F59E0B", background: "#FEF3C7" } : {}}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </button>

              {/* Emoji Picker */}
              <div style={{ position: "relative" }}>
                <button className={styles.composerBtn} title="Emoji" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowCannedResponses(false); setShowTemplatePicker(false); }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" />
                  </svg>
                </button>
                {showEmojiPicker && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
              </div>

              {/* File Attachment */}
              <button className={styles.composerBtn} title="Attach file" onClick={() => fileInputRef.current?.click()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} style={{ display: "none" }} />

              {/* Meta Flow / Form */}
              <button className={styles.composerBtn} title="Send Form (Meta Flow)" onClick={handleSendForm}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
              </button>

              {/* Template Quick-Insert */}
              <div style={{ position: "relative" }}>
                <button className={styles.composerBtn} title="Insert template" onClick={() => { setShowTemplatePicker(!showTemplatePicker); setShowEmojiPicker(false); setShowCannedResponses(false); }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="3" x2="21" y1="9" y2="9" /><line x1="9" x2="9" y1="21" y2="9" />
                  </svg>
                </button>
                {showTemplatePicker && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setShowTemplatePicker(false)} />
                    <div className={styles.templatePicker}>
                      <div className={styles.templatePickerHeader}>Templates</div>
                      {templates.length === 0 ? (
                        <div className={styles.templateEmpty}>No templates found</div>
                      ) : (
                        templates.map((t) => (
                          <button key={t.id} className={styles.templateItem} onClick={() => handleTemplateInsert(t)}>
                            <span className={styles.templateName}>{t.name}</span>
                            <span className={styles.templateBody}>{t.body.slice(0, 60)}...</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Canned Responses */}
              <div style={{ position: "relative" }}>
                <button className={styles.composerBtn} title="Quick replies" onClick={() => { setShowCannedResponses(!showCannedResponses); setShowEmojiPicker(false); setShowTemplatePicker(false); }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <line x1="9" x2="15" y1="10" y2="10" />
                  </svg>
                </button>
                {showCannedResponses && <CannedResponses onSelect={handleCannedSelect} onClose={() => setShowCannedResponses(false)} />}
              </div>

              <input
                ref={inputRef}
                type="text"
                className={styles.composerInput}
                placeholder={isInternalMode ? "Type an internal note (customers won't see this)..." : "Type a message..."}
                value={messageInput}
                onChange={(e) => { setMessageInput(e.target.value); notifyTyping(); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                disabled={sending}
                style={isInternalMode ? { background: "#FFFBEB" } : {}}
              />
              <button className={styles.sendBtn} disabled={(!messageInput.trim() && !attachment) || sending} onClick={handleSendMessage} style={isInternalMode ? { background: "#F59E0B" } : {}}>
                {isInternalMode ? "Save Note" : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.emptyChat}>
            <div className={styles.emptyChatIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
            <p className={styles.emptyChatTitle}>Your conversations live here</p>
            <p className={styles.emptyChatText}>Select a conversation from the list to start messaging, or connect a WhatsApp number to begin.</p>
          </div>
        )}
      </div>

      {/* ── Contact Details Panel ───────────────────────── */}
      {selected && (
        <div className={styles.detailsPanel}>
          <div className={styles.detailsHeader}>
            <div className={styles.detailsAvatar} style={{ background: `linear-gradient(135deg, ${sentimentColors.neutral}88, ${sentimentColors.neutral})` }}>
              {(selected.contact?.name || "??").substring(0,2).toUpperCase()}
            </div>
            <h3 className={styles.detailsName}>{selected.contact?.name || "Unknown"}</h3>
            <p className={styles.detailsPhone}>{selected.contact?.phoneNumber}</p>
          </div>

          <div className={styles.detailsSection}>
            <h4 className={styles.detailsSectionTitle}>Lead Info</h4>
            <div className={styles.detailsRow}><span>Status</span><span className={styles.stagePill}>{selected.status}</span></div>
            <div className={styles.detailsRow}><span>Source</span><span>WhatsApp</span></div>
            <div className={styles.detailsRow}><span>Assigned to</span><span>{selected.assignedAgent ? `${selected.assignedAgent.firstName} ${selected.assignedAgent.lastName}` : "Unassigned"}</span></div>
            <button
              onClick={() => setShowTransferModal(true)}
              style={{ width: "100%", marginTop: 12, padding: "8px 14px", background: "var(--tp-bg-secondary)", border: "1px solid var(--tp-border)", borderRadius: "var(--tp-radius-md)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "var(--tp-text-secondary)", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Transfer Conversation
            </button>
          </div>

          <div className={styles.detailsSection}>
            <h4 className={styles.detailsSectionTitle}>Tags</h4>
            <div className={styles.tagList}>
              {tags.length === 0 && <span className={styles.noteTime}>No tags yet</span>}
              {tags.map(t => (
                <span key={t.id} className={styles.tag} style={{ background: `${t.color}22`, color: t.color }}>
                  {t.name}
                  <button
                    onClick={() => handleRemoveTag(t.id)}
                    title="Remove tag"
                    style={{ marginLeft: 6, background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="text"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(); }}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--tp-border)", borderRadius: "var(--tp-radius-md)", fontSize: "0.85rem", background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", outline: "none" }}
              />
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                style={{ padding: "8px 14px", background: "var(--tp-brand-600)", color: "white", border: "none", borderRadius: "var(--tp-radius-md)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, opacity: tagInput.trim() ? 1 : 0.5 }}
              >
                Add
              </button>
            </div>
          </div>

          <div className={styles.detailsSection}>
            <h4 className={styles.detailsSectionTitle}>Internal Notes</h4>
            {internalNotes.length === 0 && <span className={styles.noteTime}>No notes yet</span>}
            {internalNotes.map(note => (
              <div key={note.id} className={styles.noteCard} style={{ marginTop: 8 }}>
                <p>{note.text}</p>
                <span className={styles.noteTime}>{new Date(note.createdAt).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="text"
                placeholder="Add a note..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--tp-border)", borderRadius: "var(--tp-radius-md)", fontSize: "0.85rem", background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", outline: "none" }}
              />
              <button
                onClick={handleAddNote}
                disabled={!noteInput.trim()}
                style={{ padding: "8px 14px", background: "var(--tp-brand-600)", color: "white", border: "none", borderRadius: "var(--tp-radius-md)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, opacity: noteInput.trim() ? 1 : 0.5 }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Sound toggle */}
          <div className={styles.detailsSection}>
            <div className={styles.detailsRow} style={{ cursor: "pointer" }} onClick={() => setSoundEnabled(!soundEnabled)}>
              <span>🔔 Sound Alerts</span>
              <span style={{ fontWeight: 600, color: soundEnabled ? "var(--tp-success)" : "var(--tp-text-tertiary)" }}>{soundEnabled ? "On" : "Off"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998 }} onClick={() => setShowTransferModal(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--tp-bg-primary)", borderRadius: "var(--tp-radius-lg)", padding: 32, width: 400, zIndex: 9999, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.2rem", color: "var(--tp-text-primary)" }}>Transfer Conversation</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--tp-text-secondary)", marginBottom: 20 }}>
              Select an agent and optionally leave a note for context.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6, color: "var(--tp-text-secondary)" }}>Assign to</label>
              <select value={transferAgent} onChange={(e) => setTransferAgent(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--tp-border)", borderRadius: "var(--tp-radius-md)", fontSize: "0.9rem", background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)" }}>
                <option value="">Select agent...</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6, color: "var(--tp-text-secondary)" }}>Transfer Note (optional)</label>
              <textarea
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="e.g. Customer wants billing help..."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--tp-border)", borderRadius: "var(--tp-radius-md)", fontSize: "0.9rem", background: "var(--tp-bg-secondary)", color: "var(--tp-text-primary)", resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowTransferModal(false)} style={{ padding: "10px 20px", border: "1px solid var(--tp-border)", borderRadius: "var(--tp-radius-md)", background: "transparent", cursor: "pointer", color: "var(--tp-text-secondary)", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleTransfer} disabled={!transferAgent} style={{ padding: "10px 20px", background: "var(--tp-brand-600)", color: "white", border: "none", borderRadius: "var(--tp-radius-md)", cursor: "pointer", fontWeight: 600, opacity: transferAgent ? 1 : 0.5 }}>Transfer</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
