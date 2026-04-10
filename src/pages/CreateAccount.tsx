import { FormEvent, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { addressToMockCoords, generateZoneId, getHexGrid, H3Cell } from '../lib/h3';

const accountOptions = [
  {
    value: 'private',
    title: 'Private',
    subtitle: 'Team coordination, fleet management',
    features: ['Many users allowed', '1 device per user', 'Shared zone type', '3 acceptable zones']
  },
  {
    value: 'exclusive',
    title: 'Exclusive',
    subtitle: 'Solo deployment, personal zones',
    features: ['1 user only', '1 device per user', 'Any zone type', 'Full flexibility']
  }
];

export default function CreateAccount() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'private' | 'exclusive'>('private');
  const [address, setAddress] = useState('350 Fifth Avenue, New York');
  const [zoneId, setZoneId] = useState(() => generateZoneId());
  const [useExistingZone, setUseExistingZone] = useState(false);
  const [existingZoneId, setExistingZoneId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const center = useMemo<[number, number]>(() => addressToMockCoords(address), [address]);
  const grid = useMemo<H3Cell[]>(() => getHexGrid(center, 13, 1), [center]);
  const selectedZoneId = useExistingZone && existingZoneId ? existingZoneId : zoneId;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        account_type: accountType,
        address,
        phone: phone || undefined,
        zone_id: selectedZoneId
      });
      navigate('/login');
    } catch (err) {
      setError('Could not create account. Please review your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-10 xl:grid-cols-[0.95fr_0.95fr]">
      <div className="layer-card">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Create Account</p>
          <h1 className="text-4xl font-semibold text-white">Launch your zone network with live H3 preview.</h1>
          <p className="max-w-2xl text-slate-400">
            Enter your details and watch the zone map update instantly as the address is converted to H3.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-300">First name</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300">Last name</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-slate-100"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-slate-100"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-300">Phone (optional)</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300">Address</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="350 Fifth Avenue, New York"
                required
                className="mt-2 w-full rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-slate-100"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-800/90 bg-slate-950/90 p-4">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Account type</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {accountOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAccountType(option.value as 'private' | 'exclusive')}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      accountType === option.value
                        ? 'border-teal-500/80 bg-teal-500/10 text-white'
                        : 'border-slate-800/70 bg-slate-900/80 text-slate-300 hover:border-teal-400/50'
                    }`}
                  >
                    <p className="font-semibold text-white">{option.title}</p>
                    <p className="mt-2 text-sm text-slate-400">{option.subtitle}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800/90 bg-slate-950/90 p-4">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Zone ID</p>
              <div className="mt-3 flex items-center gap-3">
                <input
                  value={selectedZoneId}
                  onChange={(event) => {
                    if (useExistingZone) setExistingZoneId(event.target.value);
                    else setZoneId(event.target.value);
                  }}
                  className="min-w-0 flex-1 rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-slate-100"
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                <button
                  type="button"
                  onClick={() => setUseExistingZone(false)}
                  className={`rounded-3xl px-4 py-2 transition ${
                    !useExistingZone ? 'bg-teal-500/15 text-teal-200' : 'bg-slate-900/80 hover:bg-slate-800/80'
                  }`}
                >
                  Generate New
                </button>
                <button
                  type="button"
                  onClick={() => setUseExistingZone(true)}
                  className={`rounded-3xl px-4 py-2 transition ${
                    useExistingZone ? 'bg-teal-500/15 text-teal-200' : 'bg-slate-900/80 hover:bg-slate-800/80'
                  }`}
                >
                  Enter Existing
                </button>
              </div>
              <button
                type="button"
                onClick={() => setZoneId(generateZoneId())}
                className="mt-4 rounded-3xl bg-slate-900/90 px-4 py-3 text-sm text-slate-100 transition hover:bg-slate-800/90"
              >
                Regenerate
              </button>
            </div>
          </div>

          {error && <p className="rounded-3xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-3xl bg-teal-500 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account & define zone'}
          </button>
        </form>
      </div>

      <div className="layer-card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Zone preview</p>
            <h2 className="text-xl font-semibold text-white">Live H3 cell map</h2>
          </div>
          <span className="rounded-2xl bg-slate-950/85 px-4 py-2 text-sm text-slate-300">Res 13</span>
        </div>
        <div className="h-[520px] rounded-[1.75rem] overflow-hidden border border-slate-800/90 bg-slate-950">
          <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            <Marker position={center}>
              <Popup>
                <div className="space-y-1 text-sm text-slate-900">
                  <p className="font-semibold">Preview location</p>
                  <p>{address}</p>
                </div>
              </Popup>
            </Marker>
            {grid.map((hex: H3Cell) => (
              <Polygon
                key={hex.id}
                positions={hex.polygon.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number])}
                pathOptions={{ color: '#20c997', weight: 1, fillColor: '#14b8a6', fillOpacity: 0.12 }}
              />
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
