/**
 * The Sentience timeline: braided strands, drawn on a 2D canvas. Shared by
 * the intro, the ribbon along the top of each page, and the day timeline on
 * the home page.
 */

export interface StrandOptions {
  x0: number;
  span: number;
  cy: number;
  amp: number;
  /** Optional per-position amplitude multiplier (0..1+), s in [0,1]. */
  ampAt?: (s: number) => number;
  /** 1 = ends converge to a knot, 0 = open. */
  pinch: number;
  alpha: number;
  t: number;
  strands: number;
  ribbons: number;
  /** Horizontal sampling step in CSS px; larger is cheaper. */
  step: number;
  dark: boolean;
  lineWidth?: number;
}

const clampHue = (h: number) => Math.max(212, Math.min(292, h));

/**
 * Purple-to-blue palette whose hues drift slowly over time, so the threads
 * shift colour while they move. Hues stay inside 212°–292°.
 */
export function strandStops(t: number, dark: boolean): string[] {
  const sat = dark ? 82 : 72;
  const light = dark ? 68 : 54;
  const base = 252 + 22 * Math.sin(t * 0.13);
  const offsets = [-34, 12, -18, 34, -34];
  return offsets.map((o, i) => {
    const h = clampHue(base + o * Math.cos(t * 0.09 + i * 1.3));
    return `hsl(${h.toFixed(1)} ${sat}% ${light}%)`;
  });
}

export function drawStrands(ctx: CanvasRenderingContext2D, o: StrandOptions): void {
  const grad = ctx.createLinearGradient(o.x0, 0, o.x0 + o.span, 0);
  const stops = strandStops(o.t, o.dark);
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  ctx.strokeStyle = grad;
  ctx.lineWidth = o.lineWidth ?? (o.dark ? 0.9 : 0.85);
  ctx.lineJoin = "round";
  const n = Math.max(16, Math.ceil(o.span / o.step));
  const twoPi = Math.PI * 2;
  // Per-column terms are shared by every strand; compute them once.
  const env = new Float32Array(n + 1);
  const phi0 = new Float32Array(n + 1);
  const width = new Float32Array(n + 1);
  const drift = new Float32Array(n + 1);
  for (let r = 0; r < o.ribbons; r++) {
    const dir = r % 2 === 0 ? 1 : -1;
    for (let j = 0; j <= n; j++) {
      const s = j / n;
      const knot = Math.pow(Math.sin(Math.PI * s), 0.85);
      const a = o.ampAt ? o.ampAt(s) : 1;
      env[j] = (o.pinch * knot + (1 - o.pinch)) * (0.78 + 0.22 * Math.sin(twoPi * 0.55 * s + o.t * 0.21 + r)) * a;
      phi0[j] = twoPi * (1.15 * s + r * 0.5) + o.t * 0.5 * dir;
      width[j] = 0.55 + 0.45 * Math.sin(twoPi * 0.8 * s - o.t * 0.33 + r * 2.1);
      drift[j] = 0.32 * Math.sin(twoPi * 0.42 * s + o.t * 0.23 + r * 1.3);
    }
    for (let i = 0; i < o.strands; i++) {
      const theta = (i / o.strands) * Math.PI;
      ctx.globalAlpha = o.alpha * (0.28 + 0.72 * Math.abs(Math.sin(theta + r * 0.7))) * (r === 0 ? 1 : 0.8);
      ctx.beginPath();
      for (let j = 0; j <= n; j++) {
        const x = o.x0 + (j / n) * o.span;
        const y = o.cy + o.amp * env[j] * (width[j] * Math.cos(theta + phi0[j]) * 0.92 + drift[j]);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
