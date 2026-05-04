import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QrCode } from "lucide-react";
import { GuestQrTokensAdmin } from "../components/guestQr/GuestQrTokensAdmin";
import { useAuth } from "../hooks/useAuth";
import { useZones, type SavedZone } from "../hooks/useZones";

export default function GuestAccessQr() {
  const { user } = useAuth();
  const userZoneId = user?.zone_id ?? user?.zoneId ?? null;
  const isAdministrator =
    String(user?.role ?? "").toLowerCase() === "administrator";

  const { zones, loading } = useZones(userZoneId, {
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

  if (loading && !userZoneStr && zoneOptions.length === 0) {
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
          <QrCode size={16} strokeWidth={2} /> Guest access
        </span>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
          Guest access QR
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-400">
          Administrators issue tokens that open{" "}
          <Link to="/access" className="text-[#00E5D1] hover:underline">
            /access?gt=…
          </Link>{" "}
          without sign-in. Account-invite QR codes stay under{" "}
          <Link to="/qr" className="text-[#00E5D1] hover:underline">
            QR invite
          </Link>
          .
        </p>
      </div>

      {zoneOptions.length > 1 ? (
        <div className="max-w-md space-y-2">
          <label
            htmlFor="guest-qr-zone"
            className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
          >
            Zone
          </label>
          <select
            id="guest-qr-zone"
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
          No zone is available on this account. Set a zone on your profile or
          open the dashboard to configure zones.
        </p>
      ) : !isAdministrator ? (
        <p className="rounded-md border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          Only <strong className="text-slate-200">administrators</strong> can
          create and revoke guest QR tokens for a zone. Ask an administrator to
          issue a link or sign in with an admin account.
        </p>
      ) : (
        <div className="rounded-[1.25rem] border border-slate-800/80 bg-slate-950/60 p-5 sm:p-6">
          <GuestQrTokensAdmin zoneId={effectiveZone} />
        </div>
      )}
    </section>
  );
}
