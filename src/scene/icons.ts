// Icons used by the v2.1 flow: Fingers (rub your fingers, GS:1420-1436) and Stem (get
// comfortable, GS:1237-1247 with flower GS:1118-1146 and leaf GS:1505-1512).
import {clamp01} from '../motion';
import {ACCENT, CREAM, WARM, WHITE, mix, rgba, type Rgb} from './palette';
import {clearShadow, glowPad, makeSprite, setShadow, type Sprite} from './sprites';
import type {Icon, State} from './state';

/** softFill (GS:1536-1540): radial gradient offset up-left, stops 0 / .7 / 1. */
function softFill(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rgb: Rgb, a: number): CanvasGradient {
  const g = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.2, 0, cx - r * 0.15, cy - r * 0.2, Math.max(1, r));
  g.addColorStop(0, rgba(mix(rgb, WHITE, 0.35), a));
  g.addColorStop(0.7, rgba(rgb, a * 0.9));
  g.addColorStop(1, rgba(rgb, a * 0.6));
  return g;
}

const DEG = Math.PI / 180;
/** Fingers drawing scale (drawFingers(…, s·1.4), GS:1104); the icon spring s is applied live. */
const FINGERS_SCALE = 1.4;

interface Finger {
  sprite: Sprite;
}

let fingerL: Finger | null = null;
let fingerR: Finger | null = null;

/**
 * One finger capsule in its own (unrotated) frame, baked at 1.4×: softFill + glow r 7 (glow 14).
 * The sprite is centred on the finger's local origin.
 */
function fingerSprite(top: number, bottom: number, half: number, fillCy: number, rgb: Rgb): Finger {
  const k = FINGERS_SCALE;
  const pad = glowPad(7 * k) + 2;
  const sprite = makeSprite(-half * k - pad, top * k - pad, half * k + pad, bottom * k + pad, (ctx) => {
    ctx.scale(k, k);
    ctx.fillStyle = softFill(ctx, 0, fillCy, 70, rgb, 0.9);
    setShadow(ctx, 7, rgb, 0.5, k);
    ctx.beginPath();
    ctx.roundRect(-half, top, 2 * half, bottom - top, half);
    ctx.fill();
    clearShadow(ctx);
  });
  return {sprite};
}

export function warmIcons(): void {
  fingerL ??= fingerSprite(-78, 30, 18, -20, WARM);
  fingerR ??= fingerSprite(-84, 30, 16, -24, ACCENT);
}

const CREAM_FILL = rgba(CREAM, 1);

function drawFingers(ctx: CanvasRenderingContext2D, s: State, sc: number, a: number, reduceMotion: boolean): void {
  warmIcons();
  if (!fingerL || !fingerR) return;
  const now = s.now;
  const rub = reduceMotion ? 0 : Math.sin(now / 450) * 6;
  const k = FINGERS_SCALE;
  ctx.save();
  ctx.translate(300, 262);
  ctx.scale(sc, sc); // icon scale spring .88 → 1; the 1.4 is baked into the sprites
  ctx.globalAlpha = a;
  for (const [f, x, y, rot] of [
    [fingerL, -36 + rub, 18, -28],
    [fingerR, 38 - rub, 6, 32],
  ] as const) {
    ctx.save();
    ctx.translate(x * k, y * k);
    ctx.rotate(rot * DEG);
    ctx.drawImage(f.sprite.canvas, f.sprite.x, f.sprite.y);
    ctx.restore();
  }
  ctx.fillStyle = CREAM_FILL;
  for (let i = 0; i < 5; i++) {
    const ang = i * 1.256 + now / 900;
    ctx.globalAlpha = a * (0.3 + 0.4 * Math.abs(Math.sin(now / 300 + i)));
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * 22 * k, (-52 + Math.sin(ang) * 14) * k, 2.2 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------- stem

/** One linear-gradient slot, recreated only when its inputs change (static after growth). */
class GradSlot {
  private key = NaN;
  private key2 = NaN;
  private key3 = NaN;
  private g: CanvasGradient | null = null;

  get(ctx: CanvasRenderingContext2D, x0: number, x1: number, a: number, c0: string, c1: string): CanvasGradient {
    if (!this.g || x0 !== this.key || x1 !== this.key2 || a !== this.key3) {
      this.g = ctx.createLinearGradient(x0, 0, x1, 0);
      this.g.addColorStop(0, c0);
      this.g.addColorStop(1, c1);
      this.key = x0;
      this.key2 = x1;
      this.key3 = a;
    }
    return this.g;
  }
}

const leafSlots = Array.from({length: 4}, () => new GradSlot());
const petalSlots = Array.from({length: 13}, () => new GradSlot());
const PETAL_INNER: Rgb = mix(ACCENT, [255, 250, 235], 0.55);
const ACCENT_LIGHT: Rgb = mix(ACCENT, WHITE, 0.3);
const PETAL_INNER_LIGHT: Rgb = mix(PETAL_INNER, WHITE, 0.3);

function leaf(ctx: CanvasRenderingContext2D, slot: GradSlot, x: number, y: number, ang: number, len: number, wid: number, a: number): void {
  if (len < 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = slot.get(ctx, 0, len, a, rgba(ACCENT, 0.95 * a), rgba(ACCENT_LIGHT, 0.6 * a));
  ctx.beginPath();
  ctx.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(WHITE, 0.25 * a);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.stroke();
  ctx.restore();
}

/** drawFlower without a stem (GS:1118-1146), two petal layers, slowly rotating. */
function flower(ctx: CanvasRenderingContext2D, now: number, x: number, y: number, r: number, b: number, a: number): void {
  const rot = now / 40000;
  const tau = 2 * Math.PI;
  let slot = 0;
  for (let layer = 0; layer <= 1; layer++) {
    const nn = layer === 1 ? 5 : 8;
    const rl = layer === 1 ? r * 0.6 : r;
    const light = layer === 1 ? PETAL_INNER_LIGHT : ACCENT_LIGHT;
    const col = layer === 1 ? PETAL_INNER : ACCENT;
    const al = layer === 1 ? 0.78 : 0.6;
    for (let i = 0; i < nn; i++) {
      const closed = -Math.PI / 2 + ((i + 0.5) / nn - 0.5) * (layer === 1 ? 0.35 : 0.65);
      let open = (i / nn) * tau + rot + (layer === 1 ? Math.PI / nn : 0);
      // Kotlin's % keeps the dividend's sign; JS % does too.
      open = closed + ((((open - closed) % tau) + tau * 1.5) % tau - Math.PI);
      const bb = clamp01(b);
      const th = closed + (open - closed) * bb;
      const len = rl * (0.6 + 0.4 * b);
      const wid = rl * (0.26 + 0.16 * b);
      const dc = len * 0.5 * (0.35 + 0.65 * b);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(th);
      ctx.fillStyle = petalSlots[slot++]!.get(ctx, dc - len / 2, dc + len / 2, a, rgba(light, al * a), rgba(col, al * a * 0.5));
      ctx.beginPath();
      ctx.ellipse(dc, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

const LEAVES = [
  [0.3, 30, -0.5],
  [0.3, 26, Math.PI + 0.5],
  [0.6, 34, -0.6],
  [0.6, 30, Math.PI + 0.6],
] as const;

function drawStem(ctx: CanvasRenderingContext2D, now: number, x: number, base: number, g: number, a: number): void {
  // Floor: dottedLine (x−60, base)–(x+60, base), step 10 → 13 dots r 1.3, cream @ .35.
  ctx.globalAlpha = Math.min(1, a * 0.35);
  ctx.fillStyle = CREAM_FILL;
  ctx.beginPath();
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const px = x - 60 + (120 * i) / n;
    ctx.moveTo(px + 1.3, base);
    ctx.arc(px, base, 1.3, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
  const h = 170 * g;
  const top = base - h;
  if (h > 1) {
    ctx.strokeStyle = rgba(ACCENT, 0.85 * a);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + 6, base - h * 0.5, x, top);
    ctx.stroke();
  }
  LEAVES.forEach(([at, len, ang], i) => {
    const k = clamp01((g - at) / 0.25);
    leaf(ctx, leafSlots[i]!, x + (ang < 0 ? 2 : -2), base - 170 * at, ang, len * k, len * 0.42 * k, a);
  });
  if (g > 0.85) flower(ctx, now, x, top, 22 * clamp01((g - 0.85) / 0.15), 0.55, a);
  else if (h > 1) {
    ctx.fillStyle = rgba(ACCENT, a);
    ctx.beginPath();
    ctx.arc(x, top, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** drawIcons (GS:1079-1116) for the icons the current flow uses. */
export function drawIcons(ctx: CanvasRenderingContext2D, s: State, reduceMotion: boolean): void {
  for (const ic of s.icons) {
    const a = iconAlpha(s, ic);
    if (a <= 0.003) continue;
    if (ic.kind === 'Fingers') drawFingers(ctx, s, ic.s.value, a, reduceMotion);
    else if (ic.kind === 'Stem') drawStem(ctx, s.now, 300, 352, s.stem.value, a);
    // Other ObjectKinds are legacy v1 drawings that the v2.1 engine never emits.
  }
}

function iconAlpha(s: State, ic: Icon): number {
  return clamp01(ic.op.value * (ic.outAt >= 0 ? clamp01(1 - (s.now - ic.outAt) / 400) : 1));
}
