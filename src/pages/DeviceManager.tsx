import { useEffect, useMemo, useState } from 'react';
import { fetchDevices } from '../lib/api';
import { BadgeCheck, CircleDot, Plus, Settings2 } from 'lucide-react';

interface Device {
  id: number;
  hid: string;
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  h3_cell_id?: string;
  active: boolean;
  updated_at?: string;
}

function statusText(active: boolean) {
  return active ? 'online' : 'offline';
}

export default function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<'name' | 'status' | 'lastSeen'>('lastSeen');

  useEffect(() => {
    fetchDevices()
      .then((data) => setDevices(data))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, []);

  const online = useMemo(
    () => devices.filter((d) => d.active).length,
    [devices],
  );
  const offline = useMemo(
    () => devices.filter((d) => !d.active).length,
    [devices],
  );

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortKey === 'status') {
        return Number(b.active) - Number(a.active);
      }
      const dateA = new Date(a.updated_at || 0).getTime();
      const dateB = new Date(b.updated_at || 0).getTime();
      return dateB - dateA;
    });
  }, [devices, sortKey]);

  const users = useMemo(() => {
    const grouped = new Map<string, { username: string; email: string; deviceId: string; status: string; zone: string }>();
    devices.forEach((device) => {
      const username = device.name || device.hid;
      const key = username.toLowerCase().replace(/\w/g, (match) => match.toUpperCase());
      if (!grouped.has(key)) {
        grouped.set(key, {
          username: key,
          email: `${key.toLowerCase().replace(/\s+/g, '.')}@zoneweaver.io`,
          deviceId: device.hid,
          status: device.active ? 'active' : 'inactive',
          zone: device.h3_cell_id || 'ZN-XXXXXX'
        });
      }
    });
    return Array.from(grouped.values()).slice(0, 5);
  }, [devices]);

  return (
    <div className="space-y-8">
      <section className="layer-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Account & Device Manager</p>
            <h1 className="text-3xl font-semibold text-white">Manage users, devices, and zone assignments.</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              See device status, last seen timestamps, and device configuration in one unified panel.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-3xl bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
          >
            <Plus size={16} /> Add User
          </button>
        </div>
      </section>

      <section className="layer-card bg-slate-950/90 p-6">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-5 text-slate-300">
          <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Account notice</p>
          <p className="mt-3 text-sm">
            All devices in a Private account must share the same zone type. Each user defines three acceptable zones based on H3 indexing (resolution ≥ 13).
          </p>
        </div>
      </section>

      <section className="layer-card overflow-hidden">
        <div className="min-w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
            <thead className="bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Device</th>
                <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Location</th>
                <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">H3 cell</th>
                <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Status</th>
                <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Last seen</th>
                <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td className="px-6 py-8 text-center" colSpan={6}>
                    Loading devices…
                  </td>
                </tr>
              ) : sortedDevices.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center" colSpan={6}>
                    No devices found. Ensure your API and login token are valid.
                  </td>
                </tr>
              ) : (
                sortedDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-900/80">
                    <td className="px-6 py-5">
                      <div className="font-semibold text-white">{device.name}</div>
                      <p className="text-xs text-slate-500">{device.hid}</p>
                    </td>
                    <td className="px-6 py-5 text-slate-300">{device.address || `${device.latitude?.toFixed(4)}, ${device.longitude?.toFixed(4)}`}</td>
                    <td className="px-6 py-5 text-slate-300">{device.h3_cell_id || '—'}</td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${device.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                        <CircleDot size={12} /> {statusText(device.active)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-slate-300">{device.updated_at ? new Date(device.updated_at).toLocaleString() : 'Unknown'}</td>
                    <td className="px-6 py-5">
                      <button className="inline-flex items-center gap-2 rounded-3xl bg-slate-800/90 px-4 py-2 text-xs text-teal-200 transition hover:bg-slate-700/90">
                        <Settings2 size={14} /> Settings
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.65fr_0.35fr]">
        <div className="layer-card">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-teal-300">User directory</p>
              <h2 className="text-xl font-semibold text-white">Assigned users</h2>
            </div>
            <span className="rounded-full bg-slate-950/80 px-3 py-2 text-xs text-slate-400">Auto-generated</span>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-slate-800/80 bg-slate-950/80">
            <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
              <thead className="bg-slate-950/90 text-slate-400">
                <tr>
                  <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Username</th>
                  <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Email</th>
                  <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Device</th>
                  <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Zone</th>
                  <th className="px-6 py-4 text-left font-medium uppercase tracking-[0.15em]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-slate-500" colSpan={5}>
                      No linked users available yet.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.username} className="hover:bg-slate-900/80">
                      <td className="px-6 py-5 text-white">{user.username}</td>
                      <td className="px-6 py-5 text-slate-300">{user.email}</td>
                      <td className="px-6 py-5 text-slate-300">{user.deviceId}</td>
                      <td className="px-6 py-5 text-slate-300">{user.zone}</td>
                      <td className="px-6 py-5 text-slate-300">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${user.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800/60 text-slate-300'}`}>
                          <BadgeCheck size={12} /> {user.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="layer-card rounded-[2rem] border border-slate-800/80 bg-slate-950/90 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Device summary</p>
          <div className="mt-6 grid gap-4">
            <div className="rounded-3xl bg-slate-900/80 p-4">
              <p className="text-sm text-slate-400">Total devices</p>
              <p className="mt-2 text-3xl font-semibold text-white">{devices.length}</p>
            </div>
            <div className="rounded-3xl bg-slate-900/80 p-4">
              <p className="text-sm text-slate-400">Active devices</p>
              <p className="mt-2 text-3xl font-semibold text-white">{online}</p>
            </div>
            <div className="rounded-3xl bg-slate-900/80 p-4">
              <p className="text-sm text-slate-400">Inactive devices</p>
              <p className="mt-2 text-3xl font-semibold text-white">{offline}</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
