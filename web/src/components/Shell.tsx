import { NavLink, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme, type ThemePref } from "../lib/theme";
import { Toaster } from "./Toaster";

const NAV = [
  { to: "/", label: "Today", icon: TodayIcon },
  { to: "/review", label: "Review", icon: ReviewIcon },
  { to: "/goals", label: "Goals", icon: GoalIcon },
  { to: "/health", label: "Health", icon: HeartIcon },
  { to: "/profile", label: "Profile", icon: PersonIcon },
];

export function Shell({ onReplaySplash }: { onReplaySplash: () => void }) {
  return (
    <div className="min-h-full bg-paper">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-paper px-4 py-6 md:flex">
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
                `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "text-ink" : "text-ink-3 hover:bg-paper-2 hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-xl bg-paper-3" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <n.icon className="h-[18px] w-[18px]" />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <ThemeSwitch />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/80 px-4 py-3 backdrop-blur md:hidden">
        <button onClick={onReplaySplash} className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold tracking-tight">Sentience</span>
        </button>
        <ThemeSwitch compact />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:pb-12 md:pl-[17rem] md:pr-8 md:pt-10">
        <Outlet />
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-paper/90 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium ${isActive ? "text-ink" : "text-ink-3"}`}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <Toaster />
    </div>
  );
}

function ThemeSwitch({ compact }: { compact?: boolean }) {
  const { pref, setPref } = useTheme();
  const opts: { v: ThemePref; label: string; icon: string }[] = [
    { v: "light", label: "Light", icon: "☀️" },
    { v: "system", label: "Auto", icon: "◐" },
    { v: "dark", label: "Dark", icon: "☾" },
  ];
  return (
    <div className={`inline-flex rounded-full border border-line bg-paper-2 p-1 ${compact ? "" : "w-full"}`} role="radiogroup" aria-label="Theme">
      {opts.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={pref === o.v}
          onClick={() => setPref(o.v)}
          className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${pref === o.v ? "text-ink" : "text-ink-3 hover:text-ink"}`}
        >
          {pref === o.v && <motion.span layoutId={compact ? "theme-pill-m" : "theme-pill"} className="absolute inset-0 rounded-full bg-paper shadow-soft" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          <span className="relative">{o.icon}</span>
          {!compact && <span className="relative">{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" className="fill-ink" />
      <path d="M14 36c6 0 6-12 12-12s6 24 12 24 6-16 12-16" fill="none" className="stroke-paper" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type IconProps = { className?: string };
function TodayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function ReviewIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15l3-4 3 2 4-6" />
    </svg>
  );
}
function GoalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}
function HeartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12h4l2-5 3 10 2-6 2 3h5" />
    </svg>
  );
}
function PersonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
