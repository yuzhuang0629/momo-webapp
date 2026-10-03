// Virtual prayer-bead bracelet (GS:1249-1297). Each bead look (depth level, gold, glow,
// highlight) is pre-baked once with its soft gradient and glow; frames only blit 16 sprites.
import {CREAM, mix, rgba, WHITE, type Rgb} from './palette';
import {blit, blitAt, clearShadow, glowPad, makeSprite, setShadow, type Sprite} from './sprites';
import type {State} from './state';

const CX = 300;
const CY = 222;
const RX = 46;
const RY = 140;
export const BEAD_COUNT = 16;
export const BEAD_STEP = (2 * Math.PI) / BEAD_COUNT;
const GOLD: Rgb = [243, 210, 122];
const BACK: Rgb = [178, 64, 52];
const FRONT: Rgb = [230, 122, 92];
/** Depth quantisation of the baked bead looks (radius step 0.13 px). */
const LEVELS = 64;

/** softFill (GS:1536-1540): radial gradient offset up-left, stops 0 / .7 / 1. */
export function softFill(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rgb: Rgb, a: number): CanvasGradient {
  const g = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.2, 0, cx - r * 0.15, cy - r * 0.2, Math.max(1, r));
  g.addColorStop(0, rgba(mix(rgb, WHITE, 0.35), a));
  g.addColorStop(0.7, rgba(rgb, a * 0.9));
  g.addColorStop(1, rgba(rgb, a * 0.6));
  return g;
}

const beadCache = new Map<number, Sprite>();

/** A bead at depth d (al = .25 + .75d baked in; the screen opacity is applied at blit time). */
function beadSprite(level: number, gold: boolean, glow: boolean, hl: boolean): Sprite {
  const key = level * 8 + (gold ? 4 : 0) + (glow ? 2 : 0) + (hl ? 1 : 0);
  let s = beadCache.get(key);
  if (!s) {
    const d = level / LEVELS;
    const r = 6.5 + 8.5 * d;
    const col = gold ? GOLD : mix(BACK, FRONT, d);
    const al = 0.25 + 0.75 * d;
    const glowR = gold ? 7 : 4; // glow(col, al, 14 | 8) = setShadowLayer(blur / 2)
    const pad = r + (glow ? glowPad(glowR) : 2);
    s = makeSprite(-pad, -pad, pad, pad, (ctx) => {
      ctx.fillStyle = softFill(ctx, 0, 0, r, col, al);
      if (glow) setShadow(ctx, glowR, col, 0.5 * al);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      clearShadow(ctx);
      if (hl) {
        ctx.fillStyle = rgba(WHITE, 0.35 * al);
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.35, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    beadCache.set(key, s);
  }
  return s;
}

let stringSprite: Sprite | null = null;
const hintSprites: Array<Sprite | null> = [null, null];

/** Direction hint beside the front beads: dotted arc + arrowhead, alphas at hint = 1. */
function hintSprite(up: boolean): Sprite {
  const ax = CX + RX + 34;
  const y0 = up ? CY + 70 : CY - 70;
  const y1 = up ? CY - 70 : CY + 70;
  return makeSprite(ax - 12, CY - 82, ax + 16, CY + 82, (ctx) => {
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      ctx.fillStyle = rgba(CREAM, 0.15 + 0.6 * t);
      ctx.beginPath();
      ctx.arc(ax + 10 * Math.sin(Math.PI * t), y0 + (y1 - y0) * t, 1.6 + 1.2 * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(CREAM, 0.8);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'miter';
    const dy = up ? 9 : -9;
    ctx.beginPath();
    ctx.moveTo(ax - 7, y1 + dy);
    ctx.lineTo(ax, y1);
    ctx.lineTo(ax + 7, y1 + dy);
    ctx.stroke();
  });
}

let prebaked = 0;

/** Bakes the next few bead looks (all 2 × 65 over ~22 idle frames); true when all are done. */
export function prebakeBeads(): boolean {
  const end = Math.min(2 * (LEVELS + 1), prebaked + 6);
  for (; prebaked < end; prebaked++) {
    const level = prebaked >> 1;
    const d = level / LEVELS;
    beadSprite(level, (prebaked & 1) === 1, d > 0.6, d > 0.55);
  }
  return prebaked >= 2 * (LEVELS + 1);
}

export function warmBeads(): void {
  stringSprite ??= makeSprite(CX - RX - 3, CY - RY - 3, CX + RX + 3, CY + RY + 3, (ctx) => {
    ctx.strokeStyle = rgba(CREAM, 0.18);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  hintSprites[0] ??= hintSprite(true);
  hintSprites[1] ??= hintSprite(false);
}

const bx = new Float64Array(BEAD_COUNT);
const by = new Float64Array(BEAD_COUNT);
const bd = new Float64Array(BEAD_COUNT);
const order = new Int8Array(BEAD_COUNT);

export function drawBeads(ctx: CanvasRenderingContext2D, s: State, a: number): void {
  warmBeads();
  if (stringSprite) blit(ctx, stringSprite, a);
  const rot = s.beadRot.value;
  for (let i = 0; i < BEAD_COUNT; i++) {
    const th = i * BEAD_STEP + rot;
    bx[i] = CX + RX * Math.cos(th);
    by[i] = CY + RY * Math.sin(th);
    bd[i] = (Math.cos(th) + 1) / 2; // 1 = front (right side), 0 = back
    order[i] = i;
  }
  // Back to front (stable insertion sort, like Kotlin's sortedBy).
  for (let i = 1; i < BEAD_COUNT; i++) {
    const v = order[i]!;
    let j = i - 1;
    while (j >= 0 && bd[order[j]!]! > bd[v]!) {
      order[j + 1] = order[j]!;
      j--;
    }
    order[j + 1] = v;
  }
  for (let n = 0; n < BEAD_COUNT; n++) {
    const i = order[n]!;
    const d = bd[i]!;
    // Glow / highlight switch on the quantised depth (±1/128 of the source's hard thresholds).
    const level = Math.round(d * LEVELS);
    const sp = beadSprite(level, i === 0, level / LEVELS > 0.6, level / LEVELS > 0.55);
    blitAt(ctx, sp, bx[i]!, by[i]!, a);
  }
  // The hint switches between 1 and .35 instantly, as in the source (GS:1279-1280).
  const moving = Math.abs(s.beadRot.value - s.beadRot.target) > 0.01;
  const hint = s.beadGuide || moving ? 1 : 0.35;
  const h = hintSprites[s.beadDir < 0 ? 0 : 1];
  if (h) blit(ctx, h, a * hint);
}
