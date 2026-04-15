import { useEffect, useMemo, useRef, useState } from "react";
import { getNewMessages, type Message } from "../services/api/messages";
import { MessageSocketClient } from "../services/socket/messageSocket";
import { useAuth } from "./useAuth";
import { useAppState } from "../state/app/AppStateContext";

function sortByNewest(list: Message[]) {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function useMessageFeed(zoneIds: string[]) {
  const { token } = useAuth();
  const { setMessages: setGlobalMessages } = useAppState();
  const [messages, setLocalMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestTimestamp = useRef<string>(new Date(0).toISOString());

  useEffect(() => {
    let active = true;
    const socket = new MessageSocketClient();
    let pollTimer: number | undefined;

    const applyMessage = (incoming: Message) => {
      setLocalMessages((prev) => {
        const exists = prev.some((msg) => msg.id === incoming.id);
        const next = exists
          ? prev.map((msg) => (msg.id === incoming.id ? incoming : msg))
          : [incoming, ...prev];
        const newest = next[0]?.createdAt;
        if (newest) latestTimestamp.current = newest;
        const sorted = sortByNewest(next);
        setGlobalMessages(sorted);
        return sorted;
      });
    };

    const poll = async () => {
      setLoading(true);
      const result = await getNewMessages(latestTimestamp.current);
      if (!active) return;
      if (result.error) {
        setError(result.error);
      } else {
        const batch = result.data ?? [];
        if (batch.length > 0) {
          const newest = sortByNewest(batch)[0]?.createdAt;
          if (newest) latestTimestamp.current = newest;
          setLocalMessages((prev) => {
            const sorted = sortByNewest([...batch, ...prev]);
            setGlobalMessages(sorted);
            return sorted;
          });
        }
      }
      setLoading(false);
      pollTimer = window.setTimeout(poll, 8000);
    };

    socket.connect({
      token,
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
  }, [token, zoneIds, setGlobalMessages]);

  const zones = useMemo(
    () => Array.from(new Set(messages.map((msg) => msg.zoneId))),
    [messages],
  );

  return { messages, zones, loading, error };
}
