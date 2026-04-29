import { useCallback, useEffect, useMemo, useState } from "react";
import { listMessages, type Message } from "../services/api/messages";
import { parseMessageSocketPayload } from "../services/socket/messageSocket";
import { useAuth } from "./useAuth";
import { useAppState } from "../state/app/AppStateContext";
import { useWebSocket } from "./useWebSocket";

function sortByNewest(list: Message[]) {
  return [...list].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function useMessageFeed(zoneIds: string[]) {
  const { token, user } = useAuth();
  const { setMessages: setGlobalMessages } = useAppState();
  const [messages, setLocalMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownerId = Number(user?.id);

  const applyMessage = useCallback(
    (incoming: Message) => {
      setLocalMessages((prev) => {
        const exists = prev.some((msg) => msg.id === incoming.id);
        const next = exists
          ? prev.map((msg) => (msg.id === incoming.id ? incoming : msg))
          : [incoming, ...prev];
        return sortByNewest(next);
      });
    },
    [],
  );

  const { lastMessage, status } = useWebSocket({
    token,
    zoneIds,
  });

  useEffect(() => {
    if (!lastMessage) return;
    const incoming = parseMessageSocketPayload(lastMessage);
    if (incoming) {
      applyMessage(incoming);
    }
  }, [lastMessage, applyMessage]);

  useEffect(() => {
    if (status === "closed" && token) {
      setError("WebSocket connection error");
      return;
    }
    if (status === "open") {
      setError(null);
    }
  }, [status, token]);

  useEffect(() => {
    if (!Number.isFinite(ownerId) || ownerId <= 0 || !token) {
      setLocalMessages([]);
      setGlobalMessages([]);
      return;
    }
    let active = true;
    let pollTimer: number | undefined;

    const poll = async () => {
      setLoading(true);
      const result = await listMessages({
        owner_id: ownerId,
        skip: 0,
        limit: 100,
      });
      if (!active) return;
      if (result.error) {
        setError(result.error);
      } else {
        const batch = result.data ?? [];
        if (batch.length > 0) {
          setLocalMessages(sortByNewest(batch));
        } else {
          setLocalMessages([]);
          setGlobalMessages([]);
        }
      }
      setLoading(false);
      pollTimer = window.setTimeout(poll, 8000);
    };

    void poll();

    return () => {
      active = false;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [token, setGlobalMessages, ownerId]);

  useEffect(() => {
    setGlobalMessages(messages);
  }, [messages, setGlobalMessages]);

  const zones = useMemo(
    () => Array.from(new Set(messages.map((msg) => msg.zone_id))),
    [messages],
  );

  return { messages, zones, loading, error };
}
