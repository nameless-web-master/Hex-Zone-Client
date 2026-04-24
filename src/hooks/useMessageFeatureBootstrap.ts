import { useEffect, useRef } from "react";
import { refreshMessageFeatureMembershipLocation } from "../services/api/messageFeature";

const SIGNIFICANT_MOVE_METERS = 250;
const REFRESH_INTERVAL_MS = 120_000;

type LatLng = { latitude: number; longitude: number };

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: LatLng, b: LatLng): number {
  const earthRadius = 6_371_000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function useMessageFeatureBootstrap(token: string | null) {
  const lastSyncedRef = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!token || !("geolocation" in navigator)) return;
    let timer: number | undefined;
    let cancelled = false;

    const maybeSyncLocation = async (coords: GeolocationCoordinates) => {
      const next = {
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      const prev = lastSyncedRef.current;
      const moved = prev ? distanceMeters(prev, next) : Number.POSITIVE_INFINITY;
      if (prev && moved < SIGNIFICANT_MOVE_METERS) return;
      const result = await refreshMessageFeatureMembershipLocation(next);
      if (cancelled) return;
      if (!result.error) {
        lastSyncedRef.current = next;
      } else if (result.status === 401) {
        // Allow auth flow to handle re-login without spamming retries.
        timer = window.setTimeout(requestCurrentLocation, REFRESH_INTERVAL_MS);
      }
    };

    const requestCurrentLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void maybeSyncLocation(position.coords);
        },
        () => {
          timer = window.setTimeout(requestCurrentLocation, REFRESH_INTERVAL_MS);
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      );
    };

    requestCurrentLocation();
    timer = window.setInterval(requestCurrentLocation, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [token]);
}
