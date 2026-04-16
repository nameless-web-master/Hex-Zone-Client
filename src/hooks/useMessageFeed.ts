import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listMessages, type Message } from "../services/api/messages";
import {
  defaultRealtimeWsBase,
  parseMessageSocketPayload,
} from "../services/socket/messageSocket";
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

  const zoneIdsRef = useRef(zoneIds);
  zoneIdsRef.current = zoneIds;
  const zoneKey = useMemo(() => JSON.stringify(zoneIds), [zoneIds]);

  const wsUrl = useMemo(() => {
    if (!token) return null;
    const base = defaultRealtimeWsBase();
    return `${base}?token=${encodeURIComponent(token)}`;
  }, [token]);

  const applyMessage = useCallback(
    (incoming: Message) => {
      setLocalMessages((prev) => {
        const exists = prev.some((msg) => msg.id === incoming.id);
        const next = exists
          ? prev.map((msg) => (msg.id === incoming.id ? incoming : msg))
          : [incoming, ...prev];
        const sorted = sortByNewest(next);
        setGlobalMessages(sorted);
        return sorted;
      });
    },
    [setGlobalMessages],
  );

  const { send } = useWebSocket(wsUrl, {
    buildOpenFrames: () =>
      zoneIdsRef.current.length > 0
        ? [JSON.stringify({ type: "SUBSCRIBE", zoneIds: zoneIdsRef.current })]
        : [],
    onMessage: (ev) => {
      if (typeof ev.data !== "string") return;
      const incoming = parseMessageSocketPayload(ev.data);
      if (incoming) applyMessage(incoming);
    },
    onError: () => {
      setError("WebSocket connection error");
    },
  });

  useEffect(() => {
    if (!wsUrl) return;
    if (zoneIdsRef.current.length === 0) return;
    send(JSON.stringify({ type: "SUBSCRIBE", zoneIds: zoneIdsRef.current }));
  }, [wsUrl, send, zoneKey]);

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

    void poll();

    return () => {
      active = false;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [token, setGlobalMessages, ownerId]);

  const zones = useMemo(
    () => Array.from(new Set(messages.map((msg) => msg.zone_id))),
    [messages],
  );

  return { messages, zones, loading, error };
}
