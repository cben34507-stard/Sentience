import { useEffect, useRef, useState } from "react";

export type WavePhase = "intro" | "expand" | "ambient";

interface Props {
  phase: WavePhase;
  isDark: boolean;
}

interface Params {
  span: number; // fraction of viewport width the bundle covers
  cy: number; // vertical centre in px
  amp: number; // vertical spread in px
  pinch: number; // 1 = ends converge to a point (timeline knot), 0 = open
  alpha: number; // strand opacity
  bg: number; // opacity of the paper fill painted under the strands
}

const STRANDS = 34;
const RIBBONS = 2;

function targets(phase: WavePhase, w: number, h: number): Params {
  const mobile = w < 768;
  switch (phase) {
    case "intro":
      return { span: Math.min(0.94, Math.max(380, Math.min(980, w * 0.62)) / w), cy: h / 2, amp: Math.min(h * 0.27, 230), pinch: 1, alpha: 1, bg: 1 };
    case "expand":
      return { span: 1.12, cy: h / 2, amp: Math.min(h * 0.3, 250), pinch: 0.15, alpha: 0.95, bg: 1 };
    case "ambient":
      return { span: 1.15, cy: mobile ? 10 : 18, amp: mobile ? 12 : 20, pinch: 0, alpha: 0.5, bg: 0 };
  }
}

/**
 * The Sentience strands: two twisting ribbons of thin lines, like timelines
 * braiding together. On first load they sit in the centre behind the
 * wordmark; on entry they stretch out to the left and right edges and settle
 * as a slow, always-moving band behind the page header.
 */
export function WaveField({ phase, isDark }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ p: Params | null; phase: WavePhase; dark: boolean }>({ p: null, phase, dark: isDark });
  const [onTop, setOnTop] = useState(phase !== "ambient");

  state.current.phase = phase;
  state.current.dark = isDark;

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let t = Math.random() * 100;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let top = state.current.phase !== "ambient";
    let lastDraw = 0;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const paper = () => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || (state.current.dark ? "#0b0b0c" : "#ffffff");

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const { phase: ph, dark } = state.current;
      // Ambient band runs at ~30fps to stay light on battery.
      if (ph === "ambient" && now - lastDraw < 32 && state.current.p && state.current.p.bg < 0.01) return;
      lastDraw = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) t += dt;

      const goal = targets(ph, w, h);
      const p = state.current.p ?? { ...goal };
      const speed = reduce ? 1e3 : ph === "expand" ? 2.6 : ph === "ambient" ? 2.2 : 3;
      const k = 1 - Math.exp(-dt * speed);
      const kBg = 1 - Math.exp(-dt * (ph === "ambient" ? 3.2 : 8));
      (Object.keys(goal) as (keyof Params)[]).forEach((key) => {
        p[key] += (goal[key] - p[key]) * (key === "bg" ? kBg : k);
      });
      state.current.p = p;

      const shouldTop = ph !== "ambient" || p.bg > 0.02;
      if (shouldTop !== top) {
        top = shouldTop;
        setOnTop(shouldTop);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (p.bg > 0.001) {
        ctx.globalAlpha = Math.min(1, p.bg);
        ctx.fillStyle = paper();
        ctx.fillRect(0, 0, w, h);
      }

      const spanW = p.span * w;
      const x0 = w / 2 - spanW / 2;
      const grad = ctx.createLinearGradient(x0, 0, x0 + spanW, 0);
      const stops = dark ? ["#3fd1c0", "#ff6f9a", "#ffad5c", "#9b8cff", "#3fd1c0"] : ["#14a394", "#e2507a", "#ee8a2f", "#6d5bd8", "#14a394"];
      stops.forEach((col, i) => grad.addColorStop(i / (stops.length - 1), col));
      ctx.strokeStyle = grad;
      ctx.lineWidth = dark ? 0.9 : 0.85;
      ctx.lineJoin = "round";

      const step = w < 768 ? 7 : 5;
      const n = Math.max(24, Math.ceil(spanW / step));
      for (let r = 0; r < RIBBONS; r++) {
        const dir = r === 0 ? 1 : -1;
        for (let i = 0; i < STRANDS; i++) {
          const theta = (i / STRANDS) * Math.PI;
          ctx.globalAlpha = p.alpha * (0.28 + 0.72 * Math.abs(Math.sin(theta + r * 0.7))) * (r === 0 ? 1 : 0.8);
          ctx.beginPath();
          for (let j = 0; j <= n; j++) {
            const s = j / n;
            const x = x0 + s * spanW;
            const knot = Math.pow(Math.sin(Math.PI * s), 0.85);
            const env = (p.pinch * knot + (1 - p.pinch)) * (0.78 + 0.22 * Math.sin(2 * Math.PI * 0.55 * s + t * 0.21 + r));
            const phi = 2 * Math.PI * (1.15 * s + r * 0.5) + t * 0.5 * dir;
            const width = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.8 * s - t * 0.33 + r * 2.1);
            const drift = 0.32 * Math.sin(2 * Math.PI * 0.42 * s + t * 0.23 + r * 1.3);
            const y = p.cy + p.amp * env * (width * Math.cos(theta + phi) * 0.92 + drift);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: onTop ? 55 : 0,
        WebkitMaskImage: onTop ? undefined : "linear-gradient(to bottom, #000 0, #000 26px, transparent 52px)",
        maskImage: onTop ? undefined : "linear-gradient(to bottom, #000 0, #000 26px, transparent 52px)",
      }}
    />
  );
}
