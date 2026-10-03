// Figma 7.1: three tide circles round a glowing dot, with the hand (temperature) or sprout
// (scent) on top (GS:1040-1075, constants GS:1588-1601).
import {clamp01, lerp} from '../motion';
import {LOGO_GLOW} from './palette';
import {HAND_PATH, SPROUT_PATH} from './paths';
import {blit, drawGlowDot, makeSprite, type Sprite} from './sprites';
import type {State} from './state';

const CX = 299.5;
const CY = 254.5;
const WAVE_MS = 2300;
const RING_R = [35.5, 51.5, 71.5] as const;
// Piecewise-linear keys (progress, opacity) over the 2.3 s loop, inner → outer.
const RING_KEYS: ReadonlyArray<readonly number[]> = [
  [0, 0, 0.12, 0.42, 0.24, 0.6, 0.36, 0.42, 0.48, 0, 1, 0],
  [0, 0, 0.18, 0, 0.3, 0.21, 0.42, 0.3, 0.54, 0.21, 0.66, 0, 1, 0],
  [0, 0, 0.4, 0, 0.53, 0.14, 0.66, 0.2, 0.79, 0.14, 0.92, 0, 1, 0],
];
const RING_STROKE = 2.11;

/** CSS `linear` keyframes as (progress, value) pairs (keyed, GS:1066-1072). */
export function keyed(keys: readonly number[], p: number): number {
  let i = 2;
  while (i < keys.length && keys[i]! < p) i += 2;
  if (i >= keys.length) return keys[keys.length - 1]!;
  const t0 = keys[i - 2]!, v0 = keys[i - 1]!, t1 = keys[i]!, v1 = keys[i + 1]!;
  return t1 <= t0 ? v1 : lerp(v0, v1, clamp01((p - t0) / (t1 - t0)));
}

const rings: Sprite[] = [];
let hand: Sprite | null = null;
let sprout: Sprite | null = null;

function ringSprite(r: number): Sprite {
  const pad = RING_STROKE + 2;
  return makeSprite(CX - r - pad, CY - r - pad, CX + r + pad, CY + r + pad, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = RING_STROKE;
    ctx.setLineDash([1.06, 12.66]);
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

export function warmSense(): void {
  if (rings.length === 0) for (const r of RING_R) rings.push(ringSprite(r));
  hand ??= makeSprite(266, 196, 357, 358, (ctx) => {
    ctx.fillStyle = 'rgba(129,129,129,0.4)';
    ctx.fill(new Path2D(HAND_PATH));
  });
  sprout ??= makeSprite(247, 246, 355, 343, (ctx) => {
    ctx.fillStyle = `rgba(255,255,255,${Math.round(0.29 * 255) / 255})`;
    ctx.fill(new Path2D(SPROUT_PATH));
  });
}

export function drawSense(ctx: CanvasRenderingContext2D, s: State, a: number, reduceMotion: boolean): void {
  warmSense();
  const ph = ((s.now - s.senseT0) % WAVE_MS) / WAVE_MS;
  for (let i = 0; i < rings.length; i++) {
    // Reduce motion (the HTML's prefers-reduced-motion): only the inner circle, at 60 %.
    const o = reduceMotion ? (i === 0 ? 0.6 : 0) : keyed(RING_KEYS[i]!, ph);
    if (o > 0.003) blit(ctx, rings[i]!, o * a);
  }
  drawGlowDot(ctx, 300, 255, 7, a, LOGO_GLOW);
  const icon = s.senseKind === 'SCENT' ? sprout : hand;
  if (icon) blit(ctx, icon, a);
}
