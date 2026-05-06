import { h3ToPolygon } from "./h3";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export type GuestDashboardMapView = {
  center: [number, number];
  polygons: [number, number][][];
};

/** Lat/lng ring (Leaflet-native [lat,lng][]), at least three points */
function parseLatLngRing(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const ring: [number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    ring.push([lat, lng]);
  }
  return ring;
}

/** GeoJSON position ring uses [lng, lat] */
function ringLngLatToLeaflet(outer: unknown): [number, number][] | null {
  if (!Array.isArray(outer) || outer.length < 3) return null;
  const ring: [number, number][] = [];
  for (const pt of outer) {
    if (!Array.isArray(pt) || pt.length < 2) return null;
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    ring.push([lat, lng]);
  }
  return ring;
}

function extractPolygonsFromGeoJson(node: unknown, out: [number, number][][]) {
  const o = asRecord(node);
  if (!o) return;
  if (o.type === "FeatureCollection" && Array.isArray(o.features)) {
    for (const f of o.features) extractPolygonsFromGeoJson(f, out);
    return;
  }
  if (o.type === "Feature" && o.geometry != null) {
    extractPolygonsFromGeoJson(o.geometry, out);
    return;
  }
  if (o.type === "Polygon" && Array.isArray(o.coordinates)) {
    const outer = (o.coordinates as unknown[][])[0];
    const ring = ringLngLatToLeaflet(outer);
    if (ring) out.push(ring);
    return;
  }
  if (o.type === "MultiPolygon" && Array.isArray(o.coordinates)) {
    for (const poly of o.coordinates as unknown[][][]) {
      const outer = poly[0];
      const ring = ringLngLatToLeaflet(outer);
      if (ring) out.push(ring);
    }
  }
}

function parseCenterCandidate(raw: unknown): [number, number] | null {
  if (Array.isArray(raw) && raw.length >= 2) {
    const a = Number(raw[0]);
    const b = Number(raw[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    /** Heuristic: treat as GeoJSON-ish if first value looks like longitude */
    return Math.abs(a) > 90 ? [b, a] : [a, b];
  }
  const r = asRecord(raw);
  if (!r) return null;
  const lat = Number(r.lat ?? r.latitude);
  const lng = Number(r.lng ?? r.lon ?? r.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return null;
}

function centroidOfPolygons(polygons: [number, number][][]): [number, number] {
  const ring = polygons[0];
  if (!ring?.length) return [40.7527, -73.9772];
  let slat = 0;
  let slng = 0;
  for (const [lat, lng] of ring) {
    slat += lat;
    slng += lng;
  }
  return [slat / ring.length, slng / ring.length];
}

function readStringArr(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}

/**
 * Parses optional map geometry from GET /api/guest/zones/{id}/dashboard `data`.
 * Supports: geojson, polygon / geo_fence (lat,lng rings), map.h3_cells / h3_cells.
 */
export function tryParseGuestDashboardMap(dashboard: unknown): GuestDashboardMapView | null {
  const root = asRecord(dashboard);
  if (!root) return null;
  const mapBag = asRecord(root.map);
  const bags = mapBag ? [root, mapBag] : [root];

  function pick(key: string): unknown {
    for (const b of bags) {
      if (Object.prototype.hasOwnProperty.call(b, key)) return b[key];
    }
    return undefined;
  }

  const polygons: [number, number][][] = [];

  const h3Candidates = [...readStringArr(pick("h3_cells")), ...readStringArr(pick("cells"))];
  for (const cell of h3Candidates) {
    try {
      const ringLngLat = h3ToPolygon(cell);
      polygons.push(ringLngLat.map(([lng, lat]) => [lat, lng] as [number, number]));
    } catch {
      /* skip invalid cell */
    }
  }

  const fences = ["geo_fence", "geofence", "polygon", "boundary"] as const;
  for (const k of fences) {
    const raw = pick(k);
    const ring = parseLatLngRing(raw);
    if (ring) polygons.push(ring);
  }

  const geoKeys = ["geojson", "geo_json", "GeoJSON"] as const;
  for (const k of geoKeys) {
    const gj = pick(k);
    if (gj) extractPolygonsFromGeoJson(gj, polygons);
  }

  const bounds = pick("bounds") ?? pick("bbox");
  const bRecord = asRecord(bounds);
  if (bRecord) {
    const south = Number(bRecord.south ?? bRecord.minLat ?? bRecord.min_lat);
    const north = Number(bRecord.north ?? bRecord.maxLat ?? bRecord.max_lat);
    const west = Number(bRecord.west ?? bRecord.minLng ?? bRecord.min_lng ?? bRecord.minLon);
    const east = Number(bRecord.east ?? bRecord.maxLng ?? bRecord.max_lng ?? bRecord.maxLon);
    if (
      Number.isFinite(south) &&
      Number.isFinite(north) &&
      Number.isFinite(west) &&
      Number.isFinite(east)
    ) {
      polygons.push([
        [south, west],
        [south, east],
        [north, east],
        [north, west],
      ]);
    }
  }

  if (polygons.length === 0) return null;

  const centerPick =
    parseCenterCandidate(pick("center")) ??
    parseCenterCandidate(mapBag?.center ?? mapBag?.map_center ?? mapBag?.mapCenter) ??
    centroidOfPolygons(polygons);

  return { center: centerPick, polygons };
}
