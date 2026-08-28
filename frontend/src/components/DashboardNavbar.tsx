import { useState } from "react";
import type { ReactNode } from "react";
import {
  ChartIcon,
  ChevronDown,
  HistoryIcon,
  HomeIcon,
  LogoIcon,
  MenuIcon,
  CloseIcon,
  TemplateIcon,
} from "./icons";

export type NavKey = "dashboard" | "history" | "templates" | "reports";

interface DashboardNavbarProps {
  active: NavKey | null;
  userName: string;
  userEmail: string;
  onNavigate: (to: NavKey) => void;
  onSignOut: () => void;
}

const NAV_ITEMS: { key: NavKey; label: string; icon: (c: { className?: string }) => ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: HomeIcon },
  { key: "history", label: "History", icon: HistoryIcon },
  { key: "templates", label: "Templates", icon: TemplateIcon },
  { key: "reports", label: "Reports", icon: ChartIcon },
];

function initials(name: string) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function DashboardNavbar({
  active,
  userName,
  userEmail,
  onNavigate,
  onSignOut,
}: DashboardNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const activeLabel = NAV_ITEMS.find((n) => n.key === active)?.label ?? "Dashboard";

  const navigate = (to: NavKey) => {
    setMobileOpen(false);
    setProfileOpen(false);
    onNavigate(to);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate("dashboard")}
            className="flex items-center gap-3 text-left shrink-0"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white shadow-sm">
              <LogoIcon className="w-5 h-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-slate-900">
                DocuVerify
              </span>
              <span className="hidden lg:block text-[11px] text-slate-500 font-medium">
                Intelligent Document Authenticity &amp; Forgery Detection
              </span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => navigate(key)}
                aria-current={active === key ? "page" : undefined}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active === key
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                  {initials(userName)}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                />
              </button>
              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 z-20 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-800">{userName}</p>
                      <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                    </div>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onSignOut();
                      }}
                      className="mt-1 w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-200 bg-white px-4 py-2">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {activeLabel}
          </p>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => navigate(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                active === key
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}