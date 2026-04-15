import { useEffect, useRef, useState } from "react";

type AlertKind = "panic" | "ns_panic";

const HOLD_MS: Record<AlertKind, number> = {
  panic: 2000,
  ns_panic: 3000,
};

export default function AlertPanel() {
  // UPDATED for Zoning-Messaging-System-Summary-v1.1.pdf
  const [activeHold, setActiveHold] = useState<AlertKind | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [status, setStatus] = useState("Ready.");
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
    };
  }, []);

  const stopHold = () => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    startedAtRef.current = null;
    setActiveHold(null);
    setHoldProgress(0);
  };

  const beginHold = (kind: AlertKind) => {
    stopHold();
    const required = HOLD_MS[kind];
    setActiveHold(kind);
    startedAtRef.current = Date.now();
    setStatus(
      kind === "panic"
        ? "Hold PANIC for 2 seconds to confirm."
        : "Hold NS PANIC for 3 seconds to confirm.",
    );
    timerRef.current = window.setInterval(() => {
      if (!startedAtRef.current) return;
      const elapsed = Date.now() - startedAtRef.current;
      const pct = Math.min(100, (elapsed / required) * 100);
      setHoldProgress(pct);
      if (elapsed >= required) {
        setStatus(
          kind === "panic"
            ? "PANIC alert dispatched."
            : "NS PANIC alert dispatched.",
        );
        stopHold();
      }
    }, 40);
  };

  return (
    <section className="space-y-6 p-6 md:p-8">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-[#00E5D1]">
          Alert Panel
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Emergency Trigger Controls
        </h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onMouseDown={() => beginHold("panic")}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => beginHold("panic")}
          onTouchEnd={stopHold}
          className="rounded-3xl border border-red-500/60 bg-red-950/40 px-6 py-14 text-center transition hover:bg-red-900/40"
        >
          <p className="text-4xl font-extrabold tracking-wide text-red-200">
            PANIC
          </p>
          <p className="mt-3 text-sm text-red-300">Hold 2 seconds to send</p>
        </button>

        <button
          type="button"
          onMouseDown={() => beginHold("ns_panic")}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => beginHold("ns_panic")}
          onTouchEnd={stopHold}
          className="rounded-3xl border border-orange-400/70 bg-orange-950/40 px-6 py-14 text-center transition hover:bg-orange-900/40"
        >
          <p className="text-4xl font-extrabold tracking-wide text-orange-200">
            NS PANIC
          </p>
          <p className="mt-3 text-sm text-orange-300">Hold 3 seconds to send</p>
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4">
        <div className="h-2 w-full rounded-full bg-slate-800">
          <div
            className="h-2 rounded-full bg-[#00E5D1] transition-[width]"
            style={{ width: `${holdProgress}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-slate-300">
          {activeHold ? `Confirming ${activeHold}...` : status}
        </p>
      </div>
    </section>
  );
}
