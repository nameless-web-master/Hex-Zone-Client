import type { Message } from "../../services/api/messages";

export function MessageDetail({ message }: { message: Message | null }) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-5">
      {!message ? (
        <p className="text-sm text-slate-400">
          Select a message to view full details.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">
              {message.zoneId}
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-1 text-[#00E5D1]">
              {message.type}
            </span>
            <span className="text-slate-500">
              {new Date(message.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-200">{message.text}</p>
        </div>
      )}
    </section>
  );
}
