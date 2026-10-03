// Guiding light with a fading trail (GS:1393-1406, trail sampling GS:652-656).
import {clamp01} from '../motion';
import {WARM, WHITE, mix, rgba} from './palette';
import {blitAt, clearShadow, glowPad, makeSprite, setShadow, type Sprite} from './sprites';
import {Trail, type State} from './state';

/** The mirror sampled the trail once per display frame; sample at a fixed 60 Hz instead. */
export const TRAIL_SAMPLE_MS = 1000 / 60;
const TRAIL_MS = 900;
const DISC_R = 10;

let light: Sprite | null = null;
let disc: Sprite | null = null;

/** Halo (radial r 34, warm .5 → 0) + core (r 9, warm/white mix) + warm glow, at alpha 1. */
function lightSprite(): Sprite {
  const pad = Math.max(34, 9 + glowPad(9));
  return makeSprite(-pad, -pad, pad, pad, (ctx) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
    g.addColorStop(0, rgba(WARM, 0.5));
    g.addColorStop(1, rgba(WARM, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(mix(WARM, WHITE, 0.5), 1);
    setShadow(ctx, 9, WARM, 0.5); // glow(warm, a, 18)
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    clearShadow(ctx);
  });
}

export function warmGaze(): void {
  light ??= lightSprite();
  disc ??= makeSprite(-DISC_R - 1, -DISC_R - 1, DISC_R + 1, DISC_R + 1, (ctx) => {
    ctx.fillStyle = rgba(WARM, 1);
    ctx.beginPath();
    ctx.arc(0, 0, DISC_R, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function drawGaze(ctx: CanvasRenderingContext2D, s: State, a: number): void {
  warmGaze();
  const tr = s.trail;
  const n = tr.size;
  if (disc) {
    const src = disc.canvas;
    for (let i = 0; i < n; i++) {
      const j = ((tr.head + i) % Trail.CAP) * 3;
      const age = clamp01((s.now - tr.buf[j + 2]!) / TRAIL_MS);
      const al = a * (1 - age) * 0.55 * (i / Math.max(1, n));
      if (al < 0.01) continue;
      // Flat warm disc of radius 3 + 7(1 − age): the r 10 disc scaled down.
      const r = 3 + 7 * (1 - age);
      const k = r / DISC_R;
      const half = (DISC_R + 1) * k;
      ctx.globalAlpha = al;
      ctx.drawImage(src, tr.buf[j]! - half, tr.buf[j + 1]! - half, src.width * k, src.height * k);
    }
    ctx.globalAlpha = 1;
  }
  if (light) blitAt(ctx, light, s.gazeX.value, s.gazeY.value, a);
}
