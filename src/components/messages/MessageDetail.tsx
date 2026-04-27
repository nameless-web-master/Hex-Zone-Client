import type { Message } from "../../services/api/messages";
import { toMessageTypeLabel } from "../../lib/messageTypes";

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
              {message.zone_id}
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-1 text-[#00E5D1]">
              {toMessageTypeLabel(message.type)}
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-1 text-amber-300">
              Category {message.category}
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">
              Scope {message.scope}
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">
              sender {message.sender_id}
            </span>
            {message.receiver_id != null && (
              <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">
                receiver {message.receiver_id}
              </span>
            )}
            <span className="text-slate-500">
              {new Date(message.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-200">
            {message.message}
          </p>
          {message.raw_payload && (
            <pre className="overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
              {JSON.stringify(message.raw_payload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
