import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Loader2,
  MapPin,
  QrCode,
  RefreshCw,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  buildGuestArrivalPermissionPayload,
  type GuestArrivalPosition,
} from "../lib/guestArrival";
import {
  normalizeGuestPermissionResponse,
  pollGuestApprovalStatus,
  requestGuestScanAuthToken,
  resolveMappedDeviceApiKey,
  submitGuestArrivalPermission,
  type GuestApprovalStatus,
} from "../services/api/accessPermissions";

type FeedbackTone = "neutral" | "success" | "warning" | "error";

type ArrivalPhase =
  | { id: "form" }
  | {
      id: "expected_ok";
      proceedLine: string;
      waitLine?: string;
      eventHint?: string;
    }
  | {
      id: "unexpected_pending";
      requestId?: string;
    }
  | {
      id: "awaiting_approval";
      requestId?: string;
    }
  | {
      id: "approved";
      instructions?: string;
    }
  | {
      id: "rejected";
    };

const DEVICE_HID_STORAGE_KEY = "zoneweaver_device_hid";
const GUEST_HID_STORAGE_KEY = "zoneweaver_guest_hid";
const DEVICE_KEY_INVALID_MESSAGE =
  "Device key is invalid for this environment. Please re-sync device credentials.";
const SCAN_AUTH_REAUTH_MESSAGE =
  "Scan session expired. Please sign in again and rescan the guest QR code.";
const SCAN_AUTH_MISSING_MESSAGE =
  "Client error: missing scan auth header. Please update the app and retry.";
const REAUTH_PROMPT_MESSAGE =
  "Your scan authorization could not be refreshed. Please scan the guest QR again.";

function buildBrowserDerivedHid(): string {
  const seed = `${navigator.userAgent}|${navigator.language}|${navigator.platform}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const suffix = hash.toString(36).toUpperCase().slice(0, 10).padEnd(10, "X");
  return `WEB-${suffix}`;
}

function resolveBrowserHid(): string {
  const knownHid = String(
    localStorage.getItem(DEVICE_HID_STORAGE_KEY) ??
      localStorage.getItem(GUEST_HID_STORAGE_KEY) ??
      "",
  ).trim();
  if (knownHid) return knownHid;
  const derived = buildBrowserDerivedHid();
  localStorage.setItem(GUEST_HID_STORAGE_KEY, derived);
  return derived;
}

function includesScheduleNotFound(value?: string): boolean {
  return /schedule[_\s-]?not[_\s-]?found/i.test(String(value ?? ""));
}

function includesNetworkFailure(value?: string): boolean {
  return /network|timeout|failed to fetch|connection/i.test(String(value ?? ""));
}

function hintFromTexts(...parts: Array<string | undefined>): string {
  const t = parts.find((text) => String(text ?? "").trim().length > 0);
  return t?.trim() ?? "";
}

function pickProceedWait(
  decision: ReturnType<typeof normalizeGuestPermissionResponse>,
): { proceed: string; wait?: string } {
  const dm = hintFromTexts(decision.waitCopy).toLowerCase();
  const proactive =
    /\b(wait|hold|stay|stay put|outside|remain|blocked|freeze)\b/i.test(dm);
  const waitLine = proactive ? hintFromTexts(decision.waitCopy) : undefined;
  const proceedFallback = proactive ? "" : hintFromTexts(decision.waitCopy, decision.proceedCopy);
  const proceed = hintFromTexts(
    decision.proceedCopy,
    !proceedFallback ? decision.waitCopy : undefined,
    "Please proceed to check in with your host.",
  );
  return { proceed: proceed || "Please proceed.", wait: waitLine };
}

export default function GuestArrival() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const toParam = String(searchParams.get("to") ?? "").trim();
  const tokenParam = String(searchParams.get("token") ?? "").trim();

  const [guestName, setGuestName] = useState("");
  const [eventId, setEventId] = useState("");
  const [phase, setPhase] = useState<ArrivalPhase>({ id: "form" });
  const [hid] = useState(() => resolveBrowserHid());

  const [position, setPosition] = useState<GuestArrivalPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<{ text: string; tone: FeedbackTone } | null>(null);

  const [scannedZoneId, setScannedZoneId] = useState("");
  const [scannedToken, setScannedToken] = useState("");

  const prevZoneTokenPair = useRef<string>("");

  useEffect(() => {
    const key = `${toParam}:${tokenParam}`;
    if (!toParam || !tokenParam) return;
    setScannedZoneId(toParam);
    setScannedToken(tokenParam);
    if (prevZoneTokenPair.current && prevZoneTokenPair.current !== key) {
      setPhase({ id: "form" });
      setGuestName("");
      setEventId("");
      setLocalError(null);
      setPosition(null);
    }
    prevZoneTokenPair.current = key;
  }, [toParam, tokenParam]);

  useEffect(() => {
    if ((!toParam || !tokenParam) && phase.id === "form") {
      navigate("/guest-arrival/scan", { replace: true });
    }
  }, [navigate, toParam, tokenParam, phase.id]);

  const effectiveZoneId = scannedZoneId || toParam;
  const effectiveToken = scannedToken || tokenParam;

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocalError({
        text: "Location is not available on this browser.",
        tone: "warning",
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (next) => {
        setPosition({
          latitude: next.coords.latitude,
          longitude: next.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocalError({
          text: "We could not read your location. You can still continue.",
          tone: "warning",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const mapPollToPhase = (status: GuestApprovalStatus) => {
    if (status === "APPROVED") {
      setPhase({
        id: "approved",
        instructions: "Your host approved your visit. Follow their directions on site.",
      });
    } else if (status === "REJECTED") {
      setPhase({ id: "rejected" });
    }
  };

  useEffect(() => {
    if (phase.id !== "awaiting_approval" && phase.id !== "unexpected_pending") return;
    const requestId = phase.requestId?.trim();
    if (!requestId) return;
    let alive = true;
    const step = async () => {
      const res = await pollGuestApprovalStatus(requestId);
      if (!alive || !res.data) return;
      mapPollToPhase(res.data.status);
    };
    void step();
    const handle = window.setInterval(() => void step(), 9000);
    return () => {
      alive = false;
      window.clearInterval(handle);
    };
  }, [phase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setLocalError(null);

    let payload;
    try {
      payload = buildGuestArrivalPermissionPayload({
        hid,
        to: effectiveZoneId,
        guestName,
        eventId: eventId.trim() || undefined,
        timestamp: new Date().toISOString(),
        position,
      });
    } catch (error) {
      setLocalError({
        text: error instanceof Error ? error.message : "Guest arrival payload is invalid.",
        tone: "error",
      });
      return;
    }
    const requiredToken = effectiveToken.trim();
    if (!requiredToken || !effectiveZoneId.trim()) {
      setLocalError({
        text: "Missing zone or QR token. Return to Scan QR.",
        tone: "error",
      });
      return;
    }

    const fallbackApiKey = resolveMappedDeviceApiKey();
    const submitWithHeaders = async (scanAuthToken?: string) =>
      submitGuestArrivalPermission(payload, {
        scanAuthToken,
        fallbackApiKey,
        idempotencyKey: requiredToken,
      });

    setSubmitting(true);
    let scanAuthToken = "";
    const scanAuthProbe = await requestGuestScanAuthToken({
      to: payload.to,
      token: requiredToken,
    });
    if (!scanAuthProbe.error && scanAuthProbe.data?.scanAuthToken) {
      scanAuthToken = scanAuthProbe.data.scanAuthToken.trim();
    }

    let result = await submitWithHeaders(scanAuthToken || undefined);

    if (result.errorCode === "INVALID_SCAN_AUTH") {
      const refreshed = await requestGuestScanAuthToken({
        to: payload.to,
        token: requiredToken,
      });
      const fresh = String(refreshed.data?.scanAuthToken ?? "").trim();
      if (!fresh) {
        setSubmitting(false);
        setLocalError({ text: REAUTH_PROMPT_MESSAGE, tone: "error" });
        return;
      }
      result = await submitWithHeaders(fresh);
      if (result.errorCode === "INVALID_SCAN_AUTH") {
        setSubmitting(false);
        setLocalError({ text: REAUTH_PROMPT_MESSAGE, tone: "error" });
        return;
      }
    }
    setSubmitting(false);

    if (result.error) {
      if (result.errorCode === "MISSING_SCAN_AUTH" || result.error === SCAN_AUTH_MISSING_MESSAGE) {
        setLocalError({ text: SCAN_AUTH_MISSING_MESSAGE, tone: "error" });
      } else if (result.error === SCAN_AUTH_REAUTH_MESSAGE) {
        setLocalError({ text: REAUTH_PROMPT_MESSAGE, tone: "error" });
      } else if (result.error === DEVICE_KEY_INVALID_MESSAGE) {
        setLocalError({ text: DEVICE_KEY_INVALID_MESSAGE, tone: "error" });
      } else if (includesScheduleNotFound(result.error)) {
        setLocalError({
          text: "Schedule not found: your host may need to create or update a guest pass.",
          tone: "warning",
        });
      } else if (includesNetworkFailure(result.error)) {
        setLocalError({
          text: "Network failure: we could not submit your arrival. Please retry.",
          tone: "error",
        });
      } else {
        setLocalError({ text: `Validation/API error: ${result.error}`, tone: "error" });
      }
      return;
    }

    const decision = result.data;
    if (!decision) {
      setLocalError({
        text: "Unexpected response from access permission service.",
        tone: "warning",
      });
      return;
    }

    if (decision.expectation === "expected") {
      const { proceed, wait } = pickProceedWait(decision);
      setPhase({
        id: "expected_ok",
        proceedLine: proceed,
        waitLine: wait,
        eventHint: eventId.trim() || undefined,
      });
      return;
    }

    if (decision.approvalStatus === "APPROVED") {
      setPhase({
        id: "approved",
        instructions:
          decision.nextInstructions ||
          "Access granted. Follow your host’s directions.",
      });
      return;
    }
    if (decision.approvalStatus === "REJECTED") {
      setPhase({ id: "rejected" });
      return;
    }

    if (decision.approvalStatus === "PENDING" || decision.pollingNeeded) {
      setPhase({
        id: "awaiting_approval",
        requestId: decision.requestId,
      });
      return;
    }

    setPhase({
      id: "unexpected_pending",
      requestId: decision.requestId,
    });
  };

  const resetToForm = () => {
    setPhase({ id: "form" });
    setLocalError(null);
  };

  return (
    <section className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-2 rounded-full bg-[#00E5D1]/10 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-[#00E5D1]">
          <QrCode className="h-4 w-4" /> GUEST ARRIVAL
        </p>
        <h1 className="text-2xl font-semibold text-slate-100">Guest info</h1>
        <p className="text-sm text-slate-400">
          Zone <span className="font-mono text-[#00E5D1]">{effectiveZoneId || "—"}</span>
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            to="/guest-arrival/scan"
            className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:border-[#00E5D1]/40 hover:text-white"
          >
            Back to Scan QR
          </Link>
        </div>
      </header>

      {phase.id === "form" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="guest-name"
              className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-500"
            >
              Guest name (required)
            </label>
            <input
              id="guest-name"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Jordan Rivera"
              className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
              required
            />
          </div>

          <div>
            <label
              htmlFor="guest-event-id"
              className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-500"
            >
              Event ID (optional)
            </label>
            <input
              id="guest-event-id"
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              placeholder="EVT-2026-GALA"
              className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold uppercase tracking-[0.16em] text-slate-300">
                Position (optional)
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
              <p>
                latitude: {position.latitude.toFixed(6)} / longitude: {position.longitude.toFixed(6)}
              </p>
            ) : (
              <p>No position attached.</p>
            )}
          </div>

          {localError && (
            <p
              className={`rounded-md border px-3 py-2 text-sm ${
                localError.tone === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : localError.tone === "warning"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : localError.tone === "error"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                      : "border-slate-700/70 bg-slate-900/70 text-slate-300"
              }`}
            >
              {localError.text}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#00E5D1] px-4 py-2.5 text-sm font-bold text-[#0B0E11] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "I have arrived"}
          </button>
        </form>
      )}

      {(phase.id === "expected_ok" ||
        phase.id === "unexpected_pending" ||
        phase.id === "awaiting_approval") && (
        <output className="block space-y-3 rounded-xl border border-slate-800/90 bg-slate-900/40 px-4 py-4">
          {phase.id === "expected_ok" ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-lg font-semibold text-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-400" /> You are expected
              </p>
              {phase.eventHint ? (
                <p className="text-sm text-slate-400">
                  Event reference:{" "}
                  <span className="font-mono text-slate-200">{phase.eventHint}</span>
                </p>
              ) : null}
              <div className="space-y-2 text-sm leading-relaxed text-slate-200">
                {phase.waitLine ? (
                  <>
                    <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-amber-100">
                      Wait for host: {phase.waitLine}
                    </p>
                    <p className="text-slate-300">When cleared: {phase.proceedLine}</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-[#00E5D1]">Please proceed</p>
                    <p className="text-slate-400">{phase.proceedLine}</p>
                  </>
                )}
              </div>
            </div>
          ) : phase.id === "unexpected_pending" ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-lg font-semibold text-amber-100">
                <ShieldAlert className="h-5 w-5 text-amber-400" /> You are not scheduled here
              </p>
              <p className="text-sm text-slate-400">Waiting for approval…</p>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Realtime updates arrive over the admin channel; polling runs when configured.
              </p>
              {phase.requestId ? (
                <p className="break-all font-mono text-[10px] text-slate-600">
                  Reference: {phase.requestId}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-lg font-semibold text-amber-50">
                <ShieldAlert className="h-5 w-5 text-amber-400" /> You are not scheduled here
              </p>
              <p className="text-sm text-slate-400">Waiting for approval…</p>
              <p className="text-base font-medium text-slate-100">Admin reviewing your request</p>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Live refresh…
              </div>
              {phase.requestId ? (
                <p className="break-all font-mono text-[10px] text-slate-600">
                  Reference: {phase.requestId}
                </p>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate("/guest-arrival/scan")}
            className="text-xs font-medium uppercase tracking-[0.14em] text-[#00E5D1] hover:underline"
          >
            Scan another QR
          </button>
        </output>
      )}

      {phase.id === "approved" && (
        <div className="space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-4 text-emerald-50">
          <p className="text-lg font-semibold">Access granted</p>
          <p className="text-sm leading-relaxed">{phase.instructions}</p>
          <button
            type="button"
            onClick={resetToForm}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Check in again
          </button>
        </div>
      )}

      {phase.id === "rejected" && (
        <div className="space-y-3 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-4 text-rose-50">
          <p className="text-lg font-semibold">Access denied</p>
          <p className="text-sm">Your host or an admin declined this visit.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetToForm}
              className="rounded-md bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-950"
            >
              Retry
            </button>
            <span className="text-xs text-rose-200/90">or contact your host / admin.</span>
          </div>
        </div>
      )}
    </section>
  );
}
