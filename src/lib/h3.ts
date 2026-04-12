import { cellToBoundary, gridDisk, latLngToCell } from 'h3-js';

export type H3Cell = {
  id: string;
  polygon: [number, number][];
};

export interface ZonePayload {
  name: string;
  description: string;
  zone_type: string;
  h3_cells?: string[];
  geo_fence?: [number, number][];
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** Default map center for auth screens (Manhattan) */
export const AUTH_MAP_DEFAULT_CENTER: [number, number] = [40.7527, -73.9772];

export function generateZoneId() {
  return `ZN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export function h3ToPolygon(cell: string): [number, number][] {
  const boundary = cellToBoundary(cell) as [number, number][];
  return boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
}

export function getHexGrid(center: [number, number], resolution: number, radius = 2): H3Cell[] {
  const origin = latLngToCell(center[0], center[1], resolution);
  const ring = gridDisk(origin, radius) as string[];
  return ring.map((cell: string) => ({
    id: cell,
    polygon: h3ToPolygon(cell)
  }));
}

export function getCellFromCoords(lat: number, lng: number, resolution: number) {
  return latLngToCell(lat, lng, resolution);
}

export function addressToMockCoords(address: string): [number, number] {
  const seed = address.trim().split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const lat = 37.33 + ((seed % 100) / 1000) * (address.length > 0 ? 1 : 0);
  const lng = -122.03 - ((seed % 100) / 1000) * (address.length > 0 ? 1 : 0);
  return [lat, lng];
}

export function serializeCellCsv(cells: string[]) {
  return ['h3_cell_id', ...cells].join('\n');
}

export function buildZonePayload(name: string, description: string, zoneType: string, cells: string[], geoFence?: [number, number][]): ZonePayload {
  const payload: ZonePayload = {
    name,
    description,
    zone_type: zoneType
  };

  if (cells.length) {
    payload.h3_cells = [...cells];
  }

  if (geoFence && geoFence.length) {
    payload.geo_fence = geoFence;
  }

  return payload;
}

export function polygonAreaKm2(vertices: [number, number][]) {
  if (vertices.length < 3) return 0;
  let areaSum = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const [lat1, lon1] = vertices[index];
    const [lat2, lon2] = vertices[(index + 1) % vertices.length];
    areaSum += toRadians(lon2 - lon1) * (Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }
  return Math.abs((areaSum * 6371 * 6371) / 2);
}
