import { MessageCircle } from "lucide-react";
import type { Message } from "../../services/api/messages";

export function MessageList({
  messages,
  activeId,
  onSelect,
}: {
  messages: Message[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-8 text-center text-slate-400">
        No messages found for current filters.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {messages.map((message) => {
        const active = activeId === message.id;
        return (
          <li key={message.id}>
            <button
              type="button"
              onClick={() => onSelect(message.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? "border-[#00E5D1]/60 bg-[#00E5D1]/10"
                  : "border-slate-800/80 bg-slate-950/80 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-lg bg-[#00E5D1]/10 p-2">
                  <MessageCircle className="h-4 w-4 text-[#00E5D1]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-slate-300">
                      {message.zoneId}
                    </span>
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[#00E5D1]">
                      {message.type}
                    </span>
                    <span className="text-slate-500">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-200">
                    {message.text}
                  </p>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
