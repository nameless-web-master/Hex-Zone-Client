import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Loader2 } from "lucide-react";
import { getGuestSessionMeta } from "../../lib/guestAccessToken";
import { fetchGuestMe, fetchGuestZoneDashboard } from "../../services/api/guestMessages";
import type { GuestMe } from "../../services/api/guestMessages";

function zonesFromMeAndStored(me: GuestMe | null, stored: ReturnType<typeof getGuestSessionMeta>): string[] {
  if (me?.zone_ids?.length) return me.zone_ids;
  if (stored?.zone_ids?.length) return stored.zone_ids;
  if (stored?.zone_id?.trim()) return [stored.zone_id.trim()];
  return [];
}

function primaryZoneForUi(me: GuestMe | null, stored: ReturnType<typeof getGuestSessionMeta>, zones: string[]): string {
  const fb = stored?.zone_id?.trim();
  if (fb && zones.includes(fb)) return fb;
  return zones[0] ?? "";
}

/** Parsed from `GET /api/guest/zones/{id}/dashboard` success `data`. */
type GuestZoneDashboardPayload = {
  zone_id?: string;
  label?: string;
  welcome_text?: string;
  links?: unknown[];
};

function asDashboardPayload(d: unknown): GuestZoneDashboardPayload | null {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  return d as GuestZoneDashboardPayload;
}

function dashboardLinks(
  raw: unknown,
): { href: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { href: string; label: string }[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push({ href: item.trim(), label: item.trim() });
      continue;
    }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const hrefRaw = o.url ?? o.href ?? o.link;
      const href = typeof hrefRaw === "string" && hrefRaw.trim() ? hrefRaw.trim() : "";
      if (!href) continue;
      const labRaw = o.label ?? o.title ?? o.text;
      const label =
        typeof labRaw === "string" && labRaw.trim() ? labRaw.trim() : href;
      out.push({ href, label });
    }
  }
  return out;
}

export default function GuestDashboard() {
  const stored = useMemo(() => getGuestSessionMeta(), []);
  const [me, setMe] = useState<GuestMe | null>(null);
  const [dashboard, setDashboard] = useState<unknown | null>(null);
  const [dashNote, setDashNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const zones = useMemo(() => zonesFromMeAndStored(me, stored), [me, stored]);
  const primaryZone = useMemo(() => primaryZoneForUi(me, stored, zones), [me, stored, zones]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setProfileError(null);
      const m = await fetchGuestMe();
      if (!alive) return;
      if (m.data) {
        setMe(m.data);
        setProfileError(null);
      } else {
        setMe(null);
        setProfileError(m.error ?? "Could not refresh profile from the server.");
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [stored?.zone_id]);

  useEffect(() => {
    let alive = true;
    const z = primaryZone.trim();
    if (!z) {
      setDashboard(null);
      setDashNote(null);
      return;
    }
    (async () => {
      const dash = await fetchGuestZoneDashboard(z);
      if (!alive) return;
      if (dash.error) {
        setDashNote(dash.error);
        setDashboard(null);
      } else if (dash.notFound) {
        setDashNote(null);
        setDashboard(null);
      } else {
        setDashNote(null);
        setDashboard(dash.data);
      }
    })();
    return () => {
      alive = false;
    };
  }, [primaryZone]);

  const displayName = me?.display_name || stored?.display_name || "Guest";
  const dash = asDashboardPayload(dashboard);
  const linkRows = dashboardLinks(dash?.links);

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-100">Guest dashboard</h1>
        <p className="text-sm text-slate-400">
          Signed in as <span className="text-slate-200">{displayName}</span>
        </p>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </p>
      ) : null}

      {!loading && profileError ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {profileError} Saved session data below still works if your token is valid (e.g. open Messages). If this
          persists, confirm the server exposes <span className="font-mono">GET /api/guest/me</span> and matches the
          response shape this app expects.
        </p>
      ) : null}

      {!loading ? (
        <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Zones
            </h2>
            {zones.length ? (
              <ul className="mt-2 space-y-1 font-mono text-sm text-[#00E5D1]">
                {zones.map((z) => (
                  <li key={z} className="break-all">
                    {z}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No zone on this session. Return to{" "}
                <Link className="text-[#00E5D1] underline" to="/access">
                  guest access
                </Link>{" "}
                with your invite link.
              </p>
            )}
          </div>

          {primaryZone ? (
            <Link
              to={`/guest/messages?zone=${encodeURIComponent(primaryZone)}`}
              className="inline-flex items-center gap-2 rounded-md bg-[#00E5D1] px-4 py-2.5 text-sm font-bold text-[#0B0E11] transition hover:brightness-110"
            >
              <MessageSquare className="h-4 w-4" /> Open messages
            </Link>
          ) : (
            <p className="text-sm text-slate-500">Pick a zone from your host to use messaging.</p>
          )}

          {dash && (dash.label || dash.welcome_text || linkRows.length > 0) ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-4 text-emerald-50">
              {dash.label ? (
                <h3 className="text-lg font-semibold text-white">{dash.label}</h3>
              ) : null}
              {dash.welcome_text ? (
                <p className="text-sm leading-relaxed text-emerald-100/95">{dash.welcome_text}</p>
              ) : null}
              {linkRows.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {linkRows.map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#00E5D1] underline hover:text-emerald-200"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {dashNote ? (
            <p className="text-xs text-amber-200/90">Dashboard extra: {dashNote}</p>
          ) : null}

          {dashboard != null && typeof dashboard === "object" ? (
            <details className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
              <summary className="cursor-pointer font-medium text-slate-300">
                Raw zone dashboard JSON
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(dashboard, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
