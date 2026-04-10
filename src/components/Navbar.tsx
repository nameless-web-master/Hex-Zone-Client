import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Activity, MapPin, Shield, Mail, Terminal, Sparkles } from 'lucide-react';

const appRoutes = [
  { path: '/dashboard', title: 'Dashboard', icon: Activity },
  { path: '/zone-builder', title: 'Zone Builder', icon: MapPin },
  { path: '/devices', title: 'Devices', icon: Shield },
  { path: '/messages', title: 'Messages', icon: Mail }
];

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const isLoggedIn = Boolean(token);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link to="/" className="flex items-center gap-3 text-teal-300">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900/90 shadow-glow">
            <div className="h-4 w-4 rounded-full bg-teal-500" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Zone Weaver</p>
            <p className="font-semibold">weave your spatial network</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/api"
            className="rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-2 text-sm text-slate-200 transition hover:border-teal-400/50 hover:text-teal-200"
          >
            <span className="inline-flex items-center gap-2">
              <Terminal size={14} /> API
            </span>
          </Link>

          {isLoggedIn ? (
            <>
              <nav className="hidden md:flex items-center gap-2">
                {appRoutes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `rounded-2xl px-4 py-2 text-sm transition ${
                          isActive ? 'bg-teal-500/15 text-teal-200' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                        }`
                      }
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon size={14} /> {item.title}
                      </span>
                    </NavLink>
                  );
                })}
              </nav>
              <button
                onClick={logout}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-2 text-sm text-slate-200 transition hover:border-teal-400/50 hover:text-teal-200"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-2 text-sm text-slate-200 transition hover:border-teal-400/50 hover:text-teal-200"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="rounded-2xl bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
              >
                Start Weaving
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
