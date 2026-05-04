import { FormEvent, useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import {
  Ban,
  Copy,
  Download,
  Link2,
  Loader2,
  PlusCircle,
  RefreshCw,
  Table2,
} from "lucide-react";
import {
  createGuestQrToken,
  fetchGuestQrTokenPngBlob,
  getGuestQrTokenLink,
  listGuestQrTokens,
  resolveGuestQrCreatedDisplayUrl,
  revokeGuestQrToken,
  type GuestQrTokenCreated,
  type GuestQrTokenListItem,
} from "../../services/api/guestQrTokens";
import {
  absoluteUrlFromPathWithQuery,
  ensureGuestAccessUrlIncludesZidWhenGtOnly,
} from "../../lib/guestAccessUrls";

type TabId = "issue" | "manage";

type Props = {
  zoneId: string;
};

function formatDt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function GuestQrTokensAdmin({ zoneId }: Props) {
  const z = zoneId.trim();
  const [tab, setTab] = useState<TabId>("issue");

  const [expiresMode, setExpiresMode] = useState<"hours" | "at">("hours");
  const [expiresInHours, setExpiresInHours] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [eventId, setEventId] = useState("");
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [issued, setIssued] = useState<GuestQrTokenCreated | null>(null);

  const [rows, setRows] = useState<GuestQrTokenListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [copied, setCopied] = useState<string | null>(null);

  const displayIssuedUrl = issued
    ? resolveGuestQrCreatedDisplayUrl(issued, window.location.origin)
    : "";

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const refreshList = useCallback(async () => {
    if (!z) return;
    setListLoading(true);
    setListError("");
    const res = await listGuestQrTokens({
      zone_id: z,
      include_revoked: includeRevoked,
      limit: 50,
    });
    setListLoading(false);
    if (res.error) {
      setListError(res.error);
      return;
    }
    setRows(Array.isArray(res.data) ? res.data : []);
  }, [includeRevoked, z]);

  useEffect(() => {
    if (tab !== "manage" || !z) return;
    void refreshList();
  }, [tab, z, refreshList]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!z) return;
    setCreating(true);
    setCreateError("");
    const payload: Parameters<typeof createGuestQrToken>[0] = {
      zone_id: z,
      ...(eventId.trim() ? { event_id: eventId.trim() } : {}),
      ...(label.trim() ? { label: label.trim() } : {}),
    };
    const mu = maxUses.trim();
    if (mu) {
      const n = Number(mu);
      if (Number.isInteger(n) && n >= 1) payload.max_uses = n;
    }
    if (expiresMode === "at") {
      if (expiresAtLocal.trim()) {
        const d = new Date(expiresAtLocal);
        if (!Number.isNaN(d.getTime())) payload.expires_at = d.toISOString();
      }
    } else {
      const h = Number(expiresInHours.trim());
      if (Number.isFinite(h) && h > 0) payload.expires_in_hours = Math.floor(h);
    }

    const res = await createGuestQrToken(payload);
    setCreating(false);
    if (res.error || !res.data) {
      setCreateError(res.error ?? "Could not create token.");
      return;
    }
    const raw = res.data as unknown;
    let created: GuestQrTokenCreated | null = null;
    if (
      raw &&
      typeof raw === "object" &&
      "token" in raw &&
      typeof (raw as { token: unknown }).token === "string"
    ) {
      created = raw as GuestQrTokenCreated;
    } else if (
      raw &&
      typeof raw === "object" &&
      "data" in raw &&
      (raw as { data: unknown }).data &&
      typeof (raw as { data: unknown }).data === "object" &&
      typeof ((raw as { data: { token?: unknown } }).data.token) === "string"
    ) {
      created = (raw as { data: GuestQrTokenCreated }).data;
    }
    if (!created) {
      setCreateError("Unexpected response from server (missing token).");
      return;
    }
    setIssued(created);
    void refreshList();
  };

  const runRevoke = async (id: number) => {
    if (!z) return;
    setBusyId(id);
    const res = await revokeGuestQrToken(id, z);
    setBusyId(null);
    if (res.error) {
      setListError(res.error);
      return;
    }
    void refreshList();
  };

  const runCopyLink = async (id: number) => {
    if (!z) return;
    setBusyId(id);
    const res = await getGuestQrTokenLink(id, z);
    setBusyId(null);
    if (res.error || !res.data) {
      setListError(res.error ?? "Could not resolve link.");
      return;
    }
    const rawUrl =
      String(res.data.url ?? "").trim() ||
      (res.data.path_with_query
        ? absoluteUrlFromPathWithQuery(
            window.location.origin,
            res.data.path_with_query,
          )
        : "");
    const url = ensureGuestAccessUrlIncludesZidWhenGtOnly(rawUrl, z);
    if (url) await copyText(`link-${id}`, url);
  };

  const runDownloadPng = async (id: number) => {
    if (!z) return;
    setBusyId(id);
    const { blob, error } = await fetchGuestQrTokenPngBlob(id, z);
    setBusyId(null);
    if (error || !blob) {
      setListError(error ?? "PNG download failed.");
      return;
    }
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `guest-qr-${z}-${id}.png`;
    a.click();
    URL.revokeObjectURL(u);
  };

  if (!z) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-800/90 pb-3">
        <button
          type="button"
          onClick={() => setTab("issue")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "issue"
              ? "bg-[#00E5D1]/15 text-[#00E5D1]"
              : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
          }`}
        >
          <PlusCircle className="h-4 w-4" /> Issue new QR
        </button>
        <button
          type="button"
          onClick={() => setTab("manage")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "manage"
              ? "bg-[#00E5D1]/15 text-[#00E5D1]"
              : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
          }`}
        >
          <Table2 className="h-4 w-4" /> Active tokens
        </button>
      </div>

      {tab === "issue" && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form onSubmit={(ev) => void handleCreate(ev)} className="space-y-4">
            <p className="text-sm text-slate-400">
              Creates a time-bound guest link (<span className="font-mono">/access?gt=…</span>
              ). Only administrators can call this API.
            </p>

            <div className="space-y-2">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Expiry
              </span>
              <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="exp"
                    checked={expiresMode === "hours"}
                    onChange={() => setExpiresMode("hours")}
                  />
                  Hours from now
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="exp"
                    checked={expiresMode === "at"}
                    onChange={() => setExpiresMode("at")}
                  />
                  Fixed time (ISO/local)
                </label>
              </div>
              {expiresMode === "hours" ? (
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={expiresInHours}
                  onChange={(ev) => setExpiresInHours(ev.target.value)}
                  className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
                />
              ) : (
                <input
                  type="datetime-local"
                  value={expiresAtLocal}
                  onChange={(ev) => setExpiresAtLocal(ev.target.value)}
                  className="w-full max-w-md rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
                />
              )}
              <p className="text-xs text-slate-500">
                Leave hours empty to use the server default TTL (typically 7 days). Use
                fixed time mode for an exact <span className="font-mono">expires_at</span>.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Event id (optional)
              </label>
              <input
                value={eventId}
                onChange={(ev) => setEventId(ev.target.value)}
                placeholder="EVT-2026-05"
                className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Label (optional)
              </label>
              <input
                value={label}
                onChange={(ev) => setLabel(ev.target.value)}
                placeholder="Lobby — vendor day"
                className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Max uses (optional)
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={maxUses}
                onChange={(ev) => setMaxUses(ev.target.value)}
                placeholder="Unlimited if empty"
                className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
              />
            </div>

            {createError ? (
              <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {createError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-[#00E5D1] px-5 py-2.5 text-sm font-bold text-[#0B0E11] disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create token"}
            </button>
          </form>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5">
            {!issued ? (
              <p className="text-sm text-slate-500">
                After you create a token, the secret link and QR appear here once.
                Copy or download immediately — it may not be shown again.
              </p>
            ) : (
              <div className="space-y-4">
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  Save this link now. The full token secret may not be retrievable later.
                </p>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <div className="rounded-2xl bg-white p-4">
                    {displayIssuedUrl ? (
                      <QRCode value={displayIssuedUrl} size={200} level="M" />
                    ) : (
                      <p className="max-w-[200px] text-center text-xs text-slate-700">
                        No URL returned. Use{" "}
                        <span className="font-semibold">Copy raw token</span> below
                        or check your API response shape.
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Guest URL
                    </p>
                    <code className="block break-all rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1.5 text-xs text-slate-300">
                      {displayIssuedUrl || "—"}
                    </code>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyText("issued-url", displayIssuedUrl)}
                        disabled={!displayIssuedUrl}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-[#00E5D1]/50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copied === "issued-url" ? "Copied" : "Copy URL"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          issued.token
                            ? void copyText("issued-token", issued.token)
                            : undefined
                        }
                        disabled={!issued.token}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-[#00E5D1]/50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copied === "issued-token" ? "Copied" : "Copy raw token"}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Suffix ···{issued.token_suffix ?? "—"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIssued(null)}
                  className="text-xs text-slate-500 underline hover:text-slate-300"
                >
                  Clear (issue another)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "manage" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={includeRevoked}
                onChange={(ev) => setIncludeRevoked(ev.target.checked)}
                className="rounded border-slate-600"
              />
              Include revoked
            </label>
            <button
              type="button"
              onClick={() => void refreshList()}
              disabled={listLoading}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200"
            >
              {listLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </div>
          {listError ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {listError}
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-slate-800/90">
            <table className="w-full min-w-[640px] text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2">Suffix</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2">Uses</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !listLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      No tokens for this zone.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const revoked = Boolean(row.revoked_at);
                    const depleted =
                      row.max_uses != null &&
                      row.max_uses >= 1 &&
                      (row.use_count ?? 0) >= row.max_uses;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-800/80 hover:bg-slate-900/40"
                      >
                        <td className="px-3 py-2">
                          <span className="line-clamp-2" title={row.label ?? ""}>
                            {row.label ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.token_suffix ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs">{formatDt(row.expires_at)}</td>
                        <td className="px-3 py-2 text-xs">
                          {row.use_count ?? 0}
                          {row.max_uses != null ? ` / ${row.max_uses}` : ""}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {revoked
                            ? "Revoked"
                            : depleted
                              ? "Depleted"
                              : "Active"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={busyId === row.id || revoked}
                              onClick={() => void runCopyLink(row.id)}
                              className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-40"
                              title="Resolve link"
                            >
                              <Link2 className="h-3 w-3" /> Link
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id || revoked}
                              onClick={() => void runDownloadPng(row.id)}
                              className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-40"
                            >
                              <Download className="h-3 w-3" /> PNG
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id || revoked}
                              onClick={() => void runRevoke(row.id)}
                              className="inline-flex items-center gap-1 rounded border border-rose-800/60 px-2 py-1 text-[11px] text-rose-200 disabled:opacity-40"
                            >
                              <Ban className="h-3 w-3" /> Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
