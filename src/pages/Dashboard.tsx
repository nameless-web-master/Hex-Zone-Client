import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as turf from "@turf/turf";
import {
  Copy,
  Download,
  MapPin,
  Ruler,
  Trash2,
  Upload,
} from "lucide-react";
import HexMapperMap, {
  h3CellsAtPoint,
  type MapFitBoundsRequest,
  type SavedZoneCellLayer,
  type SavedZonePolygonLayer,
} from "../components/HexMapperMap";
import { AddressAutocompleteInput } from "../components/AddressAutocompleteInput";
import { useAuth } from "../hooks/useAuth";
import { useZones, type SavedZone } from "../hooks/useZones";
import {
  generateZoneId,
  getCellFromCoords,
  h3ToPolygon,
  serializeCellCsv,
  AUTH_MAP_DEFAULT_CENTER,
} from "../lib/h3";
import {
  distanceMeters,
  findPolygonContainingPoint,
  newPolygonId,
  pointInPolygon,
  ringsNearlyClosed,
  type GeoPolygonShape,
  type LatLng,
} from "../lib/geoPoly";
import {
  exportPolygonsAsKML,
  exportPolygonsAsWKT,
  parseKmlToPolygons,
  parseWktToPolygons,
} from "../lib/wktKml";
import { cornersFromH3Cell, cornersFromPolygonShape } from "../lib/mapBounds";

const accent = "#00E5D1";
const panel = "bg-[#151a20]";

type MapperMode = "h3" | "polygon";
type ActiveTool = null | "measure";

type HexMapperExport = {
  version: 1;
  resolution: number;
  h3_cells: string[];
  polygons: GeoPolygonShape[];
  h3Color: string;
  h3OpacityPct: number;
  polygonColor: string;
  polygonOpacityPct: number;
};

type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

type ParsedGeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

function closeRingLatLng(ring: LatLng[]): LatLng[] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function ringLatLngToGeoJson(ring: LatLng[]): number[][] {
  return closeRingLatLng(ring).map(([lat, lng]) => [lng, lat]);
}

function polygonsToGeoFenceMultiPolygon(
  polygons: GeoPolygonShape[],
): GeoJsonMultiPolygon | undefined {
  if (polygons.length === 0) return undefined;
  return {
    type: "MultiPolygon",
    coordinates: polygons
      .map((p) => [p.outer, ...p.holes].filter((r) => r.length >= 3))
      .filter((rings) => rings.length > 0)
      .map((rings) => rings.map((r) => ringLatLngToGeoJson(r))),
  };
}

function geoJsonPolygonToShapes(value: unknown): GeoPolygonShape[] {
  if (!value || typeof value !== "object") return [];
  const g = value as { type?: unknown; coordinates?: unknown };
  if (!("type" in g) || !("coordinates" in g)) return [];

  const toRing = (ring: unknown): LatLng[] => {
    if (!Array.isArray(ring)) return [];
    return ring
      .map((pt) => {
        if (!Array.isArray(pt) || pt.length < 2) return null;
        const lng = Number(pt[0]);
        const lat = Number(pt[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return [lat, lng] as LatLng;
      })
      .filter((pt): pt is LatLng => pt !== null);
  };

  const asPolygon = (coords: unknown): GeoPolygonShape | null => {
    if (!Array.isArray(coords) || coords.length === 0) return null;
    const rings = coords.map((r) => toRing(r)).filter((r) => r.length >= 3);
    if (rings.length === 0) return null;
    return {
      id: newPolygonId(),
      outer: rings[0],
      holes: rings.slice(1),
    };
  };

  if (g.type === "Polygon") {
    const poly = asPolygon(g.coordinates);
    return poly ? [poly] : [];
  }
  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
    return g.coordinates
      .map((polyCoords) => asPolygon(polyCoords))
      .filter((p): p is GeoPolygonShape => p !== null);
  }
  return [];
}

function ewkbHexToMultiPolygon(hex: string): ParsedGeoJsonMultiPolygon | null {
  const normalized = hex
    .trim()
    .replace(/^\\x/i, "")
    .replace(/^0x/i, "")
    .replace(/\s+/g, "");
  if (!/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2 !== 0)
    return null;

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const parseGeometry = (
    offsetStart: number,
  ): {
    value: ParsedGeoJsonMultiPolygon | GeoJsonPolygon | null;
    offset: number;
  } => {
    let offset = offsetStart;
    const byteOrder = view.getUint8(offset);
    offset += 1;
    const little = byteOrder === 1;
    const rawType = view.getUint32(offset, little);
    offset += 4;

    const hasSrid = (rawType & 0x20000000) !== 0;
    const baseType = rawType & 0xff;
    if (hasSrid) offset += 4;

    if (baseType === 3) {
      const ringCount = view.getUint32(offset, little);
      offset += 4;
      const polygon: GeoJsonPolygon = { type: "Polygon", coordinates: [] };
      for (let r = 0; r < ringCount; r += 1) {
        const pointCount = view.getUint32(offset, little);
        offset += 4;
        const ring: number[][] = [];
        for (let p = 0; p < pointCount; p += 1) {
          const x = view.getFloat64(offset, little);
          offset += 8;
          const y = view.getFloat64(offset, little);
          offset += 8;
          ring.push([x, y]);
        }
        polygon.coordinates.push(ring);
      }
      return { value: polygon, offset };
    }

    if (baseType === 6) {
      const polygonCount = view.getUint32(offset, little);
      offset += 4;
      const multi: ParsedGeoJsonMultiPolygon = {
        type: "MultiPolygon",
        coordinates: [],
      };
      for (let i = 0; i < polygonCount; i += 1) {
        const parsed = parseGeometry(offset);
        offset = parsed.offset;
        if (parsed.value?.type === "Polygon") {
          multi.coordinates.push(parsed.value.coordinates);
        }
      }
      return { value: multi, offset };
    }

    return { value: null, offset };
  };

  try {
    const parsed = parseGeometry(0).value;
    if (!parsed) return null;
    if (parsed.type === "Polygon") {
      return { type: "MultiPolygon", coordinates: [parsed.coordinates] };
    }
    return parsed;
  } catch {
    return null;
  }
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeGeoFencePolygonValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
  }
  if (
    value &&
    typeof value === "object" &&
    "type" in (value as Record<string, unknown>) &&
    (value as Record<string, unknown>).type === "Buffer" &&
    Array.isArray((value as Record<string, unknown>).data)
  ) {
    const arr = (value as { data: unknown[] }).data
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 255);
    return bytesToHex(arr);
  }
  if (
    value &&
    typeof value === "object" &&
    "geometry" in (value as Record<string, unknown>)
  ) {
    const g = (value as { geometry?: unknown }).geometry;
    if (g && typeof g === "object") return g;
  }
  return value;
}

function zoneToPolygons(zone: SavedZone): GeoPolygonShape[] {
  const rawGeo =
    zone.geo_fence_polygon ??
    (zone as Record<string, unknown>).geoFencePolygon ??
    null;
  const normalizedGeo = normalizeGeoFencePolygonValue(rawGeo);

  const fromGeoJson = geoJsonPolygonToShapes(normalizedGeo);
  if (fromGeoJson.length > 0) {
    return fromGeoJson;
  }
  if (typeof normalizedGeo === "string") {
    const parsed = ewkbHexToMultiPolygon(normalizedGeo);
    const fromEwkb = geoJsonPolygonToShapes(parsed);
    if (fromEwkb.length > 0) return fromEwkb;
  }
  if (Array.isArray(zone.polygons)) {
    return zone.polygons.filter(
      (p): p is GeoPolygonShape =>
        typeof p === "object" &&
        p !== null &&
        "id" in p &&
        "outer" in p &&
        "holes" in p,
    );
  }
  if (Array.isArray(zone.geo_fence) && zone.geo_fence.length >= 3) {
    return [{ id: newPolygonId(), outer: zone.geo_fence, holes: [] }];
  }
  return [];
}

function savedZoneId(zone: SavedZone): string {
  return String(zone.zone_id ?? zone.id);
}

function polygonKey(p: GeoPolygonShape): string {
  return JSON.stringify([p.outer, p.holes]);
}

function geoPolygonAreaKm2(p: GeoPolygonShape): number {
  try {
    const rings = [p.outer, ...p.holes].filter((r) => r.length >= 3);
    if (!rings.length) return 0;
    const coords = rings.map((ring) => {
      const c = [...ring];
      const a = c[0];
      const b = c[c.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) c.push(a);
      return c.map(([lat, lng]) => [lng, lat] as [number, number]);
    });
    const poly = turf.polygon(coords);
    return turf.area(poly) / 1e6;
  } catch {
    return 0;
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const userLabel = useMemo(() => {
    if (!user) return "—";
    const n = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
    return n || user.email;
  }, [user]);

  const [zoneId] = useState(() => generateZoneId());
  const [zoneName] = useState("Operations Zone");
  const [description] = useState("Zone from dashboard console.");
  const [zoneType] = useState("geofence");

  const [mapperMode, setMapperMode] = useState<MapperMode>("h3");
  const [resolution, setResolution] = useState(6);
  const [h3Color, setH3Color] = useState(accent);
  const [h3OpacityPct, setH3OpacityPct] = useState(38);
  const [polygonColor, setPolygonColor] = useState(accent);
  const [polygonOpacityPct, setPolygonOpacityPct] = useState(22);

  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [polygons, setPolygons] = useState<GeoPolygonShape[]>([]);
  const [draftRing, setDraftRing] = useState<LatLng[]>([]);
  const [drawingActive, setDrawingActive] = useState(false);
  const [holeParentId, setHoleParentId] = useState<string | null>(null);

  const [grayscaleMap, setGrayscaleMap] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [measureA, setMeasureA] = useState<LatLng | null>(null);
  const [measureB, setMeasureB] = useState<LatLng | null>(null);
  const [measurePreview, setMeasurePreview] = useState<LatLng | null>(null);
  const [measureColor, setMeasureColor] = useState(accent);
  const [measureLabelKm, setMeasureLabelKm] = useState<number | null>(null);

  const [mapCenter, setMapCenter] = useState<[number, number]>(
    AUTH_MAP_DEFAULT_CENTER,
  );
  const mapFitSeq = useRef(0);
  const [mapFitBounds, setMapFitBounds] = useState<MapFitBoundsRequest | null>(
    null,
  );
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const [locationQuery, setLocationQuery] = useState("");

  const [pasteText, setPasteText] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [activeSavedZoneId, setActiveSavedZoneId] = useState<
    number | string | null
  >(null);
  const [removedCellIds, setRemovedCellIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [removedPolygonKeys, setRemovedPolygonKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const {
    zones,
    loading: loadingZones,
    error: zonesError,
    saveZoneWithRebalance,
  } = useZones(user?.id ?? null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [contextPanel, setContextPanel] = useState<
    "h3info" | "customer" | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (zones.length === 0) return;
    const chosen =
      (activeSavedZoneId != null &&
        zones.find((z) => savedZoneId(z) === String(activeSavedZoneId))) ||
      zones.find((z) => zoneToPolygons(z).length > 0) ||
      zones[0];
    if (!chosen) return;
    setActiveSavedZoneId(savedZoneId(chosen));
    setSelectedCells(
      Array.isArray(chosen.h3_cells) ? [...chosen.h3_cells] : [],
    );
    setRemovedPolygonKeys(new Set());
    setPolygons(zoneToPolygons(chosen));
  }, [zones, activeSavedZoneId]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-context-menu-root]")) return;
      setContextMenu(null);
      setContextPanel(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activeTool === "measure") {
        setActiveTool(null);
        setMeasureA(null);
        setMeasureB(null);
        setMeasurePreview(null);
        setMeasureLabelKm(null);
      }
      if (drawingActive) {
        setDraftRing((d) => {
          if (d.length <= 1) {
            setDrawingActive(false);
            setHoleParentId(null);
            return [];
          }
          return d.slice(0, -1);
        });
      }
      setContextMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTool, drawingActive]);

  const toggleCell = useCallback((cell: string) => {
    setSelectedCells((current) =>
      current.includes(cell)
        ? current.filter((c) => c !== cell)
        : [...current, cell],
    );
  }, []);

  const h3FillOpacity = h3OpacityPct / 100;
  const polygonFillOpacity = polygonOpacityPct / 100;
  const allWorkingCells = useMemo(() => {
    const set = new Set<string>();
    for (const zone of zones) {
      if (!Array.isArray(zone.h3_cells)) continue;
      for (const c of zone.h3_cells) {
        if (typeof c !== "string") continue;
        if (removedCellIds.has(c)) continue;
        set.add(c);
      }
    }
    for (const c of selectedCells) {
      if (!removedCellIds.has(c)) set.add(c);
    }
    return Array.from(set);
  }, [zones, selectedCells, removedCellIds]);

  const allWorkingPolygons = useMemo<GeoPolygonShape[]>(() => {
    const byKey = new Map<string, GeoPolygonShape>();
    for (const zone of zones) {
      const parsed = zoneToPolygons(zone);
      for (const p of parsed) {
        const key = polygonKey(p);
        if (removedPolygonKeys.has(key)) continue;
        if (!byKey.has(key)) byKey.set(key, p);
      }
    }
    for (const p of polygons) {
      const key = polygonKey(p);
      if (removedPolygonKeys.has(key)) continue;
      byKey.set(key, p);
    }
    return Array.from(byKey.values());
  }, [zones, polygons, removedPolygonKeys]);

  const mapInteraction = useMemo(() => {
    if (activeTool === "measure") return "measure" as const;
    if (mapperMode === "h3") return "h3" as const;
    if (mapperMode === "polygon") return "polygon" as const;
    return "none" as const;
  }, [activeTool, mapperMode]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (activeTool === "measure") {
        const p: LatLng = [lat, lng];
        if (!measureA) {
          setMeasureA(p);
          setMeasureB(null);
          setMeasureLabelKm(null);
          return;
        }
        if (!measureB) {
          setMeasureB(p);
          const km = distanceMeters(measureA, p) / 1000;
          setMeasureLabelKm(km);
          return;
        }
        setMeasureA(p);
        setMeasureB(null);
        setMeasureLabelKm(null);
        return;
      }

      if (mapperMode === "h3") {
        const pt = turf.point([lng, lat]);
        let matchedExisting: string | null = null;
        for (const id of allWorkingCells) {
          try {
            const ring = h3ToPolygon(id);
            const coords = ring.map(([x, y]) => [x, y] as [number, number]);
            if (
              coords[0][0] !== coords[coords.length - 1][0] ||
              coords[0][1] !== coords[coords.length - 1][1]
            ) {
              coords.push(coords[0]);
            }
            if (turf.booleanPointInPolygon(pt, turf.polygon([coords]))) {
              matchedExisting = id;
              break;
            }
          } catch {
            /* skip invalid ids */
          }
        }
        if (matchedExisting) {
          setRemovedCellIds((prev) => {
            const next = new Set(prev);
            next.add(matchedExisting);
            return next;
          });
          setSelectedCells((current) =>
            current.filter((c) => c !== matchedExisting),
          );
          return;
        }
        const cell = getCellFromCoords(lat, lng, resolution);
        setRemovedCellIds((prev) => {
          if (!prev.has(cell)) return prev;
          const next = new Set(prev);
          next.delete(cell);
          return next;
        });
        toggleCell(cell);
        return;
      }

      if (mapperMode === "polygon" && drawingActive) {
        const pt: LatLng = [lat, lng];
        if (draftRing.length >= 3 && ringsNearlyClosed(draftRing, pt)) {
          const outer = [...draftRing];
          setDraftRing([]);
          if (holeParentId) {
            setPolygons((ps) =>
              ps.map((p) =>
                p.id === holeParentId
                  ? { ...p, holes: [...p.holes, outer] }
                  : p,
              ),
            );
            setHoleParentId(null);
          } else {
            setPolygons((ps) => [
              ...ps,
              { id: newPolygonId(), outer, holes: [] },
            ]);
          }
          return;
        }
        if (draftRing.length === 0) {
          const parent = findPolygonContainingPoint(lat, lng, polygons);
          setHoleParentId(parent?.id ?? null);
        }
        setDraftRing((d) => [...d, pt]);
        return;
      }

      if (mapperMode === "polygon" && !drawingActive) {
        let matched: GeoPolygonShape | null = null;
        for (const p of allWorkingPolygons) {
          if (pointInPolygon(lat, lng, p.outer)) {
            let inHole = false;
            for (const h of p.holes) {
              if (pointInPolygon(lat, lng, h)) {
                inHole = true;
                break;
              }
            }
            if (!inHole) {
              matched = p;
              break;
            }
          }
        }
        if (matched) {
          const key = polygonKey(matched);
          setRemovedPolygonKeys((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
          setPolygons((ps) => ps.filter((p) => polygonKey(p) !== key));
        }
      }
    },
    [
      activeTool,
      mapperMode,
      resolution,
      toggleCell,
      allWorkingCells,
      allWorkingPolygons,
      drawingActive,
      draftRing,
      holeParentId,
      polygons,
      measureA,
      measureB,
    ],
  );

  const handleMapMouseMove = useCallback(
    (lat: number, lng: number) => {
      if (activeTool === "measure" && measureA && !measureB) {
        setMeasurePreview([lat, lng]);
      } else {
        setMeasurePreview(null);
      }
    },
    [activeTool, measureA, measureB],
  );

  const clearH3 = () => setSelectedCells([]);
  const clearPolygons = () => {
    setPolygons([]);
    setRemovedPolygonKeys(new Set());
    setDraftRing([]);
    setDrawingActive(false);
    setHoleParentId(null);
  };

  const handleExportWorkspaceJson = () => {
    const doc: HexMapperExport = {
      version: 1,
      resolution,
      h3_cells: selectedCells,
      polygons,
      h3Color,
      h3OpacityPct,
      polygonColor,
      polygonOpacityPct,
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "h3-hex-mapper-workspace.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadWorkspaceJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as HexMapperExport;
        if (data.h3_cells) setSelectedCells(data.h3_cells);
        if (data.polygons) {
          setRemovedPolygonKeys(new Set());
          setPolygons(data.polygons);
        }
        if (typeof data.resolution === "number")
          setResolution(Math.min(15, Math.max(0, data.resolution)));
        if (data.h3Color) setH3Color(data.h3Color);
        if (typeof data.h3OpacityPct === "number")
          setH3OpacityPct(data.h3OpacityPct);
        if (data.polygonColor) setPolygonColor(data.polygonColor);
        if (typeof data.polygonOpacityPct === "number")
          setPolygonOpacityPct(data.polygonOpacityPct);
        setSaveStatus("Workspace loaded.");
      } catch {
        setSaveStatus("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleImportWktKml = () => {
    const t = pasteText.trim();
    if (!t) return;
    const upper = t.toUpperCase();
    let next: GeoPolygonShape[] = [];
    if (upper.includes("POLYGON") || upper.includes("MULTIPOLYGON")) {
      next = parseWktToPolygons(t);
    } else if (upper.includes("<KML") || upper.includes("COORDINATES")) {
      next = parseKmlToPolygons(t);
    }
    if (next.length) {
      setRemovedPolygonKeys(new Set());
      setPolygons((p) => [...p, ...next]);
      setSaveStatus(`Imported ${next.length} polygon(s).`);
    } else {
      setSaveStatus("Could not parse WKT/KML.");
    }
  };

  const handleExportWkt = () => {
    const wkt = exportPolygonsAsWKT(allWorkingPolygons);
    if (!wkt) {
      setSaveStatus("No polygons to export.");
      return;
    }
    const blob = new Blob([wkt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polygons.wkt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportKml = () => {
    const kml = exportPolygonsAsKML(allWorkingPolygons);
    const blob = new Blob([kml], {
      type: "application/vnd.google-earth.kml+xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polygons.kml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csv = serializeCellCsv(selectedCells);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zone-cells.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    const canSave = allWorkingCells.length > 0 || allWorkingPolygons.length > 0;
    if (!canSave) {
      setSaveStatus("Select H3 cells or add polygons before saving.");
      return;
    }
    setSaveStatus("Saving…");
    try {
      const payload = {
        name: zoneName,
        description,
        zone_type: zoneType,
        h3_cells: allWorkingCells,
        geo_fence_polygon: polygonsToGeoFenceMultiPolygon(allWorkingPolygons),
      };
      const result = await saveZoneWithRebalance(payload);
      setSaveStatus(
        `Zone saved. Removed ${result.removedFromNewCount} overlapping cell(s); updated ${result.updatedPreviousZonesCount} previous zone(s).`,
      );
    } catch {
      setSaveStatus("Save failed. Check your session and try again.");
    }
  };

  const loadSavedZone = useCallback((zone: SavedZone) => {
    setActiveSavedZoneId(savedZoneId(zone));
    setSelectedCells(Array.isArray(zone.h3_cells) ? [...zone.h3_cells] : []);
    setRemovedCellIds(new Set());
    setRemovedPolygonKeys(new Set());
    setPolygons(zoneToPolygons(zone));
    setSaveStatus(`Loaded ${zone.name ?? `zone ${savedZoneId(zone)}`}.`);
  }, []);

  const copyZoneId = async () => {
    try {
      await navigator.clipboard.writeText(zoneId);
      setSaveStatus("Zone ID copied.");
    } catch {
      setSaveStatus("Could not copy.");
    }
  };

  const totalPolyAreaKm2 = useMemo(
    () => allWorkingPolygons.reduce((s, p) => s + geoPolygonAreaKm2(p), 0),
    [allWorkingPolygons],
  );

  const savedZoneCellLayers = useMemo<SavedZoneCellLayer[]>(
    () =>
      zones
        .map((zone) => {
          const active =
            activeSavedZoneId != null &&
            savedZoneId(zone) === String(activeSavedZoneId);
          const cells = active
            ? selectedCells.filter((c) => !removedCellIds.has(c))
            : Array.isArray(zone.h3_cells)
              ? zone.h3_cells.filter(
                  (v): v is string =>
                    typeof v === "string" && !removedCellIds.has(v),
                )
              : [];
          if (cells.length === 0) return null;
          return {
            key: `saved-${savedZoneId(zone)}`,
            cells,
            color: "#00E5D1",
            fillOpacity: active ? 0.42 : 0.26,
            weight: active ? 2.4 : 1.8,
          } satisfies SavedZoneCellLayer;
        })
        .filter((v): v is SavedZoneCellLayer => v !== null),
    [zones, activeSavedZoneId, selectedCells, removedCellIds],
  );

  const savedZonePolygonLayers = useMemo<SavedZonePolygonLayer[]>(
    () =>
      zones
        .map((zone) => {
          const active =
            activeSavedZoneId != null &&
            savedZoneId(zone) === String(activeSavedZoneId);
          const zonePolys = active ? polygons : zoneToPolygons(zone);
          const filtered = zonePolys.filter(
            (p) => !removedPolygonKeys.has(polygonKey(p)),
          );
          if (filtered.length === 0) return null;
          return {
            key: `poly-${savedZoneId(zone)}`,
            polygons: filtered,
            color: "#00E5D1",
            fillOpacity: active ? 0.28 : 0.14,
            weight: active ? 2.4 : 1.6,
          } satisfies SavedZonePolygonLayer;
        })
        .filter((v): v is SavedZonePolygonLayer => v !== null),
    [zones, activeSavedZoneId, polygons, removedPolygonKeys],
  );

  const focusH3Cell = useCallback((cellId: string) => {
    const corners = cornersFromH3Cell(cellId);
    if (!corners) return;
    mapFitSeq.current += 1;
    setMapFitBounds({ key: mapFitSeq.current, ...corners });
  }, []);

  const focusPolygonShape = useCallback((p: GeoPolygonShape) => {
    const corners = cornersFromPolygonShape(p);
    if (!corners) return;
    mapFitSeq.current += 1;
    setMapFitBounds({ key: mapFitSeq.current, ...corners });
  }, []);

  const modeBadge =
    mapperMode === "h3" ? "H3 Select" : drawingActive ? "Drawing" : "Polygon";

  const customerSummary = useMemo(() => {
    if (!contextMenu) return { h3Hits: 0, polyHits: 0 };
    const { lat, lng } = contextMenu;
    let h3Hits = 0;
    for (const id of selectedCells) {
      try {
        const ring = h3ToPolygon(id);
        const t = turf.point([lng, lat]);
        const c = ring.map(([x, y]) => [x, y] as [number, number]);
        if (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1]) {
          c.push(c[0]);
        }
        const poly = turf.polygon([c]);
        if (turf.booleanPointInPolygon(t, poly)) h3Hits += 1;
      } catch {
        /* skip */
      }
    }
    let polyHits = 0;
    for (const p of polygons) {
      if (pointInPolygon(lat, lng, p.outer)) {
        let inHole = false;
        for (const h of p.holes) {
          if (pointInPolygon(lat, lng, h)) {
            inHole = true;
            break;
          }
        }
        if (!inHole) polyHits += 1;
      }
    }
    return { h3Hits, polyHits };
  }, [contextMenu, selectedCells, polygons]);

  const labelClass =
    "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500";

  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden rounded-lg border border-slate-800/60 bg-[#0B0E11]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 sm:px-6">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-white">
          H3 Hexagon Mapper
        </span>
        <div
          className={`flex items-center gap-2 rounded-full border border-slate-700/80 ${panel} px-3 py-1.5 font-mono text-xs text-[#00E5D1]`}
        >
          <span className="max-w-[140px] truncate sm:max-w-xs">{zoneId}</span>
          <button
            type="button"
            onClick={copyZoneId}
            className="rounded p-1 text-[#00E5D1] transition hover:bg-white/10"
            aria-label="Copy zone ID"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        <span className="text-sm text-slate-300">{userLabel}</span>
      </header>

      <div className="flex min-h-[min(100dvh,920px)] flex-1 flex-col lg:min-h-[calc(100dvh-11rem)] lg:flex-row">
        <aside className="flex w-full flex-col border-slate-800/80 lg:w-[400px] lg:shrink-0 lg:border-r">
          <div className="max-h-[50vh] flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 lg:max-h-none">
            <div>
              <p className={labelClass}>Zone ID</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={zoneId}
                  className={`min-w-0 flex-1 rounded-md border border-slate-700/80 ${panel} px-3 py-2 font-mono text-xs text-[#00E5D1]`}
                />
                <button
                  type="button"
                  onClick={copyZoneId}
                  className={`rounded-md border border-slate-700/80 ${panel} px-2.5 text-[#00E5D1]`}
                  aria-label="Copy"
                >
                  <Copy className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>

            <div>
              <p className={labelClass}>Mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMapperMode("h3");
                    setDrawingActive(false);
                    setDraftRing([]);
                  }}
                  className={`rounded-md border px-3 py-2.5 text-sm font-medium transition ${
                    mapperMode === "h3"
                      ? "border-[#00E5D1] bg-[#00E5D1]/10 text-[#00E5D1]"
                      : "border-slate-700/80 bg-[#151a20] text-slate-400"
                  }`}
                >
                  H3
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMapperMode("polygon");
                    setActiveTool(null);
                  }}
                  className={`rounded-md border px-3 py-2.5 text-sm font-medium transition ${
                    mapperMode === "polygon"
                      ? "border-[#00E5D1] bg-[#00E5D1]/10 text-[#00E5D1]"
                      : "border-slate-700/80 bg-[#151a20] text-slate-400"
                  }`}
                >
                  Polygon
                </button>
              </div>
            </div>

            {mapperMode === "h3" && (
              <div className="space-y-3 rounded-md border border-slate-700/80 bg-[#151a20]/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  H3 Select settings
                </p>
                <div>
                  <label className={labelClass} htmlFor="dash-res">
                    Resolution (0–15)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="dash-res"
                      type="range"
                      min={0}
                      max={15}
                      value={resolution}
                      onChange={(e) => setResolution(Number(e.target.value))}
                      className="w-full accent-[#00E5D1]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={resolution}
                      onChange={(e) =>
                        setResolution(
                          Math.min(
                            15,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        )
                      }
                      className="w-14 rounded border border-slate-600 bg-[#0d1117] px-2 py-1 text-center text-xs text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="h3-color">
                    Color
                  </label>
                  <input
                    id="h3-color"
                    type="color"
                    value={h3Color}
                    onChange={(e) => setH3Color(e.target.value)}
                    className="h-9 w-full cursor-pointer rounded border border-slate-600 bg-transparent"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="h3-op">
                    Opacity ({h3OpacityPct}%)
                  </label>
                  <input
                    id="h3-op"
                    type="range"
                    min={0}
                    max={100}
                    value={h3OpacityPct}
                    onChange={(e) => setH3OpacityPct(Number(e.target.value))}
                    className="w-full accent-[#00E5D1]"
                  />
                </div>
                <button
                  type="button"
                  onClick={clearH3}
                  className="w-full rounded-md border border-red-500/40 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
                >
                  Clear All H3
                </button>
              </div>
            )}

            {mapperMode === "polygon" && (
              <div className="space-y-3 rounded-md border border-slate-700/80 bg-[#151a20]/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Polygon Select settings
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDrawingActive((d) => {
                      const next = !d;
                      if (!next) {
                        setDraftRing([]);
                        setHoleParentId(null);
                      }
                      return next;
                    });
                  }}
                  className={`w-full rounded-md py-2.5 text-sm font-bold transition ${
                    drawingActive
                      ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/50"
                      : "bg-[#00E5D1] text-[#0B0E11] hover:brightness-110"
                  }`}
                >
                  {drawingActive ? "Stop Drawing" : "Start Drawing"}
                </button>
                <div>
                  <label className={labelClass} htmlFor="poly-color">
                    Color
                  </label>
                  <input
                    id="poly-color"
                    type="color"
                    value={polygonColor}
                    onChange={(e) => setPolygonColor(e.target.value)}
                    className="h-9 w-full cursor-pointer rounded border border-slate-600 bg-transparent"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="poly-op">
                    Opacity ({polygonOpacityPct}%)
                  </label>
                  <input
                    id="poly-op"
                    type="range"
                    min={0}
                    max={100}
                    value={polygonOpacityPct}
                    onChange={(e) =>
                      setPolygonOpacityPct(Number(e.target.value))
                    }
                    className="w-full accent-[#00E5D1]"
                  />
                </div>
                <button
                  type="button"
                  onClick={clearPolygons}
                  className="w-full rounded-md border border-red-500/40 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
                >
                  Clear All Polygons
                </button>
                <div>
                  <label className={labelClass} htmlFor="paste-wkt">
                    Paste KML or WKT
                  </label>
                  <textarea
                    id="paste-wkt"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={3}
                    placeholder="POLYGON ((…)) or KML…"
                    className="w-full rounded-md border border-slate-600 bg-[#0d1117] px-2 py-1.5 font-mono text-[11px] text-slate-200"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleImportWktKml}
                    className="flex-1 rounded-md border border-slate-600 py-2 text-xs text-slate-200 hover:border-[#00E5D1]/50"
                  >
                    Import
                  </button>
                  <button
                    type="button"
                    onClick={handleExportWkt}
                    className="flex-1 rounded-md border border-slate-600 py-2 text-xs text-slate-200 hover:border-[#00E5D1]/50"
                  >
                    Export WKT
                  </button>
                  <button
                    type="button"
                    onClick={handleExportKml}
                    className="flex-1 rounded-md border border-slate-600 py-2 text-xs text-slate-200 hover:border-[#00E5D1]/50"
                  >
                    Export KML
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-md border border-slate-700/80 bg-[#151a20]/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Other tools
              </p>
              <button
                type="button"
                onClick={() => {
                  if (activeTool === "measure") {
                    setActiveTool(null);
                    setMeasureA(null);
                    setMeasureB(null);
                    setMeasurePreview(null);
                    setMeasureLabelKm(null);
                  } else {
                    setActiveTool("measure");
                    setDrawingActive(false);
                  }
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-md border py-2 text-sm ${
                  activeTool === "measure"
                    ? "border-[#00E5D1] bg-[#00E5D1]/15 text-[#00E5D1]"
                    : "border-slate-600 text-slate-300"
                }`}
              >
                <Ruler className="h-4 w-4" strokeWidth={2} />
                Measurement Tool
              </button>
              {activeTool === "measure" && (
                <div className="space-y-2">
                  <label className={labelClass}>Line color</label>
                  <input
                    type="color"
                    value={measureColor}
                    onChange={(e) => setMeasureColor(e.target.value)}
                    className="h-8 w-full cursor-pointer rounded border border-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool(null);
                      setMeasureA(null);
                      setMeasureB(null);
                      setMeasurePreview(null);
                      setMeasureLabelKm(null);
                    }}
                    className="w-full rounded-md border border-slate-600 py-1.5 text-xs text-slate-400"
                  >
                    Stop measuring
                  </button>
                </div>
              )}
              <label className="flex cursor-pointer items-center justify-between gap-2 text-sm text-slate-300">
                <span>Grayscale map</span>
                <input
                  type="checkbox"
                  checked={grayscaleMap}
                  onChange={(e) => setGrayscaleMap(e.target.checked)}
                  className="accent-[#00E5D1]"
                />
              </label>
              <AddressAutocompleteInput
                id="dash-loc"
                label="Search location"
                value={locationQuery}
                onChange={(address, coords) => {
                  setLocationQuery(address);
                  if (coords) {
                    const [lat, lng] = coords;
                    setMapCenter([lat, lng]);
                  }
                }}
                required={false}
                placeholder="Search for a street or place…"
                labelClassName={labelClass}
                inputClassName={`w-full rounded-md border border-slate-700/80 ${panel} px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#00E5D1]/60 focus:outline-none focus:ring-1 focus:ring-[#00E5D1]/25`}
                className="relative z-10"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportWorkspaceJson}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[#00E5D1] px-3 py-2 text-xs font-bold text-[#0B0E11]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Save JSON
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-600 px-3 py-2 text-xs text-slate-200"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Load JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLoadWorkspaceJson(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Saved zones ({zones.length})
                  </p>
                  {loadingZones && (
                    <span className="text-[10px] text-slate-500">Loading…</span>
                  )}
                </div>
                <div className="max-h-36 overflow-y-auto rounded-md border border-slate-700/80 bg-[#0d1117] p-2">
                  {zonesError ? (
                    <p className="text-xs text-red-300">{zonesError}</p>
                  ) : zones.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No saved zones for this account yet.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {zones.map((zone, idx) => {
                        const isActive =
                          activeSavedZoneId != null &&
                          String(activeSavedZoneId) === savedZoneId(zone);
                        return (
                          <li key={savedZoneId(zone)}>
                            <button
                              type="button"
                              onClick={() => loadSavedZone(zone)}
                              className={`w-full rounded px-2 py-1.5 text-left text-[10px] leading-snug transition ${
                                isActive
                                  ? "bg-[#00E5D1]/20 text-white"
                                  : "text-[#00E5D1] hover:bg-[#00E5D1]/15 hover:text-white"
                              }`}
                            >
                              <div className="flex items-baseline gap-2 font-mono">
                                <span className="shrink-0 text-slate-500">
                                  #{idx + 1}
                                </span>
                                <span className="min-w-0 break-all">
                                  {zone.name || `Zone ${savedZoneId(zone)}`}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Selected H3 cells ({selectedCells.length})
                </p>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-md border border-slate-700/80 bg-[#0d1117] p-2">
                {selectedCells.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Click the map in H3 mode to add cells at resolution{" "}
                    {resolution}.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {selectedCells.map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => focusH3Cell(id)}
                          className="w-full rounded px-2 py-1.5 text-left font-mono text-[10px] leading-snug text-[#00E5D1] transition hover:bg-[#00E5D1]/15 hover:text-white"
                        >
                          <span className="break-all">{id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    All working H3 cells ({allWorkingCells.length})
                  </p>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-md border border-slate-700/80 bg-[#0d1117] p-2">
                  {allWorkingCells.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No working cells. Add cells or load saved zones.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {allWorkingCells.map((id) => (
                        <li key={`all-${id}`}>
                          <button
                            type="button"
                            onClick={() => focusH3Cell(id)}
                            className="w-full rounded px-2 py-1.5 text-left font-mono text-[10px] leading-snug text-[#00E5D1] transition hover:bg-[#00E5D1]/15 hover:text-white"
                          >
                            <span className="break-all">{id}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Polygons ({allWorkingPolygons.length})
                    {allWorkingPolygons.length > 0 ? (
                      <span className="ml-1 font-normal normal-case tracking-normal text-slate-600">
                        · {totalPolyAreaKm2.toFixed(3)} km² total
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-md border border-slate-700/80 bg-[#0d1117] p-2">
                  {allWorkingPolygons.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Draw in polygon mode or load workspace JSON.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {allWorkingPolygons.map((p, i) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => focusPolygonShape(p)}
                            className="w-full rounded px-2 py-1.5 text-left text-[10px] leading-snug text-[#00E5D1] transition hover:bg-[#00E5D1]/15 hover:text-white"
                          >
                            <div className="flex items-baseline gap-2 font-mono">
                              <span className="shrink-0 text-slate-500">
                                #{i + 1}
                              </span>
                              <span className="min-w-0 break-all">{p.id}</span>
                            </div>
                            <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                              {geoPolygonAreaKm2(p).toFixed(3)} km²
                              {p.holes.length > 0
                                ? ` · ${p.holes.length} hole(s)`
                                : ""}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800/80 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  clearH3();
                  clearPolygons();
                  setSaveStatus("");
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-600 bg-transparent px-3 py-2.5 text-sm text-slate-300 sm:flex-none"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                Clear all
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-md border border-slate-700/80 bg-[#151a20] p-2.5 text-slate-300"
                aria-label="Export CSV"
              >
                <Download className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="ml-auto min-w-[120px] flex-1 rounded-md bg-[#00E5D1] px-4 py-2.5 text-sm font-bold text-[#0B0E11] sm:flex-none"
              >
                Save zone
              </button>
            </div>
            {saveStatus ? (
              <p className="mt-2 text-center text-xs text-slate-500">
                {saveStatus}
              </p>
            ) : null}
          </div>
        </aside>

        <div className="relative min-h-[360px] flex-1 lg:min-h-0">
          <HexMapperMap
            center={mapCenter}
            mapFitBounds={mapFitBounds}
            resolution={resolution}
            selectedCells={selectedCells}
            savedZoneCellLayers={savedZoneCellLayers}
            savedZonePolygonLayers={savedZonePolygonLayers}
            h3Color={h3Color}
            h3FillOpacity={h3FillOpacity}
            polygons={[]}
            polygonColor={polygonColor}
            polygonFillOpacity={polygonFillOpacity}
            draftRing={draftRing}
            draftLineColor={polygonColor}
            measureA={measureA}
            measureB={measureB}
            measurePreview={measurePreview}
            measureColor={measureColor}
            grayscale={grayscaleMap}
            interactionMode={mapInteraction}
            drawingActive={drawingActive}
            onMapClick={handleMapClick}
            onMapMouseMove={(lat, lng) => {
              handleMapMouseMove(lat, lng);
              setCursor({ lat, lng });
            }}
            onContextMenu={(lat, lng, cx, cy) => {
              setContextMenu({ x: cx, y: cy, lat, lng });
              setContextPanel(null);
            }}
            onCursorCoords={(lat, lng) => setCursor({ lat, lng })}
            interactive
          />

          {drawingActive && mapperMode === "polygon" && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-md border border-amber-500/40 bg-[#0B0E11]/95 px-4 py-2 text-center text-xs text-amber-100 shadow-lg backdrop-blur">
              Drawing · near start to close ·{" "}
              <kbd className="rounded bg-white/10 px-1">Esc</kbd> undo ·{" "}
              {holeParentId ? "Hole ring" : "Outer ring"}
            </div>
          )}

          {activeTool === "measure" && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-md border border-[#00E5D1]/40 bg-[#0B0E11]/95 px-4 py-2 text-xs text-[#00E5D1] shadow-lg">
              {!measureA && "Click first point"}
              {measureA && !measureB && "Click second point"}
              {measureB && measureLabelKm != null && (
                <span className="font-mono">
                  {(measureLabelKm * 1000).toFixed(1)} m ·{" "}
                  {measureLabelKm.toFixed(3)} km
                </span>
              )}
            </div>
          )}

          {contextMenu && !contextPanel && (
            <div
              data-context-menu-root
              className="fixed z-[2000] min-w-[180px] rounded-md border border-slate-600 bg-[#1a222c] py-1 text-sm shadow-xl"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-white/5"
                onClick={() => setContextPanel("h3info")}
              >
                H3 Info Here
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-white/5"
                onClick={() => setContextPanel("customer")}
              >
                Customer Info Here
              </button>
            </div>
          )}

          {contextMenu && contextPanel === "h3info" && (
            <div
              data-context-menu-root
              className="fixed z-[2001] max-h-64 max-w-sm overflow-auto rounded-md border border-slate-600 bg-[#1a222c] p-3 text-xs shadow-xl"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 font-semibold text-[#00E5D1]">
                H3 at click (res 0–15)
              </p>
              <ul className="space-y-1 font-mono text-[10px] text-slate-300">
                {h3CellsAtPoint(contextMenu.lat, contextMenu.lng).map((row) => (
                  <li key={row.res}>
                    r{row.res}:{" "}
                    <span className="break-all text-[#00E5D1]">{row.id}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 text-[10px] text-slate-500 underline"
                onClick={() => setContextMenu(null)}
              >
                Close
              </button>
            </div>
          )}

          {contextMenu && contextPanel === "customer" && (
            <div
              data-context-menu-root
              className="fixed z-[2001] max-w-xs rounded-md border border-slate-600 bg-[#1a222c] p-3 text-xs shadow-xl"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-semibold text-white">Coverage summary</p>
              <p className="mt-2 text-slate-400">
                Selected H3 cells covering point:{" "}
                <span className="text-[#00E5D1]">{customerSummary.h3Hits}</span>
              </p>
              <p className="text-slate-400">
                Polygons covering point:{" "}
                <span className="text-[#00E5D1]">
                  {customerSummary.polyHits}
                </span>
              </p>
              <button
                type="button"
                className="mt-2 text-[10px] text-slate-500 underline"
                onClick={() => setContextMenu(null)}
              >
                Close
              </button>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-slate-700/80 bg-[#0B0E11]/90 px-2 py-1 font-mono text-[10px] text-slate-400">
            {cursor ? (
              <>
                {cursor.lat.toFixed(6)}, {cursor.lng.toFixed(6)}
              </>
            ) : (
              "Move cursor…"
            )}
          </div>

          <div className="pointer-events-none absolute right-3 top-14 z-[400] flex flex-col gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-[#00E5D1]/35 bg-[#0B0E11]/95 px-3 py-1.5 text-xs font-medium text-[#00E5D1] shadow-lg backdrop-blur-sm">
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
              {modeBadge}
            </span>
          </div>

          <p className="pointer-events-none absolute bottom-2 right-3 z-[400] text-[10px] text-slate-500">
            Leaflet · © OSM / Esri / CARTO
          </p>
        </div>
      </div>
    </div>
  );
}
