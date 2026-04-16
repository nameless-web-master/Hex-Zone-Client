import type { Message } from "../api/messages";
import { API_BASE_URL, getStoredToken } from "../api/client";

type IncomingNewMessage = {
  type: "NEW_MESSAGE";
  data: Message;
};

type SocketEvent = IncomingNewMessage | { type: string; data?: unknown };

export type MessageSocketOptions = {
  /** Latest access token; falls back to storage if omitted before each connect attempt. */
  token?: string | null;
  getToken?: () => string | null;
  zoneIds: string[];
  onMessage: (message: Message) => void;
  onError?: (error: string) => void;
};

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.id != null &&
    typeof row.zone_id === "string" &&
    typeof row.sender_id === "number" &&
    (row.receiver_id == null || typeof row.receiver_id === "number") &&
    (row.visibility === "public" || row.visibility === "private") &&
    typeof row.message === "string" &&
    typeof row.created_at === "string"
  );
}

/** WebSocket base (no query): wss://host/ws matching API host unless VITE_WS_URL is set. */
export function defaultRealtimeWsBase(): string {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "").split("?")[0] ?? explicit;
  }
  try {
    const u = new URL(API_BASE_URL);
    const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${u.host}/ws`;
  } catch {
    return "wss://hex-zone-server.onrender.com/ws";
  }
}

function resolveToken(options: MessageSocketOptions): string | null {
  const fromGetter = options.getToken?.() ?? null;
  if (fromGetter) return fromGetter;
  if (options.token) return options.token;
  return getStoredToken();
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export class MessageSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private attempt = 0;
  private stopped = false;
  private options: MessageSocketOptions | null = null;

  connect(options: MessageSocketOptions) {
    this.stopped = false;
    this.options = options;
    this.clearReconnectTimer();
    this.attempt = 0;
    this.openNow();
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private openNow() {
    if (this.stopped || !this.options) return;

    const token = resolveToken(this.options);
    if (!token) {
      this.options.onError?.("Not authenticated");
      this.scheduleReconnect();
      return;
    }

    const wsBase = defaultRealtimeWsBase();
    const url = `${wsBase}?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.options.onError?.("WebSocket setup failed");
      this.scheduleReconnect();
      return;
    }

    const opts = this.options;

    this.ws.onopen = () => {
      this.attempt = 0;
      if (opts.zoneIds.length > 0) {
        this.ws?.send(
          JSON.stringify({
            type: "SUBSCRIBE",
            zoneIds: opts.zoneIds,
          }),
        );
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as SocketEvent;
        if (parsed.type === "NEW_MESSAGE" && isMessage(parsed.data)) {
          opts.onMessage(parsed.data);
        }
      } catch {
        opts.onError?.("Invalid socket payload");
      }
    };

    this.ws.onerror = () => {
      opts.onError?.("WebSocket connection error");
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.stopped) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    if (this.stopped || !this.options) return;
    this.clearReconnectTimer();
    const expBackoff = Math.min(
      MAX_BACKOFF_MS,
      INITIAL_BACKOFF_MS * 2 ** this.attempt,
    );
    this.attempt += 1;
    const jitter = Math.floor(Math.random() * 400);
    const delay = expBackoff + jitter;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.openNow();
    }, delay);
  }

  disconnect() {
    this.stopped = true;
    this.clearReconnectTimer();
    this.options = null;
    this.ws?.close();
    this.ws = null;
  }
}
