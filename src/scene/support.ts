// "Sit down and feel support": SupportFigure.kt (timeline + contour morph) and
// GlassScene.drawSupport (GS:964-1019) at the size of Figma Component 8: the HTML's figure scaled
// ×1.7775 onto Component 8's boxes, with Component 8's own (wider, flatter) mat and ring ellipses
// and 40 px two-line captions.
import {clamp01, cosEase as ease, lerp} from '../motion';
import {SIT_LINE, SUPPORT_LINE} from './copy';
import {LOGO_GLOW} from './palette';
import {blit, blitAt, drawGlowDot, makeSprite, type Sprite} from './sprites';
import type {State} from './state';
import shapes from './support_shapes.json';
import {CAPTION_467, captionSprite, fontReady} from './text';

// ---------------------------------------------------------------- timeline (SF:94-108)
export const HOLD_IN = 1.0;
const MORPH = 3.0;
const HOLD_SIT = 1.4;
const SHIFT = 2.4;
export const T_SHIFT = HOLD_IN + MORPH + HOLD_SIT;
export const T_RISE = T_SHIFT + SHIFT;
const RING_KEYS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [1.8, 0.8], [4.0, 0.2], [6.8, 0.8], [9.0, 0.2], [11.8, 0.8], [14.0, 0.2],
];
const FADE_ALL = 2.0;
const T_FADE_ALL = T_RISE + 14.0;
export const TOTAL = T_FADE_ALL + FADE_ALL;

// ---------------------------------------------------------------- geometry (SF:110-126)
const BOX_STAND = [280.1, 318.0, 253.7, 339.8] as const;
const BOX_SIT = [260.7, 336.3, 268.5, 337.7] as const;
const HEAD_STAND = [300.93, 237.36, 10.5995] as const;
const HEAD_SIT = [303.38, 255.85, 10.2729] as const;
const STAND_BOX = [263.66, 252.84, 67.365, 94.317] as const;
const SIT_BOX = [258.07, 265.25, 81.868, 73.642] as const;
// Component 8 (GS:1906-1917): the figure's transform, and its own mat / ring ellipses.
const SUP_S = 1.7775; // 2.2's seated sprite 145.52 × 130.90 vs the HTML's 81.87 × 73.64
const SUP_TX = -233.72;
const SUP_TY = -241.48;
const MAT_CX = 297.59; // Ellipse 2364 / 2369: 335.19 × 130.34 at (130, 283)
const MAT_CY = 348.17;
const MAT_RX = 167.59;
const MAT_RY = 65.17;
const RING_CX = 300.34; // Ellipse 2365: 266.69 × 99.46 at (167, 299)
const RING_CY = 348.73;
const RING_RX = 133.34;
const RING_RY = 49.73;
/** A Figma-box [l, t, w, h] of the HTML figure mapped through the Component 8 transform. */
const scaledBox = (b: readonly number[]): readonly number[] =>
  [SUP_TX + SUP_S * b[0]!, SUP_TY + SUP_S * b[1]!, SUP_S * b[2]!, SUP_S * b[3]!];
const STAND_BOX_S = scaledBox(STAND_BOX);
const SIT_BOX_S = scaledBox(SIT_BOX);
const FG = 'rgb(251,250,249)';
const RING_STROKE = 2.11;

interface SupportState {
  sit: number;
  fig: number;
  sink: number;
  ring: number;
  all: number;
  txtSit: number;
  txtSupport: number;
}

const st: SupportState = {sit: 0, fig: 0, sink: 0, ring: 0, all: 0, txtSit: 0, txtSupport: 0};

/** stateAt (SF:128-147), written into a reused object. */
function stateAt(t: number): SupportState {
  const sit = clamp01((t - HOLD_IN) / MORPH);
  const sh = clamp01((t - T_SHIFT) / SHIFT);
  const p = t - T_RISE;
  let ring: number;
  const i = RING_KEYS.findIndex((k) => k[0] > p);
  if (i < 0) ring = RING_KEYS[RING_KEYS.length - 1]![1];
  else if (i === 0) ring = RING_KEYS[0]![1];
  else {
    const a = RING_KEYS[i - 1]!;
    const b = RING_KEYS[i]!;
    ring = lerp(a[1], b[1], ease((p - a[0]) / (b[0] - a[0])));
  }
  st.sit = sit;
  st.fig = 1 - ease(sh / 0.7);
  st.sink = 7 * ease(sh);
  st.ring = ring;
  st.all = 1 - ease((t - T_FADE_ALL) / FADE_ALL);
  st.txtSit = 1 - ease(sh / 0.45);
  st.txtSupport = ease((sh - 0.45) / 0.55);
  return st;
}

// ---------------------------------------------------------------- contour morph (SF:42-90)
type Pts = ReadonlyArray<ReadonlyArray<number>>;

function flat(p: Pts): Float64Array {
  const out = new Float64Array(p.length * 2);
  p.forEach((q, i) => {
    out[2 * i] = q[0] ?? 0;
    out[2 * i + 1] = q[1] ?? 0;
  });
  return out;
}

function bounds(sets: Float64Array[]): [number, number, number, number] {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const a of sets) {
    for (let i = 0; i < a.length; i += 2) {
      const x = a[i]!, y = a[i + 1]!;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return [x0, x1, y0, y1];
}

/** Independent x/y linear map of bounds [from] onto box [to] (fitTo, SF:159-166). */
function fit(a: Float64Array, from: readonly number[], to: readonly number[]): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i += 2) {
    out[i] = to[0]! + ((a[i]! - from[0]!) * (to[1]! - to[0]!)) / (from[1]! - from[0]!);
    out[i + 1] = to[2]! + ((a[i + 1]! - from[2]!) * (to[3]! - to[2]!)) / (from[3]! - from[2]!);
  }
  return out;
}

function centroid(a: Float64Array): [number, number] {
  let x = 0, y = 0;
  const n = a.length / 2;
  for (let i = 0; i < a.length; i += 2) {
    x += a[i]! / n;
    y += a[i + 1]! / n;
  }
  return [x, y];
}

function bez(a: number, b: number, c: number, u: number): number {
  return (1 - u) * (1 - u) * a + 2 * u * (1 - u) * b + u * u * c;
}

interface Leg {
  a: Float64Array;
  b: Float64Array;
  ca: [number, number];
  cb: [number, number];
  ctrl: [number, number];
  out: Float64Array;
}

class Figure {
  private readonly standS: Float64Array;
  private readonly midM: Float64Array;
  private readonly torsoT: Float64Array;
  private readonly torso: Float64Array;
  private readonly legs: [Leg, Leg];

  constructor() {
    const stand = flat(shapes.stand);
    const torso = flat(shapes.torso);
    const legLs = flat(shapes.legL);
    const legRs = flat(shapes.legR);
    const fromStand = bounds([stand]);
    const fromSit = bounds([torso, legLs, legRs]);
    this.standS = fit(stand, fromStand, BOX_STAND);
    const legL0 = fit(flat(shapes.legL0), fromStand, BOX_STAND);
    const legR0 = fit(flat(shapes.legR0), fromStand, BOX_STAND);
    this.torsoT = fit(torso, fromSit, BOX_SIT);
    const legL = fit(legLs, fromSit, BOX_SIT);
    const legR = fit(legRs, fromSit, BOX_SIT);
    // Midway torso: the standing body sinking toward the floor, a bit wider (SF:55-58).
    let botY = -Infinity;
    for (let i = 1; i < this.standS.length; i += 2) botY = Math.max(botY, this.standS[i]!);
    const cxS = centroid(this.standS)[0];
    this.midM = new Float64Array(this.standS.length);
    for (let i = 0; i < this.standS.length; i += 2) {
      this.midM[i] = cxS + (this.standS[i]! - cxS) * 1.12;
      this.midM[i + 1] = botY - (botY - this.standS[i + 1]!) * 0.88;
    }
    this.torso = new Float64Array(this.standS.length);
    const cL0 = centroid(legL0), cR0 = centroid(legR0), cL = centroid(legL), cR = centroid(legR);
    this.legs = [
      {a: legL0, b: legL, ca: cL0, cb: cL, ctrl: [cL[0] + 4, cL0[1]], out: new Float64Array(legL0.length)},
      {a: legR0, b: legR, ca: cR0, cb: cR, ctrl: [cR[0] - 3, cR0[1]], out: new Float64Array(legR0.length)},
    ];
  }

  /** Body polygons at morph progress t (bodyAt, SF:68-90) into reused buffers. */
  polys(t: number): readonly Float64Array[] {
    const uL = ease((t - 0.12) / 0.88);
    const u = ease(t);
    const s = this.standS, m = this.midM, tt = this.torsoT, o = this.torso;
    for (let i = 0; i < s.length; i++) o[i] = bez(s[i]!, m[i]!, tt[i]!, u);
    for (const L of this.legs) {
      // The leg shape cross-blends about its centroid while the centroid swings out, then up.
      const cx = bez(L.ca[0], L.ctrl[0], L.cb[0], uL);
      const cy = bez(L.ca[1], L.ctrl[1], L.cb[1], uL);
      for (let i = 0; i < L.a.length; i += 2) {
        L.out[i] = cx + (1 - uL) * (L.a[i]! - L.ca[0]) + uL * (L.b[i]! - L.cb[0]);
        L.out[i + 1] = cy + (1 - uL) * (L.a[i + 1]! - L.ca[1]) + uL * (L.b[i + 1]! - L.cb[1]);
      }
    }
    return [o, this.legs[0].out, this.legs[1].out];
  }
}

// ---------------------------------------------------------------- assets + sprites

let figure: Figure | null = null;
let standImg: HTMLImageElement | null = null;
let sitImg: HTMLImageElement | null = null;
let standSprite: Sprite | null = null;
let sitSprite: Sprite | null = null;
let matSprite: Sprite | null = null;
let ringSprite: Sprite | null = null;

function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img;
}

/** Starts loading the two body PNGs (3× art) and bakes the static sprites. */
export function warmSupport(): void {
  figure ??= new Figure();
  standImg ??= loadImage('/scene/support_body_stand.png');
  sitImg ??= loadImage('/scene/support_body_sit.png');
  matSprite ??= ellipseSprite(MAT_CX, MAT_CY, MAT_RX, MAT_RY, true);
  ringSprite ??= ellipseSprite(RING_CX, RING_CY, RING_RX, RING_RY, false);
}

function ellipseSprite(cx: number, cy: number, rx: number, ry: number, dotted: boolean): Sprite {
  const pad = RING_STROKE + 2;
  return makeSprite(cx - rx - pad, cy - ry - pad, cx + rx + pad, cy + ry + pad, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = RING_STROKE;
    if (dotted) ctx.setLineDash([1.06, 12.66]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** The PNG downscaled once (high quality) into its (Component 8-scaled) box, or null while still loading. */
function bodySprite(img: HTMLImageElement | null, box: readonly number[], cached: Sprite | null): Sprite | null {
  if (cached) return cached;
  if (!img || !img.complete || img.naturalWidth === 0) return null;
  const [l, t, w, h] = box as [number, number, number, number];
  return makeSprite(l, t, l + w, t + h, (ctx) => {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, l, t, w, h);
  });
}

/** Idle-time bake of everything Support draws; false while the PNGs or the font are not ready. */
export function prebakeSupport(): boolean {
  warmSupport();
  standSprite = bodySprite(standImg, STAND_BOX_S, standSprite);
  sitSprite = bodySprite(sitImg, SIT_BOX_S, sitSprite);
  if (!standSprite || !sitSprite || !fontReady()) return false;
  captionSprite(SIT_LINE, 'Sit', CAPTION_467);
  captionSprite(SUPPORT_LINE, 'Support', CAPTION_467);
  return true;
}

/** Where the card is on its design timeline, in seconds (supportT, GS:890-893). */
function supportT(s: State): number {
  const p = clamp01((s.now - s.supStart) / s.supDur);
  return lerp(s.supFrom, TOTAL, p);
}

export function drawSupport(ctx: CanvasRenderingContext2D, s: State, a0: number, reduceMotion: boolean): void {
  warmSupport();
  let t = supportT(s);
  if (reduceMotion) t = t < T_SHIFT ? HOLD_IN + MORPH : T_RISE + 1.8;
  const k = stateAt(t);
  const a = a0 * k.all;
  if (a <= 0.003) return;
  // Body: the Figma sprites at the holds, the traced contours morphing in between.
  if (k.sit <= 0) {
    standSprite = bodySprite(standImg, STAND_BOX_S, standSprite);
    if (standSprite) blit(ctx, standSprite, a * k.fig);
  } else if (k.sit >= 1) {
    sitSprite = bodySprite(sitImg, SIT_BOX_S, sitSprite);
    if (sitSprite) blitAt(ctx, sitSprite, 0, SUP_S * k.sink, a * k.fig);
  } else if (figure) {
    ctx.save();
    ctx.translate(SUP_TX, SUP_TY);
    ctx.scale(SUP_S, SUP_S);
    ctx.fillStyle = FG;
    ctx.globalAlpha = a > 1 ? 1 : a;
    for (const poly of figure.polys(k.sit)) {
      ctx.beginPath();
      ctx.moveTo(poly[0]!, poly[1]!);
      for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i]!, poly[i + 1]!);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // The head travels with the body; the two Figma head dots cross-fade along the way (placed by
  // hand rather than under the scale, so their glow keeps Figma's σ).
  const e = ease(k.sit);
  const hx = SUP_TX + SUP_S * lerp(HEAD_STAND[0], HEAD_SIT[0], e);
  const hy = SUP_TY + SUP_S * (lerp(HEAD_STAND[1], HEAD_SIT[1], e) + k.sink);
  drawGlowDot(ctx, hx, hy, SUP_S * HEAD_STAND[2], a * k.fig * (1 - e), LOGO_GLOW);
  drawGlowDot(ctx, hx, hy, SUP_S * HEAD_SIT[2], a * k.fig * e, LOGO_GLOW);
  // Mat (dotted) and the support ring (only its opacity changes).
  if (matSprite) blit(ctx, matSprite, a);
  if (ringSprite && k.ring > 0.003) blit(ctx, ringSprite, a * k.ring);
  // The two captions cross-fade on the timeline.
  if (a * k.txtSit > 0.003) blit(ctx, captionSprite(SIT_LINE, 'Sit', CAPTION_467), a * k.txtSit);
  if (a * k.txtSupport > 0.003) blit(ctx, captionSprite(SUPPORT_LINE, 'Support', CAPTION_467), a * k.txtSupport);
}

