import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useOutlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Apple, Bell, ChartLine, CircleUser, Clock, Ellipsis, FlaskConical, GitCompareArrows, HeartPulse, Monitor, Moon, Settings as SettingsIcon, Sun, Target, type LucideIcon } from "lucide-react";
import { useReminderNotifications } from "../lib/notify";
import { useTheme, type ThemePref } from "../lib/theme";
import { Toaster } from "./Toaster";
import { ErrorBoundary } from "./ErrorBoundary";

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Today", icon: Clock },
  { to: "/review", label: "Review", icon: ChartLine },
  { to: "/explore", label: "Explore", icon: GitCompareArrows },
  { to: "/food", label: "Food", icon: Apple },
  { to: "/tests", label: "Tests", icon: FlaskConical },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/profile", label: "Profile", icon: CircleUser },
];

export function Shell({ onReplaySplash }: { onReplaySplash: () => void }) {
  const location = useLocation();
  const outlet = useOutlet();
  // Block body on purpose: newer browsers return a Promise from scrollTo, and an
  // effect that returns anything but a function crashes React on the next route.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  useReminderNotifications();

  return (
    <div className="relative z-10 min-h-full">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-paper/75 px-4 py-6 backdrop-blur-xl md:flex">
        <button onClick={onReplaySplash} className="group flex items-center gap-2 px-2 text-left" title="Replay intro">
          <Logo />
          <span className="text-lg font-semibold tracking-[-0.03em]">Sentience</span>
        </button>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive ? "text-ink" : "text-ink-3 hover:bg-paper-2 hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-xl bg-paper-3" transition={{ type: "spring", stiffness: 380, damping: 34 }} />}
                  <n.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-paper-3 text-ink" : "text-ink-3 hover:bg-paper-2 hover:text-ink"}`}>
            <SettingsIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            Settings
          </NavLink>
          <ThemeSwitch />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <button onClick={onReplaySplash} className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold tracking-tight">Sentience</span>
        </button>
        <div className="flex items-center gap-2">
          <NavLink to="/settings" className="btn-ghost h-9 w-9 rounded-full p-0" aria-label="Settings">
            <SettingsIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </NavLink>
          <ThemeSwitch compact />
        </div>
      </header>

      <main className="w-full px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pl-[17rem] md:pr-8 md:pt-10 xl:pr-10 2xl:pl-[18rem] 2xl:pr-14">
        {/* CSS rather than AnimatePresence: an exit animation that never reports
            finishing (throttled tab, dropped WAAPI animation) used to leave the
            page blank until a reload. A keyed enter animation can't block. */}
        <div key={location.pathname} className="page-enter">
          <ErrorBoundary key={location.pathname}>{outlet}</ErrorBoundary>
        </div>
      </main>

      {/* Mobile tab bar: the most used five, the rest under More */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-paper/85 px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl md:hidden">
        {MOBILE_MAIN.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors ${isActive ? "text-ink" : "text-ink-3"}`}>
            <n.icon className="h-5 w-5" strokeWidth={1.8} />
            {n.label}
          </NavLink>
        ))}
        <MoreMenu active={MOBILE_MORE.some((n) => location.pathname.startsWith(n.to))} />
      </nav>
      <Toaster />
    </div>
  );
}

const MOBILE_MAIN_PATHS = ["/", "/food", "/tests", "/reminders"];
const MOBILE_MAIN = NAV.filter((n) => MOBILE_MAIN_PATHS.includes(n.to));
const MOBILE_MORE = [...NAV.filter((n) => !MOBILE_MAIN_PATHS.includes(n.to)), { to: "/settings", label: "Settings", icon: SettingsIcon }];

function MoreMenu({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  return (
    <>
      <button ref={btn} onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium ${active || open ? "text-ink" : "text-ink-3"}`}>
        <Ellipsis className="h-5 w-5" strokeWidth={1.8} />
        More
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
            <div className="absolute bottom-[calc(max(env(safe-area-inset-bottom),8px)+64px)] right-3 w-56 rounded-2xl border border-line bg-paper p-1.5 shadow-pop" onClick={(e) => e.stopPropagation()}>
              {MOBILE_MORE.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "bg-paper-3 text-ink" : "text-ink-2"}`}>
                  <n.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  {n.label}
                </NavLink>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function ThemeSwitch({ compact }: { compact?: boolean }) {
  const { pref, setPref } = useTheme();
  const opts: { v: ThemePref; label: string; icon: LucideIcon }[] = [
    { v: "light", label: "Light", icon: Sun },
    { v: "system", label: "Auto", icon: Monitor },
    { v: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <div className={`inline-flex rounded-full border border-line bg-paper-2 p-1 ${compact ? "" : "w-full"}`} role="radiogroup" aria-label="Theme">
      {opts.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={pref === o.v}
          aria-label={o.label}
          onClick={() => setPref(o.v)}
          className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-medium transition-colors ${compact ? "px-3" : "px-1.5"} ${pref === o.v ? "text-ink" : "text-ink-3 hover:text-ink"}`}
        >
          {pref === o.v && <motion.span layoutId={compact ? "theme-pill-m" : "theme-pill"} className="absolute inset-0 rounded-full bg-paper shadow-soft" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          <o.icon className="relative h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          {!compact && <span className="relative truncate">{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" className="fill-ink" />
      <path d="M10 32c7-10 13-10 22 0s15 10 22 0" fill="none" className="stroke-paper" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M10 32c7 10 13 10 22 0s15-10 22 0" fill="none" className="stroke-paper" strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
