import { useEffect, useRef, useState } from "react";
import { drawStrands, prefersReducedMotion } from "../lib/strands";

export type WavePhase = "intro" | "expand" | "ambient";

interface Props {
  phase: WavePhase;
  isDark: boolean;
  /** Hide the top ribbon (the home page shows its own timeline). */
  hideRibbon?: boolean;
}

interface Params {
  span: number;
  cy: number;
  amp: number;
  pinch: number;
  alpha: number;
  bg: number;
}

const RIBBON_H = 56;

function targets(phase: WavePhase, w: number, h: number): Params {
  const mobile = w < 768;
  switch (phase) {
    case "intro":
      return { span: Math.min(0.94, Math.max(380, Math.min(980, w * 0.62)) / w), cy: h / 2, amp: Math.min(h * 0.27, 230), pinch: 1, alpha: 1, bg: 1 };
    case "expand":
      return { span: 1.12, cy: h / 2, amp: Math.min(h * 0.3, 250), pinch: 0.15, alpha: 0.95, bg: 1 };
    case "ambient":
      return { span: 1.15, cy: mobile ? 10 : 18, amp: mobile ? 12 : 20, pinch: 0, alpha: 0.55, bg: 0 };
  }
}

/**
 * Intro and top ribbon. While the intro plays the canvas covers the screen;
 * once settled it shrinks to a 56px strip with fewer strands at ~24fps, and
 * stops entirely when the tab is hidden, so it costs very little.
 */
export function WaveField({ phase, isDark, hideRibbon }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ phase, dark: isDark, hideRibbon: !!hideRibbon });
  const [mode, setMode] = useState<"full" | "ribbon" | "off">(phase === "ambient" ? (hideRibbon ? "off" : "ribbon") : "full");

  state.current.phase = phase;
  state.current.dark = isDark;
  state.current.hideRibbon = !!hideRibbon;

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const reduce = prefersReducedMotion();
    let raf = 0;
    let last = performance.now();
    let lastDraw = 0;
    let t = 20 + Math.random() * 40;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let cur: "full" | "ribbon" | "off" = mode;
    let p: Params | null = null;

    const size = (m: "full" | "ribbon" | "off") => {
      dpr = Math.min(m === "full" ? 2 : 1.5, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = m === "full" ? window.innerHeight : RIBBON_H;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    };
    size(cur);
    const onResize = () => size(cur);
    window.addEventListener("resize", onResize);

    const paper = () => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#fff";

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const { phase: ph, dark, hideRibbon: hide } = state.current;
      const vh = window.innerHeight;
      const goal = targets(ph, w, vh);
      if (!p) p = { ...goal };

      // Decide which canvas mode we're in.
      const settled = ph === "ambient" && p.bg < 0.02 && Math.abs(p.cy - goal.cy) < 2;
      const want: typeof cur = !settled ? "full" : hide ? "off" : "ribbon";
      if (want !== cur) {
        cur = want;
        size(cur);
        setMode(cur);
      }
      if (cur === "off") return;

      const interval = cur === "ribbon" ? 42 : 0; // ~24fps for the ribbon
      if (now - lastDraw < interval) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      lastDraw = now;
      if (!reduce) t += dt;

      const speed = reduce ? 1e3 : ph === "expand" ? 2.6 : ph === "ambient" ? 2.2 : 3;
      const k = 1 - Math.exp(-dt * speed);
      const kBg = 1 - Math.exp(-dt * (ph === "ambient" ? 3.2 : 8));
      (Object.keys(goal) as (keyof Params)[]).forEach((key) => {
        p![key] += (goal[key] - p![key]) * (key === "bg" ? kBg : k);
      });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (cur === "full" && p.bg > 0.001) {
        ctx.globalAlpha = Math.min(1, p.bg);
        ctx.fillStyle = paper();
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      // While fading into the app on the home page, let the strands dissolve
      // instead of flying to the top.
      const alpha = ph === "ambient" && hide ? p.alpha * Math.min(1, p.bg * 3) : p.alpha;
      const spanW = p.span * w;
      const ribbon = cur === "ribbon";
      drawStrands(ctx, {
        x0: w / 2 - spanW / 2,
        span: spanW,
        cy: p.cy,
        amp: p.amp,
        pinch: p.pinch,
        alpha,
        t,
        strands: ribbon ? 12 : w < 768 ? 22 : 32,
        ribbons: 2,
        step: ribbon ? 10 : w < 768 ? 7 : 5,
        dark,
      });
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvas}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0"
      style={{
        zIndex: mode === "full" ? 55 : 0,
        display: mode === "off" ? "none" : "block",
        WebkitMaskImage: mode === "ribbon" ? "linear-gradient(to bottom, #000 0, #000 26px, transparent 52px)" : undefined,
        maskImage: mode === "ribbon" ? "linear-gradient(to bottom, #000 0, #000 26px, transparent 52px)" : undefined,
      }}
    />
  );
}
