import type { Message } from "../api/messages";

type IncomingNewMessage = {
  type: "NEW_MESSAGE";
  data: Message;
};

type SocketEvent = IncomingNewMessage | { type: string; data?: unknown };

type MessageSocketOptions = {
  token?: string | null;
  zoneIds: string[];
  onMessage: (message: Message) => void;
  onError?: (error: string) => void;
};

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.zoneId === "string" &&
    typeof row.text === "string" &&
    typeof row.type === "string" &&
    typeof row.createdAt === "string"
  );
}

export class MessageSocketClient {
  private ws: WebSocket | null = null;

  connect(options: MessageSocketOptions) {
    const baseWs =
      import.meta.env.VITE_WS_URL ||
      "wss://hex-zone-server.onrender.com/ws/messages";
    const tokenQuery = options.token
      ? `?token=${encodeURIComponent(options.token)}`
      : "";
    this.ws = new WebSocket(`${baseWs}${tokenQuery}`);

    this.ws.onopen = () => {
      this.ws?.send(
        JSON.stringify({
          type: "SUBSCRIBE",
          zoneIds: options.zoneIds,
        }),
      );
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as SocketEvent;
        if (parsed.type === "NEW_MESSAGE" && isMessage(parsed.data)) {
          options.onMessage(parsed.data);
        }
      } catch {
        options.onError?.("Invalid socket payload");
      }
    };

    this.ws.onerror = () => {
      options.onError?.("WebSocket connection error");
    };
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
