import { Link } from "react-router-dom";
import { QrCode } from "lucide-react";

type Props = {
  zoneId: string;
  compact?: boolean;
};

/** Dashboard teaser: full issuance lives on Guest QR (admin). */
export function GuestAccessQrSection({ zoneId, compact = false }: Props) {
  const normalizedZone = zoneId.trim();
  if (!normalizedZone) {
    return (
      <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-4 py-3 text-sm text-slate-500">
        Select or enter a zone, then use{" "}
        <Link to="/guest-access-qr" className="text-[#00E5D1] hover:underline">
          Guest QR
        </Link>{" "}
        to issue guest access tokens.
      </div>
    );
  }

  return (
    <section
      id="guest-access-qr-section"
      className={`rounded-xl border border-slate-800/80 bg-slate-950/70 ${compact ? "px-4 py-4" : "px-5 py-5"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#00E5D1]">
            <QrCode className="h-4 w-4" /> Guest access QR
          </p>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Issue time-bound links (<span className="font-mono">/access?gt=…</span>) from
            the Guest QR page. Requires an administrator account for this zone.
          </p>
        </div>
        <Link
          to="/guest-access-qr"
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-700/80 bg-[#151a20]/90 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
        >
          Open Guest QR
        </Link>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        Current zone:{" "}
        <span className="font-mono text-slate-400">{normalizedZone}</span>
      </p>
    </section>
  );
}
