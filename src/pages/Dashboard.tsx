import { useMemo, useRef, useState, type RefObject } from "react";
import HexMapperMap from "../components/HexMapperMap";
import { useAuth } from "../hooks/useAuth";
import { AUTH_MAP_DEFAULT_CENTER, getCellFromCoords } from "../lib/h3";

type DashboardTab = "zone1" | "zone2" | "zone3" | "schedule";

type ScheduleEvent = {
  id: string;
  company: string;
  date: string;
  start: string;
  end: string;
  description: string;
  waitTimeSec: number;
};

const tabs: { key: DashboardTab; label: string }[] = [
  { key: "zone1", label: "Zone 1" },
  { key: "zone2", label: "Zone 2" },
  { key: "zone3", label: "Zone 3" },
  { key: "schedule", label: "Schedule Access" },
];

const scheduleEvents: ScheduleEvent[] = [
  // UPDATED for Zoning-Messaging-System-Summary-v1.1.pdf
  {
    id: "EV-1001",
    company: "Northline Security",
    date: "Apr 16, 2026",
    start: "08:00",
    end: "10:30",
    description: "Contractor entry for camera maintenance.",
    waitTimeSec: 45,
  },
  {
    id: "EV-1002",
    company: "Metro Utility",
    date: "Apr 16, 2026",
    start: "11:00",
    end: "13:00",
    description: "Power meter validation visit.",
    waitTimeSec: 60,
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const isGuard = String(user?.account_type ?? "").toLowerCase() === "guard";
  const allowedTabs = isGuard ? tabs.filter((t) => t.key !== "zone2" && t.key !== "zone3") : tabs;

  const [activeTab, setActiveTab] = useState<DashboardTab>("zone1");
  const [resolution, setResolution] = useState(13);
  const [selectedCellsByZone, setSelectedCellsByZone] = useState<
    Record<"zone1" | "zone2" | "zone3", string[]>
  >({
    zone1: [],
    zone2: [],
    zone3: [],
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    scheduleEvents[0]?.id ?? null,
  );

  const slideRefs: Record<DashboardTab, RefObject<HTMLDivElement>> = {
    zone1: useRef<HTMLDivElement>(null),
    zone2: useRef<HTMLDivElement>(null),
    zone3: useRef<HTMLDivElement>(null),
    schedule: useRef<HTMLDivElement>(null),
  };

  const selectedEvent = useMemo(
    () => scheduleEvents.find((event) => event.id === selectedEventId) ?? null,
    [selectedEventId],
  );

  const switchTab = (tab: DashboardTab) => {
    if (isGuard && (tab === "zone2" || tab === "zone3")) return;
    setActiveTab(tab);
    slideRefs[tab].current?.scrollIntoView({
      behavior: "smooth",
      inline: "start",
      block: "nearest",
    });
  };

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-800/80 bg-[#0B0E11] p-5">
        <p className="text-xs uppercase tracking-[0.22em] text-[#00E5D1]">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {isGuard ? "Guard Account Operations" : "Zone Operations & Schedule Access"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {isGuard
            ? "Guard Account is restricted to one active zone with focused control behavior."
            : "Swipe or use tabs to move between Zone 1, Zone 2, Zone 3, and Schedule Access."}
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {allowedTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTab(tab.key)}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              activeTab === tab.key
                ? "border-[#00E5D1] bg-[#00E5D1]/15 text-[#00E5D1]"
                : "border-slate-700/80 bg-slate-950/80 text-slate-300 hover:border-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {allowedTabs.map((tab) => (
          <article
            key={tab.key}
            ref={slideRefs[tab.key]}
            className="w-full shrink-0 snap-start rounded-2xl border border-slate-800/80 bg-slate-950/85 p-4"
          >
            {tab.key === "schedule" ? (
              <ScheduleAccessPanel
                selectedEvent={selectedEvent}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
              />
            ) : (
              <ZonePanel
                zoneKey={tab.key}
                guardMode={isGuard}
                resolution={resolution}
                onResolutionChange={setResolution}
                selectedCells={selectedCellsByZone[tab.key]}
                onSelectedCellsChange={(next) =>
                  setSelectedCellsByZone((prev) => ({ ...prev, [tab.key]: next }))
                }
              />
            )}
          </article>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        // UPDATED for Zoning-Messaging-System-Summary-v1.1.pdf
      </p>
    </section>
  );
}

function ZonePanel({
  zoneKey,
  guardMode,
  resolution,
  onResolutionChange,
  selectedCells,
  onSelectedCellsChange,
}: {
  zoneKey: "zone1" | "zone2" | "zone3";
  guardMode: boolean;
  resolution: number;
  onResolutionChange: (value: number) => void;
  selectedCells: string[];
  onSelectedCellsChange: (cells: string[]) => void;
}) {
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {zoneKey === "zone1" ? "Zone 1" : zoneKey === "zone2" ? "Zone 2" : "Zone 3"}
          </h2>
          <p className="text-sm text-slate-400">
            {guardMode
              ? "Guard dashboard keeps one zone active; use this pane for guard coverage."
              : "Tap map hexagons to shape this zone with H3 mapping."}
          </p>
        </div>
        <label className="text-sm text-slate-300">
          H3 Resolution: {resolution}
          <input
            type="range"
            min={0}
            max={15}
            value={resolution}
            onChange={(event) => onResolutionChange(Number(event.target.value))}
            className="mt-2 w-full min-w-[170px] accent-[#00E5D1]"
          />
        </label>
      </div>

      <div className="h-[440px] overflow-hidden rounded-xl border border-slate-800/80">
        <HexMapperMap
          center={AUTH_MAP_DEFAULT_CENTER}
          mapFitBounds={null}
          resolution={resolution}
          selectedCells={selectedCells}
          savedZoneCellLayers={[]}
          savedZonePolygonLayers={[]}
          h3Color="#00E5D1"
          h3FillOpacity={0.35}
          polygons={[]}
          polygonColor="#00E5D1"
          polygonFillOpacity={0.2}
          draftRing={[]}
          draftLineColor="#00E5D1"
          measureA={null}
          measureB={null}
          measurePreview={null}
          measureColor="#00E5D1"
          grayscale={false}
          interactionMode="h3"
          drawingActive={false}
          onMapClick={(lat, lng) => {
            const nextCell = getCellFromCoords(lat, lng, resolution);
            onSelectedCellsChange(
              selectedCells.includes(nextCell)
                ? selectedCells.filter((id) => id !== nextCell)
                : [...selectedCells, nextCell],
            );
          }}
          onMapMouseMove={(lat, lng) => setCursor({ lat, lng })}
          onContextMenu={() => undefined}
          onCursorCoords={(lat, lng) => setCursor({ lat, lng })}
          interactive
        />
      </div>

      <div className="rounded-xl border border-slate-800/80 bg-[#0B0E11] p-3 text-sm text-slate-300">
        <p>Selected cells: {selectedCells.length}</p>
        <p className="font-mono text-xs text-slate-500">
          Cursor: {cursor ? `${cursor.lat.toFixed(5)}, ${cursor.lng.toFixed(5)}` : "move pointer..."}
        </p>
      </div>
    </div>
  );
}

function ScheduleAccessPanel({
  selectedEvent,
  selectedEventId,
  onSelectEvent,
}: {
  selectedEvent: ScheduleEvent | null;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-xl border border-slate-800/80 bg-[#0B0E11] p-4">
        <h2 className="text-lg font-semibold text-white">Upcoming Events</h2>
        <ul className="mt-4 space-y-2">
          {scheduleEvents.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onSelectEvent(event.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left ${
                  selectedEventId === event.id
                    ? "border-[#00E5D1]/70 bg-[#00E5D1]/10 text-[#00E5D1]"
                    : "border-slate-700/80 bg-slate-900/70 text-slate-300"
                }`}
              >
                <p className="font-medium">{event.company}</p>
                <p className="text-xs">{event.date}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800/80 bg-[#0B0E11] p-4">
        <h3 className="text-lg font-semibold text-white">Event Detail</h3>
        {selectedEvent ? (
          <div className="space-y-1 text-sm text-slate-300">
            <p>Name/Company: {selectedEvent.company}</p>
            <p>Date: {selectedEvent.date}</p>
            <p>Start: {selectedEvent.start}</p>
            <p>End: {selectedEvent.end}</p>
            <p>Event ID: {selectedEvent.id}</p>
            <p>Description: {selectedEvent.description}</p>
            <p>Wait time (sec): {selectedEvent.waitTimeSec}</p>
            <p>How to handle access REQUEST: Event owner first, members second.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Select an event to view details.</p>
        )}

        <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/40 p-5 text-center text-slate-500">
          Calendar Placeholder
        </div>
      </div>
    </div>
  );
}
