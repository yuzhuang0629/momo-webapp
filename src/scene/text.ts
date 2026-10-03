// Text layers: roles, wrapping, the fade rules and the lens text grid (GS:166-289, GS:824-863,
// GS:987-998). Each layer is baked once (glyphs + underline + glow) into a sprite and then only
// blitted with its fade alpha.
import {Spring, clamp01} from '../motion';
import type {Copy} from './copy';
import {PINCH_HINT} from './copy';
import {CREAM, TEXT_GLOW_6_4, TEXT_GLOW_9_3, WHITE, rgba, type Rgb} from './palette';
import {blit, clearShadow, ctx2d, glowPad, makeSprite, newCanvas, setShadow, type Sprite} from './sprites';

export const FONT_FAMILY = '"Elms Sans"';
const TITLE_PX = 37.4;
const SUB_PX = 20;

export const META_Y = 408;
export const TITLE_Y = 452;
export const SUB_Y = 498;
export const FOOT_Y = 556;
/** Figma one-liner baseline (find / sense / support captions), GS:1578. */
export const BREATH_TEXT_Y = 424;
/** 40 px breathing caption centre, GS:1574. */
export const BREATH_CAPTION_CY = 489.6;
/** Widest a Figma one-liner may be before it is scaled down, GS:1579. */
const FIGMA_LINE_MAX = 560;
const WRAP_MAX = 500;

export interface Role {
  readonly name: RoleName;
  readonly size: number;
  readonly weight: number;
  readonly alpha: number;
  readonly track: number;
  /** Extra lines go down from y (else the block is centred on y). */
  readonly top: boolean;
  /** y is the baseline instead of the line's centre. */
  readonly baseline: boolean;
  /** Android shadow radius of the white glow (0 = cream, no glow). */
  readonly glow: number;
  readonly glowA: number;
}

export type RoleName = 'TITLE' | 'SUB' | 'LABEL' | 'PHASE' | 'CHOICE' | 'FOOT' | 'BREATH' | 'BREATH_L';

function role(name: RoleName, size: number, weight: number, alpha: number, track: number, top: boolean, baseline = false, glow = 0, glowA = 0): Role {
  return {name, size, weight, alpha, track, top, baseline, glow, glowA};
}

// GS:178-188. PHASE's letter-spacing animation (0.04 → −0.011, legacy PhaseIntro) is baked at its end value.
export const Roles: Readonly<Record<RoleName, Role>> = {
  TITLE: role('TITLE', TITLE_PX, 300, 0.95, -0.011, false),
  SUB: role('SUB', SUB_PX, 400, 0.7, 0, true),
  LABEL: role('LABEL', SUB_PX, 400, 0.9, 0, true),
  PHASE: role('PHASE', TITLE_PX, 300, 0.95, -0.011, false),
  CHOICE: role('CHOICE', TITLE_PX, 300, 0.95, -0.011, false),
  FOOT: role('FOOT', SUB_PX, 400, 0.6, 0, true),
  BREATH: role('BREATH', 32, 300, 1, -0.011, false, true, TEXT_GLOW_6_4, 0.5),
  BREATH_L: role('BREATH_L', 40, 300, 1, -0.011, false, false, TEXT_GLOW_6_4, 0.5),
};

function isOneLine(r: Role): boolean {
  return r.name === 'BREATH' || r.name === 'BREATH_L';
}

function isTitleRole(r: Role): boolean {
  return r.name === 'TITLE' || r.name === 'PHASE' || r.name === 'CHOICE';
}

export function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D {
  if (!measureCtx) measureCtx = ctx2d(newCanvas(1, 1));
  return measureCtx;
}

/** Applies Elms Sans at [weight]/[size] with letter-spacing [track] em. */
export function useFont(ctx: CanvasRenderingContext2D, weight: number, size: number, track: number): void {
  ctx.font = font(weight, size);
  ctx.letterSpacing = `${track * size}px`;
}

export function measure(s: string, weight: number, size: number, track: number): number {
  const m = measurer();
  useFont(m, weight, size, track);
  return m.measureText(s).width;
}

/** True once the shell's Elms Sans is usable (sprites baked earlier would use a fallback face). */
export function fontReady(): boolean {
  return document.fonts.check(font(300, 20));
}

/** Two lines at the word break that best balances their widths if wider than 500 px (GS:225-235). */
export function wrap(s: string, r: Role): string[] {
  if (measure(s, r.weight, r.size, r.track) <= WRAP_MAX) return [s];
  const words = s.split(' ');
  let best = [s];
  let bd = Number.MAX_VALUE;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const d = Math.abs(measure(a, r.weight, r.size, r.track) - measure(b, r.weight, r.size, r.track));
    if (d < bd) {
      bd = d;
      best = [a, b];
    }
  }
  return best;
}

/** Draws one centred line at baseline (cx, y) with its underlined word; fill/shadow already set. */
function drawLine(ctx: CanvasRenderingContext2D, ln: string, underline: string | null, cx: number, y: number, size: number): void {
  ctx.textAlign = 'center';
  ctx.fillText(ln, cx, y);
  const at = underline == null ? -1 : ln.indexOf(underline);
  if (underline == null || at < 0) return;
  ctx.textAlign = 'left';
  const x0 = cx - ctx.measureText(ln).width / 2 + ctx.measureText(ln.slice(0, at)).width;
  const w = ctx.measureText(underline).width;
  // Elms Sans post table: underlinePosition −100, thickness 50 (per 1000 em), GS:993-996.
  ctx.fillRect(x0, y + 0.1 * size, w, Math.max(1, 0.05 * size));
}

/**
 * Bakes lines of [r] laid out like GlassScene.drawText at (x, y) with colour/alpha of the role
 * (alpha 1 = fully faded in), including the Figma glow and the >560 px fit of one-liners.
 */
export function bakeText(lines: readonly string[], r: Role, x: number, y: number, underline: string | null): Sprite {
  const lh = r.size * 1.15;
  // Centred roles: baseline = centre − (ascent + descent)/2 = cy + 0.35·size (hhea 1000 / −300).
  const base = r.baseline ? 0 : 0.35 * r.size;
  const ys: number[] = [];
  const ks: number[] = [];
  let maxW = 0;
  for (let i = 0; i < lines.length; i++) {
    ys.push(y + (r.top || r.baseline ? i * lh : (i - (lines.length - 1) / 2) * lh) + base);
    const w = measure(lines[i] ?? '', r.weight, r.size, r.track);
    const k = isOneLine(r) && w > FIGMA_LINE_MAX ? FIGMA_LINE_MAX / w : 1;
    ks.push(k);
    maxW = Math.max(maxW, w * k);
  }
  const pad = r.glow > 0 ? glowPad(r.glow) : 2;
  const firstY = ys[0] ?? y;
  const lastY = ys[ys.length - 1] ?? y;
  const col: Rgb = r.glow > 0 ? WHITE : CREAM;
  return makeSprite(x - maxW / 2 - pad - 4, firstY - 1.05 * r.size - pad, x + maxW / 2 + pad + 4, lastY + 0.45 * r.size + pad, (ctx) => {
    useFont(ctx, r.weight, r.size, r.track);
    ctx.fillStyle = rgba(col, r.alpha);
    if (r.glow > 0) setShadow(ctx, r.glow, WHITE, r.glowA);
    for (let i = 0; i < lines.length; i++) {
      const ly = ys[i] ?? y;
      const k = ks[i] ?? 1;
      ctx.save();
      if (k !== 1) {
        ctx.translate(x, ly);
        ctx.scale(k, k);
        ctx.translate(-x, -ly);
      }
      drawLine(ctx, lines[i] ?? '', underline, x, ly, r.size);
      ctx.restore();
    }
    clearShadow(ctx);
  });
}

// ---------------------------------------------------------------- start screen text (GS:1337-1360)

const INTRO_TITLE_PX = 40;
const INTRO_TITLE_CY1 = 357.6;
const INTRO_TITLE_CY2 = 402.8;
const INTRO_PINCH_PX = 30;
const INTRO_PINCH_CY = 478;

/** "Take a moment / for yourself." — 40 px, "moment" wght 600, white, glow 6.42 px @ .71. */
export function bakeIntroTitle(): Sprite {
  const rows: Array<[number, Array<[string, number]>]> = [
    [INTRO_TITLE_CY1, [['Take a ', 300], ['moment', 600]]],
    [INTRO_TITLE_CY2, [['for yourself.', 300]]],
  ];
  const pad = glowPad(TEXT_GLOW_6_4);
  return makeSprite(300 - 220 - pad, INTRO_TITLE_CY1 - 40 - pad, 300 + 220 + pad, INTRO_TITLE_CY2 + 30 + pad, (ctx) => {
    ctx.fillStyle = '#fff';
    setShadow(ctx, TEXT_GLOW_6_4, WHITE, 0.71);
    ctx.textAlign = 'left';
    for (const [cy, parts] of rows) {
      const widths = parts.map(([s, w]) => measure(s, w, INTRO_TITLE_PX, -0.011));
      let x = 300 - widths.reduce((a, b) => a + b, 0) / 2;
      const base = cy + 0.35 * INTRO_TITLE_PX;
      parts.forEach(([s, w], i) => {
        useFont(ctx, w, INTRO_TITLE_PX, -0.011);
        ctx.fillText(s, x, base);
        x += widths[i] ?? 0;
      });
    }
    clearShadow(ctx);
  });
}

/** "Pinch to start" — 30 px wght 200, white, glow 9.31 px @ .5, no outline. */
export function bakeIntroPinch(): Sprite {
  const pad = glowPad(TEXT_GLOW_9_3);
  return makeSprite(300 - 140 - pad, INTRO_PINCH_CY - 30 - pad, 300 + 140 + pad, INTRO_PINCH_CY + 25 + pad, (ctx) => {
    useFont(ctx, 200, INTRO_PINCH_PX, -0.011);
    ctx.fillStyle = '#fff';
    setShadow(ctx, TEXT_GLOW_9_3, WHITE, 0.5);
    ctx.textAlign = 'center';
    ctx.fillText('Pinch to start', 300, INTRO_PINCH_CY + 0.35 * INTRO_PINCH_PX);
    clearShadow(ctx);
  });
}

// ---------------------------------------------------------------- shared text sprite cache

/** Baked lines keyed by layout; repeated lines ("Pinch to move on", meta lines) bake once. */
const textCache = new Map<string, Sprite>();
const TEXT_CACHE_MAX = 64;

export function textSprite(lines: readonly string[], r: Role, x: number, y: number, underline: string | null): Sprite {
  const key = `${r.name}|${x}|${y}|${underline ?? ''}|${lines.join('\n')}`;
  let s = textCache.get(key);
  if (s) {
    // Least-recently-used order: re-insert on hit.
    textCache.delete(key);
    textCache.set(key, s);
    return s;
  }
  s = bakeText(lines, r, x, y, underline);
  if (!fontReady()) return s;
  textCache.set(key, s);
  if (textCache.size > TEXT_CACHE_MAX) {
    const oldest = textCache.keys().next().value;
    if (oldest !== undefined) textCache.delete(oldest);
  }
  return s;
}

/** A one-line BREATH caption at baseline 424 (support captions are drawn outside the layer system). */
export function captionSprite(str: string, underline: string | null): Sprite {
  return textSprite([str], Roles.BREATH, 300, BREATH_TEXT_Y, underline);
}

/** Bakes lines that are certain to appear (call from idle frames; no-op until the font is ready). */
export function prebakeCommon(): boolean {
  if (!fontReady()) return false;
  textSprite([PINCH_HINT], Roles.FOOT, 300, FOOT_Y, null);
  return true;
}

// ---------------------------------------------------------------- layers (GS:194-289)

export interface Clock {
  now: number;
}

export interface TextItem {
  str: string;
  role: Role;
  y: number;
  x?: number;
  underline?: string | null;
}

class TextLayer {
  readonly lines: string[];
  readonly op = new Spring(0);
  start = 0;
  started = false;
  outAt = -1;
  sprite: Sprite | null = null;

  constructor(
    readonly str: string,
    readonly role: Role,
    readonly x: number,
    readonly y: number,
    readonly underline: string | null,
  ) {
    this.lines = isOneLine(role) ? [str] : wrap(str, role);
  }

  bake(): Sprite {
    if (this.sprite) return this.sprite;
    const s = textSprite(this.lines, this.role, this.x, this.y, this.underline);
    if (fontReady()) this.sprite = s;
    return s;
  }
}

/** Port of GlassScene's text layers with the phone-mirror fade rules. */
export class TextSystem {
  private layers: TextLayer[] = [];

  constructor(private readonly clock: Clock) {}

  /** setTexts (GS:265-289): keep identical lines, fade the rest out, stagger the new ones. */
  set(items: readonly TextItem[], dir = 0): void {
    const now = this.clock.now;
    const keep = new Set<TextLayer>();
    for (const l of items) {
      if (dir !== 0 && l.role !== Roles.SUB) continue;
      const u = l.underline ?? null;
      const k = this.layers.find((t) => t.outAt < 0 && t.str === l.str && t.role === l.role && t.underline === u && Math.abs(t.y - l.y) < 1);
      if (k) keep.add(k);
    }
    let fading = false;
    for (const t of this.layers) {
      if (!keep.has(t) && t.outAt < 0) {
        t.outAt = now;
        fading = true;
      }
    }
    const keptHas = (l: TextItem): boolean => {
      for (const k of keep) if (k.str === l.str && k.role === l.role) return true;
      return false;
    };
    const hasTitle = items.some((l) => isTitleRole(l.role) && !keptHas(l));
    for (const l of items) {
      if (keptHas(l)) continue;
      const t = new TextLayer(l.str, l.role, l.x ?? 300, l.y, l.underline ?? null);
      const stagger = (l.role === Roles.SUB || l.role === Roles.FOOT) && hasTitle ? 500 : 0;
      t.start = now + (dir !== 0 ? 0 : fading ? 220 : 0) + stagger;
      this.layers.push(t);
    }
  }

  clear(): void {
    this.set([]);
  }

  /** Lens grid: meta → title → subtitle, footer (lensTexts, GS:252-263). */
  grid(copy: Copy | null, metaY = META_Y, titleY = TITLE_Y, subY = SUB_Y): void {
    if (!copy) {
      this.set([]);
      return;
    }
    const lines = copy.title != null ? wrap(copy.title, Roles.TITLE).length : 1;
    const extra = ((lines - 1) * Roles.TITLE.size * 1.15) / 2;
    const items: TextItem[] = [];
    if (copy.meta != null) items.push({str: copy.meta, role: Roles.SUB, y: metaY - extra});
    if (copy.title != null) items.push({str: copy.title, role: Roles.TITLE, y: titleY});
    if (copy.sub != null) items.push({str: copy.sub, role: Roles.SUB, y: subY + extra});
    if (copy.footer) items.push({str: PINCH_HINT, role: Roles.FOOT, y: FOOT_Y});
    this.set(items);
  }

  /** One Figma one-liner with its underlined key word (breathCaption, GS:243-246). */
  caption(copy: Copy | null, r: Role = Roles.BREATH, y = BREATH_TEXT_Y): void {
    this.set(copy?.title != null ? [{str: copy.title, role: r, y, underline: copy.underline}] : []);
  }

  /** After the Support card: words not yet started wait ≥ 220 ms (GS:551). */
  delayUnstarted(ms: number): void {
    const at = this.clock.now + ms;
    for (const t of this.layers) if (!t.started && t.outAt < 0) t.start = Math.max(t.start, at);
  }

  step(dt: number): void {
    const now = this.clock.now;
    let baked = false;
    for (const t of this.layers) {
      if (!t.started && now >= t.start) {
        t.started = true;
        t.op.to(1);
      }
      t.op.step(dt);
      // Bake at most one waiting layer per frame ahead of its fade-in, to keep frames even.
      if (!baked && !t.sprite && t.outAt < 0) {
        t.bake();
        baked = true;
      }
    }
    if (this.layers.some((t) => t.outAt >= 0 && now - t.outAt > 340)) {
      this.layers = this.layers.filter((t) => !(t.outAt >= 0 && now - t.outAt > 340));
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const now = this.clock.now;
    for (const t of this.layers) {
      const a = t.op.value * (t.outAt >= 0 ? clamp01(1 - (now - t.outAt) / 300) : 1);
      if (a <= 0.003) continue;
      blit(ctx, t.bake(), a);
    }
  }

  /** Reduce motion: drop outgoing lines and show the rest at once (snapAll, GS:602-603). */
  snapAll(): void {
    this.layers = this.layers.filter((t) => t.outAt < 0);
    for (const t of this.layers) {
      t.start = this.clock.now;
      t.started = true;
      t.op.set(1);
    }
  }

  get count(): number {
    return this.layers.length;
  }
}

