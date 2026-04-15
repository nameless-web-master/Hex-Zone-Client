import { useMemo, useState } from "react";
import { createZone } from "../lib/api";

type ZoneTypeKey =
  | "type1_h3"
  | "type2_communal"
  | "type3_gov_code"
  | "type4_object"
  | "type5_grid"
  | "type6_geo_fence"
  | "type7_proximity"
  | "type8_dynamic";

type ZoneTypeSpec = {
  key: ZoneTypeKey;
  title: string;
  steps: string[];
  helper: string;
};

const zoneTypeSpecs: ZoneTypeSpec[] = [
  // UPDATED for Zoning-Messaging-System-Summary-v1.1.pdf
  {
    key: "type1_h3",
    title: "Type 1 - H3 Hex Grid Zoning",
    helper: "Select hex cells, adjust resolution (default 13), then save cell IDs.",
    steps: [
      "Step 1: Map + Hex Overlay",
      "Step 2: Cell Selection",
      "Step 3: Resolution Adjustment",
      "Step 4: Name and Save",
    ],
  },
  {
    key: "type2_communal",
    title: "Type 2 - Zone Matching (Communal ID)",
    helper: "Enter communal ID, validate with API, preview geometry, confirm save.",
    steps: ["Step 1: Input Communal ID", "Step 2: Validate via REST API", "Step 3: Confirm and Save"],
  },
  {
    key: "type3_gov_code",
    title: "Type 3 - Zone Matching (Governmental Local Code)",
    helper: "Use postal/district code and run the same validate + confirm flow as Type 2.",
    steps: ["Step 1: Input Government Code", "Step 2: Validate via REST API", "Step 3: Confirm and Save"],
  },
  {
    key: "type4_object",
    title: "Type 4 - Object Zoning",
    helper: "Associate zone with object ID and radius; server tracks moving boundary.",
    steps: ["Step 1: Object Search/Select", "Step 2: Radius Definition", "Step 3: Save"],
  },
  {
    key: "type5_grid",
    title: "Type 5 - Grid Zoning",
    helper: "Select rectangular grid cells (similar to H3 flow but square grid).",
    steps: ["Step 1: Show Grid Overlay", "Step 2: Select Grid Cells", "Step 3: Name and Save"],
  },
  {
    key: "type6_geo_fence",
    title: "Type 6 - Geo-fence Zoning",
    helper: "Draw polygon/circle, edit vertices, then save coordinates.",
    steps: [
      "Step 1: Drawing Mode Toggle",
      "Step 2: Draw on Map",
      "Step 3: Edit Handles",
      "Step 4: Name and Save",
    ],
  },
  {
    key: "type7_proximity",
    title: "Type 7 - Proximity-to-Source Zoning",
    helper: "Set source and radius with live preview, then save source+radius.",
    steps: ["Step 1: Source Selection", "Step 2: Radius Input", "Step 3: Live Preview", "Step 4: Save"],
  },
  {
    key: "type8_dynamic",
    title: "Type 8 - Dynamic-Size Zoning",
    helper: "Configure member-count/time trigger and min/max radius bounds.",
    steps: ["Step 1: Dynamic Parameters", "Step 2: Preview Min/Max Extents", "Step 3: Save Rules"],
  },
];

export default function ZoneBuilder() {
  const [selectedType, setSelectedType] = useState<ZoneTypeKey>("type1_h3");
  const [zoneName, setZoneName] = useState("Operations Zone");
  const [description, setDescription] = useState("Zone flow configured from v1.1 summary.");
  const [communalId, setCommunalId] = useState("");
  const [governmentCode, setGovernmentCode] = useState("");
  const [objectId, setObjectId] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [sourceMode, setSourceMode] = useState("originator");
  const [dynamicMembers, setDynamicMembers] = useState(12);
  const [dynamicTimeMinutes, setDynamicTimeMinutes] = useState(20);
  const [status, setStatus] = useState("");

  const selectedSpec = useMemo(
    () => zoneTypeSpecs.find((spec) => spec.key === selectedType) ?? zoneTypeSpecs[0],
    [selectedType],
  );

  const saveZone = async () => {
    setStatus("Saving zone...");
    try {
      const payload: Record<string, unknown> = {
        name: zoneName,
        description,
        zone_type: selectedType,
        communal_id: communalId || undefined,
        government_code: governmentCode || undefined,
        object_id: objectId || undefined,
        radius_meters: radiusMeters,
        source_mode: sourceMode,
        dynamic_member_threshold: dynamicMembers,
        dynamic_time_minutes: dynamicTimeMinutes,
      };
      await createZone(payload);
      setStatus("Zone flow saved.");
    } catch {
      setStatus("Could not save. Verify authentication and API availability.");
    }
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-5">
        <p className="text-sm uppercase tracking-[0.28em] text-[#00E5D1]">Zone Creation</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">8 Type-Specific Flows</h1>
        <p className="mt-3 text-sm text-slate-400">
          Select one of the eight zone types and follow the exact flow steps from the v1.1 summary.
        </p>

        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {zoneTypeSpecs.map((spec) => (
            <button
              key={spec.key}
              type="button"
              onClick={() => setSelectedType(spec.key)}
              className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                selectedType === spec.key
                  ? "border-[#00E5D1]/70 bg-[#00E5D1]/10 text-[#00E5D1]"
                  : "border-slate-700/80 bg-slate-900/70 text-slate-300"
              }`}
            >
              {spec.title}
            </button>
          ))}
        </div>
      </div>

      <aside className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-5">
        <h2 className="text-xl font-semibold text-white">{selectedSpec.title}</h2>
        <p className="text-sm text-slate-400">{selectedSpec.helper}</p>
        <ol className="space-y-1 text-sm text-slate-300">
          {selectedSpec.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <label className="block text-sm text-slate-300">
          Zone name
          <input
            value={zoneName}
            onChange={(event) => setZoneName(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-700/80 bg-slate-950 px-3 py-2 text-white"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-md border border-slate-700/80 bg-slate-950 px-3 py-2 text-white"
          />
        </label>

        {(selectedType === "type2_communal" || selectedType === "type3_gov_code") && (
          <label className="block text-sm text-slate-300">
            {selectedType === "type2_communal" ? "Communal ID" : "Government Local Code"}
            <input
              value={selectedType === "type2_communal" ? communalId : governmentCode}
              onChange={(event) =>
                selectedType === "type2_communal"
                  ? setCommunalId(event.target.value)
                  : setGovernmentCode(event.target.value)
              }
              className="mt-2 w-full rounded-md border border-slate-700/80 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
        )}

        {selectedType === "type4_object" && (
          <label className="block text-sm text-slate-300">
            Object ID / Landmark
            <input
              value={objectId}
              onChange={(event) => setObjectId(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-700/80 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
        )}

        {(selectedType === "type4_object" ||
          selectedType === "type6_geo_fence" ||
          selectedType === "type7_proximity") && (
          <label className="block text-sm text-slate-300">
            Radius / distance (meters)
            <input
              type="number"
              min={50}
              value={radiusMeters}
              onChange={(event) => setRadiusMeters(Number(event.target.value))}
              className="mt-2 w-full rounded-md border border-slate-700/80 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
        )}

        {selectedType === "type7_proximity" && (
          <label className="block text-sm text-slate-300">
            Source selection
            <select
              value={sourceMode}
              onChange={(event) => setSourceMode(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-700/80 bg-slate-950 px-3 py-2 text-white"
            >
              <option value="originator">Message Originator Coordinate</option>
              <option value="pin">Pin on Map</option>
              <option value="my_location">My Current Location</option>
            </select>
          </label>
        )}

        {selectedType === "type8_dynamic" && (
          <>
            <label className="block text-sm text-slate-300">
              Active member threshold
              <input
                type="number"
                min={1}
                value={dynamicMembers}
                onChange={(event) => setDynamicMembers(Number(event.target.value))}
                className="mt-2 w-full rounded-md border border-slate-700/80 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Time period (minutes)
              <input
                type="number"
                min={1}
                value={dynamicTimeMinutes}
                onChange={(event) => setDynamicTimeMinutes(Number(event.target.value))}
                className="mt-2 w-full rounded-md border border-slate-700/80 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
          </>
        )}

        <button
          type="button"
          onClick={saveZone}
          className="w-full rounded-md bg-[#00E5D1] px-4 py-2 font-semibold text-[#0B0E11]"
        >
          Save Zone Flow
        </button>
        {status ? <p className="text-sm text-slate-400">{status}</p> : null}
      </aside>
    </section>
  );
}
