import { useMemo, useState } from "react";
import { MessageCircle, Smartphone } from "lucide-react";

interface MessageItem {
  id: string;
  date: string;
  time: string;
  sender: string;
  text: string;
  senderZoneId: string;
}

const sampleMessages: MessageItem[] = [
  {
    id: "msg-1",
    date: "Mar 17, 2024",
    time: "01:15 PM",
    sender: "alex.chen",
    text: "Zone perimeter check completed. All sensors nominal.",
    senderZoneId: "ZN-4F8A2C",
  },
  {
    id: "msg-2",
    date: "Mar 17, 2024",
    time: "01:17 PM",
    sender: "maria.santos",
    text: "Copy that. Moving to sector 7 for sweep.",
    senderZoneId: "ZN-7D2B9F",
  },
  {
    id: "msg-3",
    date: "Mar 17, 2024",
    time: "01:22 PM",
    sender: "alex.chen",
    text: "Anomaly detected at cell 8a1a2b3c4d6fffff. Investigating.",
    senderZoneId: "ZN-4F8A2C",
  },
  {
    id: "msg-4",
    date: "Mar 17, 2024",
    time: "01:25 PM",
    sender: "james.kim",
    text: "Standing by for support. Device online.",
    senderZoneId: "ZN-9A6C11",
  },
  {
    id: "msg-5",
    date: "Mar 17, 2024",
    time: "01:30 PM",
    sender: "maria.santos",
    text: "Returning to base. Sector 7 clear.",
    senderZoneId: "ZN-7D2B9F",
  },
];

export default function Messages() {
  const [activeZone, setActiveZone] = useState<string>("all");

  const zoneOptions = useMemo(
    () => [
      { id: "all", name: "All zones" },
      ...Array.from(new Set(sampleMessages.map((m) => m.senderZoneId))).map(
        (id) => ({ id, name: id }),
      ),
    ],
    [],
  );

  const filteredMessages = useMemo(() => {
    return activeZone === "all"
      ? sampleMessages
      : sampleMessages.filter((message) => message.senderZoneId === activeZone);
  }, [activeZone]);

  return (
    <section className="space-y-8 p-8">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/90 px-4 py-3">
        <Smartphone
          className="h-5 w-5 shrink-0 text-orange-400"
          strokeWidth={2}
          aria-hidden
        />
        <p className="text-sm text-slate-300">
          <span className="font-medium text-slate-200">
            Messaging is active on mobile.
          </span>{" "}
          <span className="text-slate-500">Web view is read-only.</span>
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          In-Zone Messages
        </h1>
        <div className="sm:text-right">
          <label
            htmlFor="messages-zone-filter"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.3em] text-slate-500"
          >
            Filter zone
          </label>
          <select
            id="messages-zone-filter"
            value={activeZone}
            onChange={(event) => setActiveZone(event.target.value)}
            className="w-full min-w-[12rem] rounded-md border border-[#00E5D1]/45 bg-slate-950/90 px-4 py-2.5 text-sm font-medium text-slate-100 shadow-glow outline-none transition hover:border-[#00E5D1]/70 focus:border-[#00E5D1] focus:ring-1 focus:ring-[#00E5D1]/40 sm:w-auto"
          >
            {zoneOptions.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-800/80 bg-slate-950/80 p-6 shadow-glow">
        {filteredMessages.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            No messages for the selected zone.
          </div>
        ) : (
          <ul className="space-y-6">
            {filteredMessages.map((item, index) => {
              const showDate =
                index === 0 ||
                item.date !== filteredMessages[index - 1]?.date;
              return (
                <li key={item.id} className="space-y-4">
                  {showDate ? (
                    <div className="flex justify-center">
                      <span className="rounded-full bg-slate-900/95 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                        {item.date}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00E5D1]/10">
                      <MessageCircle
                        className="h-5 w-5 text-[#00E5D1]"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                        <span className="font-semibold text-white">
                          {item.sender}
                        </span>
                        <span className="text-slate-500">{item.time}</span>
                        <span className="font-medium text-[#00E5D1]">
                          {item.senderZoneId}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-400">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
