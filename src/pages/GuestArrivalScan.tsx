import { FormEvent, useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { Camera, ClipboardPaste, QrCode } from "lucide-react";
import {
  parseGuestArrivalTokenFromQrPayload,
  parseGuestArrivalZoneFromQrPayload,
} from "../lib/guestArrival";

const REGION_ID = "guest-arrival-qr-render";

export default function GuestArrivalScan() {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [pasteValue, setPasteValue] = useState("");
  const [msg, setMsg] = useState("");

  const goToGuestForm = (raw: string) => {
    const zone = parseGuestArrivalZoneFromQrPayload(raw);
    const token = parseGuestArrivalTokenFromQrPayload(raw);
    if (!zone || !token) {
      setMsg("Could not read zone id or token from QR. Paste the full arrival link or JSON payload.");
      return;
    }
    const qs = new URLSearchParams({
      to: zone,
      token,
    }).toString();
    void scannerRef.current?.clear().catch(() => {});
    navigate(`/guest-arrival?${qs}`);
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      REGION_ID,
      { fps: 8, qrbox: { width: 260, height: 260 } },
      /* verbose */ false,
    );
    scannerRef.current = scanner;
    scanner.render(
      async (decoded) => {
        goToGuestForm(String(decoded));
      },
      () => {
        /* scan errors muted */
      },
    );
    return () => {
      void scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scanner owns lifecycle; navigate stable
  }, []);

  const onPasteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMsg("");
    goToGuestForm(pasteValue.trim());
  };

  const tryPasteFromClipboard = async () => {
    setMsg("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setMsg("Clipboard empty.");
        return;
      }
      setPasteValue(text.trim());
      goToGuestForm(text.trim());
    } catch {
      setMsg("Could not read clipboard. Paste manually below.");
    }
  };

  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-x-hidden">
      <div className="mx-auto grid min-h-[min(100dvh,940px)] max-w-xl gap-8 px-5 py-10 sm:max-w-lg">
        <header className="space-y-2 text-center">
          <p className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00E5D1]/10 px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-[#00E5D1]">
            <QrCode className="h-4 w-4" /> Scan QR
          </p>
          <h1 className="text-2xl font-semibold text-white">Guest arrival scan</h1>
          <p className="text-sm text-slate-400">
            Point your camera at the host&apos;s QR, or paste the link or payload you received.
            We&apos;ll extract the zone id and take you to the guest form next.
          </p>
        </header>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Camera className="h-3.5 w-3.5" aria-hidden /> Camera scanner
          </div>
          <div id={REGION_ID} className="[&_video]:rounded-xl [&_.html5-qrcode-element]:rounded-xl" />
        </div>

        <form onSubmit={onPasteSubmit} className="space-y-3 rounded-3xl border border-slate-800/90 bg-[#151a20]/95 p-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <ClipboardPaste className="h-3.5 w-3.5" /> Or paste
          </div>
          <textarea
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
            rows={3}
            placeholder={'Paste URL with ?to=&token=, or JSON like {"to":"ZONE","token":"…"}'}
            className="w-full rounded-xl border border-slate-700/80 bg-[#0f1318] px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-[#00E5D1]/55 focus:outline-none"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void tryPasteFromClipboard()}
              className="rounded-lg border border-slate-700/80 px-4 py-2 text-sm text-slate-300 transition hover:border-[#00E5D1]/35 hover:text-white"
            >
              From clipboard
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#00E5D1] px-4 py-2 text-sm font-bold text-[#0B0E11] transition hover:brightness-105"
            >
              Continue with pasted payload
            </button>
          </div>
          {msg && (
            <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {msg}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
