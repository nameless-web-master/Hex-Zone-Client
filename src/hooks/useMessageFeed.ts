import { useEffect, useMemo, useState } from "react";
import { getStoredToken } from "../services/api/client";
import { listMessages, type Message } from "../services/api/messages";
import { MessageSocketClient } from "../services/socket/messageSocket";
import { useAuth } from "./useAuth";
import { useAppState } from "../state/app/AppStateContext";

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

  useEffect(() => {
    if (!Number.isFinite(ownerId) || ownerId <= 0 || !token) {
      setLocalMessages([]);
      setGlobalMessages([]);
      return;
    }
    let active = true;
    const socket = new MessageSocketClient();
    let pollTimer: number | undefined;

    const applyMessage = (incoming: Message) => {
      setLocalMessages((prev) => {
        const exists = prev.some((msg) => msg.id === incoming.id);
        const next = exists
          ? prev.map((msg) => (msg.id === incoming.id ? incoming : msg))
          : [incoming, ...prev];
        const sorted = sortByNewest(next);
        setGlobalMessages(sorted);
        return sorted;
      });
    };

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
          setLocalMessages(() => {
            const sorted = sortByNewest(batch);
            setGlobalMessages(sorted);
            return sorted;
          });
        } else {
          setLocalMessages([]);
          setGlobalMessages([]);
        }
      }
      setLoading(false);
      pollTimer = window.setTimeout(poll, 8000);
    };

    socket.connect({
      token,
      getToken: getStoredToken,
      zoneIds,
      onMessage: applyMessage,
      onError: setError,
    });
    void poll();

    return () => {
      active = false;
      socket.disconnect();
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [token, zoneIds, setGlobalMessages, ownerId]);

  const zones = useMemo(
    () => Array.from(new Set(messages.map((msg) => msg.zone_id))),
    [messages],
  );

  return { messages, zones, loading, error };
}
