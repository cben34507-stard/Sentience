import { useEffect, useState } from "react";
import type { ReminderDose } from "@sentience/shared";
import { api } from "./api";

const KEY = "sentience.notify";

export type NotifyState = "unsupported" | "insecure" | "off" | "denied" | "on";

/** Browsers only allow notifications on HTTPS (or localhost). */
export function notifyState(): NotifyState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (Notification.permission === "denied") return "denied";
  let wanted = false;
  try {
    wanted = localStorage.getItem(KEY) === "1";
  } catch {
    /* ignore */
  }
  return Notification.permission === "granted" && wanted ? "on" : "off";
}

export async function setNotify(on: boolean): Promise<NotifyState> {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (on && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  window.dispatchEvent(new Event("sentience:notify"));
  return notifyState();
}

export function useNotifyState(): NotifyState {
  const [s, setS] = useState<NotifyState>(notifyState);
  useEffect(() => {
    const h = () => setS(notifyState());
    window.addEventListener("sentience:notify", h);
    return () => window.removeEventListener("sentience:notify", h);
  }, []);
  return s;
}

/**
 * While a Sentience tab is open, pops a notification when a dose comes due.
 * Mounted once in the shell. Closed tab = no notifications; the calendar
 * export covers that case.
 */
export function useReminderNotifications(): void {
  const state = useNotifyState();
  useEffect(() => {
    if (state !== "on") return;
    let timers: number[] = [];
    const fired = new Set<string>();
    const schedule = (doses: ReminderDose[]) => {
      timers.forEach(clearTimeout);
      timers = [];
      for (const d of doses) {
        if (d.status !== "upcoming") continue;
        const ms = Date.parse(d.dueAt) - Date.now();
        if (ms < 0 || ms > 6 * 3600_000) continue;
        const k = `${d.reminderId}|${d.dueAt}`;
        timers.push(
          window.setTimeout(() => {
            if (fired.has(k)) return;
            fired.add(k);
            try {
              new Notification(d.title, { body: d.dose ? `${d.dose} · ${d.time}` : d.time, tag: k });
            } catch {
              /* some mobile browsers need a service worker for this; ignore */
            }
          }, ms),
        );
      }
    };
    const refresh = () => api.reminders.doses().then(schedule).catch(() => undefined);
    void refresh();
    const iv = window.setInterval(refresh, 10 * 60_000);
    window.addEventListener("sentience:doses", refresh);
    return () => {
      window.removeEventListener("sentience:doses", refresh);
      timers.forEach(clearTimeout);
      clearInterval(iv);
    };
  }, [state]);
}
