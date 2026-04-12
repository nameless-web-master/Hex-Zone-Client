import { useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
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
}

function MapClickHandler({
  mode,
  resolution,
  onCellToggle,
  onPolygonAddPoint,
}: Omit<
  ZoneBuilderMapProps,
  | "selectedCells"
  | "selectedColor"
  | "polygonPoints"
  | "onPolygonReset"
  | "center"
>) {
  useMapEvent("click", (event) => {
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
}: ZoneBuilderMapProps) {
  const [mapCenter] = useState(center);
  const hexGrid = useMemo<H3Cell[]>(
    () => getHexGrid(mapCenter, resolution, 2),
    [mapCenter, resolution],
  );

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
          onClick={onPolygonReset}
          className="rounded-2xl border border-slate-800/80 px-4 py-2 text-sm text-slate-200 transition hover:border-teal-400/60 hover:text-teal-200"
        >
          Reset polygon
        </button>
      </div>
      <div className="h-[560px] rounded-[1.75rem] overflow-hidden">
        <MapContainer
          center={mapCenter}
          zoom={12}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
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
                  color: isActive ? selectedColor : "#0f172a",
                  weight: 1,
                  fillColor: isActive ? selectedColor : "#0f172a",
                  fillOpacity: isActive ? 0.35 : 0.08,
                }}
              >
                <Popup>
                  <div className="space-y-2 text-sm text-slate-950">
                    <strong>Cell</strong>
                    <p>{hex.id}</p>
                    <button
                      className="rounded-xl bg-teal-500 px-3 py-1 text-xs font-semibold text-slate-950"
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
                color: "#20c997",
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
          />
        </MapContainer>
      </div>
    </div>
  );
}
