/**
 * TickerPro WebSocket Client
 *
 * Manages a persistent WebSocket connection for real-time events:
 * - New messages in conversations
 * - Message status updates (sent/delivered/read)
 * - Agent assignment changes
 * - Typing indicators
 * - Broadcast progress updates
 */

type WSEventType =
  | "message:new"
  | "message:status"
  | "conversation:update"
  | "conversation:new"
  | "typing:start"
  | "typing:stop"
  | "agent:assigned"
  | "broadcast:progress"
  | "notification"
  | "connected"
  | "error";

interface WSEvent {
  type: WSEventType;
  payload: any;
  timestamp: string;
}

type EventCallback = (event: WSEvent) => void;

class TickerProWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private listeners: Map<WSEventType | "*", Set<EventCallback>> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isIntentionalClose = false;

  constructor(baseUrl?: string) {
    const wsBase = (baseUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000")
      .replace("http://", "ws://")
      .replace("https://", "wss://");
    this.url = `${wsBase}/ws`;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.token = token;
    this.isIntentionalClose = false;

    try {
      this.ws = new WebSocket(`${this.url}?token=${encodeURIComponent(token)}`);

      this.ws.onopen = () => {
        console.log("[WS] ✅ Connected to TickerPro real-time server");
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.startHeartbeat();
        this.emit({ type: "connected", payload: {}, timestamp: new Date().toISOString() });
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          this.emit(data);
        } catch (err) {
          console.warn("[WS] Failed to parse message:", event.data);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`[WS] Disconnected (code: ${event.code})`);
        this.stopHeartbeat();

        if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error("[WS] Error:", error);
        this.emit({
          type: "error",
          payload: { message: "WebSocket connection error" },
          timestamp: new Date().toISOString(),
        });
      };
    } catch (err) {
      console.error("[WS] Connection failed:", err);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, "Client disconnected");
      this.ws = null;
    }
  }

  /**
   * Send a message through the WebSocket
   */
  send(type: string, payload: any): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send — not connected");
      return;
    }

    this.ws.send(JSON.stringify({ type, payload, timestamp: new Date().toISOString() }));
  }

  /**
   * Subscribe to specific event types
   */
  on(type: WSEventType | "*", callback: EventCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  /**
   * Remove all listeners for a specific event type
   */
  off(type: WSEventType): void {
    this.listeners.delete(type);
  }

  /**
   * Check if currently connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Private Methods ─────────────────────────────────────────────

  private emit(event: WSEvent): void {
    // Notify specific listeners
    this.listeners.get(event.type)?.forEach((cb) => cb(event));
    // Notify wildcard listeners
    this.listeners.get("*")?.forEach((cb) => cb(event));
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.token && !this.isIntentionalClose) {
        this.connect(this.token);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send("ping", {});
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// ── Singleton Instance ────────────────────────────────────────────────
let wsInstance: TickerProWebSocket | null = null;

export function getWSClient(): TickerProWebSocket {
  if (!wsInstance) {
    wsInstance = new TickerProWebSocket();
  }
  return wsInstance;
}

export type { WSEvent, WSEventType, EventCallback };
export default TickerProWebSocket;
