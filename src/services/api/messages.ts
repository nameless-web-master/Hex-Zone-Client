import { API_BASE_URL, request } from "./client";
import {
  getMessageTypeCategory,
  getMessageScopeForType,
  toMessageType,
  type MessageScope,
  type MessageType,
} from "../../lib/messageTypes";

export type MessageVisibility = MessageScope;

export type Message = {
  id: string;
  zone_id: string;
  sender_id: number;
  receiver_id: number | null;
  type: MessageType;
  category: "Alarm" | "Alert" | "Access";
  scope: MessageScope;
  visibility: MessageVisibility;
  message: string;
  created_at: string;
  raw_payload: Record<string, unknown> | null;
};

export type ListMessagesParams = {
  owner_id: number;
  other_owner_id?: number;
  skip?: number;
  limit?: number;
};

export type SendMessagePayload = {
  message: string;
  type: MessageType;
  zone_id?: string;
  receiver_id?: number;
};

function toLegacyTypeFromVisibility(visibility: unknown): MessageType | null {
  if (visibility === "private") return "PRIVATE";
  if (visibility === "public") return "SERVICE";
  return null;
}

function normalizeReceiverId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function logMalformedMessageWarning(id: unknown, reason: string) {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.warn(`[messages] malformed message record (${String(id ?? "unknown")}): ${reason}`);
}

export function normalizeMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = row.id;
  const zoneIdRaw = row.zone_id ?? row.zoneId;
  const senderId = row.sender_id;
  const createdAt = row.created_at;
  const visibility = row.visibility;
  const text = row.message;
  const directType = toMessageType(row.type ?? row.message_type);
  const fallbackType = toLegacyTypeFromVisibility(visibility);
  const type = directType ?? fallbackType ?? "UNKNOWN";
  const meta = {
    category: getMessageTypeCategory(type),
    scope: getMessageScopeForType(type),
  } as const;

  const zoneId = typeof zoneIdRaw === "string" ? zoneIdRaw : String(zoneIdRaw ?? "");
  const senderIdValue =
    typeof senderId === "number" ? senderId : typeof row.owner_id === "number" ? row.owner_id : null;
  const textValue =
    typeof text === "string"
      ? text
      : row.msg && typeof row.msg === "object"
        ? String((row.msg as Record<string, unknown>).text ?? "")
        : "";

  if (
    id == null ||
    zoneId.trim().length === 0 ||
    senderIdValue == null ||
    typeof createdAt !== "string" ||
    textValue.trim().length === 0
  ) {
    logMalformedMessageWarning(id, "missing core identifiers");
    return null;
  }
  const receiver = normalizeReceiverId(row.receiver_id ?? row.receiver_owner_id);
  if (!directType && !fallbackType) {
    logMalformedMessageWarning(id, "type missing; using UNKNOWN");
  }
  return {
    id: String(id),
    zone_id: zoneId,
    sender_id: senderIdValue,
    receiver_id: receiver,
    type,
    category: meta.category,
    scope: meta.scope,
    visibility: meta.scope,
    message: textValue,
    created_at: createdAt,
    raw_payload: row.msg && typeof row.msg === "object" ? (row.msg as Record<string, unknown>) : null,
  };
}

function messagesListUrl(): string {
  const base = API_BASE_URL.replace(/\/+$/, "");
  return `${base}/messages/`;
}

export async function listMessages(params: ListMessagesParams) {
  const result = await request<unknown[]>({
    method: "GET",
    url: messagesListUrl(),
    params,
  });
  return {
    ...result,
    data: (result.data ?? []).map(normalizeMessage).filter((m): m is Message => Boolean(m)),
  };
}

export async function sendMessage(payload: SendMessagePayload) {
  const result = await request<unknown>({
    method: "POST",
    url: "/messages",
    data: {
      message: payload.message,
      message_type: payload.type,
      visibility: getMessageScopeForType(payload.type),
      ...(payload.zone_id ? { zone_id: payload.zone_id } : {}),
      ...(payload.receiver_id != null ? { receiver_id: payload.receiver_id } : {}),
    },
  });
  return {
    ...result,
    data: normalizeMessage(result.data),
  };
}
