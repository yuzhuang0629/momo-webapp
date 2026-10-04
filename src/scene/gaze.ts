// Expand view, Figma 9.1 (drawGaze, GS:1685-1709; trail sampling GS:719-724): the light's home
// (dotted circle r 63.75), the light (glowing dot r 14.77) and, while it moves, its tail — Figma's
// 301.5 × 7.5 wedge, white at the light fading to nothing — pointing back the way it came (longer
// the faster it goes). The route (SessionEngine.expandView, 21:06): the light goes out once along a
// random angle on a slow spring (~5 s), rests, and fades; the scene follows the card's angle (GS:587-599).
import {DOT_GLOW_17} from './palette';
import {blit, drawGlowDot, makeSprite, newCanvas, ctx2d, type Sprite} from './sprites';
import {Trail, type State} from './state';

/** The mirror sampled the trail once per display frame; sample at a fixed 60 Hz instead. */
export const TRAIL_SAMPLE_MS = 1000 / 60;
export const GAZE_HOME_X = 260.25;
export const GAZE_HOME_Y = 256.75;
const RING_R = 63.75;
const BIG_STROKE = 3.166;
const DOT_R = 14.77;
/** How far the light goes out before the frame's edges stop it (GAZE_REACH). */
const REACH = 300;
/** The frame the light stays inside: x 50…550, y 60…405 (above the caption, text box top 469). */
const MIN_X = 50, MAX_X = 550, MIN_Y = 60, MAX_Y = 405;
const TAIL_LEN = 301.5; // Rectangle 13
const TAIL_W = 7.5;
/** The tail points at where the light was this long ago. */
const TAIL_LOOKBACK_MS = 400;

/** Where an AWAY card sends the light: out from home along angleDeg (0 = right, 90 = down). */
export function gazeAwayPoint(angleDeg: number): readonly [number, number] {
  const r = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(r), uy = Math.sin(r);
  let d = REACH;
  if (ux > 1e-3) d = Math.min(d, (MAX_X - GAZE_HOME_X) / ux);
  else if (ux < -1e-3) d = Math.min(d, (MIN_X - GAZE_HOME_X) / ux);
  if (uy > 1e-3) d = Math.min(d, (MAX_Y - GAZE_HOME_Y) / uy);
  else if (uy < -1e-3) d = Math.min(d, (MIN_Y - GAZE_HOME_Y) / uy);
  return [GAZE_HOME_X + ux * d, GAZE_HOME_Y + uy * d];
}

let ring: Sprite | null = null;
/**
 * The full-length wedge along +x from the light (x = 0) to its point (x = TAIL_LEN), white → clear.
 * A shorter tail is the same wedge scaled along its axis (its gradient runs light → point, so the
 * scaled sprite is exactly the shorter wedge).
 */
let tail: HTMLCanvasElement | null = null;
const TAIL_PAD = 2;

export function warmGaze(): void {
  ring ??= makeSprite(GAZE_HOME_X - RING_R - 4, GAZE_HOME_Y - RING_R - 4, GAZE_HOME_X + RING_R + 4, GAZE_HOME_Y + RING_R + 4, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = BIG_STROKE;
    ctx.setLineDash([1.58, 18.99]);
    ctx.beginPath();
    ctx.arc(GAZE_HOME_X, GAZE_HOME_Y, RING_R, 0, Math.PI * 2);
    ctx.stroke();
  });
  if (!tail) {
    tail = newCanvas(Math.ceil(TAIL_LEN) + 2 * TAIL_PAD, Math.ceil(TAIL_W) + 2 * TAIL_PAD);
    const c = ctx2d(tail);
    c.translate(TAIL_PAD, TAIL_PAD + TAIL_W / 2);
    const g = c.createLinearGradient(0, 0, TAIL_LEN, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -TAIL_W / 2);
    c.lineTo(TAIL_LEN, 0);
    c.lineTo(0, TAIL_W / 2);
    c.closePath();
    c.fill();
  }
}

export function drawGaze(ctx: CanvasRenderingContext2D, s: State, a: number): void {
  warmGaze();
  if (ring) blit(ctx, ring, a);
  const x = s.gazeX.value;
  const y = s.gazeY.value;
  // The oldest trail sample still within the look-back (the trail is oldest first).
  const tr = s.trail;
  let px = NaN, py = NaN;
  for (let i = 0; i < tr.size; i++) {
    const j = ((tr.head + i) % Trail.CAP) * 3;
    if (s.now - tr.buf[j + 2]! <= TAIL_LOOKBACK_MS) {
      px = tr.buf[j]!;
      py = tr.buf[j + 1]!;
      break;
    }
  }
  // The tail and the light fade as one picture (Android 23:00, layered()), so the tail's root never
  // shows through a half-faded light; the root starts at the light's edge, not its centre.
  const moving = tail !== null && !Number.isNaN(px) && Math.hypot(x - px, y - py) > 3;
  const target = a < 0.999 && moving ? groupLayer() : ctx;
  if (target !== ctx) {
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.clearRect(0, 0, 600, 600);
  }
  if (moving && tail) {
    const dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
    const len = Math.min(TAIL_LEN, d * 2.5);
    target.save();
    target.translate(x - (dx / d) * DOT_R, y - (dy / d) * DOT_R); // root on the light's edge
    target.rotate(Math.atan2(-dy, -dx));
    target.scale(len / TAIL_LEN, 1);
    target.drawImage(tail, -TAIL_PAD, -TAIL_PAD - TAIL_W / 2);
    target.restore();
  }
  drawGlowDot(target, x, y, DOT_R, target === ctx ? a : 1, DOT_GLOW_17);
  if (target !== ctx) {
    ctx.globalAlpha = a;
    ctx.drawImage(target.canvas, 0, 0);
    ctx.globalAlpha = 1;
  }
}

let group: CanvasRenderingContext2D | null = null;
/** Offscreen 600×600 layer for fading the tail and the light together (only while both fade). */
function groupLayer(): CanvasRenderingContext2D {
  group ??= ctx2d(newCanvas(600, 600));
  return group;
}
