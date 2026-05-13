import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  MapPin,
  Shield,
  Mail,
  Terminal,
  QrCode,
  Users,
  ScanLine,
  Ticket,
  LayoutDashboard,
  MessageSquare,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { clearGuestAccessSession, getGuestAccessToken } from "../lib/guestAccessToken";

const appRoutes = [
  { path: "/dashboard", title: "Dashboard", icon: MapPin },
  { path: "/devices", title: "Devices", icon: Shield },
  { path: "/messages", title: "Messages", icon: Mail },
  { path: "/members", title: "Members", icon: Users },
  { path: "/guest-passes", title: "Guest Passes", icon: Ticket },
  { path: "/guest-access-qr", title: "Guest QR", icon: ScanLine },
  { path: "/qr", title: "QR invite", icon: QrCode },
];

const guestRoutes = [
  { path: "/guest/dashboard", title: "Guest dashboard", icon: LayoutDashboard },
  { path: "/guest/messages", title: "Guest messages", icon: MessageSquare },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, token, logout } = useAuth();
  const guestToken = getGuestAccessToken();
  const guestSessionActive = Boolean(guestToken);
  const isLoggedIn = Boolean(token);
  const isPrivateAdministrator =
    String(user?.role ?? "").toLowerCase() === "administrator" &&
    String(user?.accountType ?? user?.account_type ?? "").toUpperCase() ===
      "PRIVATE";
  const isAdministrator =
    String(user?.role ?? "").toLowerCase() === "administrator";
  const visibleAppRoutes = appRoutes.filter((route) => {
    if (route.path === "/qr") return isPrivateAdministrator;
    if (route.path === "/guest-access-qr") return isAdministrator;
    return true;
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-4 py-2 text-sm transition ${
      isActive
        ? "bg-[#00E5D1]/15 font-medium text-[#00E5D1]"
        : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
    }`;

  const dropdownLinkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition ${
      isActive
        ? "bg-[#00E5D1]/15 font-medium text-[#00E5D1]"
        : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
    }`;

  return (
    <header className="border-b border-slate-800/80 bg-transparent backdrop-blur-xl fixed w-full z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
        <Link
          to="/"
          className="group flex items-center gap-3 transition hover:opacity-95"
        >
          <div className="grid h-11 w-11 place-items-center rounded-md border-2 border-[#00E5D1]/80 bg-[#0B0E11]/40 shadow-[0_0_24px_-8px_rgba(0,229,209,0.35)]">
            <div className="h-4 w-4 rounded-full bg-[#00E5D1] transition group-hover:brightness-110" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Zone Weaver
            </p>
            <p className="font-semibold text-white group-hover:text-[#00E5D1]">
              weave your spatial network
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/api"
            className="rounded-md border border-slate-700/80 bg-[#151a20]/90 px-4 py-2 text-sm text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
          >
            <span className="inline-flex items-center gap-2">
              <Terminal size={14} /> API
            </span>
          </Link>

          {guestSessionActive ? (
            <>
              <nav className="hidden md:flex items-center gap-2">
                {guestRoutes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.path} to={item.path} className={navLinkCls}>
                      <span className="inline-flex items-center gap-2">
                        <Icon size={14} /> {item.title}
                      </span>
                    </NavLink>
                  );
                })}
              </nav>
              <button
                type="button"
                onClick={() => {
                  clearGuestAccessSession();
                  navigate("/access", { replace: true });
                }}
                className="hidden md:inline-flex rounded-md border border-slate-700/80 bg-[#151a20]/90 px-4 py-2 text-sm text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut size={14} /> Guest logout
                </span>
              </button>
            </>
          ) : isLoggedIn ? (
            <>
              <nav className="hidden md:flex items-center gap-2">
                {visibleAppRoutes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.path} to={item.path} className={navLinkCls}>
                      <span className="inline-flex items-center gap-2">
                        <Icon size={14} /> {item.title}
                      </span>
                    </NavLink>
                  );
                })}
              </nav>
              <button
                type="button"
                onClick={() => { void logout(); }}
                className="hidden md:inline-flex rounded-md border border-slate-700/80 bg-[#151a20]/90 px-4 py-2 text-sm text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md border border-slate-700/80 bg-[#151a20]/90 px-4 py-2 text-sm text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-[#00E5D1] px-4 py-2 text-sm font-bold text-[#0B0E11] transition hover:brightness-110"
              >
                Start Weaving
              </Link>
            </>
          )}

          {/* Mobile hamburger — shown when there are nav links to display */}
          {(guestSessionActive || isLoggedIn) && (
            <div className="relative md:hidden" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-md border border-slate-700/80 bg-[#151a20]/90 p-2 text-slate-200 transition hover:border-[#00E5D1]/50 hover:text-[#00E5D1]"
                aria-label="Toggle navigation menu"
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>

              {menuOpen && (
                <nav className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-slate-700/80 bg-[#0B0E11]/95 p-2 shadow-xl backdrop-blur-xl">
                  {guestSessionActive ? (
                    <>
                      {guestRoutes.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink key={item.path} to={item.path} className={dropdownLinkCls}>
                            <Icon size={14} /> {item.title}
                          </NavLink>
                        );
                      })}
                      <div className="my-1.5 border-t border-slate-800/80" />
                      <button
                        type="button"
                        onClick={() => {
                          clearGuestAccessSession();
                          navigate("/access", { replace: true });
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
                      >
                        <LogOut size={14} /> Guest logout
                      </button>
                    </>
                  ) : (
                    <>
                      {visibleAppRoutes.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink key={item.path} to={item.path} className={dropdownLinkCls}>
                            <Icon size={14} /> {item.title}
                          </NavLink>
                        );
                      })}
                      <div className="my-1.5 border-t border-slate-800/80" />
                      <button
                        type="button"
                        onClick={() => { void logout(); }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
                      >
                        <LogOut size={14} /> Sign out
                      </button>
                    </>
                  )}
                </nav>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
