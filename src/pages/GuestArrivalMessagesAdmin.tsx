import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, NotebookPen, RefreshCw } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useZones, type SavedZone } from "../hooks/useZones";
import {
  formatGuestArrivalValidationErrors,
  getGuestArrivalMessages,
  guestArrivalMessageMaxLength,
  normalizeGuestArrivalMessageField,
  updateGuestArrivalMessages,
  type GuestArrivalMessagesNormalized,
} from "../services/api/guestArrivalMessages";

type BannerTone = "success" | "error" | "neutral";

function ArrivalMessagesSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-48 rounded bg-slate-800" />
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-slate-800" />
        <div className="h-24 rounded-md bg-slate-800/80" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-40 rounded bg-slate-800" />
        <div className="h-24 rounded-md bg-slate-800/80" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-24 rounded-md bg-slate-800" />
        <div className="h-10 w-40 rounded-md bg-slate-800" />
      </div>
    </div>
  );
}

export default function GuestArrivalMessagesAdmin() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userZoneId = user?.zone_id ?? user?.zoneId ?? null;
  const isAdministrator =
    String(user?.role ?? "").toLowerCase() === "administrator";

  const { zones, loading: zonesLoading } = useZones(userZoneId, {
    role: user?.role,
    currentUserId: user?.id != null ? String(user.id) : null,
    accountOwnerId:
      user?.account_owner_id != null ? String(user.account_owner_id) : null,
  });

  const userZoneStr = String(userZoneId ?? "").trim();
  const [pickedZone, setPickedZone] = useState<string | null>(null);

  const zoneOptions = useMemo(() => {
    const list = (zones ?? []) as SavedZone[];
    const ids = new Set<string>();
    for (const z of list) {
      const id = String(z.zone_id ?? z.id ?? "").trim();
      if (id) ids.add(id);
    }
    return [...ids].sort();
  }, [zones]);

  const effectiveZone = useMemo(() => {
    const p = pickedZone?.trim();
    if (p) return p;
    if (userZoneStr && zoneOptions.includes(userZoneStr)) return userZoneStr;
    return zoneOptions[0] ?? "";
  }, [pickedZone, userZoneStr, zoneOptions]);

  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [normalized, setNormalized] =
    useState<GuestArrivalMessagesNormalized | null>(null);
  const [expectedDraft, setExpectedDraft] = useState("");
  const [unexpectedDraft, setUnexpectedDraft] = useState("");
  const [guestPassDraft, setGuestPassDraft] = useState("");

  const [banner, setBanner] = useState<{
    tone: BannerTone;
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const maxLen = guestArrivalMessageMaxLength();

  const applyNormalizedToForm = useCallback((n: GuestArrivalMessagesNormalized) => {
    setExpectedDraft(n.expected_arrival_message ?? "");
    setUnexpectedDraft(n.unexpected_arrival_message ?? "");
    setGuestPassDraft(
      n.supports_guest_pass_verified_message
        ? (n.guest_pass_verified_message ?? "")
        : "",
    );
  }, []);

  const load = useCallback(async () => {
    const z = effectiveZone.trim();
    if (!z) {
      setLoadState("error");
      setBanner({ tone: "error", text: "No zone selected." });
      return;
    }
    setLoadState("loading");
    setNormalized(null);
    setBanner(null);
    const res = await getGuestArrivalMessages(z);
    if (!res.ok) {
      if (res.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      if (res.status === 403) {
        setLoadState("error");
        setBanner({
          tone: "error",
          text: "You don't have permission to edit this zone.",
        });
        return;
      }
      if (res.status === 404) {
        setLoadState("error");
        setBanner({
          tone: "error",
          text: "Zone or resource not found.",
        });
        return;
      }
      const ve = formatGuestArrivalValidationErrors(res.validationErrors);
      setLoadState("error");
      setBanner({
        tone: "error",
        text: ve ?? res.message,
      });
      return;
    }
    setNormalized(res.data);
    applyNormalizedToForm(res.data);
    setLoadState("loaded");
  }, [applyNormalizedToForm, effectiveZone, logout, navigate]);

  useEffect(() => {
    if (!effectiveZone || !isAdministrator) return;
    void load();
  }, [effectiveZone, isAdministrator, load]);

  const defaults = normalized?.defaults;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const z = effectiveZone.trim();
    if (!z || !normalized) return;

    const lengthChecks: [string, string][] = [
      ["Expected (on schedule)", expectedDraft],
      ["Unexpected (awaiting approval)", unexpectedDraft],
    ];
    if (normalized.supports_guest_pass_verified_message) {
      lengthChecks.push(["Guest pass verified", guestPassDraft]);
    }
    for (const [label, raw] of lengthChecks) {
      const t = raw.trim();
      if (t.length > maxLen) {
        setBanner({
          tone: "error",
          text: `${label} is too long (max ${maxLen} characters).`,
        });
        return;
      }
    }

    let expected_arrival_message: string | null;
    let unexpected_arrival_message: string | null;
    let guest_pass_verified_message: string | null | undefined;
    try {
      expected_arrival_message = normalizeGuestArrivalMessageField(expectedDraft);
      unexpected_arrival_message =
        normalizeGuestArrivalMessageField(unexpectedDraft);
      guest_pass_verified_message = normalized.supports_guest_pass_verified_message
        ? normalizeGuestArrivalMessageField(guestPassDraft)
        : undefined;
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Invalid message.",
      });
      return;
    }

    const payload = {
      expected_arrival_message,
      unexpected_arrival_message,
      ...(normalized.supports_guest_pass_verified_message
        ? { guest_pass_verified_message }
        : {}),
    };

    setSaving(true);
    setBanner(null);
    const res = await updateGuestArrivalMessages(z, payload);
    setSaving(false);

    if (!res.ok) {
      if (res.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      if (res.status === 403) {
        setBanner({
          tone: "error",
          text: "You don't have permission to edit this zone.",
        });
        return;
      }
      if (res.status === 404) {
        setBanner({
          tone: "error",
          text: "Zone or resource not found.",
        });
        return;
      }
      const ve = formatGuestArrivalValidationErrors(res.validationErrors);
      setBanner({ tone: "error", text: ve ?? res.message });
      return;
    }

    setNormalized(res.data);
    applyNormalizedToForm(res.data);
    setBanner({
      tone: "success",
      text: "Guest arrival messages saved.",
    });
  };

  const handleReset = async () => {
    const z = effectiveZone.trim();
    if (!z || !normalized) return;
    const payload = {
      expected_arrival_message: null as string | null,
      unexpected_arrival_message: null as string | null,
      ...(normalized.supports_guest_pass_verified_message
        ? { guest_pass_verified_message: null as string | null }
        : {}),
    };
    setSaving(true);
    setBanner(null);
    const res = await updateGuestArrivalMessages(z, payload);
    setSaving(false);

    if (!res.ok) {
      if (res.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      if (res.status === 403) {
        setBanner({
          tone: "error",
          text: "You don't have permission to edit this zone.",
        });
        return;
      }
      if (res.status === 404) {
        setBanner({
          tone: "error",
          text: "Zone or resource not found.",
        });
        return;
      }
      const ve = formatGuestArrivalValidationErrors(res.validationErrors);
      setBanner({ tone: "error", text: ve ?? res.message });
      return;
    }

    setNormalized(res.data);
    applyNormalizedToForm(res.data);
    setBanner({
      tone: "success",
      text: "Reset to server defaults.",
    });
  };

  if (zonesLoading && !userZoneStr && zoneOptions.length === 0) {
    return (
      <section className="space-y-4 p-4">
        <p className="text-sm text-slate-400">Loading zones…</p>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#00E5D1]/10 px-4 py-2 text-sm font-medium text-[#00E5D1]">
          <NotebookPen size={16} strokeWidth={2} /> Guest access
        </span>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
          Guest arrival messages
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-400">
          Edit the short lines guests see after they request access (expected vs
          unexpected visits). Guest apps keep using the existing permission and
          poll responses; only this admin screen calls the settings API. Related:{" "}
          <Link to="/guest-access-qr" className="text-[#00E5D1] hover:underline">
            Guest QR
          </Link>
          .
        </p>
      </div>

      {zoneOptions.length > 1 ? (
        <div className="max-w-md space-y-2">
          <label
            htmlFor="guest-arrival-zone"
            className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
          >
            Zone
          </label>
          <select
            id="guest-arrival-zone"
            value={effectiveZone}
            onChange={(e) => setPickedZone(e.target.value)}
            className="w-full rounded-md border border-slate-700/80 bg-[#151a20] px-3 py-2 text-sm text-white"
          >
            {zoneOptions.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!effectiveZone ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          No zone is available on this account. Set a zone on your profile or open
          the dashboard to configure zones.
        </p>
      ) : !isAdministrator ? (
        <p className="rounded-md border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          Only <strong className="text-slate-200">administrators</strong> can load
          or edit guest arrival message settings for a zone.
        </p>
      ) : (
        <div className="rounded-lg border border-slate-800/60 bg-[#0B0E11] overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 sm:px-6">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white">
              <NotebookPen className="h-4 w-4 text-[#00E5D1]" />
              Zone copy
            </span>
            <span className="rounded-full border border-slate-700/80 bg-[#151a20] px-3 py-1.5 font-mono text-xs text-[#00E5D1]">
              {effectiveZone}
            </span>
          </header>

          <div className="px-4 py-5 sm:px-6">
            {banner ? (
              <div
                className={`mb-5 rounded-md border px-4 py-3 text-sm ${
                  banner.tone === "success"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                    : banner.tone === "error"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
                      : "border-slate-600/80 bg-slate-900/60 text-slate-200"
                }`}
                role="status"
              >
                {banner.text}
              </div>
            ) : null}

            {loadState === "loading" || loadState === "idle" ? (
              <ArrivalMessagesSkeleton />
            ) : loadState === "error" && !normalized ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Could not load settings for this zone.
                </p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSave}>
                <p className="text-xs text-slate-500">
                  Leave a field empty to use the server default (placeholder text
                  shows what guests see). Max {maxLen} characters per message.
                </p>

                <div className="space-y-2">
                  <label
                    htmlFor="expected-arrival-msg"
                    className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400"
                  >
                    Expected (on schedule)
                  </label>
                  <textarea
                    id="expected-arrival-msg"
                    rows={3}
                    maxLength={maxLen}
                    placeholder={
                      defaults?.expected_arrival_message ??
                      "You are expected. Please proceed."
                    }
                    value={expectedDraft}
                    onChange={(e) => setExpectedDraft(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-md border border-slate-700/80 bg-[#151a20] px-3 py-2 text-sm text-white placeholder:text-slate-600 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="unexpected-arrival-msg"
                    className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400"
                  >
                    Unexpected (not on schedule, waiting for approval)
                  </label>
                  <textarea
                    id="unexpected-arrival-msg"
                    rows={3}
                    maxLength={maxLen}
                    placeholder={
                      defaults?.unexpected_arrival_message ??
                      "You are not scheduled. Please wait for approval."
                    }
                    value={unexpectedDraft}
                    onChange={(e) => setUnexpectedDraft(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-md border border-slate-700/80 bg-[#151a20] px-3 py-2 text-sm text-white placeholder:text-slate-600 disabled:opacity-60"
                  />
                </div>

                {normalized?.supports_guest_pass_verified_message ? (
                  <div className="space-y-2">
                    <label
                      htmlFor="guest-pass-verified-msg"
                      className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400"
                    >
                      Guest pass verified (optional)
                    </label>
                    <textarea
                      id="guest-pass-verified-msg"
                      rows={3}
                      maxLength={maxLen}
                      placeholder={
                        defaults?.guest_pass_verified_message ??
                        "Your guest pass was verified. Please proceed."
                      }
                      value={guestPassDraft}
                      onChange={(e) => setGuestPassDraft(e.target.value)}
                      disabled={saving}
                      className="w-full rounded-md border border-slate-700/80 bg-[#151a20] px-3 py-2 text-sm text-white placeholder:text-slate-600 disabled:opacity-60"
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-[#00E5D1] px-4 py-2 text-sm font-bold text-[#0B0E11] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleReset()}
                    className="inline-flex items-center justify-center rounded-md border border-slate-600 bg-transparent px-4 py-2 text-sm text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reset to defaults
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
