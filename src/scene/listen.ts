// Listen: three breathing dot rings fed by simulated ambient energy (GS:683-697, GS:734-739),
// plus the shared dot-ring primitive and the pinch ripple (GS:1490-1521).
import {MotionTokens} from '../motion';
import {CREAM, rgba} from './palette';
import type {State} from './state';

export const RINGS_CY = 240;
const CREAM_FILL = rgba(CREAM, 1);

/** dotRing (GS:1514-1521) with every dot in one path and one fill (lit = 0 in the v2.1 flow). */
export function dotRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rad: number, alpha: number, rot = 0): void {
  if (alpha <= 0.003) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.fillStyle = CREAM_FILL;
  ctx.beginPath();
  const step = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + rot + i * step;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    ctx.moveTo(x + rad, y);
    ctx.arc(x, y, rad, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
}

const rnd = new Float64Array(512);
for (let j = 0; j < 512; j++) rnd[j] = ((j * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

function noise(t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const a = rnd[i & 511]!, b = rnd[(i + 1) & 511]!;
  return a + (b - a) * u;
}

/** Simulated ambient sound energy, smoothed ≥ 300 ms (updateEnergy, GS:683-691). */
export function stepListen(s: State, dt: number): void {
  const t = s.now / 1000;
  const k = 1 - Math.exp(-dt / 0.35);
  const raw0 = 0.25 + 0.6 * noise(t * 0.5);
  const raw1 = 0.2 + 0.65 * noise(t * 0.9 + 40);
  const raw2 = 0.15 + 0.7 * noise(t * 1.4 + 90);
  s.energy[0] = s.energy[0]! + (Math.min(1, Math.max(0, raw0)) - s.energy[0]!) * k;
  s.energy[1] = s.energy[1]! + (Math.min(1, Math.max(0, raw1)) - s.energy[1]!) * k;
  s.energy[2] = s.energy[2]! + (Math.min(1, Math.max(0, raw2)) - s.energy[2]!) * k;
  s.rings.forEach((r, i) => r.r.to(r.base + s.energy[i]! * 18, MotionTokens.Calm));
}

export function drawListen(ctx: CanvasRenderingContext2D, s: State): void {
  s.rings.forEach((r, i) => {
    const op = r.op.value;
    if (op <= 0.003) return;
    const rad = r.r.value;
    const n = Math.max(12, Math.round((2 * Math.PI * rad) / 16));
    dotRing(ctx, 300, RINGS_CY, rad, n, 1.8, op, ((i % 2 === 1 ? -1 : 1) * s.now) / 20000);
  });
}

/** Pinch ripples (drawRipples, GS:1490-1501). */
export function drawRipples(ctx: CanvasRenderingContext2D, s: State): void {
  for (const r of s.ripples) {
    for (let k = 0; k < 3; k++) {
      const t = (s.now - r.t0 - k * 170) / 1300;
      if (t < 0 || t > 1) continue;
      const e = 1 - Math.pow(1 - t, 3);
      const rad = (8 + 96 * e) * r.s;
      dotRing(ctx, r.x, r.y, rad, Math.max(10, Math.round((2 * Math.PI * rad) / 9)), 1.5, (1 - t) * 0.75);
    }
    const t0 = (s.now - r.t0) / 260;
    if (t0 < 1) {
      ctx.globalAlpha = 1 - t0;
      ctx.fillStyle = CREAM_FILL;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4 * (1 - t0) + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
