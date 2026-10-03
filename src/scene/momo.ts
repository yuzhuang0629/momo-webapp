// The Momo dot (drawObj, GS:792-822). Its glow (setShadowLayer 16 or 6) is pre-blurred for a few
// sizes and scaled to the current size; the soft fill and the black "drained" interior are drawn live.
import {clamp01} from '../motion';
import {ACCENT, mix, rgba, WHITE, type Rgb} from './palette';
import {ctx2d, glowPad, newCanvas, shadowOnly} from './sprites';
import type {State} from './state';

interface GlowSprite {
  d: number;
  canvas: HTMLCanvasElement;
  /** Canvas px from the edge to the disc's bounding box. */
  pad: number;
}

const glowCache = new Map<string, GlowSprite>();

/** Glow-only disc of diameter d: Android glow(col, op, 32 | 12) = shadow r 16 | 6, col @ .5. */
let last: GlowSprite | null = null;
let lastId = -1;

function glowSprite(d: number, big: boolean, rgb: Rgb): GlowSprite {
  // Same look as the previous frame → no key string (the common, static case).
  const id = ((d * 2 + (big ? 1 : 0)) * 256 + Math.round(rgb[0])) * 65536 + Math.round(rgb[1]) * 256 + Math.round(rgb[2]);
  if (last && id === lastId) return last;
  lastId = id;
  last = glowSpriteByKey(d, big, rgb);
  return last;
}

function glowSpriteByKey(d: number, big: boolean, rgb: Rgb): GlowSprite {
  const key =`${d}|${big ? 1 : 0}|${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])}`;
  let g = glowCache.get(key);
  if (!g) {
    const radius = big ? 16 : 6;
    const pad = glowPad(radius);
    const size = Math.ceil(d + 2 * pad);
    const canvas = newCanvas(size, size);
    const ctx = ctx2d(canvas);
    ctx.translate(size / 2, size / 2);
    shadowOnly(ctx, radius, rgb, 0.5, (c) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(0, 0, d / 2, 0, Math.PI * 2);
      c.fill();
    });
    g = {d, canvas, pad: (size - d) / 2};
    glowCache.set(key, g);
  }
  return g;
}

const BIG_LEVELS = [32, 48, 64, 80, 100, 120, 140, 160] as const;
const SMALL_LEVELS = [12, 20, 30] as const;

function nearest(levels: readonly number[], v: number): number {
  let best = levels[0]!;
  for (const l of levels) if (Math.abs(l - v) < Math.abs(best - v)) best = l;
  return best;
}

/** Pre-blurs the sage glow at every level (the Listen flourish grows through all of them). */
export function warmMomo(): void {
  for (const d of BIG_LEVELS) glowSprite(d, true, ACCENT);
  for (const d of SMALL_LEVELS) glowSprite(d, false, ACCENT);
}

export function drawMomo(ctx: CanvasRenderingContext2D, s: State): void {
  const o = s.o;
  let w = o.w.value;
  let h = o.h.value;
  const op = o.op.value;
  if (op <= 0.003 || w < 0.3 || h < 0.3) return;
  let k = 1;
  const now = s.now;
  if (o.steady.value > 0.001) {
    // Heartbeat at 55 bpm (legacy Steady pose).
    const per = 60000 / 55;
    const ph = (now % Math.trunc(per)) / per;
    const lub = Math.exp(-(((ph - 0.04) / 0.035) ** 2));
    const dub = 0.7 * Math.exp(-(((ph - 0.2) / 0.035) ** 2));
    k *= 1 + 0.04 * o.steady.value * (lub + dub);
  }
  if (o.drift.value > 0.001) k *= 1 + 0.03 * o.drift.value * Math.sin((now / 6000) * 2 * Math.PI);
  w *= k;
  h *= k;
  const col: Rgb = [o.r.value, o.g.value, o.b.value];
  const cr = clamp01(o.corner.value);
  const a = clamp01(op);
  ctx.save();
  ctx.translate(o.x.value, o.y.value);
  if (o.rot.value !== 0) ctx.rotate(o.rot.value);
  // Glow (under the fill, as Android draws the shadow first), scaled from the nearest baked size.
  const big = w > 30;
  const level = big ? nearest(BIG_LEVELS, Math.max(w, h)) : nearest(SMALL_LEVELS, Math.max(w, h));
  const g = glowSprite(level, big, col);
  const sx = w / g.d, sy = h / g.d;
  ctx.globalAlpha = a;
  ctx.drawImage(g.canvas, -w / 2 - g.pad * sx, -h / 2 - g.pad * sy, g.canvas.width * sx, g.canvas.height * sy);
  // Fill: soft radial gradient when large, flat colour when small.
  const rMax = Math.max(w, h) / 2;
  if (rMax > 14) {
    const gr = ctx.createRadialGradient(-rMax * 0.15, -rMax * 0.2, 0, -rMax * 0.15, -rMax * 0.2, Math.max(1, rMax));
    gr.addColorStop(0, rgba(mix(col, WHITE, 0.35), 1));
    gr.addColorStop(0.7, rgba(col, 0.9));
    gr.addColorStop(1, rgba(col, 0.6));
    ctx.fillStyle = gr;
  } else ctx.fillStyle = rgba(col, 1);
  const rad = (Math.min(w, h) / 2) * cr;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, rad);
  ctx.fill();
  // "Drain to ring": an opaque black inner shape regardless of op (GS:815-820).
  const f = clamp01(o.fill.value);
  if (f < 0.995) {
    const iw = Math.max(0, (w - 4) * (1 - f));
    const ih = Math.max(0, (h - 4) * (1 - f));
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(-iw / 2, -ih / 2, iw, ih, (Math.min(iw, ih) / 2) * cr);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
