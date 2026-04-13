import { useEffect, useMemo, useState } from 'react';
import { fetchZones, fetchDevices, type DeviceResponse } from '../lib/api';
import { MessageCircle, Filter } from 'lucide-react';

interface Zone {
  id: number;
  name: string;
  zone_type: string;
  description?: string;
}

type Device = Pick<
  DeviceResponse,
  'id' | 'name' | 'hid' | 'h3_cell_id' | 'active'
>;

interface MessageItem {
  id: string;
  time: string;
  sender: string;
  text: string;
  zoneId: string;
}

const sampleMessages: MessageItem[] = [
  { id: 'msg-1', time: '8:15 PM', sender: 'alex.chen', text: 'Zone perimeter check completed. All sensors nominal.', zoneId: 'ZN-4F8A2C' },
  { id: 'msg-2', time: '8:17 PM', sender: 'maria.santos', text: 'Copy that. Moving to sector 7 for sweep.', zoneId: 'ZN-4F8A2C' },
  { id: 'msg-3', time: '8:22 PM', sender: 'alex.chen', text: 'Anomaly detected at cell 8d1a2b3c4d6ffff. Investigating.', zoneId: 'ZN-4F8A2C' },
  { id: 'msg-4', time: '8:25 PM', sender: 'james.kim', text: 'Standing by for support. Device online.', zoneId: 'ZN-4F8A2C' },
  { id: 'msg-5', time: '8:30 PM', sender: 'maria.santos', text: 'Returning to base. Sector 7 clear.', zoneId: 'ZN-4F8A2C' }
];

export default function Messages() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeZone, setActiveZone] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchZones(), fetchDevices()])
      .then(([zoneData, deviceData]) => {
        setZones(zoneData);
        setDevices(deviceData);
      })
      .catch(() => {
        setZones([]);
        setDevices([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const zoneOptions = useMemo(
    () => [{ id: 'all', name: 'All zones' }, ...zones.map((zone) => ({ id: zone.id.toString(), name: zone.name }))],
    [zones]
  );

  const filteredMessages = useMemo(() => {
    return activeZone === 'all'
      ? sampleMessages
      : sampleMessages.filter((message) => message.zoneId === activeZone);
  }, [activeZone]);

  const selectedZoneName = useMemo(() => {
    return activeZone === 'all' ? 'All zones' : zones.find((zone) => zone.id.toString() === activeZone)?.name || 'Unknown zone';
  }, [activeZone, zones]);

  return (
    <div className="grid gap-8 lg:grid-cols-[0.7fr_0.3fr]">
      <section className="layer-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-teal-300">In-Zone Messages</p>
            <h1 className="text-3xl font-semibold text-white">Message activity stream</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-3xl bg-slate-900/90 px-4 py-3 text-sm text-slate-300">
            <Filter size={16} /> Filter by zone
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-slate-800/80 bg-slate-950/90 p-6">
          <div className="mb-6 rounded-3xl bg-slate-900/90 p-4 text-slate-300">
            <p className="font-semibold text-white">Messaging is active on mobile.</p>
            <p className="mt-2">This web view is read-only and designed for message review and zone filtering.</p>
          </div>

          <div className="mb-6 flex items-center justify-between gap-4 rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Showing</p>
              <p className="text-lg font-semibold text-white">{selectedZoneName}</p>
            </div>
            <select
              value={activeZone}
              onChange={(event) => setActiveZone(event.target.value)}
              className="rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-sm text-slate-100"
            >
              {zoneOptions.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-6 text-slate-300">Loading messages…</div>
            ) : filteredMessages.length === 0 ? (
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-6 text-slate-300">No messages for the selected zone.</div>
            ) : (
              filteredMessages.map((item) => (
                <article key={item.id} className="rounded-3xl border border-slate-800/80 bg-slate-900/90 p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.sender}</p>
                      <p className="mt-2 text-slate-400">{item.text}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                      {item.zoneId} · {item.time}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <aside className="layer-card space-y-6">
        <div className="flex items-center gap-3 text-teal-300">
          <MessageCircle size={20} />
          <p className="text-sm uppercase tracking-[0.3em]">Zone filters</p>
        </div>
        <div className="space-y-3">
          {zoneOptions.map((zone) => (
            <button
              key={zone.id}
              type="button"
              onClick={() => setActiveZone(zone.id)}
              className={`w-full rounded-3xl px-4 py-3 text-left text-sm ${
                activeZone === zone.id ? 'bg-teal-500/15 text-teal-200' : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              {zone.name}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
