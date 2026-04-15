import { useMemo, useState } from "react";
import { Smartphone } from "lucide-react";
import { MessageList } from "../components/messages/MessageList";
import { MessageDetail } from "../components/messages/MessageDetail";
import { useMessageFeed } from "../hooks/useMessageFeed";
import { sendMessage, type MessageType } from "../services/api/messages";
import { useAuth } from "../hooks/useAuth";

export default function Messages() {
  const { user } = useAuth();
  const userZoneId = user?.zoneId ?? user?.zone_id;
  const [zoneFilter, setZoneFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | MessageType>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const [composeZoneId, setComposeZoneId] = useState(String(userZoneId ?? ""));
  const [composeType, setComposeType] = useState<MessageType>("NORMAL");
  const [composeText, setComposeText] = useState("");
  const [composeStatus, setComposeStatus] = useState("");

  const { messages, zones, loading, error } = useMessageFeed(
    userZoneId ? [String(userZoneId)] : [],
  );

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      if (zoneFilter !== "all" && message.zoneId !== zoneFilter) return false;
      if (typeFilter !== "all" && message.type !== typeFilter) return false;
      if (dateFilter) {
        const ymd = new Date(message.createdAt).toISOString().slice(0, 10);
        if (ymd !== dateFilter) return false;
      }
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        message.text.toLowerCase().includes(q) ||
        message.zoneId.toLowerCase().includes(q)
      );
    });
  }, [messages, zoneFilter, typeFilter, dateFilter, search]);

  const activeMessage =
    filteredMessages.find((msg) => msg.id === activeMessageId) ?? null;

  const handleSend = async () => {
    if (!composeZoneId.trim() || !composeText.trim()) return;
    setComposeStatus("Sending...");
    const result = await sendMessage({
      zoneId: composeZoneId.trim(),
      type: composeType,
      text: composeText.trim(),
      metadata: {},
    });
    setComposeStatus(result.error ? "Send failed." : "Sent.");
    if (!result.error) setComposeText("");
  };

  return (
    <section className="space-y-6 p-8">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/90 px-4 py-3">
        <Smartphone
          className="h-5 w-5 shrink-0 text-orange-400"
          strokeWidth={2}
          aria-hidden
        />
        <p className="text-sm text-slate-300">
          <span className="font-medium text-slate-200">Live message feed.</span>{" "}
          <span className="text-slate-500">WebSocket with polling fallback.</span>
        </p>
      </div>

      <div className="grid gap-4 rounded-[2rem] border border-slate-800/80 bg-slate-950/80 p-5 lg:grid-cols-5">
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-md border border-[#00E5D1]/45 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100"
        >
          <option value="all">All zones</option>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | MessageType)}
          className="rounded-md border border-[#00E5D1]/45 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100"
        >
          <option value="all">All types</option>
          <option value="NORMAL">NORMAL</option>
          <option value="PANIC">PANIC</option>
          <option value="NS_PANIC">NS_PANIC</option>
          <option value="SENSOR">SENSOR</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search text or zone..."
          className="lg:col-span-2 rounded-md border border-slate-700 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {error && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {loading && <p className="text-sm text-slate-500">Syncing messages...</p>}
          <MessageList
            messages={filteredMessages}
            activeId={activeMessageId}
            onSelect={setActiveMessageId}
          />
        </div>
        <div className="space-y-4">
          <MessageDetail message={activeMessage} />
          <section className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
              Compose
            </p>
            <input
              value={composeZoneId}
              onChange={(e) => setComposeZoneId(e.target.value)}
              placeholder="Zone ID"
              className="w-full rounded-md border border-slate-700 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100"
            />
            <select
              value={composeType}
              onChange={(e) => setComposeType(e.target.value as MessageType)}
              className="w-full rounded-md border border-slate-700 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100"
            >
              <option value="NORMAL">NORMAL</option>
              <option value="PANIC">PANIC</option>
              <option value="NS_PANIC">NS_PANIC</option>
              <option value="SENSOR">SENSOR</option>
            </select>
            <textarea
              rows={4}
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder="Type your message..."
              className="w-full rounded-md border border-slate-700 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100"
            />
            <button
              type="button"
              onClick={handleSend}
              className="w-full rounded-md bg-[#00E5D1] px-4 py-2.5 text-sm font-bold text-[#0B0E11]"
            >
              Send Message
            </button>
            {composeStatus && <p className="text-xs text-slate-500">{composeStatus}</p>}
          </section>
        </div>
      </div>
    </section>
  );
}
