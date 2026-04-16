import { API_BASE_URL, request } from "./client";

export type MessageVisibility = "public" | "private";

export type Message = {
  id: string;
  zone_id: string;
  sender_id: number;
  receiver_id: number | null;
  visibility: MessageVisibility;
  message: string;
  created_at: string;
};

export type ListMessagesParams = {
  owner_id: number;
  other_owner_id?: number;
  skip?: number;
  limit?: number;
};

export type SendMessagePayload = {
  message: string;
  visibility: MessageVisibility;
  receiver_id?: number;
};

function normalizeMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = row.id;
  const zoneId = row.zone_id;
  const senderId = row.sender_id;
  const createdAt = row.created_at;
  const visibility = row.visibility;
  const text = row.message;
  if (
    id == null ||
    typeof zoneId !== "string" ||
    typeof senderId !== "number" ||
    typeof createdAt !== "string" ||
    (visibility !== "public" && visibility !== "private") ||
    typeof text !== "string"
  ) {
    return null;
  }
  const receiver =
    typeof row.receiver_id === "number" ? row.receiver_id : row.receiver_id === null ? null : null;
  return {
    id: String(id),
    zone_id: zoneId,
    sender_id: senderId,
    receiver_id: receiver,
    visibility,
    message: text,
    created_at: createdAt,
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
  const result = await request<unknown>({ method: "POST", url: "/messages", data: payload });
  return {
    ...result,
    data: normalizeMessage(result.data),
  };
}
