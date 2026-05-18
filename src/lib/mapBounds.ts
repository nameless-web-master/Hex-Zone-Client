import * as turf from "@turf/turf";
import L from "leaflet";
import { h3ToPolygon } from "./h3";
import type { GeoPolygonShape } from "./geoPoly";

/** Serializable corners for react state → Leaflet fitBounds */
export type FitBoundsCorners = {
  southWest: [number, number];
  northEast: [number, number];
};

export function cornersFromH3Cell(cellId: string): FitBoundsCorners | null {
  try {
    const ring = h3ToPolygon(cellId);
    const latlngs = ring.map(([lng, lat]) => L.latLng(lat, lng));
    const b = L.latLngBounds(latlngs);
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    return {
      southWest: [sw.lat, sw.lng],
      northEast: [ne.lat, ne.lng],
    };
  } catch {
    return null;
  }
}

export function cornersFromPolygonShape(p: GeoPolygonShape): FitBoundsCorners | null {
  const ring = p.outer;
  if (ring.length < 2) return null;
  const latlngs = ring.map(([lat, lng]) => L.latLng(lat, lng));
  const b = L.latLngBounds(latlngs);
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return {
    southWest: [sw.lat, sw.lng],
    northEast: [ne.lat, ne.lng],
  };
}

/** Bounding box for a circle zone (object / proximity preview). */
export function cornersFromCircle(
  center: [number, number],
  radiusMeters: number,
): FitBoundsCorners | null {
  const [lat, lng] = center;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return null;
  const circle = turf.circle([lng, lat], radiusMeters / 1000, {
    units: "kilometers",
    steps: 32,
  });
  const bbox = turf.bbox(circle);
  return {
    southWest: [bbox[1], bbox[0]],
    northEast: [bbox[3], bbox[2]],
  };
}
