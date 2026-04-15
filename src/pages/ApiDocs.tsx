import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://hex-zone-server.onrender.com";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ParamIn = "path" | "query" | "body";

interface ParamDef {
  name: string;
  in: ParamIn;
  type?: "string" | "number";
  required?: boolean;
  placeholder?: string;
}

interface EndpointSpec {
  id: string;
  method: HttpMethod;
  /** Path starting with /; may include {param} segments */
  path: string;
  description: string;
  params: ParamDef[];
  /** When true, show one JSON body textarea (uses param name "body" in values) */
  bodyJson?: boolean;
  /** Skip Authorization header (login/register) */
  public?: boolean;
}

const ENDPOINTS: EndpointSpec[] = [
  {
    id: "owners-login",
    method: "POST",
    path: "/owners/login",
    description: "Authenticate an owner and return an access token.",
    public: true,
    params: [
      {
        name: "email",
        in: "body",
        required: true,
        placeholder: "owner@example.com",
      },
      {
        name: "password",
        in: "body",
        required: true,
        placeholder: "password",
      },
    ],
  },
  {
    id: "owners-register",
    method: "POST",
    path: "/owners/register",
    description: "Register a new owner account.",
    public: true,
    bodyJson: true,
    params: [
      {
        name: "body",
        in: "body",
        required: true,
        placeholder: "JSON body",
      },
    ],
  },
  {
    id: "owners-me",
    method: "GET",
    path: "/owners/me",
    description: "Return the current authenticated owner profile.",
    params: [],
  },
  {
    id: "owners-list",
    method: "GET",
    path: "/owners/",
    description: "List registered owner accounts (paginated).",
    params: [
      { name: "skip", in: "query", type: "number", placeholder: "0" },
      { name: "limit", in: "query", type: "number", placeholder: "100" },
    ],
  },
  {
    id: "owners-patch",
    method: "PATCH",
    path: "/owners/{owner_id}",
    description: "Partially update an owner (e.g. active flag, name).",
    params: [
      { name: "owner_id", in: "path", required: true, placeholder: "id" },
    ],
    bodyJson: true,
  },
  {
    id: "devices-list",
    method: "GET",
    path: "/devices/",
    description: "List devices for the authenticated owner.",
    params: [],
  },
  {
    id: "devices-get",
    method: "GET",
    path: "/devices/{device_id}",
    description: "Get a single device by numeric id.",
    params: [
      { name: "device_id", in: "path", required: true, placeholder: "device id" },
    ],
  },
  {
    id: "devices-create",
    method: "POST",
    path: "/devices/",
    description: "Create a new device for the authenticated owner.",
    bodyJson: true,
    params: [
      {
        name: "body",
        in: "body",
        required: true,
        placeholder: "JSON body",
      },
    ],
  },
  {
    id: "devices-patch",
    method: "PATCH",
    path: "/devices/{device_id}",
    description: "Update device settings.",
    params: [
      { name: "device_id", in: "path", required: true, placeholder: "device id" },
    ],
    bodyJson: true,
  },
  {
    id: "devices-heartbeat",
    method: "POST",
    path: "/devices/{device_id}/heartbeat",
    description: "Send a heartbeat for a device (no body).",
    params: [
      { name: "device_id", in: "path", required: true, placeholder: "device id" },
    ],
  },
  {
    id: "devices-location",
    method: "POST",
    path: "/devices/{device_id}/location",
    description: "Update device GPS location.",
    params: [
      { name: "device_id", in: "path", required: true, placeholder: "device id" },
      {
        name: "latitude",
        in: "body",
        type: "number",
        required: true,
        placeholder: "47.6205",
      },
      {
        name: "longitude",
        in: "body",
        type: "number",
        required: true,
        placeholder: "-122.3493",
      },
      {
        name: "address",
        in: "body",
        required: false,
        placeholder: "optional address string",
      },
    ],
  },
  {
    id: "zones-list",
    method: "GET",
    path: "/zones/",
    description: "List zones for the authenticated owner.",
    params: [],
  },
  {
    id: "h3-convert",
    method: "POST",
    path: "/utils/h3/convert",
    description: "Convert latitude and longitude to an H3 cell id.",
    params: [
      {
        name: "latitude",
        in: "body",
        type: "number",
        required: true,
        placeholder: "34.0522",
      },
      {
        name: "longitude",
        in: "body",
        type: "number",
        required: true,
        placeholder: "-118.2437",
      },
      {
        name: "resolution",
        in: "body",
        type: "number",
        required: false,
        placeholder: "13",
      },
    ],
  },
];

const DEFAULT_JSON: Record<string, string> = {
  "owners-register": `{
  "email": "owner@example.com",
  "password": "password123",
  "first_name": "Alex",
  "last_name": "Chen",
  "account_type": "private",
  "phone": "+1234567890",
  "zone_id": "ZN-4F8A2C",
  "address": "123 Zone St"
}`,
  "owners-patch": `{
  "first_name": "Alex",
  "active": true
}`,
  "devices-create": `{
  "hid": "DEV-A1B2C3",
  "name": "Front Gate Tracker",
  "address": "123 Main St, Anytown",
  "latitude": 47.6205,
  "longitude": -122.3493,
  "propagate_enabled": true,
  "propagate_radius_km": 2.5,
  "enable_notification": true,
  "alert_threshold_meters": 150.0,
  "update_interval_seconds": 120
}`,
  "devices-patch": `{
  "name": "Front Gate Tracker v2",
  "propagate_enabled": false
}`,
};

function methodPillClass(method: HttpMethod) {
  switch (method) {
    case "GET":
      return "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40";
    case "POST":
      return "bg-sky-500/20 text-sky-300 ring-sky-500/40";
    case "PUT":
    case "PATCH":
      return "bg-amber-500/20 text-amber-300 ring-amber-500/40";
    case "DELETE":
      return "bg-rose-500/20 text-rose-300 ring-rose-500/40";
    default:
      return "bg-slate-500/20 text-slate-300 ring-slate-500/40";
  }
}

function buildResolvedPath(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const v = values[key]?.trim();
    return v != null && v !== "" ? encodeURIComponent(v) : `{${key}}`;
  });
}

function buildUrl(
  path: string,
  values: Record<string, string>,
  ep: EndpointSpec,
): string {
  const resolved = buildResolvedPath(path, values);
  const u = new URL(API_BASE.replace(/\/$/, "") + resolved);
  for (const p of ep.params) {
    if (p.in !== "query") continue;
    const v = values[p.name]?.trim();
    if (v === undefined || v === "") continue;
    u.searchParams.set(p.name, v);
  }
  return u.toString();
}

function buildBodyObject(
  ep: EndpointSpec,
  values: Record<string, string>,
): Record<string, unknown> | null {
  if (ep.bodyJson) {
    const raw = values.body?.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const bodyParams = ep.params.filter((p) => p.in === "body");
  if (bodyParams.length === 0) return null;
  const o: Record<string, unknown> = {};
  for (const p of bodyParams) {
    const v = values[p.name]?.trim();
    if (v === undefined || v === "") continue;
    if (p.type === "number") {
      const n = Number(v);
      if (!Number.isNaN(n)) o[p.name] = n;
    } else {
      o[p.name] = v;
    }
  }
  return Object.keys(o).length ? o : null;
}

export default function ApiDocs() {
  const { user, token } = useAuth();
  const [selectedId, setSelectedId] = useState(ENDPOINTS[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [responseText, setResponseText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"curl" | "zone" | null>(null);
  const [curlDraft, setCurlDraft] = useState("");
  const curlEditedRef = useRef(false);
  const prevEndpointRef = useRef(selectedId);

  const selected = useMemo(
    () => ENDPOINTS.find((e) => e.id === selectedId) ?? ENDPOINTS[0],
    [selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setValues((prev) => {
      const next = { ...prev };
      if (selected.bodyJson) {
        next.body = next.body ?? DEFAULT_JSON[selected.id] ?? "{}";
      }
      for (const p of selected.params) {
        if (p.in === "body" && p.name !== "body" && next[p.name] === undefined) {
          next[p.name] = "";
        }
      }
      return next;
    });
    setResponseText("");
    setError(null);
  }, [selected?.id]);

  const generatedCurl = useMemo(() => {
    if (!selected) return "";
    const url = buildUrl(selected.path, values, selected);
    const lines: string[] = [`curl -X ${selected.method} "${url}" \\`];
    if (!selected.public && token) {
      lines.push(`  -H "Authorization: Bearer <token>" \\`);
    }
    const body = buildBodyObject(selected, values);
    const hasBody = body && selected.method !== "GET";
    if (hasBody) {
      lines.push(`  -H "Content-Type: application/json" \\`);
      const escaped = JSON.stringify(body)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
      lines.push(`  -d "${escaped}"`);
    } else {
      lines.push(`  -H "Content-Type: application/json"`);
    }
    return lines.join("\n");
  }, [selected, values, token]);

  useEffect(() => {
    const endpointChanged = prevEndpointRef.current !== selectedId;
    prevEndpointRef.current = selectedId;
    if (endpointChanged) {
      curlEditedRef.current = false;
      setCurlDraft(generatedCurl);
      return;
    }
    if (!curlEditedRef.current) {
      setCurlDraft(generatedCurl);
    }
  }, [selectedId, generatedCurl]);

  const zoneLabel = useMemo(() => {
    if (user?.id != null) {
      const hex = Number(user.id).toString(16).toUpperCase().padStart(6, "0");
      return `ZN-${hex.slice(-6)}`;
    }
    return "ZN-4F8A2C";
  }, [user?.id]);

  const displayName = user
    ? `${user.first_name} ${user.last_name}`.trim() || user.email
    : "Guest";

  const copyToClipboard = useCallback(async (text: string, kind: "curl" | "zone") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  const sendLive = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResponseText("");
    try {
      const url = buildUrl(selected.path, values, selected);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (!selected.public && token) {
        headers.Authorization = `Bearer ${token}`;
      }
      let body: string | undefined;
      if (selected.method !== "GET") {
        if (selected.bodyJson) {
          const raw = values.body?.trim();
          if (!raw) {
            throw new Error("Body JSON is required for this request.");
          }
          try {
            body = JSON.stringify(JSON.parse(raw));
          } catch {
            throw new Error("Invalid JSON in body.");
          }
        } else {
          const obj = buildBodyObject(selected, values);
          if (obj) body = JSON.stringify(obj);
        }
      }
      const res = await fetch(url, { method: selected.method, headers, body });
      const text = await res.text();
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep raw */
      }
      setResponseText(
        `${res.status} ${res.statusText}\n\n${formatted}`,
      );
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setResponseText(msg);
    } finally {
      setLoading(false);
    }
  };

  const setField = (name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }));
  };

  return (
    <div className="layer-card flex min-h-[calc(100vh-8rem)] flex-col gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <p className="text-sm font-semibold tracking-[0.2em] text-white">
            ZONE WEAVER
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300">
            <span className="text-slate-500">ZONE</span>
            <span className="font-mono text-[#00E5D1]">{zoneLabel}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(zoneLabel, "zone")}
              className="rounded p-0.5 text-slate-400 transition hover:bg-slate-800 hover:text-[#00E5D1]"
              title="Copy zone id"
            >
              {copied === "zone" ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-300">{displayName}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-slate-800/80 bg-slate-950/40 lg:w-80 lg:border-b-0 lg:border-r">
          <div className="sticky top-0 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              API endpoints
            </p>
            <p className="mt-1 text-xs text-slate-500">
              OpenAPI-style paths against{" "}
              <code className="rounded bg-slate-900 px-1 py-0.5 text-[#00E5D1]/90">
                {API_BASE.replace(/^https?:\/\//, "")}
              </code>
            </p>
            <nav className="mt-4 space-y-1 overflow-y-auto p-1">
              {ENDPOINTS.map((ep) => (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => setSelectedId(ep.id)}
                  className={`flex w-full flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    ep.id === selectedId
                      ? "bg-[#00E5D1]/12 ring-1 ring-[#00E5D1]/35"
                      : "hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex w-full flex-wrap items-baseline gap-2">
                    <span
                      className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${methodPillClass(ep.method)}`}
                    >
                      {ep.method}
                    </span>
                    <span className="break-all font-mono text-xs text-slate-200">
                      {ep.path}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{ep.description}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          {selected && (
            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex rounded px-2 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${methodPillClass(selected.method)}`}
                  >
                    {selected.method}
                  </span>
                  <h1 className="font-mono text-lg text-white break-all">
                    {selected.path}
                  </h1>
                </div>
                <p className="mt-2 text-sm text-slate-400">{selected.description}</p>
              </div>

              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Parameters
                </h2>
                {(() => {
                  const pathQuery = selected.params.filter(
                    (p) => p.in === "path" || p.in === "query",
                  );
                  const bodyInputs = selected.params.filter(
                    (p) => p.in === "body" && p.name !== "body",
                  );
                  const hasAny =
                    pathQuery.length > 0 ||
                    selected.bodyJson ||
                    bodyInputs.length > 0;
                  if (!hasAny) {
                    return (
                      <p className="text-sm text-slate-500">No parameters.</p>
                    );
                  }
                  return (
                    <div className="space-y-6">
                      {pathQuery.map((p) => (
                        <div
                          key={`${p.in}-${p.name}`}
                          className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div>
                            <label className="text-sm text-slate-200">
                              {p.name}
                              {p.required ? (
                                <span className="text-rose-400"> *</span>
                              ) : null}
                              <span className="ml-2 text-xs text-slate-500">
                                ({p.type ?? "string"})
                              </span>
                            </label>
                            <input
                              type="text"
                              value={values[p.name] ?? ""}
                              onChange={(e) => setField(p.name, e.target.value)}
                              placeholder={p.placeholder ?? p.name}
                              className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#00E5D1]/50 focus:ring-2 focus:ring-[#00E5D1]/15"
                            />
                          </div>
                          <p className="text-right text-[10px] uppercase tracking-wide text-slate-600 sm:pt-6">
                            {p.in}
                          </p>
                        </div>
                      ))}
                      {selected.bodyJson ? (
                        <div className="space-y-2">
                          <label className="block text-xs text-slate-500">
                            body (JSON)
                          </label>
                          <textarea
                            value={values.body ?? ""}
                            onChange={(e) => setField("body", e.target.value)}
                            rows={14}
                            spellCheck={false}
                            className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 font-mono text-xs text-slate-200 outline-none ring-[#00E5D1]/0 transition focus:border-[#00E5D1]/50 focus:ring-2 focus:ring-[#00E5D1]/20"
                          />
                        </div>
                      ) : (
                        bodyInputs.map((p) => (
                          <div
                            key={`${p.in}-${p.name}`}
                            className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
                          >
                            <div>
                              <label className="text-sm text-slate-200">
                                {p.name}
                                {p.required ? (
                                  <span className="text-rose-400"> *</span>
                                ) : null}
                                <span className="ml-2 text-xs text-slate-500">
                                  ({p.type ?? "string"})
                                </span>
                              </label>
                              <input
                                type={
                                  p.name.toLowerCase().includes("password")
                                    ? "password"
                                    : "text"
                                }
                                value={values[p.name] ?? ""}
                                onChange={(e) =>
                                  setField(p.name, e.target.value)
                                }
                                placeholder={p.placeholder ?? p.name}
                                className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#00E5D1]/50 focus:ring-2 focus:ring-[#00E5D1]/15"
                              />
                            </div>
                            <p className="text-right text-[10px] uppercase tracking-wide text-slate-600 sm:pt-6">
                              {p.in}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    curl
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        curlEditedRef.current = false;
                        setCurlDraft(generatedCurl);
                      }}
                      className="rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 transition hover:border-[#00E5D1]/40 hover:text-[#00E5D1]"
                    >
                      Reset to generated
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(curlDraft, "curl")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 transition hover:border-[#00E5D1]/40 hover:text-[#00E5D1]"
                    >
                      {copied === "curl" ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                      Copy
                    </button>
                  </div>
                </div>
                <textarea
                  value={curlDraft}
                  onChange={(e) => {
                    curlEditedRef.current = true;
                    setCurlDraft(e.target.value);
                  }}
                  spellCheck={false}
                  rows={8}
                  className="w-full resize-y rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 font-mono text-xs leading-relaxed text-slate-300 outline-none transition focus:border-[#00E5D1]/40 focus:ring-2 focus:ring-[#00E5D1]/15"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Edit freely for your terminal. Live test still uses the parameters above.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Live test
                </h2>
                <button
                  type="button"
                  onClick={sendLive}
                  disabled={loading}
                  className="rounded-xl bg-[#00E5D1] px-5 py-2.5 text-sm font-bold text-[#0B0E11] transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send"}
                </button>
                {error ? (
                  <p className="mt-2 text-sm text-rose-400">{error}</p>
                ) : null}
                <pre className="mt-4 min-h-[8rem] overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 text-xs text-slate-300">
                  {responseText || (
                    <span className="text-slate-600">
                      Response will appear here after you send a request.
                    </span>
                  )}
                </pre>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
