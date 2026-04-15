import type { GeoPolygonShape, LatLng } from "./geoPoly";
import { newPolygonId } from "./geoPoly";

function closedRing(ring: LatLng[]): LatLng[] {
  if (ring.length === 0) return ring;
  const a0 = ring[0];
  const last = ring[ring.length - 1];
  if (last[0] === a0[0] && last[1] === a0[1]) return ring;
  return [...ring, a0];
}

function ringToWktCoords(ring: LatLng[]): string {
  return closedRing(ring)
    .map(([lat, lng]) => `${lng} ${lat}`)
    .join(", ");
}

/** WKT MULTIPOLYGON */
export function exportPolygonsAsWKT(polygons: GeoPolygonShape[]): string {
  if (polygons.length === 0) return "";
  const parts = polygons.map((p) => {
    const rings = [p.outer, ...p.holes].filter((r) => r.length >= 3);
    const inner = rings.map((r) => `(${ringToWktCoords(r)})`).join(", ");
    return `( ${inner} )`;
  });
  return `MULTIPOLYGON ( ${parts.join(", ")} )`;
}

function parseCoordPairs(s: string): LatLng[] {
  const pts: LatLng[] = [];
  const tokens = s
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const lng = Number(tokens[i]);
    const lat = Number(tokens[i + 1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push([lat, lng]);
  }
  return pts;
}

/** Extract rings from `( ( coords ) , ( coords ) )` style block */
function extractRings(polygonInner: string): LatLng[][] {
  const rings: LatLng[][] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < polygonInner.length; i += 1) {
    const ch = polygonInner[i];
    if (ch === "(") {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0 && start > 0) {
        const coordStr = polygonInner.slice(start, i);
        const pts = parseCoordPairs(coordStr);
        if (pts.length >= 3) rings.push(pts);
        start = -1;
      }
    }
  }
  return rings;
}

function extractPolygonsFromMulti(inner: string): GeoPolygonShape[] {
  const polys: GeoPolygonShape[] = [];
  let depth = 0;
  let start = -1;
  const t = inner.trim();
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i];
    if (ch === "(") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const polyBlock = t.slice(start + 1, i);
        const rings = extractRings(polyBlock.trim());
        if (rings.length) {
          polys.push({
            id: newPolygonId(),
            outer: rings[0],
            holes: rings.slice(1),
          });
        }
        start = -1;
      }
    }
  }
  return polys;
}

export function parseWktToPolygons(wkt: string): GeoPolygonShape[] {
  const s = wkt.trim();
  if (!s) return [];
  const multi = /^MULTIPOLYGON\s*\(\s*(.*)\s*\)\s*$/is.exec(s);
  if (multi) {
    return extractPolygonsFromMulti(multi[1]);
  }
  const single = /^POLYGON\s*\(\s*(.*)\s*\)\s*$/is.exec(s);
  if (single) {
    const rings = extractRings(single[1].trim());
    if (!rings.length) return [];
    return [{ id: newPolygonId(), outer: rings[0], holes: rings.slice(1) }];
  }
  return [];
}

export function parseKmlToPolygons(kml: string): GeoPolygonShape[] {
  const re = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
  const out: GeoPolygonShape[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(kml)) !== null) {
    const text = m[1].trim();
    const pairs = text.split(/\s+/).map((x) => x.trim()).filter(Boolean);
    const ring: LatLng[] = [];
    for (const pair of pairs) {
      const [a, b] = pair.split(",").map(Number);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        ring.push([b, a]);
      }
    }
    if (ring.length >= 3) {
      out.push({ id: newPolygonId(), outer: ring, holes: [] });
    }
  }
  return out;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kmlOnePolygon(p: GeoPolygonShape): string {
  const outer = closedRing(p.outer)
    .map(([lat, lng]) => `${lng},${lat},0`)
    .join(" ");
  let body = `<outerBoundaryIs><LinearRing><coordinates>${outer}</coordinates></LinearRing></outerBoundaryIs>`;
  for (const h of p.holes) {
    const hc = closedRing(h)
      .map(([lat, lng]) => `${lng},${lat},0`)
      .join(" ");
    body += `<innerBoundaryIs><LinearRing><coordinates>${hc}</coordinates></LinearRing></innerBoundaryIs>`;
  }
  return `<Placemark><name>${escapeXml(p.id)}</name><Polygon>${body}</Polygon></Placemark>`;
}

export function exportPolygonsAsKML(
  polygons: GeoPolygonShape[],
  name = "Zone Weaver Export",
): string {
  const polys = polygons.map(kmlOnePolygon).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(
    name,
  )}</name>${polys}</Document></kml>`;
}
