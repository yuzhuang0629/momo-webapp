// Find three, Figma 6.1 / 6.2 / 6.3: pulsing dotted circle in the item's colour, then the dotted
// cup (GS:1000-1038, constants GS:1581-1587).
import {CubicBezier, lerp} from '../motion';
import {CUP_BODY, CUP_LID, CUP_RIM} from './paths';
import {blit, ctx2d, makeSprite, newCanvas, type Sprite} from './sprites';
import type {State} from './state';

const FIND_CX = 299.5;
const FIND_CY = 254.5;
const FIND_R = 99.5;
const FIND_DIM = 0.3;
const FIND_LOW_AT = 0.5016;
const FIND_PULSE_MS = 2000;
const FIND_EASE = new CubicBezier(0.5, 0, 0.5, 1);
const RING_STROKE = 2.11;

let circle: Sprite | null = null;
let cup: Sprite | null = null;
// Tinted copy of the white circle, re-tinted only when the colour changes (source-in fill).
let tint: HTMLCanvasElement | null = null;
let tintKey = '';

function circleSprite(): Sprite {
  const pad = RING_STROKE + 2;
  return makeSprite(FIND_CX - FIND_R - pad, FIND_CY - FIND_R - pad, FIND_CX + FIND_R + pad, FIND_CY + FIND_R + pad, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = RING_STROKE;
    ctx.setLineDash([1.06, 12.66]);
    ctx.beginPath();
    ctx.arc(FIND_CX, FIND_CY, FIND_R, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** Component 6 (120×175) at (239.7, 189.5): dashed body stroke, pre-dashed lid and rim fills. */
function cupSprite(): Sprite {
  const x = 239.7, y = 189.5;
  return makeSprite(x - 3, y - 3, x + 123, y + 178, (ctx) => {
    ctx.translate(x, y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([0.5, 7]);
    ctx.stroke(new Path2D(CUP_BODY));
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.fill(new Path2D(CUP_LID));
    ctx.fill(new Path2D(CUP_RIM));
  });
}

export function warmFind(): void {
  circle ??= circleSprite();
  cup ??= cupSprite();
}

function tinted(c: Sprite, r: number, g: number, b: number): HTMLCanvasElement {
  const key = `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
  if (!tint) tint = newCanvas(c.w, c.h);
  if (key !== tintKey) {
    const t = ctx2d(tint);
    t.globalCompositeOperation = 'copy';
    t.drawImage(c.canvas, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = `rgb(${key})`;
    t.fillRect(0, 0, c.w, c.h);
    t.globalCompositeOperation = 'source-over';
    tintKey = key;
  }
  return tint;
}

export function drawFind(ctx: CanvasRenderingContext2D, s: State, reduceMotion: boolean): void {
  warmFind();
  const ca = s.findCircleOp.value;
  if (ca > 0.003 && circle) {
    // Opacity 30 % → 0 → 30 % over 2 s, low point at 50.16 %, cubic-bezier(.5,0,.5,1) each half.
    const ph = reduceMotion ? 0 : ((s.now - s.findT0) % FIND_PULSE_MS) / FIND_PULSE_MS;
    const k = ph < FIND_LOW_AT ? FIND_EASE.at(ph / FIND_LOW_AT) : 1 - FIND_EASE.at((ph - FIND_LOW_AT) / (1 - FIND_LOW_AT));
    const alpha = ca * lerp(FIND_DIM, 0, k);
    if (alpha > 0.003) {
      const r = s.findR.value, g = s.findG.value, b = s.findB.value;
      const white = Math.round(r) === 255 && Math.round(g) === 255 && Math.round(b) === 255;
      ctx.globalAlpha = alpha;
      ctx.drawImage(white ? circle.canvas : tinted(circle, r, g, b), circle.x, circle.y);
      ctx.globalAlpha = 1;
    }
  }
  const ua = s.findCupOp.value;
  if (ua > 0.003 && cup) blit(ctx, cup, ua);
}
