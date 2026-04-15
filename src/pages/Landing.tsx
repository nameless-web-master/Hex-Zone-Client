import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Hexagon,
  CircleCheck,
  Users,
  User,
  Lock,
  Code2,
  Bell,
  QrCode,
  Radio,
} from "lucide-react";

const apiEndpointPreview: { method: "GET" | "POST" | "PUT"; path: string }[] = [
  { method: "GET", path: "/users/login" },
  { method: "POST", path: "/users" },
  { method: "GET", path: "/users/{u}/devices" },
  { method: "PUT", path: "/devices/{id}/setting" },
  { method: "GET", path: "/alerts/devices/{id}" },
  { method: "POST", path: "/alerts/devices/{id}" },
];

function methodBadgeClass(method: "GET" | "POST" | "PUT") {
  switch (method) {
    case "GET":
      return "bg-white text-blue-600";
    case "POST":
      return "bg-emerald-100/95 text-emerald-900";
    case "PUT":
      return "bg-amber-100 text-amber-900";
  }
}

const developerFeatures: {
  title: string;
  description: string;
  icon: LucideIcon;
  iconWrap: string;
  cardClass?: string;
}[] = [
  {
    title: "H3 Hexagonal Indexing",
    description:
      "Earth's surface divided into hex cells. Each user gets 3 acceptable zones at resolution 13 – precise enough for city blocks.",
    icon: Hexagon,
    iconWrap: "border border-sky-500/45 bg-sky-500/10 text-sky-300",
  },
  {
    title: "Private Networks",
    description:
      "Many users, one device each. Everyone shares the same zone type. Perfect for delivery teams, security patrols, or family tracking.",
    icon: User,
    iconWrap: "border border-violet-500/45 bg-violet-500/10 text-violet-300",
  },
  {
    title: "Exclusive Access",
    description:
      "Solo deployment. One user, one device, any zone type you need. Full flexibility for individual use cases.",
    icon: Lock,
    iconWrap: "border border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
    cardClass:
      "border-[#00E5D1]/35 bg-gradient-to-br from-teal-950/85 via-emerald-950/50 to-slate-950/90 shadow-[0_0_40px_-12px_rgba(0,229,209,0.22)]",
  },
  {
    title: "Developer First API",
    description:
      "REST endpoints for users, devices, alerts, and settings. Your mobile app talks directly to the zone server.",
    icon: Code2,
    iconWrap: "border border-orange-500/45 bg-orange-500/10 text-orange-300",
  },
  {
    title: "Real-time Alerts",
    description:
      "Zone entry, exit, geofence breaches, device offline. Store and retrieve alerts per device via API.",
    icon: Bell,
    iconWrap: "border border-rose-500/45 bg-rose-500/10 text-rose-300",
  },
  {
    title: "Scan to Join",
    description:
      "QR codes contain zone IDs. New users scan, enter their details, and they're automatically linked to your private zone.",
    icon: QrCode,
    iconWrap: "border border-indigo-500/45 bg-indigo-500/10 text-indigo-300",
  },
];

const networkCards = [
  {
    title: "Private Zone",
    label: "Active",
    users: 3,
    devices: 3,
    type: "H3 r13",
    accent: "bg-[#00E5D1]/10 text-[#00E5D1]",
  },
  {
    title: "Exclusive Zone",
    label: "Active",
    users: 1,
    devices: 1,
    type: "Geofence",
    accent: "bg-slate-800/80 text-slate-400",
  },
];

export default function Landing() {
  return (
    <section className="space-y-12">
      <div>
        <div className="grid gap-10 xl:grid-cols-[1.4fr_0.9fr] xl:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#00E5D1]/10 px-4 py-2 text-sm font-medium text-[#00E5D1]">
              <Hexagon size={16} /> REST API Ready
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold text-white sm:text-6xl">
                Weave Your Spatial Zones
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-400">
                A geospatial platform that bridges web and mobile. Define zones
                using H3 hexagonal indexing, connect devices via REST API, and
                track everything in real time.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-md bg-[#00E5D1] px-6 py-3 text-sm font-bold text-[#0B0E11] transition hover:brightness-110"
              >
                Create Account
              </Link>
              <Link
                to="/api"
                className="inline-flex items-center justify-center rounded-md border border-slate-700/80 px-6 py-3 text-sm text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
              >
                API Docs
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 text-sm text-slate-400">
              <div className="rounded-3xl bg-slate-900/80 p-4">H3 Indexing</div>
              <div className="rounded-3xl bg-slate-900/80 p-4">
                Mobile REST API
              </div>
              <div className="rounded-3xl bg-slate-900/80 p-4">
                QR Onboarding
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800/80 bg-slate-900/90 p-8 shadow-glow">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Zone Network
                </h2>
                <p className="text-sm text-slate-400">
                  Live status of your current network and API connectivity.
                </p>
              </div>
              <span className="rounded-md bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.2em] text-[#00E5D1]">
                Live
              </span>
            </div>
            <div className="space-y-4">
              {networkCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                        {card.title}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {card.type}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${card.accent}`}
                    >
                      {card.label}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-900/90 p-3">
                      {card.users} users
                    </div>
                    <div className="rounded-2xl bg-slate-900/90 p-3">
                      {card.devices} devices
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-3xl bg-slate-950/80 p-4 text-sm text-slate-400">
              <p className="font-medium text-white">
                Developer-friendly REST API
              </p>
              <p className="mt-2">
                Complete endpoint documentation with live request examples and
                response previews.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="">
        <div className="layer-card">
          <div className="pb-12 pt-16 px-8">
            <h2 className="text-2xl font-semibold text-white">
              How Zone Weaver Works
            </h2>
            <p className="mt-3 text-slate-400">
              From registration to real-time device tracking in three steps.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "Register",
                  description:
                    "Enter your name, address, and account type. Generate a zone ID or join an existing one.",
                },
                {
                  title: "Weave Zones",
                  description:
                    "Address data converts to H3 cells. Build and export zones in H3 or geofence mode.",
                },
                {
                  title: "Connect",
                  description:
                    "Mobile apps hit the REST API to sync devices, alerts, and zone state in real time.",
                },
              ].map((step, index) => (
                <div key={step.title} className="p-5 flex gap-4">
                  <p className="text-3xl font-bold text-[#00E5D1]">
                    0{index + 1}
                  </p>
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-slate-400">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="py-16 px-8">
          <h2 className="text-2xl font-semibold text-white">
            Pick Your Network Type
          </h2>
          <p className="mt-3 text-slate-400">
            Two models, built for different scales
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="flex flex-col rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-glow">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
                  <Users className="h-5 w-5 text-sky-300" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Private</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    Team coordination, family tracking, fleet management
                  </p>
                </div>
              </div>
              <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-slate-300">
                {[
                  "Many users allowed",
                  "1 device per user",
                  "Same zone type for all",
                  "3 acceptable zones per user",
                  "QR code invites",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CircleCheck
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#00E5D1]"
                      strokeWidth={2}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-[#00E5D1] px-5 py-3 text-sm font-bold text-[#0B0E11] transition hover:brightness-110"
              >
                Create Private Zone
              </Link>
            </div>

            <div className="flex flex-col rounded-3xl border border-orange-500/50 bg-slate-950/80 p-6 shadow-glow ring-1 ring-orange-500/20">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
                  <User className="h-5 w-5 text-amber-200" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Exclusive
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    Solo deployments, individual tracking, personal zones
                  </p>
                </div>
              </div>
              <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-slate-300">
                {[
                  "1 user only",
                  "1 device per user",
                  "Any zone type allowed",
                  "3 acceptable zones",
                  "Full flexibility",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CircleCheck
                      className="mt-0.5 h-5 w-5 shrink-0 text-orange-400"
                      strokeWidth={2}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-400"
              >
                Create Exclusive Zone
              </Link>
            </div>
          </div>
        </div>
        <div className="layer-card">
          <div className="pb-12 pt-16 px-8">
            <h2 className="text-2xl font-semibold text-white">
              Built for developers
            </h2>
            <p className="mt-3 max-w-3xl text-slate-400">
              Everything your mobile app needs to communicate with the zone
              server.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {developerFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className={`rounded-3xl border p-5 border-slate-800/80 bg-slate-950/80 shadow-glow`}
                  >
                    <div
                      className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${feature.iconWrap}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <h3 className="font-semibold text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="py-16 px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">
                REST API Endpoints
              </h2>
              <p className="max-w-xl text-slate-400">
                Your mobile app integrates with these endpoints. Authentication,
                user management, device settings, and alert handling.
              </p>
              <Link
                to="/api"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00E5D1] transition hover:brightness-110"
              >
                Explore full API <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-6 shadow-glow">
              <div className="mb-5 flex items-center gap-2">
                <Radio
                  className="h-4 w-4 shrink-0 text-[#00E5D1]"
                  strokeWidth={2}
                />
                <span className="text-sm font-medium text-white">
                  API Reference
                </span>
              </div>
              <ul className="divide-y divide-slate-800/90">
                {apiEndpointPreview.map((row) => (
                  <li
                    key={`${row.method}-${row.path}`}
                    className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      className={`inline-flex min-w-[3.25rem] justify-center rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${methodBadgeClass(row.method)}`}
                    >
                      {row.method}
                    </span>
                    <code className="font-mono text-sm text-white">
                      {row.path}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* CTA hero — full-bleed below API endpoints */}
        <div
          className="relative left-1/2 right-auto w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden border-t border-slate-800/60 bg-[#0B0E11]"
          aria-labelledby="ready-to-weave-heading"
        >
          <div
            className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-orange-500/15 blur-3xl"
            aria-hidden
          />
          <div className="flex flex-col">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:py-20">
              <Hexagon
                className="mb-8 h-14 w-14 text-[#00E5D1]"
                strokeWidth={1.25}
                aria-hidden
              />
              <h2
                id="ready-to-weave-heading"
                className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
                Ready to Weave?
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-slate-400 sm:text-lg">
                Create your zone network. Connect your devices. Start tracking.
              </p>
              <Link
                to="/register"
                className="mt-10 inline-flex items-center justify-center rounded-md bg-[#00E5D1] px-6 py-3 text-base font-bold text-[#0B0E11] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E5D1]"
              >
                Start Building Zones
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
