import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, MessageCircle, Sparkles, Cpu, Zap, Hexagon } from 'lucide-react';

const networkCards = [
  {
    title: 'Private Zone',
    label: 'Active',
    users: 3,
    devices: 3,
    type: 'H3 r13',
    accent: 'bg-teal-500/10 text-teal-200'
  },
  {
    title: 'Exclusive Zone',
    label: 'Active',
    users: 1,
    devices: 1,
    type: 'Geofence',
    accent: 'bg-slate-800/80 text-slate-400'
  }
];

export default function Landing() {
  return (
    <section className="space-y-12">
      <div className="layer-card overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950/95">
        <div className="grid gap-10 xl:grid-cols-[1.4fr_0.9fr] xl:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-200">
              <Hexagon size={16} /> REST API Ready
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold text-white sm:text-6xl">
                Weave Your Spatial Zones
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-400">
                A geospatial platform that bridges web and mobile. Define zones using H3 hexagonal indexing, connect devices via REST API, and track everything in real time.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-3xl bg-teal-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
              >
                Create Account
              </Link>
              <Link
                to="/api"
                className="inline-flex items-center justify-center rounded-3xl border border-slate-800/90 px-6 py-3 text-sm text-slate-200 transition hover:border-teal-400/60 hover:text-teal-100"
              >
                API Docs
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 text-sm text-slate-400">
              <div className="rounded-3xl bg-slate-900/80 p-4">H3 Indexing</div>
              <div className="rounded-3xl bg-slate-900/80 p-4">Mobile REST API</div>
              <div className="rounded-3xl bg-slate-900/80 p-4">QR Onboarding</div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800/80 bg-slate-900/90 p-8 shadow-glow">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Zone Network</h2>
                <p className="text-sm text-slate-400">Live status of your current network and API connectivity.</p>
              </div>
              <span className="rounded-2xl bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.2em] text-teal-300">Live</span>
            </div>
            <div className="space-y-4">
              {networkCards.map((card) => (
                <div key={card.title} className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{card.title}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{card.type}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${card.accent}`}>{card.label}</span>
                  </div>
                  <div className="mt-5 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-900/90 p-3">{card.users} users</div>
                    <div className="rounded-2xl bg-slate-900/90 p-3">{card.devices} devices</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-3xl bg-slate-950/80 p-4 text-sm text-slate-400">
              <p className="font-medium text-white">Developer-friendly REST API</p>
              <p className="mt-2">Complete endpoint documentation with live request examples and response previews.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="layer-card">
          <h2 className="text-2xl font-semibold text-white">How Zone Weaver Works</h2>
          <p className="mt-3 text-slate-400">From registration to real-time device tracking in three steps.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { title: 'Register', description: 'Enter your name, address, and account type. Generate a zone ID or join an existing one.' },
              { title: 'Weave Zones', description: 'Address data converts to H3 cells. Build and export zones in H3 or geofence mode.' },
              { title: 'Connect', description: 'Mobile apps hit the REST API to sync devices, alerts, and zone state in real time.' }
            ].map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5">
                <p className="text-sm text-teal-300">0{index + 1}</p>
                <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="layer-card">
          <h2 className="text-2xl font-semibold text-white">Built for developers</h2>
          <p className="mt-3 text-slate-400">Everything your mobile and web apps need to communicate with the zone server.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { title: 'H3 Hexagonal Indexing', description: 'Precise zone shapes at city-block resolution.' },
              { title: 'Private Networks', description: 'Many users, one device each, shared zone access.' },
              { title: 'Exclusive Access', description: 'Solo deployments with flexible zone definitions.' },
              { title: 'Developer First API', description: 'REST endpoints for users, devices, alerts and settings.' },
              { title: 'Real-time Alerts', description: 'Zone entry, exit and geofence events in a single feed.' },
              { title: 'Scan to Join', description: 'Zone IDs and QR codes make onboarding fast.' }
            ].map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5">
                <p className="font-semibold text-white">{feature.title}</p>
                <p className="mt-2 text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
