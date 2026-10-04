// Start screen, Figma 60-673 enlarged, with logo.html's draw-in / un-draw (GS:1299-1391,
// constants GS:1613-1647).
import {CubicBezier, clamp01, lerp} from '../motion';
import {LOGO_DOT_GLOW} from './palette';
import {blit, drawGlowDot, type Sprite} from './sprites';
import type {State} from './state';
import {bakeIntroPinch, bakeIntroTitle, drawIntroPill, fontReady} from './text';

const LOGO_R = 61.75;
const LOGO_STROKE = 2.094;
const LOGO_C_CX = 298.99;
const LOGO_C_CY = 187.79;
const LOGO_C_GAP = 62.22;
const LOGO_DOT_X = 300.08;
const LOGO_DOT_Y = 188.28;
const LOGO_DOT_R = 13.08;
const LOGO_SIDE_A = 0.4;
const LOGO_DASH = 1.065;
const LOGO_DASH_STEP = 9;
const LEFT = {cx: 236.49, cy: 187.75, tip: -63.06, count: 27, skipFrom: 11, skipTo: 15, dotX: 178.27, dotY: 188.31};
const RIGHT = {cx: 366.76, cy: 187.83, tip: -26.99, count: 35, skipFrom: -1, skipTo: -1, dotX: 421.73, dotY: 187.27};
/** logo.html: every element is in by 80 % of its 6 s timeline. */
export const LOGO_DONE = 4800;
const LOGO_EASE = new CubicBezier(0.55, 0.085, 0.68, 0.53);
const INTRO_FADE_EASE = new CubicBezier(0.45, 0, 0.55, 1);
const DEG = Math.PI / 180;

type Side = typeof LEFT;

/** Where the logo is on logo.html's timeline in design ms (introT, GS:1300-1303). */
export function introT(s: State): number {
  const p = clamp01((s.now - s.introStart) / s.introDur);
  return lerp(s.introFrom, s.introTo, p);
}

function seg(t: number, t0: number, t1: number, ease?: CubicBezier): number {
  const p = clamp01((t - t0) / (t1 - t0));
  return ease ? ease.at(p) : p;
}

// One Path2D per (side, number of dashes shown): the reveal is discrete, so these are reused.
const dashPaths = new Map<string, Path2D>();

function dashPath(side: Side, shown: number): Path2D {
  const key = `${side.count}|${shown}`;
  let p = dashPaths.get(key);
  if (!p) {
    p = new Path2D();
    const half = LOGO_DASH / 2;
    for (let j = 0; j < side.count && j <= shown; j++) {
      if (j >= side.skipFrom && j <= side.skipTo) continue;
      // Dash j sits 9° counter-clockwise from the previous one, tangent to the circle.
      const ang = (side.tip - LOGO_DASH_STEP * j) * DEG;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const px = side.cx + LOGO_R * ux, py = side.cy + LOGO_R * uy;
      p.moveTo(px + uy * half, py - ux * half);
      p.lineTo(px - uy * half, py + ux * half);
    }
    dashPaths.set(key, p);
  }
  return p;
}

function drawDashes(ctx: CanvasRenderingContext2D, side: Side, alpha: number, progress: number): void {
  if (alpha <= 0.003 || progress <= 0.001) return;
  const shown = Math.floor(progress * (side.count - 1) + 0.001);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = LOGO_STROKE;
  ctx.lineCap = 'round';
  ctx.stroke(dashPath(side, shown));
  ctx.globalAlpha = 1;
}

/** The solid C, drawn counter-clockwise from its top tip with butt caps (GS:1364-1371). */
function drawCrescent(ctx: CanvasRenderingContext2D, alpha: number, progress: number): void {
  if (alpha <= 0.003 || progress <= 0.001) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = LOGO_STROKE;
  ctx.lineCap = 'butt';
  const start = -LOGO_C_GAP * DEG;
  ctx.beginPath();
  ctx.arc(LOGO_C_CX, LOGO_C_CY, LOGO_R, start, start - (360 - 2 * LOGO_C_GAP) * progress * DEG, true);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1;
}

let titleSprite: Sprite | null = null;
let pinchSprite: Sprite | null = null;

/** Bakes the start-screen text; false until Elms Sans is ready. */
export function warmIntro(): boolean {
  if (!fontReady()) return false;
  titleSprite ??= bakeIntroTitle();
  pinchSprite ??= bakeIntroPinch();
  return true;
}

export function drawIntro(ctx: CanvasRenderingContext2D, s: State, op: number): void {
  const t = introT(s);
  // Exit: once the logo is back to its centre dot, the dot and the words fade out together.
  const fade = s.introFadeMs <= 0 ? 1 : 1 - INTRO_FADE_EASE.at(clamp01((s.now - s.introStart - s.introDur) / s.introFadeMs));
  const a = op * fade;
  if (a <= 0.003) return;
  const arcsA = LOGO_SIDE_A * a * seg(t, 2280, 2400);
  const arcsP = seg(t, 2280, 3720, LOGO_EASE);
  const dotsA = LOGO_SIDE_A * a * seg(t, 3960, 4800, LOGO_EASE);
  drawDashes(ctx, LEFT, arcsA, arcsP);
  drawDashes(ctx, RIGHT, arcsA, arcsP);
  drawGlowDot(ctx, LEFT.dotX, LEFT.dotY, LOGO_DOT_R, dotsA, LOGO_DOT_GLOW);
  drawGlowDot(ctx, RIGHT.dotX, RIGHT.dotY, LOGO_DOT_R, dotsA, LOGO_DOT_GLOW);
  drawCrescent(ctx, a * seg(t, 420, 540), seg(t, 480, 1800, LOGO_EASE));
  drawGlowDot(ctx, LOGO_DOT_X, LOGO_DOT_Y, LOGO_DOT_R, a, LOGO_DOT_GLOW);

  warmIntro();
  const title = titleSprite ?? bakeIntroTitle();
  blit(ctx, title, a);
  // "Pinch to start" fades out as the logo plays backwards on exit (GS:1351-1355).
  const pa = a * (!s.introMerging ? 1 : s.introFrom > 0 ? clamp01(t / s.introFrom) : 0);
  if (pa > 0.003) {
    drawIntroPill(ctx, pa);
    blit(ctx, pinchSprite ?? bakeIntroPinch(), pa);
  }
}
