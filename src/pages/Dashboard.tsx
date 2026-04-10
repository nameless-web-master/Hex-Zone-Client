import { useEffect, useMemo, useState } from 'react';
import { fetchDevices, fetchZones } from '../lib/api';
import { BarChart3, MapPin, Shield, Sparkles } from 'lucide-react';

export default function Dashboard() {
  const [devices, setDevices] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
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

  const online = useMemo(() => devices.filter((device) => device.active).length, [devices]);
  const offline = useMemo(() => devices.filter((device) => !device.active).length, [devices]);
  const alertCount = useMemo(() => Math.max(0, zones.length - 1), [zones]);

  return (
    <div className="space-y-8">
      <section className="layer-card">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Dashboard overview</p>
            <h1 className="text-3xl font-semibold text-white">Your zone operations at a glance.</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Monitor device health, active zones, and live API activity from a single command center.
            </p>
          </div>
          <div className="rounded-[2rem] border border-slate-800/80 bg-slate-900/90 p-6 shadow-glow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Fleet health</p>
                <p className="text-2xl font-semibold text-white">{loading ? '–' : `${online}/${devices.length}`}</p>
              </div>
              <div className="rounded-3xl bg-teal-500/15 px-4 py-2 text-sm text-teal-200">Live sync</div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Online devices</p>
                <p className="mt-2 text-xl font-semibold text-white">{online}</p>
              </div>
              <div className="rounded-3xl bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Offline devices</p>
                <p className="mt-2 text-xl font-semibold text-white">{offline}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="layer-card flex items-center gap-4 p-6">
          <div className="rounded-3xl bg-teal-500/10 p-4 text-teal-300">
            <MapPin size={26} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Active zones</p>
            <p className="mt-2 text-3xl font-semibold text-white">{loading ? '–' : zones.length}</p>
          </div>
        </div>
        <div className="layer-card flex items-center gap-4 p-6">
          <div className="rounded-3xl bg-teal-500/10 p-4 text-teal-300">
            <Shield size={26} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Device inventory</p>
            <p className="mt-2 text-3xl font-semibold text-white">{loading ? '–' : devices.length}</p>
          </div>
        </div>
        <div className="layer-card flex items-center gap-4 p-6">
          <div className="rounded-3xl bg-teal-500/10 p-4 text-teal-300">
            <BarChart3 size={26} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Pending alerts</p>
            <p className="mt-2 text-3xl font-semibold text-white">{loading ? '–' : alertCount}</p>
          </div>
        </div>
      </section>

      <section className="layer-card grid gap-6 xl:grid-cols-[0.7fr_0.3fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Operations map</p>
              <h2 className="text-xl font-semibold text-white">Zone heatmap preview</h2>
            </div>
            <span className="rounded-full bg-slate-950/80 px-3 py-2 text-xs text-slate-400">Interactive</span>
          </div>
          <div className="aspect-[16/9] rounded-[2rem] bg-slate-950/90 p-6 text-slate-400">
            <p className="text-sm leading-7">The Zone Builder page renders the actual H3 mesh and geofence boundaries for your current network.</p>
          </div>
        </div>
        <div className="space-y-4 rounded-[2rem] border border-slate-800/80 bg-slate-950/90 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Recent activity</p>
          <div className="space-y-3">
            <div className="rounded-3xl bg-slate-900/80 p-4">
              <p className="text-sm text-slate-400">New zone created</p>
              <p className="mt-2 text-white">{loading ? '—' : zones[0]?.name || 'No zones yet'}</p>
            </div>
            <div className="rounded-3xl bg-slate-900/80 p-4">
              <p className="text-sm text-slate-400">Device updates</p>
              <p className="mt-2 text-white">{loading ? '—' : `${online} online · ${offline} offline`}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
