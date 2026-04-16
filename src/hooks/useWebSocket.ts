import { useCallback, useEffect, useRef } from "react";

/**
 * Reusable WebSocket hook for React 18 + Strict Mode.
 *
 * Key decisions:
 * - **Single socket per `url` lifecycle:** The effect owns the socket; `wsRef` holds the active instance.
 * - **Deps only `url` + `enabled`:** Handlers and backoff tuning live in `optsRef` so callback identity does not recreate connections.
 * - **Strict Mode:** Cleanup sets `manualCloseRef` before `close()`, so `onclose` never schedules reconnect; ref resets after cleanup for the remount.
 * - **Reconnect:** Exponential backoff with jitter; only when close was not user-initiated and `reconnect` is true.
 * - **Logging:** URLs are logged with `token` query redacted; message bodies truncated (never log JWTs).
 */

export type UseWebSocketOptions = {
  enabled?: boolean;
  protocols?: string | string[];
  /**
   * JSON strings to send immediately after each successful `open` (including reconnects).
   * Use a ref inside the factory for values that change without changing `url`.
   */
  buildOpenFrames?: () => string[];
  reconnect?: boolean;
  maxBackoffMs?: number;
  initialBackoffMs?: number;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
};

const LOG_PREFIX = "[WebSocket]";

function maskUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("token")) {
      u.searchParams.set("token", "<redacted>");
    }
    return u.toString();
  } catch {
    return url.replace(/([?&]token=)[^&]*/i, "$1<redacted>");
  }
}

function log(level: "log" | "warn" | "error", message: string, ...meta: unknown[]) {
  console[level](LOG_PREFIX, message, ...meta);
}

function previewPayload(data: string, max = 500): string {
  if (data.length <= max) return data;
  return `${data.slice(0, max)}…`;
}

export function useWebSocket(
  url: string | null,
  options: UseWebSocketOptions = {},
) {
  const enabled = options.enabled ?? true;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const manualCloseRef = useRef(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const send = useCallback((data: string) => {
    const w = wsRef.current;
    if (w?.readyState === WebSocket.OPEN) {
      w.send(data);
      log("log", "send", previewPayload(data, 200));
      return true;
    }
    log("warn", "send skipped (socket not OPEN)", { readyState: w?.readyState });
    return false;
  }, []);

  useEffect(() => {
    if (!url || !enabled) {
      log("log", "inactive: closing socket", { hasUrl: Boolean(url), enabled });
      manualCloseRef.current = true;
      clearReconnectTimer();
      const existing = wsRef.current;
      if (existing) {
        existing.close(1000, "inactive");
        wsRef.current = null;
      }
      manualCloseRef.current = false;
      return;
    }

    manualCloseRef.current = false;
    attemptRef.current = 0;

    const scheduleReconnect = () => {
      clearReconnectTimer();
      if (manualCloseRef.current) return;
      const wantReconnect = optsRef.current.reconnect ?? true;
      if (!wantReconnect) return;

      const maxBackoff = optsRef.current.maxBackoffMs ?? 30_000;
      const initialBackoff = optsRef.current.initialBackoffMs ?? 1_000;
      const attempt = attemptRef.current;
      const backoff = Math.min(maxBackoff, initialBackoff * 2 ** attempt);
      attemptRef.current += 1;
      const jitter = Math.floor(Math.random() * 400);
      const delay = backoff + jitter;

      log("log", "reconnect scheduled", { delayMs: delay, attempt: attemptRef.current });

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (manualCloseRef.current) return;
        openSocket();
      }, delay);
    };

    const openSocket = () => {
      if (manualCloseRef.current) return;

      const prev = wsRef.current;
      if (prev) {
        prev.onopen = null;
        prev.onmessage = null;
        prev.onerror = null;
        prev.onclose = null;
        prev.close(1000, "replaced");
        wsRef.current = null;
      }

      const protocols = optsRef.current.protocols;
      log("log", "connecting", maskUrlForLog(url));

      let ws: WebSocket;
      try {
        ws = protocols != null ? new WebSocket(url, protocols) : new WebSocket(url);
      } catch (e) {
        log("error", "constructor failed", e);
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = (ev) => {
        if (wsRef.current !== ws) return;
        log("log", "open", { url: maskUrlForLog(url) });
        attemptRef.current = 0;
        optsRef.current.onOpen?.(ev);

        const frames = optsRef.current.buildOpenFrames?.() ?? [];
        for (const frame of frames) {
          try {
            ws.send(frame);
            log("log", "initial frame sent", previewPayload(frame, 200));
          } catch (e) {
            log("error", "initial send failed", e);
          }
        }
      };

      ws.onmessage = (ev) => {
        if (wsRef.current !== ws) return;
        const body =
          typeof ev.data === "string" ? previewPayload(ev.data) : "[non-text]";
        log("log", "message", body);
        optsRef.current.onMessage?.(ev);
      };

      ws.onerror = (ev) => {
        if (wsRef.current !== ws) return;
        log("error", "error event");
        optsRef.current.onError?.(ev);
      };

      ws.onclose = (ev) => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        log("log", "close", {
          code: ev.code,
          reason: ev.reason || "(none)",
          wasClean: ev.wasClean,
        });
        optsRef.current.onClose?.(ev);

        const userInitiated = manualCloseRef.current;
        const wantReconnect = optsRef.current.reconnect ?? true;
        if (!userInitiated && wantReconnect) {
          scheduleReconnect();
        }
      };
    };

    openSocket();

    return () => {
      log("log", "cleanup: disconnecting");
      manualCloseRef.current = true;
      clearReconnectTimer();
      const w = wsRef.current;
      wsRef.current = null;
      if (w) {
        w.onopen = null;
        w.onmessage = null;
        w.onerror = null;
        w.onclose = null;
        w.close(1000, "client cleanup");
      }
      manualCloseRef.current = false;
    };
  }, [url, enabled, clearReconnectTimer]);

  return { send };
}

/**
 * Example (messages / JWT query param):
 *
 * ```tsx
 * const url = useMemo(() => {
 *   if (!token) return null;
 *   return `${wsBase}?token=${encodeURIComponent(token)}`;
 * }, [token, wsBase]);
 *
 * const zoneIdsRef = useRef(zoneIds);
 * zoneIdsRef.current = zoneIds;
 *
 * const { send } = useWebSocket(url, {
 *   buildOpenFrames: () =>
 *     zoneIdsRef.current.length
 *       ? [JSON.stringify({ type: "SUBSCRIBE", zoneIds: zoneIdsRef.current })]
 *       : [],
 *   onMessage: (ev) => console.log(ev.data),
 * });
 *
 * useEffect(() => {
 *   send(JSON.stringify({ type: "SUBSCRIBE", zoneIds }));
 * }, [JSON.stringify(zoneIds), send]);
 * ```
 */
