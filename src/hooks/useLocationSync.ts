import { useEffect } from "react";
import { updateLocation } from "../services/api/members";
import { useWebSocket } from "./useWebSocket";

/** How often we push GPS to the server for in-zone recipient matching. */
const SYNC_INTERVAL_MS = 30_000;

/**
 * Periodically publishes the browser's GPS position to the server.
 * Prefers WebSocket **`LOCATION_UPDATE`** when connected; falls back to
 * **`POST /members/location`** when the socket is closed.
 */
export function useLocationSync(token: string | null) {
  const { status, sendMessage } = useWebSocket({
    token,
    zoneIds: [],
  });

  useEffect(() => {
    if (!token) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    let cancelled = false;
    const push = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const latitude = pos.coords.latitude;
          const longitude = pos.coords.longitude;
          const sent =
            status === "open" &&
            sendMessage({
              type: "LOCATION_UPDATE",
              latitude,
              longitude,
            });
          if (!sent) {
            void updateLocation({ latitude, longitude });
          }
        },
        () => {
          /* permission denied / unavailable — ignore and retry next tick */
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );
    };

    push();
    const id = setInterval(push, SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, status, sendMessage]);
}
