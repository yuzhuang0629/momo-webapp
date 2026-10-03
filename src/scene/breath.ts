// Breathing ring, Figma 60-696 enlarged (GS:865-887, constants GS:1565-1577) and its per-phase
// motion from 3.0动画.html (GS:626-644).
import {CubicBezier, clamp01, lerp} from '../motion';
import {RING_GLOW, WHITE, sigmaFor} from './palette';
import {blit, ctx2d, makeSprite, newCanvas, shadowOnly, type Sprite} from './sprites';
import type {State} from './state';

const CX = 300.45;
const CY = 241.4;
const RING_IN = 108.37;
const RING_OUT = 156.38;
const DOT_IN = 108.48;
const DOT_OUT = 156.48;
const STROKE = 4.052;
const DIM = 0.38;
export const TOP_UP_FROM = 0.25;

const RING_MOVE = new CubicBezier(0.2, 0.8, 0.3, 1);
const RING_DIM_EASE = new CubicBezier(0.45, 0.05, 0.25, 1);
const RING_BACK_EASE = new CubicBezier(0.4, 0, 0.2, 1);

/** Advance the ring for the current phase (GS:626-644). */
export function stepBreath(s: State): void {
  const b = s.breath;
  if (!b) return;
  const p = clamp01((s.now - b.start) / Math.max(1, b.dur));
  s.bloom.set(lerp(b.from, b.to, RING_MOVE.at(p)));
  const span = (from: number, to: number, p0: number, p1: number, ease: CubicBezier): number =>
    lerp(from, to, ease.at(clamp01((p - p0) / (p1 - p0))));
  // The circle being left dims, stays dim while the ring travels and comes back at the end; the
  // circle being reached comes back early. A phase stopping short of a circle keeps the left one dim.
  const arrives = b.to <= 0.001 || b.to >= 0.999;
  const left = (from: number): number =>
    p < 0.8 || !arrives ? span(from, DIM, 0, 0.6, RING_DIM_EASE) : span(DIM, 1, 0.8, 1, RING_BACK_EASE);
  const reached = (from: number): number => span(from, 1, 0, 0.33, RING_BACK_EASE);
  if (b.to < b.from - 0.001) {
    s.ringOuterA = left(b.outerFrom);
    s.ringInnerA = reached(b.innerFrom);
  } else if (b.to > b.from + 0.001) {
    s.ringInnerA = left(b.innerFrom);
    s.ringOuterA = reached(b.outerFrom);
  } else {
    s.ringInnerA = span(b.innerFrom, 1, 0, 0.5, RING_BACK_EASE);
    s.ringOuterA = span(b.outerFrom, 1, 0, 0.5, RING_BACK_EASE);
  }
}

function dottedCircle(r: number): Sprite {
  const pad = STROKE + 2;
  return makeSprite(CX - r - pad, CY - r - pad, CX + r + pad, CY + r + pad, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = STROKE;
    ctx.setLineDash([2.03, 24.31]);
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// The glow of the travelling ring (σ 11.14) is pre-blurred at a few radii, at half resolution
// (it is a soft halo), and scaled to the exact radius; the crisp 4 px stroke is drawn per frame.
const GLOW_STEP = 4;
const GLOW_RES = 0.5;
const GLOW_PAD = Math.ceil(3 * sigmaFor(RING_GLOW)) + STROKE;

interface GlowLevel {
  r: number;
  canvas: HTMLCanvasElement;
}

let innerDots: Sprite | null = null;
let outerDots: Sprite | null = null;
const glowLevels: GlowLevel[] = [];

function glowLevel(i: number): GlowLevel {
  let g = glowLevels[i];
  if (!g) {
    const r = RING_IN + i * GLOW_STEP;
    const half = r + GLOW_PAD;
    const canvas = newCanvas(Math.ceil(2 * half * GLOW_RES), Math.ceil(2 * half * GLOW_RES));
    const ctx = ctx2d(canvas);
    ctx.scale(GLOW_RES, GLOW_RES);
    ctx.translate(half, half);
    shadowOnly(ctx, RING_GLOW, WHITE, 0.71, (c) => {
      c.strokeStyle = '#fff';
      c.lineWidth = STROKE;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
    }, GLOW_RES);
    g = {r, canvas};
    glowLevels[i] = g;
  }
  return g;
}

const LEVELS = Math.ceil((RING_OUT - RING_IN) / GLOW_STEP) + 1;

/** Pre-bakes every sprite of this screen (call at start-up, outside the frame loop). */
export function warmBreath(): void {
  innerDots ??= dottedCircle(DOT_IN);
  outerDots ??= dottedCircle(DOT_OUT);
  for (let i = 0; i < LEVELS; i++) glowLevel(i);
}

export function drawBreathRing(ctx: CanvasRenderingContext2D, s: State, a: number): void {
  innerDots ??= dottedCircle(DOT_IN);
  outerDots ??= dottedCircle(DOT_OUT);
  blit(ctx, innerDots, a * s.ringInnerA);
  blit(ctx, outerDots, a * s.ringOuterA);
  const r = lerp(RING_IN, RING_OUT, s.bloom.value);
  const g = glowLevel(Math.min(LEVELS - 1, Math.max(0, Math.round((r - RING_IN) / GLOW_STEP))));
  // Scale the level's halo so its ring lands exactly on r (≤ 2 px of 108–156 → ≤ 2 % wider halo).
  const k = r / g.r;
  const half = (g.r + GLOW_PAD) * k;
  const size = (g.canvas.width / GLOW_RES) * k;
  ctx.globalAlpha = a;
  ctx.drawImage(g.canvas, CX - half, CY - half, size, size);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = STROKE;
  ctx.beginPath();
  ctx.arc(CX, CY, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
