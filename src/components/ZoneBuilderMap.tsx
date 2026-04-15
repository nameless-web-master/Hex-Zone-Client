import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
  Tooltip,
  useMap,
  useMapEvent,
} from "react-leaflet";
import { getCellFromCoords, getHexGrid, H3Cell } from "../lib/h3";

interface ZoneBuilderMapProps {
  resolution: number;
  selectedCells: string[];
  selectedColor: string;
  mode: "hex" | "polygon";
  polygonPoints: [number, number][];
  onCellToggle: (cell: string) => void;
  onPolygonAddPoint: (point: [number, number]) => void;
  onPolygonReset: () => void;
  center?: [number, number];
  /** default = card with title; embedded = map only (parent sets height) */
  variant?: "default" | "embedded";
  darkBasemap?: boolean;
  /** When false, map clicks do not add cells / polygon points */
  interactive?: boolean;
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 12), { animate: true });
  }, [center[0], center[1], map]);
  return null;
}

function MapClickHandler({
  mode,
  resolution,
  onCellToggle,
  onPolygonAddPoint,
  enabled,
}: Omit<
  ZoneBuilderMapProps,
  | "selectedCells"
  | "selectedColor"
  | "polygonPoints"
  | "onPolygonReset"
  | "center"
  | "variant"
  | "darkBasemap"
  | "interactive"
> & { enabled: boolean }) {
  useMapEvent("click", (event) => {
    if (!enabled) return;
    const { lat, lng } = event.latlng;
    if (mode === "polygon") {
      onPolygonAddPoint([lat, lng]);
    } else {
      const cell = getCellFromCoords(lat, lng, resolution);
      onCellToggle(cell);
    }
  });
  return null;
}

export default function ZoneBuilderMap({
  resolution,
  selectedCells,
  selectedColor,
  mode,
  polygonPoints,
  onCellToggle,
  onPolygonAddPoint,
  onPolygonReset,
  center = [37.7749, -122.4194],
  variant = "default",
  darkBasemap = false,
  interactive = true,
}: ZoneBuilderMapProps) {
  const hexGrid = useMemo<H3Cell[]>(
    () => getHexGrid(center, resolution, 2),
    [center, resolution],
  );

  const tileUrl = darkBasemap
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const tileAttribution = darkBasemap
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : "&copy; OpenStreetMap contributors";

  const mapShell = (
    <div
      className={
        variant === "embedded"
          ? "h-full min-h-[320px] w-full overflow-hidden"
          : "h-[560px] rounded-[1.75rem] overflow-hidden"
      }
    >
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full"
      >
        <MapRecenter center={center} />
        <TileLayer attribution={tileAttribution} url={tileUrl} />
        {hexGrid.map((hex: H3Cell) => {
          const isActive = selectedCells.includes(hex.id);
          return (
            <Polygon
              key={hex.id}
              positions={hex.polygon.map(
                ([lng, lat]: [number, number]) =>
                  [lat, lng] as [number, number],
              )}
              pathOptions={{
                color: isActive ? selectedColor : "#1e293b",
                weight: 1,
                fillColor: isActive ? selectedColor : "#0f172a",
                fillOpacity: isActive ? 0.38 : 0.09,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -4]}
                opacity={1}
                className="!rounded-md !border !border-slate-600 !bg-[#1a222c] !px-2 !py-1 !text-xs !text-[#00E5D1] !shadow-lg"
              >
                <span className="font-mono">
                  {hex.id.slice(0, 12)}…
                </span>
                <span className="text-slate-500"> r{resolution}</span>
              </Tooltip>
              <Popup>
                <div className="space-y-2 text-sm text-slate-950">
                  <strong>Cell</strong>
                  <p className="font-mono text-xs">{hex.id}</p>
                  <button
                    type="button"
                    className="rounded-md bg-[#00E5D1] px-3 py-1 text-xs font-semibold text-[#0B0E11]"
                    onClick={() => onCellToggle(hex.id)}
                  >
                    {isActive ? "Remove" : "Select"}
                  </button>
                </div>
              </Popup>
            </Polygon>
          );
        })}
        {polygonPoints.length > 0 && (
          <Polygon
            positions={polygonPoints.map(
              ([lat, lng]) => [lat, lng] as [number, number],
            )}
            pathOptions={{
              color: selectedColor,
              weight: 3,
              dashArray: "8 6",
              fillOpacity: 0.12,
            }}
          />
        )}
        <MapClickHandler
          mode={mode}
          resolution={resolution}
          onCellToggle={onCellToggle}
          onPolygonAddPoint={onPolygonAddPoint}
          enabled={interactive}
        />
      </MapContainer>
    </div>
  );

  if (variant === "embedded") {
    return mapShell;
  }

  return (
    <div className="rounded-[2rem] border border-slate-800/90 bg-slate-950/80 p-4 shadow-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Zone Builder Map</h2>
          <p className="text-sm text-slate-400">
            Click the map to select H3 cells or draw a polygon boundary.
          </p>
        </div>
        <button
          type="button"
          onClick={onPolygonReset}
          className="rounded-2xl border border-slate-800/80 px-4 py-2 text-sm text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
        >
          Reset polygon
        </button>
      </div>
      {mapShell}
    </div>
  );
}
