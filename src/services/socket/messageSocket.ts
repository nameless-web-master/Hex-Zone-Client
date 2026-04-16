import { API_BASE_URL } from "../api/client";
import type { Message } from "../api/messages";

type IncomingNewMessage = {
  type: "NEW_MESSAGE";
  data: Message;
};

type SocketEvent = IncomingNewMessage | { type: string; data?: unknown };

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

/** Parse a text frame from the realtime API; returns null if not a NEW_MESSAGE. */
export function parseMessageSocketPayload(raw: string): Message | null {
  try {
    const parsed = JSON.parse(raw) as SocketEvent;
    if (parsed.type === "NEW_MESSAGE" && isMessage(parsed.data)) {
      return parsed.data;
    }
  } catch {
    /* ignore */
  }
  return null;
}
