// Listen, Figma 8.1 (drawListen, GS:1492-1507): the ear (white, over its grey inner shape with a
// dotted outline) stays still inside a dotted circle; the four glowing dots on the circle turn
// counter-clockwise, once every 8 s (the team's 8.1.html). Reduce motion: still.
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
/** 8.1.html: one counter-clockwise turn every 8 s (CSS rotate(-360deg)). */
const ORBIT_MS = 8_000;

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

/** Bakes the circle, the ear and the three dot glows (fixed sizes since the dots stopped swelling). */
export function prebakeListen(): boolean {
  warmListen();
  for (const [, , r] of DOTS) glowDotSprite(r, DOT_GLOW_17);
  return true;
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

export function drawListen(ctx: CanvasRenderingContext2D, s: State, a: number, reduceMotion: boolean): void {
  warmListen();
  if (circle) blit(ctx, circle, a);
  if (earV4) blit(ctx, earV4, a);
  if (ear) blit(ctx, ear, a);
  const turn = reduceMotion ? 0 : (-(s.now - s.listenT0) / ORBIT_MS) * 2 * Math.PI;
  for (const d of DOTS) {
    const dx = d[0] - LISTEN_CX;
    const dy = d[1] - LISTEN_CY;
    const ang = Math.atan2(dy, dx) + turn;
    const rr = Math.hypot(dx, dy);
    drawGlowDot(ctx, LISTEN_CX + rr * Math.cos(ang), LISTEN_CY + rr * Math.sin(ang), d[2], a, DOT_GLOW_17);
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
