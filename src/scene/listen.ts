// Listen, Figma 8.1 (drawListen, GS:1492-1507): the ear (white, over its grey inner shape with a
// dotted outline) inside a dotted circle with four glowing dots on it. The frame has no motion; the
// dots drift slowly round the circle and swell a little with the room's (simulated) sound energy.
// Also the shared dot-ring primitive and the pinch ripple (GS:1490-1521 of the baseline).
import {CREAM, DOT_GLOW_17, rgba} from './palette';
import {EAR_PATH, EAR_V4_PATH} from './paths';
import {blit, drawGlowDot, glowDotSprite, makeSprite, type Sprite} from './sprites';
import type {State} from './state';

const CREAM_FILL = rgba(CREAM, 1);
const LISTEN_CX = 299.25;
const LISTEN_CY = 248.55;
const LISTEN_R = 167.25;
const BIG_STROKE = 3.166;
const EAR_V4_X = 240.74; // ear group (233, 153) + Vector 4's offset (7.74, 29.7)
const EAR_V4_Y = 182.7;
/** The four dots on the circle (x, y, r). */
const DOTS: ReadonlyArray<readonly [number, number, number]> = [
  [146.29, 175.29, 14.29], [185.75, 372.75, 9.75], [449.75, 324.75, 9.75], [392.75, 108.75, 6.75],
];
/** The dots drift once round the circle a minute (no Figma motion; slow on purpose). */
const ORBIT_MS = 60_000;
/** Dot radii are quantised so each glow is baked once (≤ 0.125 px off). */
const DOT_R_STEP = 0.25;

let circle: Sprite | null = null;
let earV4: Sprite | null = null;
let ear: Sprite | null = null;

export function warmListen(): void {
  circle ??= makeSprite(LISTEN_CX - LISTEN_R - 4, LISTEN_CY - LISTEN_R - 4, LISTEN_CX + LISTEN_R + 4, LISTEN_CY + LISTEN_R + 4, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = BIG_STROKE;
    ctx.setLineDash([1.58, 18.99]);
    ctx.beginPath();
    ctx.arc(LISTEN_CX, LISTEN_CY, LISTEN_R, 0, Math.PI * 2);
    ctx.stroke();
  });
  // Vector 4 (≈ 96 × 131, group-local): grey #D9D9D9 fill, white 3 px dotted outline (.75 / 13.5).
  earV4 ??= makeSprite(EAR_V4_X - 3, EAR_V4_Y - 3, EAR_V4_X + 100, EAR_V4_Y + 134, (ctx) => {
    ctx.translate(EAR_V4_X, EAR_V4_Y);
    const p = new Path2D(EAR_V4_PATH);
    ctx.fillStyle = 'rgb(217,217,217)';
    ctx.fill(p);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.setLineDash([0.75, 13.5]);
    ctx.stroke(p);
  });
  ear ??= makeSprite(233, 169, 352, 339, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fill(new Path2D(EAR_PATH));
  });
}

let prebakedDots = 0;
const DOT_SIZES: number[] = [];
for (const [, , r] of DOTS) {
  for (let q = Math.round(r / DOT_R_STEP); q <= Math.round((r * 1.3) / DOT_R_STEP); q++) DOT_SIZES.push(q * DOT_R_STEP);
}

/** Bakes the dot glows the sound swell passes through, a few per idle frame. */
export function prebakeListen(): boolean {
  warmListen();
  for (let k = 0; k < 6 && prebakedDots < DOT_SIZES.length; k++) glowDotSprite(DOT_SIZES[prebakedDots++]!, DOT_GLOW_17);
  return prebakedDots >= DOT_SIZES.length;
}

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

/** Simulated ambient sound energy, smoothed ≥ 300 ms (updateEnergy, GS:751-759). */
export function stepListen(s: State, dt: number): void {
  const t = s.now / 1000;
  const k = 1 - Math.exp(-dt / 0.35);
  const raw0 = 0.25 + 0.6 * noise(t * 0.5);
  const raw1 = 0.2 + 0.65 * noise(t * 0.9 + 40);
  const raw2 = 0.15 + 0.7 * noise(t * 1.4 + 90);
  s.energy[0] = s.energy[0]! + (Math.min(1, Math.max(0, raw0)) - s.energy[0]!) * k;
  s.energy[1] = s.energy[1]! + (Math.min(1, Math.max(0, raw1)) - s.energy[1]!) * k;
  s.energy[2] = s.energy[2]! + (Math.min(1, Math.max(0, raw2)) - s.energy[2]!) * k;
}

export function drawListen(ctx: CanvasRenderingContext2D, s: State, a: number, reduceMotion: boolean): void {
  warmListen();
  if (circle) blit(ctx, circle, a);
  if (earV4) blit(ctx, earV4, a);
  if (ear) blit(ctx, ear, a);
  const turn = reduceMotion ? 0 : ((s.now - s.listenT0) / ORBIT_MS) * 2 * Math.PI;
  for (let i = 0; i < DOTS.length; i++) {
    const d = DOTS[i]!;
    const dx = d[0] - LISTEN_CX;
    const dy = d[1] - LISTEN_CY;
    const ang = Math.atan2(dy, dx) + turn;
    const rr = Math.hypot(dx, dy);
    const r = d[2] * (reduceMotion ? 1 : 1 + 0.3 * s.energy[i % 3]!);
    drawGlowDot(ctx, LISTEN_CX + rr * Math.cos(ang), LISTEN_CY + rr * Math.sin(ang), Math.round(r / DOT_R_STEP) * DOT_R_STEP, a, DOT_GLOW_17);
  }
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
