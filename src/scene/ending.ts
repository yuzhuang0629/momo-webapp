// The end, USER_FLOW #12: Figma Component 10 (10.1) + the team's 10.0结束/orbit.html (drawEnding,
// GS:1500-1534, constants GS:2019-2034).
//
// After a 0.8 s hold the light leaves the top of the dotted ring and runs counter-clockwise round
// it over 9 s (cubic-bezier(.65, 0, .35, 1)), the path it has covered turning solid; 0.7 s after
// the loop closes the whole picture fades out over 2.2 s as one layer (Kotlin layered()). Under
// it: the two-line caption and the "Pinch to exit" pill. Reduce motion: the closed ring, still.
//
// Everything with a glow is baked once (ring, caption, pill, the light); per frame only the solid
// arc is stroked (no shadow) and the sprites are blitted.
import {CubicBezier} from '../motion';
import {ENDING_LINE, EXIT_HINT} from './copy';
import {DOT_GLOW_17, TEXT_GLOW_9_3, WHITE} from './palette';
import {blit, clearShadow, ctx2d, drawGlowDot, glowDotSprite, glowPad, makeSprite, newCanvas, setShadow, type Sprite} from './sprites';
import type {State} from './state';
import {captionSprite, fontReady, useFont} from './text';

const CX = 300;
const CY = 231.47;
const R = 108.84;
const BALL_R = 10.37;
const BIG_STROKE = 3.166;
/** Caption box top 370.84; its first line centred 22.6 px lower, like the other Figma captions. */
export const END_CAPTION_Y = 393.44;
// "Pinch to exit": Frame 18, a #999 hard-light pill (≈ #333 on black), 32 px ExtraLight, glow 9.3 @ .5.
const PILL_X = 186.62;
const PILL_Y = 487.22;
const PILL_W = 181;
const PILL_H = 41.23;
const PILL_RADIUS = 8;
const PILL_FILL = '#333333';
const PILL_PX = 32;
const PILL_WEIGHT = 200;
const PILL_TRACK = -0.011;
// orbit.html timeline (ms)
const HOLD = 800;
const ORBIT = 9000;
const CLOSED = 700;
const FADE = 2200;
const EASE = new CubicBezier(0.65, 0, 0.35, 1);

// The fading group as one picture: an offscreen layer over the box holding everything it draws.
const LAYER_X = 0;
const LAYER_Y = Math.floor(CY - R - BALL_R - 60); // room for the light's glow
const LAYER_W = 600;
const LAYER_H = Math.ceil(PILL_Y + PILL_H + 30) - LAYER_Y;

let ring: Sprite | null = null;
let pill: Sprite | null = null;
let layer: CanvasRenderingContext2D | null = null;

function bakeRing(): Sprite {
  return makeSprite(CX - R - 4, CY - R - 4, CX + R + 4, CY + R + 4, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = BIG_STROKE;
    ctx.setLineDash([1.58, 18.99]); // bigDots, round caps (makeSprite)
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function bakePill(): Sprite {
  const pad = glowPad(TEXT_GLOW_9_3);
  return makeSprite(PILL_X - pad, PILL_Y - pad, PILL_X + PILL_W + pad, PILL_Y + PILL_H + pad, (ctx) => {
    ctx.fillStyle = PILL_FILL;
    ctx.beginPath();
    ctx.roundRect(PILL_X, PILL_Y, PILL_W, PILL_H, PILL_RADIUS);
    ctx.fill();
    useFont(ctx, PILL_WEIGHT, PILL_PX, PILL_TRACK);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Android centres on the font's ascent/descent: baseline = cy − (ascent + descent) / 2.
    const m = ctx.measureText(EXIT_HINT);
    const asc = m.fontBoundingBoxAscent || 0.8 * PILL_PX;
    const desc = m.fontBoundingBoxDescent || 0.2 * PILL_PX;
    ctx.fillStyle = '#fff';
    setShadow(ctx, TEXT_GLOW_9_3, WHITE, 0.5);
    ctx.fillText(EXIT_HINT, PILL_X + PILL_W / 2, PILL_Y + PILL_H / 2 + (asc - desc) / 2);
    clearShadow(ctx);
  });
}

/** Idle-time bake of everything this screen draws; false until the font is ready. */
export function prebakeEnding(): boolean {
  ring ??= bakeRing();
  glowDotSprite(BALL_R, DOT_GLOW_17);
  if (!fontReady()) return false;
  pill ??= bakePill();
  captionSprite(ENDING_LINE, null, END_CAPTION_Y);
  return true;
}

/** The group at full opacity: ring, covered arc, light, caption, pill. */
function drawGroup(ctx: CanvasRenderingContext2D, p: number): void {
  if (ring) blit(ctx, ring, 1);
  const a = p * 2 * Math.PI;
  if (p * 360 > 0.1) {
    // From the top, counter-clockwise (drawArc(-90°, -sweep)).
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = BIG_STROKE;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(CX, CY, R, -Math.PI / 2, -Math.PI / 2 - a, true);
    ctx.stroke();
  }
  drawGlowDot(ctx, CX - R * Math.sin(a), CY - R * Math.cos(a), BALL_R, 1, DOT_GLOW_17);
  blit(ctx, captionSprite(ENDING_LINE, null, END_CAPTION_Y), 1);
  if (pill) blit(ctx, pill, 1);
}

export function drawEnding(ctx: CanvasRenderingContext2D, s: State, op: number, reduceMotion: boolean): void {
  ring ??= bakeRing();
  if (!pill && fontReady()) pill = bakePill();
  const e = reduceMotion ? HOLD + ORBIT + CLOSED : s.now - s.endT0;
  const p = reduceMotion ? 1 : EASE.at(Math.min(1, Math.max(0, (e - HOLD) / ORBIT)));
  const fade = reduceMotion ? 0 : Math.min(1, Math.max(0, (e - HOLD - ORBIT - CLOSED) / FADE));
  const ga = op * (1 - fade);
  if (ga <= 0.003) return;
  if (ga >= 0.999) {
    drawGroup(ctx, p);
    return;
  }
  layer ??= ctx2d(newCanvas(LAYER_W, LAYER_H));
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.clearRect(0, 0, LAYER_W, LAYER_H);
  layer.setTransform(1, 0, 0, 1, -LAYER_X, -LAYER_Y);
  drawGroup(layer, p);
  ctx.globalAlpha = ga;
  ctx.drawImage(layer.canvas, LAYER_X, LAYER_Y);
  ctx.globalAlpha = 1;
}

