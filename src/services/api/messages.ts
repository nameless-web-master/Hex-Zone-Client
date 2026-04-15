import { request } from "./client";

export type MessageType = "NORMAL" | "PANIC" | "NS_PANIC" | "SENSOR";

export type Message = {
  id: string;
  zoneId: string;
  text: string;
  type: MessageType;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type SendMessagePayload = {
  zoneId: string;
  type: MessageType;
  text: string;
  metadata?: Record<string, unknown>;
};

export async function sendMessage(payload: SendMessagePayload) {
  return request<Message>({ method: "POST", url: "/messages", data: payload });
}

export async function getNewMessages(since: string) {
  return request<Message[]>({
    method: "GET",
    url: "/messages/new",
    params: { since },
  });
}
