// Figma 7.1 enlarged (60-1014 scent / 105-1141 temperature) with the team's 7.0动画.html underneath
// (GS:1127-1153, constants GS:1990-2011): three dotted circles (7.0's r 35.5 / 51.5 / 71.5, scaled
// with the frame's circle: ×1.5 for scent, ×2.25 for temperature) whose brightness travels outward
// like a tide, around a glowing dot (r 10.5). Scent: the sprout (white 29 %) on top. Temperature:
// the open hand (opaque white) behind the circles and the dot.
import {clamp01, lerp} from '../motion';
import {DOT_GLOW_17} from './palette';
import {HAND_PATH, SPROUT_PATH} from './paths';
import {blit, drawGlowDot, makeSprite, type Sprite} from './sprites';
import type {State} from './state';

const WAVE_MS = 2300;
const RING_R = [35.5, 51.5, 71.5] as const;
// Piecewise-linear keys (progress, opacity) over the 2.3 s loop, inner → outer.
const RING_KEYS: ReadonlyArray<readonly number[]> = [
  [0, 0, 0.12, 0.42, 0.24, 0.6, 0.36, 0.42, 0.48, 0, 1, 0],
  [0, 0, 0.18, 0, 0.3, 0.21, 0.42, 0.3, 0.54, 0.21, 0.66, 0, 1, 0],
  [0, 0, 0.4, 0, 0.53, 0.14, 0.66, 0.2, 0.79, 0.14, 0.92, 0, 1, 0],
];
const RING_STROKE = 2.11;
const DOT_R = 10.5;

interface Kind {
  cx: number;
  cy: number;
  k: number;
  dash: [number, number];
  dotX: number;
  dotY: number;
}

// Scent: circle r 53.25 = 35.5 × 1.5, the "big" dots. Temperature: r 79.875 = 35.5 × 2.25.
const SCENT: Kind = {cx: 299.25, cy: 248.25, k: 1.5, dash: [1.58, 18.99], dotX: 299.5, dotY: 248.5};
const TEMP: Kind = {cx: 299.875, cy: 271.875, k: 2.25, dash: [2.37, 28.49], dotX: 301.5, dotY: 257.5};

/** CSS `linear` keyframes as (progress, value) pairs (keyed, GS:1155-1161). */
export function keyed(keys: readonly number[], p: number): number {
  let i = 2;
  while (i < keys.length && keys[i]! < p) i += 2;
  if (i >= keys.length) return keys[keys.length - 1]!;
  const t0 = keys[i - 2]!, v0 = keys[i - 1]!, t1 = keys[i]!, v1 = keys[i + 1]!;
  return t1 <= t0 ? v1 : lerp(v0, v1, clamp01((p - t0) / (t1 - t0)));
}

const scentRings: Sprite[] = [];
const tempRings: Sprite[] = [];
let hand: Sprite | null = null;
let sprout: Sprite | null = null;

function ringSprite(kd: Kind, r0: number): Sprite {
  const r = r0 * kd.k;
  const w = RING_STROKE * kd.k;
  const pad = w + 2;
  return makeSprite(kd.cx - r - pad, kd.cy - r - pad, kd.cx + r + pad, kd.cy + r + pad, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = w;
    ctx.setLineDash(kd.dash);
    ctx.beginPath();
    ctx.arc(kd.cx, kd.cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

export function warmSense(): void {
  if (scentRings.length === 0) for (const r of RING_R) scentRings.push(ringSprite(SCENT, r));
  if (tempRings.length === 0) for (const r of RING_R) tempRings.push(ringSprite(TEMP, r));
  hand ??= makeSprite(243, 156, 380, 398, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fill(new Path2D(HAND_PATH));
  });
  sprout ??= makeSprite(220, 234, 382, 381, (ctx) => {
    ctx.fillStyle = `rgba(255,255,255,${Math.round(0.29 * 255) / 255})`;
    ctx.fill(new Path2D(SPROUT_PATH));
  });
}

export function drawSense(ctx: CanvasRenderingContext2D, s: State, a: number, reduceMotion: boolean): void {
  warmSense();
  const scent = s.senseKind === 'SCENT';
  if (!scent && hand) blit(ctx, hand, a);
  const kd = scent ? SCENT : TEMP;
  const rings = scent ? scentRings : tempRings;
  const ph = ((s.now - s.senseT0) % WAVE_MS) / WAVE_MS;
  for (let i = 0; i < rings.length; i++) {
    // Reduce motion (the HTML's prefers-reduced-motion): only the inner circle, at 60 %.
    const o = reduceMotion ? (i === 0 ? 0.6 : 0) : keyed(RING_KEYS[i]!, ph);
    if (o > 0.003) blit(ctx, rings[i]!, o * a);
  }
  drawGlowDot(ctx, kd.dotX, kd.dotY, DOT_R, a, DOT_GLOW_17);
  if (scent && sprout) blit(ctx, sprout, a);
}
