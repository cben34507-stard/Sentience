import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "sentience.theme";

interface Ctx {
  pref: ThemePref;
  isDark: boolean;
  setPref: (p: ThemePref) => void;
}
const ThemeCtx = createContext<Ctx | null>(null);

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem(KEY) as ThemePref) || "system";
    } catch {
      return "system";
    }
  });
  const [sys, setSys] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e: MediaQueryListEvent) => setSys(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const isDark = pref === "dark" || (pref === "system" && sys);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const value = useMemo<Ctx>(
    () => ({
      pref,
      isDark,
      setPref: (p) => {
        setPrefState(p);
        try {
          localStorage.setItem(KEY, p);
        } catch {
          /* ignore */
        }
      },
    }),
    [pref, isDark],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme outside ThemeProvider");
  return c;
}
