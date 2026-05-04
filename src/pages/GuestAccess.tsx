import { FormEvent, useEffect, useLayoutEffect, useState } from "react";
import {
  CheckCircle,
  Loader2,
  MapPin,
  ShieldAlert,
  QrCode,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resolveGuestBrowserDeviceId } from "../lib/guestDeviceId";
import {
  pollGuestAccessSession,
  submitAnonymousGuestPermission,
} from "../services/api/accessPermissions";
import {
  exchangeGuestSession,
  persistGuestSessionAfterExchange,
} from "../services/api/guestSession";

type Phase =
  | { id: "form" }
  | { id: "expected"; message: string }
  | {
      id: "waiting";
      guestId: string;
      /** Zone passed as `zone_id` when polling `/api/access/session/…` (URL `zid` or permission echo). */
      pollZoneId: string;
      serverMessage: string;
      pollMessage?: string;
    }
  | {
      id: "approved";
      message?: string;
      guestId: string;
      pollZoneId: string;
      exchange_code?: string;
      exchange_expires_at?: string;
      /** Poll errors while waiting for `exchange_code` from backend. */
      pollMessage?: string;
    }
  | { id: "rejected"; message?: string };

const POLL_MS = 3500;

const SESSION_WAIT_KEY = "zoneweaver_guest_access_wait";

type StoredWaitPayload = {
  v: 1;
  gt: string;
  zid: string;
  guestId: string;
  serverMessage: string;
  /** Required for session poll when `gt`-only links omit URL `zid`. */
  pollZoneId?: string;
};

function readStoredWait(gt: string, zid: string): StoredWaitPayload | null {
  try {
    const raw = sessionStorage.getItem(SESSION_WAIT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredWaitPayload;
    if (p.v !== 1 || typeof p.guestId !== "string" || !p.guestId.trim()) {
      return null;
    }
    if ((p.gt ?? "") !== gt || (p.zid ?? "") !== zid) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

function writeStoredWait(payload: Omit<StoredWaitPayload, "v"> & { v?: 1 }) {
  const pid = payload.pollZoneId?.trim();
  const full: StoredWaitPayload = {
    v: 1,
    gt: payload.gt ?? "",
    zid: payload.zid ?? "",
    guestId: payload.guestId,
    serverMessage: payload.serverMessage ?? "",
    ...(pid ? { pollZoneId: pid } : {}),
  };
  sessionStorage.setItem(SESSION_WAIT_KEY, JSON.stringify(full));
}

function resolvedPollZoneId(stored: StoredWaitPayload): string {
  const fromField = stored.pollZoneId?.trim();
  if (fromField) return fromField;
  return (stored.zid ?? "").trim();
}

function clearStoredWait() {
  try {
    sessionStorage.removeItem(SESSION_WAIT_KEY);
  } catch {
    /* ignore */
  }
}

function formatError(err: { errorCode?: string; message: string }): string {
  const c = err.errorCode?.trim();
  if (c) return `${c}: ${err.message}`;
  return err.message;
}

export default function GuestAccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zid = String(searchParams.get("zid") ?? "").trim();
  const gt = String(searchParams.get("gt") ?? "").trim();
  const eidFromQuery = String(searchParams.get("eid") ?? "").trim();
  const sigFromQuery = String(searchParams.get("sig") ?? "").trim();
  const hasInvite = Boolean(gt || zid);

  const [guestName, setGuestName] = useState("");
  const [eventId, setEventId] = useState(eidFromQuery);
  const [deviceId, setDeviceId] = useState("");
  const [useAutoDeviceId, setUseAutoDeviceId] = useState(true);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);

  const [phase, setPhase] = useState<Phase>({ id: "form" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [exchangeBusy, setExchangeBusy] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  useEffect(() => {
    setEventId(eidFromQuery);
  }, [eidFromQuery]);

  useLayoutEffect(() => {
    if (!hasInvite) return;
    const stored = readStoredWait(gt, zid);
    if (stored) {
      const pollZoneId = resolvedPollZoneId(stored);
      setPhase({
        id: "waiting",
        guestId: stored.guestId.trim(),
        pollZoneId,
        serverMessage: stored.serverMessage || "Waiting for approval…",
      });
    } else {
      setPhase((p) => (p.id === "waiting" ? { id: "form" } : p));
    }
  }, [hasInvite, gt, zid]);

  useEffect(() => {
    const shouldPoll =
      phase.id === "waiting" ||
      (phase.id === "approved" && !phase.exchange_code?.trim());
    if (!shouldPoll) return;

    const guestId =
      phase.id === "waiting"
        ? phase.guestId.trim()
        : phase.id === "approved"
          ? phase.guestId.trim()
          : "";
    if (!guestId) return;

    let alive = true;
    const pollZoneId =
      phase.id === "waiting"
        ? phase.pollZoneId.trim()
        : phase.id === "approved"
          ? phase.pollZoneId.trim()
          : "";

    const tick = async () => {
      const res = await pollGuestAccessSession(guestId, pollZoneId);
      if (!alive) return;
      if (res.error) {
        setPhase((p) =>
          p.id === "waiting"
            ? { ...p, pollMessage: res.error ?? undefined }
            : p.id === "approved" && !p.exchange_code
              ? { ...p, pollMessage: res.error ?? undefined }
              : p,
        );
        return;
      }
      if (res.status === "APPROVED") {
        clearStoredWait();
        setPhase((p) => {
          if (p.id === "waiting") {
            return {
              id: "approved",
              message: res.message,
              guestId: p.guestId,
              pollZoneId: p.pollZoneId,
              ...(res.exchange_code ? { exchange_code: res.exchange_code } : {}),
              ...(res.exchange_expires_at
                ? { exchange_expires_at: res.exchange_expires_at }
                : {}),
            };
          }
          if (p.id === "approved" && !p.exchange_code && res.exchange_code) {
            return {
              ...p,
              exchange_code: res.exchange_code,
              ...(res.exchange_expires_at
                ? { exchange_expires_at: res.exchange_expires_at }
                : {}),
            };
          }
          return p;
        });
        if (res.exchange_code) return;
      }
      if (res.status === "REJECTED") {
        clearStoredWait();
        setPhase({ id: "rejected", message: res.message });
        return;
      }
      if (res.message) {
        setPhase((p) =>
          p.id === "waiting"
            ? { ...p, pollMessage: res.message }
            : p.id === "approved" && !p.exchange_code
              ? { ...p, pollMessage: res.message }
              : p,
        );
      }
    };

    void tick();
    const handle = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(handle);
    };
  }, [
    phase.id,
    phase.id === "waiting" ? phase.guestId : "",
    phase.id === "waiting" ? phase.pollZoneId : "",
    phase.id === "approved" && !phase.exchange_code?.trim() ? phase.guestId : "",
    phase.id === "approved" && !phase.exchange_code?.trim() ? phase.pollZoneId : "",
    phase.id === "approved" ? (phase.exchange_code ?? "").trim() : "",
  ]);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setFormError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setFormError(null);
    navigator.geolocation.getCurrentPosition(
      (next) => {
        setPosition({
          lat: next.coords.latitude,
          lng: next.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setFormError("Could not read your location. You can still continue.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!gt && !zid) {
      setFormError("This link is missing a guest token or zone id.");
      return;
    }
    const name = guestName.trim();
    if (!name) {
      setFormError("Please enter your name.");
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const effectiveDevice = useAutoDeviceId
      ? resolveGuestBrowserDeviceId()
      : deviceId.trim() || undefined;

    const body: Parameters<typeof submitAnonymousGuestPermission>[0] = {
      guest_name: name,
      ...(gt ? { guest_qr_token: gt } : {}),
      ...(zid ? { zone_id: zid } : {}),
      ...(eventId.trim() ? { event_id: eventId.trim() } : {}),
      ...(effectiveDevice ? { device_id: effectiveDevice } : {}),
      ...(position
        ? { location: { lat: position.lat, lng: position.lng } }
        : {}),
      ...(sigFromQuery ? { sig: sigFromQuery } : {}),
    };

    const result = await submitAnonymousGuestPermission(body);
    setSubmitting(false);

    if (!result.ok) {
      setFormError(formatError(result));
      return;
    }

    if (result.status === "EXPECTED") {
      setPhase({ id: "expected", message: result.message });
      return;
    }

    const gid = result.guestId?.trim();
    if (!gid) {
      setFormError(
        "This visit requires approval, but the server did not return a guest session id for polling. Please contact your host.",
      );
      return;
    }
    const pollZoneId = (result.zoneId ?? zid).trim();
    writeStoredWait({
      gt,
      zid,
      guestId: gid,
      pollZoneId,
      serverMessage: result.message ?? "Waiting for approval…",
    });
    setPhase({
      id: "waiting",
      guestId: gid,
      pollZoneId,
      serverMessage: result.message || "Waiting for approval…",
    });
  };

  const reset = () => {
    clearStoredWait();
    setPhase({ id: "form" });
    setFormError(null);
    setExchangeError(null);
    setExchangeBusy(false);
  };

  const handleContinueToGuestApp = async () => {
    if (phase.id !== "approved" || !phase.exchange_code?.trim()) return;
    setExchangeBusy(true);
    setExchangeError(null);
    const effectiveDevice = useAutoDeviceId
      ? resolveGuestBrowserDeviceId()
      : deviceId.trim() || undefined;
    const ex = await exchangeGuestSession({
      guest_id: phase.guestId.trim(),
      zone_id: phase.pollZoneId.trim(),
      exchange_code: phase.exchange_code.trim(),
      ...(effectiveDevice ? { device_id: effectiveDevice } : {}),
    });
    setExchangeBusy(false);
    if (ex.error || !ex.data) {
      setExchangeError(
        ex.error ??
          (ex.status === 404
            ? "Guest session API is not available yet (404). Ask your host to update the server."
            : "Could not start guest session."),
      );
      return;
    }
    persistGuestSessionAfterExchange(ex.data, phase.pollZoneId.trim());
    navigate("/guest/dashboard", { replace: true });
  };

  if (!hasInvite) {
    return (
      <section className="mx-auto max-w-lg space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6">
        <p className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
          <QrCode className="h-4 w-4" /> Guest access
        </p>
        <h1 className="text-xl font-semibold text-white">Invalid link</h1>
        <p className="text-sm text-slate-400">
          Ask your host for a guest link that includes an invitation token (
          <span className="font-mono text-slate-300">gt</span>) or a zone id (
          <span className="font-mono text-slate-300">zid</span>).
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-lg space-y-5 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-2 rounded-full bg-[#00E5D1]/10 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-[#00E5D1]">
          <QrCode className="h-4 w-4" /> Guest access
        </p>
        <h1 className="text-2xl font-semibold text-slate-100">Check in</h1>
        <p className="text-sm text-slate-400">
          {gt ? (
            <>
              Invitation link{" "}
              <span className="font-mono text-slate-500">(gt)</span>
            </>
          ) : null}
          {gt && zid ? <span className="text-slate-600"> · </span> : null}
          {zid ? (
            <>
              Zone{" "}
              <span className="font-mono text-[#00E5D1]" title={zid}>
                {zid.length > 36 ? `${zid.slice(0, 18)}…` : zid}
              </span>
            </>
          ) : null}
        </p>
      </header>

      {phase.id === "form" && (
        <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-4">
          <div>
            <label
              htmlFor="ga-name"
              className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-500"
            >
              Your name (required)
            </label>
            <input
              id="ga-name"
              value={guestName}
              onChange={(ev) => setGuestName(ev.target.value)}
              autoComplete="name"
              className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
              required
            />
          </div>

          <div>
            <label
              htmlFor="ga-event"
              className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-500"
            >
              Event id (optional)
            </label>
            <input
              id="ga-event"
              value={eventId}
              onChange={(ev) => setEventId(ev.target.value)}
              disabled={Boolean(eidFromQuery)}
              className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 disabled:opacity-70"
              placeholder={eidFromQuery ? "Set from link" : "e.g. EVT-2026-GALA"}
            />
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
            <label className="flex cursor-pointer items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={useAutoDeviceId}
                onChange={(ev) => setUseAutoDeviceId(ev.target.checked)}
                className="rounded border-slate-600"
              />
              Attach anonymous device fingerprint (recommended)
            </label>
            {!useAutoDeviceId ? (
              <input
                value={deviceId}
                onChange={(ev) => setDeviceId(ev.target.value)}
                placeholder="Custom device id"
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-slate-200"
              />
            ) : null}
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold uppercase tracking-[0.16em] text-slate-300">
                Location (optional)
              </p>
              <button
                type="button"
                onClick={captureLocation}
                disabled={locating}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
                {locating ? "Reading…" : "Use current location"}
              </button>
            </div>
            {position ? (
              <p className="font-mono text-[11px] text-slate-300">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </p>
            ) : (
              <p>No location sent.</p>
            )}
          </div>

          {formError ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#00E5D1] px-4 py-2.5 text-sm font-bold text-[#0B0E11] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Request access"}
          </button>
        </form>
      )}

      {phase.id === "expected" && (
        <output className="block space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-4 text-emerald-50">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle className="h-5 w-5 text-emerald-400" /> You are expected
          </p>
          <p className="text-sm leading-relaxed text-emerald-100/90">
            {phase.message}
          </p>
          <button
            type="button"
            onClick={reset}
            className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-200 hover:underline"
          >
            Check in another guest
          </button>
        </output>
      )}

      {phase.id === "waiting" && (
        <output className="block space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4">
          <p className="flex items-center gap-2 text-lg font-semibold text-amber-100">
            <ShieldAlert className="h-5 w-5 text-amber-400" /> Waiting for
            approval
          </p>
          <p className="text-sm text-slate-300">{phase.serverMessage}</p>
          {phase.pollMessage ? (
            <p className="text-sm text-slate-400">{phase.pollMessage}</p>
          ) : null}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Checking status…
          </div>
          <p className="break-all font-mono text-[10px] text-slate-600">
            Reference: {phase.guestId}
          </p>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-slate-500 underline hover:text-slate-300"
          >
            Cancel and start over
          </button>
        </output>
      )}

      {phase.id === "approved" && (
        <div className="space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-4 text-emerald-50">
          <p className="text-lg font-semibold">Approved</p>
          {phase.message ? (
            <p className="text-sm leading-relaxed">{phase.message}</p>
          ) : (
            <p className="text-sm">Your host approved this visit.</p>
          )}

          {!phase.exchange_code?.trim() ? (
            <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-3 text-sm text-emerald-100/90">
              <p className="flex items-center gap-2 font-medium text-emerald-100">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Waiting for server support
              </p>
              <p className="text-emerald-100/80">
                Approval is confirmed; this app is waiting for a one-time sign-in code from the
                server. Keep this page open, or try again later.
              </p>
              {phase.pollMessage ? (
                <p className="font-mono text-[11px] text-emerald-200/70">{phase.pollMessage}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {phase.exchange_expires_at ? (
                <p className="text-emerald-100/80">
                  Sign-in code expires:{" "}
                  <span className="font-mono text-emerald-50">
                    {new Date(phase.exchange_expires_at).toLocaleString()}
                  </span>
                </p>
              ) : null}
              {exchangeError ? (
                <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-100">
                  {exchangeError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={exchangeBusy}
                onClick={() => void handleContinueToGuestApp()}
                className="w-full rounded-md bg-[#00E5D1] px-4 py-2.5 text-sm font-bold text-[#0B0E11] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exchangeBusy ? "Signing in…" : "Continue to guest dashboard"}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={reset}
            className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-200/90 hover:underline"
          >
            Dismiss / start over
          </button>
        </div>
      )}

      {phase.id === "rejected" && (
        <div className="space-y-3 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-4 text-rose-50">
          <p className="text-lg font-semibold">Not approved</p>
          {phase.message ? (
            <p className="text-sm">{phase.message}</p>
          ) : (
            <p className="text-sm">Your request was declined.</p>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-950"
          >
            Try again
          </button>
        </div>
      )}

    </section>
  );
}
