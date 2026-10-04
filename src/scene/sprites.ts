// Pre-rendered layers. Every blur (Android setShadowLayer) is rasterised ONCE into an offscreen
// canvas here; the per-frame path only blits these with globalAlpha (no shadowBlur / filter).
//
// A sprite is baked in scene coordinates: its canvas covers the integer-aligned scene box
// [x, x+w) × [y, y+h), so a blit at (x, y) is pixel-identical to drawing the shape in place.
import {rgba, shadowBlurFor, sigmaFor, WHITE, type Rgb} from './palette';

export interface Sprite {
  readonly canvas: HTMLCanvasElement;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type Draw = (ctx: CanvasRenderingContext2D) => void;

export function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

/** Bakes [draw] (scene coordinates) into a sprite covering the scene box x0…x1 × y0…y1. */
export function makeSprite(x0: number, y0: number, x1: number, y1: number, draw: Draw): Sprite {
  const x = Math.floor(x0);
  const y = Math.floor(y0);
  const w = Math.ceil(x1) - x;
  const h = Math.ceil(y1) - y;
  const canvas = newCanvas(w, h);
  const ctx = ctx2d(canvas);
  ctx.translate(-x, -y);
  ctx.lineCap = 'round';
  draw(ctx);
  return {canvas, x, y, w, h};
}

/** Draws [s] at its baked place with [alpha] (skipped when invisible). */
export function blit(ctx: CanvasRenderingContext2D, s: Sprite, alpha: number): void {
  if (alpha <= 0.003) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(s.canvas, s.x, s.y);
  ctx.globalAlpha = 1;
}

/** Draws [s] with its baked origin moved by (dx, dy) (for sprites that travel, e.g. head dots). */
export function blitAt(ctx: CanvasRenderingContext2D, s: Sprite, dx: number, dy: number, alpha: number): void {
  if (alpha <= 0.003) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(s.canvas, s.x + dx, s.y + dy);
  ctx.globalAlpha = 1;
}

/** Configures an Android-equivalent shadow on [ctx] (bake time only). */
/** [scale] = device px per local unit (canvas shadows ignore the current transform). */
export function setShadow(ctx: CanvasRenderingContext2D, androidRadius: number, rgb: Rgb, a: number, scale = 1): void {
  ctx.shadowBlur = shadowBlurFor(androidRadius) * scale;
  ctx.shadowColor = rgba(rgb, a);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'rgba(0,0,0,0)';
}

/** Padding that holds a whole Android shadow of [androidRadius] (3σ + 2 px). */
export function glowPad(androidRadius: number): number {
  return Math.ceil(3 * sigmaFor(androidRadius)) + 2;
}

const dotCache = new Map<string, Sprite>();

/**
 * drawGlowDot (GS:1036-1044): opaque disc of colour [rgb] (default white) with a white shadow @ .71,
 * faded as a group. The sprite is centred on the scene origin; blit it with blitAt(…, cx, cy, alpha).
 */
export function glowDotSprite(r: number, glow: number, rgb: Rgb = WHITE): Sprite {
  const key = `${r}|${glow}|${rgb[0]},${rgb[1]},${rgb[2]}`;
  let s = dotCache.get(key);
  if (!s) {
    const pad = r + glowPad(glow);
    s = makeSprite(-pad, -pad, pad, pad, (ctx) => {
      setShadow(ctx, glow, WHITE, 0.71);
      ctx.fillStyle = rgba(rgb, 1);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    });
    dotCache.set(key, s);
  }
  return s;
}

/**
 * Glow dot at a fractional centre. The sprite is baked around the origin, so the blit lands on
 * a fractional offset; drawing at the exact position keeps sub-pixel motion smooth.
 */
export function drawGlowDot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number, glow: number, rgb: Rgb = WHITE): void {
  if (alpha <= 0.003) return;
  blitAt(ctx, glowDotSprite(r, glow, rgb), cx, cy, alpha);
}

/**
 * Renders only the shadow of [shape] (the shape itself is drawn far off-canvas and its shadow
 * offset back in), for glows that are composed with a crisp shape drawn per frame.
 */
export function shadowOnly(ctx: CanvasRenderingContext2D, androidRadius: number, rgb: Rgb, a: number, shape: Draw, scale = 1): void {
  const off = 10000;
  ctx.save();
  // Shadow offsets are in device space, so shift the shape by a device-space translation.
  const m = ctx.getTransform();
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e - off, m.f);
  setShadow(ctx, androidRadius, rgb, a, scale);
  ctx.shadowOffsetX = off;
  shape(ctx);
  ctx.restore();
}
