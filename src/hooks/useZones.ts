import { useCallback, useEffect, useState } from "react";
import { createZone, fetchZonesByZoneId, updateZone } from "../lib/api";

export type SavedZone = {
  zone_id?: number | string;
  id: number | string;
  name?: string;
  owner_id?: number | string;
  h3_cells?: string[];
  geo_fence?: [number, number][];
  geo_fence_polygon?: unknown;
  polygons?: unknown;
};

function getZoneId(zone: SavedZone): number | string {
  return zone.zone_id ?? zone.id;
}

function asCellList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function normalizeZoneId(value: unknown): string {
  return String(value ?? "").trim();
}

function belongsToZone(zone: SavedZone, ownerZoneId: number | string): boolean {
  const target = normalizeZoneId(ownerZoneId);
  if (!target) return false;
  return normalizeZoneId(zone.zone_id ?? zone.id) === target;
}

export function useZones(ownerZoneId: number | string | null) {
  const [zones, setZones] = useState<SavedZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (ownerZoneId == null || ownerZoneId === "") {
      setZones([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchZonesByZoneId(ownerZoneId);
      const allZones = Array.isArray(data) ? (data as SavedZone[]) : [];
      setZones(allZones.filter((zone) => belongsToZone(zone, ownerZoneId)));
    } catch {
      setError("Could not load saved zones.");
    } finally {
      setLoading(false);
    }
  }, [ownerZoneId]);

  const saveZone = useCallback(
    async (payload: Record<string, unknown>) => {
      if (ownerZoneId == null || ownerZoneId === "") {
        throw new Error("Missing owner zone id");
      }
      const saved = await createZone({ ...payload, zone_id: String(ownerZoneId) });
      await refresh();
      return saved;
    },
    [ownerZoneId, refresh],
  );

  const saveZoneWithRebalance = useCallback(
    async (payload: Record<string, unknown>) => {
      if (ownerZoneId == null || ownerZoneId === "") {
        throw new Error("Missing owner zone id");
      }

      const ownerZonesRaw = await fetchZonesByZoneId(ownerZoneId);
      const ownerZones = Array.isArray(ownerZonesRaw)
        ? (ownerZonesRaw as SavedZone[])
            .filter((zone) => belongsToZone(zone, ownerZoneId))
        : [];

      const incomingCells = asCellList(payload.h3_cells);
      const incomingSet = new Set(incomingCells);
      const seenIncomingInPrevious = new Set<string>();

      const updates = ownerZones
        .map((zone) => {
          const oldCells = asCellList(zone.h3_cells);
          const nextCells = oldCells.filter((c) => incomingSet.has(c));
          const changed =
            nextCells.length !== oldCells.length ||
            nextCells.some((c, i) => c !== oldCells[i]);

          oldCells.forEach((c) => {
            if (incomingSet.has(c)) seenIncomingInPrevious.add(c);
          });

          return { zone, nextCells, changed };
        })
        .filter((u) => u.changed);

      await Promise.all(
        updates.map(({ zone, nextCells }) => {
          const z = zone as Record<string, unknown>;
          const { id, ...rest } = z;
          return updateZone(getZoneId(zone), {
            ...rest,
            h3_cells: nextCells,
          });
        }),
      );

      const dedupedIncoming = Array.from(new Set(incomingCells));
      const filteredNewCells = dedupedIncoming.filter(
        (c) => !seenIncomingInPrevious.has(c),
      );
      const toSave = {
        ...payload,
        zone_id: String(ownerZoneId),
        h3_cells: filteredNewCells,
      };
      const geoFencePolygon = payload.geo_fence_polygon as
        | { type?: unknown; coordinates?: unknown }
        | undefined;
      const hasPolygonPayload =
        !!geoFencePolygon &&
        (geoFencePolygon.type === "Polygon" ||
          geoFencePolygon.type === "MultiPolygon") &&
        Array.isArray(geoFencePolygon.coordinates) &&
        geoFencePolygon.coordinates.length > 0;
      const hasGeoFencePayload =
        Array.isArray(payload.geo_fence) && payload.geo_fence.length > 0;

      const saved = await createZone(toSave);
      await refresh();
      return {
        saved,
        filteredNewCells,
        removedFromNewCount: dedupedIncoming.length - filteredNewCells.length,
        updatedPreviousZonesCount: updates.length,
      };
    },
    [ownerZoneId, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { zones, loading, error, refresh, saveZone, saveZoneWithRebalance };
}
