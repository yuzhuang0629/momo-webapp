// Rub your fingers (USER_FLOW #6), the team's 5.0摩擦手指 (Figma 5.0 → 5.3 → 5.1): GlassScene.kt
// drawFingers / drawFingersHand / drawFingersThumb (GS:1414-1488, constants GS:1958-1980).
//
// The thumb rubs, 2.4 s a rub (5.1摩擦手指: rests at the top 16 %, pressed and dragged down 40 % with
// the beads sliding along with the tip, rests at the bottom 16 %, lifted back up), each rub carrying
// the bracelet one bead; the far beads (60 %) sit behind the hand, the near ones (50 %) in front.
// After two rubs the bracelet, its track and the arrow fade (2 s), the hand and thumb stay at 30 %,
// and the two dots, the dotted line and the caption fade in (1.6 s); the
// dots brighten in turn with the thumb. Reduce motion: the finished page, nothing moving.
import {FINGERS_LINE} from './copy';
import {BEAD_Z_HAND, beadLayout, drawBeadArrow, drawBeadSet, drawBeadTrack, smoothstep} from './beads';
import {LOGO_GLOW, type Rgb} from './palette';
import {blit, ctx2d, drawGlowDot, makeSprite, newCanvas, type Sprite} from './sprites';
import type {State} from './state';
import {captionSprite, fontReady} from './text';

const PERIOD = 2.4; // one rub (s)
const HOLD = 0.16; // share of a rub the thumb rests at each end
const DRAG = 0.4; // share spent dragging down; the rest is the lift back up
const AMP = 11; // degrees the thumb swings
const RUBS = 2; // rubs before the bracelet fades for good
const FADE = 2;
const HAND_END = 0.3; // the hand and thumb stay at 30 %
const PAGE_IN = 1.6;
const HAND_BOX = [97.37, 18.8, 387.3, 493.4] as const; // clip box; the image is 109.5 % tall from −0.06 %
const THUMB_BOX = [243.6, 179, 104.8, 145] as const; // turned −30.95° about its centre
const THUMB_TURN = (-30.95 * Math.PI) / 180;
const SWING_X = 319.5; // the thumb swings about its base
const SWING_Y = 299.3;
const DOT_X = 244.44; // Ellipse 2368 / 2369: r 16.07, white / #9B9B9B, glow σ 5.8
const DOT_TOP_Y = 204.94;
const DOT_BOTTOM_Y = 291.04;
const DOT_R = 16.07;
const DOT_GREY: Rgb = [155, 155, 155];
const LINE_TOP = 212.49; // Vector 3: 79.37 px, dashes .5 / 9, 2 px, turned −0.58°
const LINE_LEN = 79.368;
export const FG_CAPTION_Y = 417.61; // text box top 395.01
const UNDERLINE = 'rubbing';

// The "#all" group (hand, near beads, arrow, thumb) fades as one picture: an offscreen layer over
// the hand's box, which holds everything in the group.
const LAYER_X = Math.floor(HAND_BOX[0]) - 2;
const LAYER_Y = Math.floor(HAND_BOX[1]) - 2;
const LAYER_W = Math.ceil(HAND_BOX[2]) + 4;
const LAYER_H = Math.ceil(HAND_BOX[3]) + 4;

let handImg: HTMLImageElement | null = null;
let thumbImg: HTMLImageElement | null = null;
let handSprite: Sprite | null = null;
let lineSprite: Sprite | null = null;
let layer: CanvasRenderingContext2D | null = null;

function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img;
}

const loaded = (img: HTMLImageElement | null): img is HTMLImageElement => !!img && img.complete && img.naturalWidth > 0;

/** Starts loading the two PNGs (lazily: from the idle prebake queue, after the first frames). */
function load(): void {
  handImg ??= loadImage('/scene/fingers_hand.png');
  thumbImg ??= loadImage('/scene/fingers_thumb.png');
}

/** 5.x "Background": the hand, its image 109.5 % tall from −0.06 %, clipped to its box; baked once. */
function bakeHand(img: HTMLImageElement): Sprite {
  const [x, y, w, h] = HAND_BOX;
  return makeSprite(x, y, x + w, y + h, (ctx) => {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y - 0.0006 * h, w, 1.095 * h);
  });
}

function bakeLine(): Sprite {
  const cy = LINE_TOP + LINE_LEN / 2;
  return makeSprite(DOT_X - 4, LINE_TOP - 2, DOT_X + 4, LINE_TOP + LINE_LEN + 2, (ctx) => {
    ctx.translate(DOT_X, cy);
    ctx.rotate((-0.58 * Math.PI) / 180);
    ctx.translate(-DOT_X, -cy);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'butt';
    ctx.setLineDash([0.5, 9]);
    ctx.beginPath();
    ctx.moveTo(DOT_X, LINE_TOP);
    ctx.lineTo(DOT_X, LINE_TOP + LINE_LEN);
    ctx.stroke();
  });
}

function ensure(): void {
  load();
  lineSprite ??= bakeLine();
  layer ??= ctx2d(newCanvas(LAYER_W, LAYER_H));
  if (!handSprite && loaded(handImg)) handSprite = bakeHand(handImg);
}

/** Idle-time bake of everything this screen draws; false until the PNGs and the font are ready. */
export function prebakeFingers(): boolean {
  ensure();
  if (!handSprite || !loaded(thumbImg) || !fontReady()) return false;
  captionSprite(FINGERS_LINE, UNDERLINE, FG_CAPTION_Y);
  return true;
}

/** 5.x "Object": the thumb in its 5.1 pose (−30.95°), swung about its base by the rub. */
function drawThumb(ctx: CanvasRenderingContext2D, ang: number, lift: number, press: number): void {
  if (!loaded(thumbImg)) return;
  const [bx, by, bw, bh] = THUMB_BOX;
  ctx.save();
  ctx.translate(SWING_X, SWING_Y);
  ctx.translate(-lift * 2, -lift * 3 + press * 1.2);
  ctx.rotate((ang * Math.PI) / 180);
  const sc = 1 - 0.012 * press;
  ctx.scale(sc, sc);
  ctx.translate(-SWING_X, -SWING_Y);
  ctx.translate(bx + bw / 2, by + bh / 2);
  ctx.rotate(THUMB_TURN);
  ctx.translate(-bw / 2, -bh / 2);
  ctx.drawImage(thumbImg, 0.0001 * bw, 0.0112 * bh, 0.9986 * bw, 0.9794 * bh);
  ctx.restore();
}

/** The group's content (hand, near beads, arrow, thumb) at full group opacity. */
function drawGroup(ctx: CanvasRenderingContext2D, vis: number, beads: boolean, ang: number, lift: number, press: number): void {
  if (handSprite) blit(ctx, handSprite, 1);
  if (beads) drawBeadSet(ctx, 0.5 * vis, BEAD_Z_HAND, Infinity);
  if (vis > 0.003) drawBeadArrow(ctx, 0.5 * vis);
  drawThumb(ctx, ang, lift, press);
}

export function drawFingers(ctx: CanvasRenderingContext2D, s: State, op: number, reduceMotion: boolean): void {
  ensure();
  const t = reduceMotion ? RUBS * PERIOD + FADE + PAGE_IN : (s.now - s.fingersT0) / 1000;
  const tf = t - RUBS * PERIOD; // time since the last counted rub ended
  const vis = tf < 0 ? 1 : 1 - smoothstep(tf / FADE);
  const allA = HAND_END + (1 - HAND_END) * vis;
  const pageA = smoothstep((tf - FADE) / PAGE_IN);
  const cyc = reduceMotion ? 0 : t / PERIOD; // the thumb keeps rubbing after the bracelet is gone
  const n = Math.floor(cyc);
  const fr = cyc - n;
  // 5.1摩擦手指: rest at the top | drag down, pad pressed, the beads sliding with the tip | rest at
  // the bottom | lift back up (GS:1426-1435).
  const t1 = HOLD, t2 = t1 + DRAG, t3 = t2 + HOLD;
  let ang: number;
  let lift = 0;
  let press = 0;
  let slide: number;
  if (fr < t1) {
    ang = AMP;
    slide = 0;
  } else if (fr < t2) {
    const x = (fr - t1) / DRAG;
    slide = 0.7 * x + 0.3 * smoothstep(x);
    ang = AMP * (1 - 2 * slide);
    press = Math.sin(Math.PI * x);
  } else if (fr < t3) {
    ang = -AMP;
    slide = 1;
  } else {
    slide = 1;
    const x = smoothstep((fr - t3) / (1 - t3));
    ang = -AMP + 2 * AMP * x;
    lift = Math.sin(Math.PI * x);
  }
  const beads = vis > 0.003;
  if (beads) {
    beadLayout(n + slide - 1);
    drawBeadTrack(ctx, 0.6 * vis * op);
    drawBeadSet(ctx, 0.6 * vis * op, -Infinity, BEAD_Z_HAND);
  }
  const ga = allA * op;
  if (ga >= 0.999) drawGroup(ctx, vis, beads, ang, lift, press);
  else if (ga > 0.003 && layer) {
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, LAYER_W, LAYER_H);
    layer.setTransform(1, 0, 0, 1, -LAYER_X, -LAYER_Y);
    drawGroup(layer, vis, beads, ang, lift, press);
    ctx.globalAlpha = ga;
    ctx.drawImage(layer.canvas, LAYER_X, LAYER_Y);
    ctx.globalAlpha = 1;
  }
  const pa = pageA * op;
  if (pa <= 0.003) return;
  const up = (ang / AMP + 1) / 2; // 1 with the tip raised, 0 with it down
  drawGlowDot(ctx, DOT_X, DOT_TOP_Y, DOT_R, pa * (0.3 + 0.7 * up), LOGO_GLOW);
  drawGlowDot(ctx, DOT_X, DOT_BOTTOM_Y, DOT_R, pa * (1 - 0.7 * up), LOGO_GLOW, DOT_GREY);
  if (lineSprite) blit(ctx, lineSprite, pa);
  blit(ctx, captionSprite(FINGERS_LINE, UNDERLINE, FG_CAPTION_Y), pa);
}
