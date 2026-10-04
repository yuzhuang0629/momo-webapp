// Prayer-bead bracelet, Figma 4.0 (113-1157), motion from "4.0 转动珠子" (GlassScene.kt, live
// source 18:50, drawBeads + BEAD_SPOTS): eleven beads on a tilted loop seen from the side. At rest
// every bead sits exactly on its Figma spot with that spot's look; a turn slides every bead one
// spot along a smooth curve through the spots (down the front, up the back) while its size and
// look blend into the next spot's. A thin track behind, a dashed arrow on the left, no words.
import {blit, drawGlowDot, glowDotSprite, makeSprite, newCanvas, ctx2d, type Sprite} from './sprites';
import type {State} from './state';

/** One spot: centre, depth (drawing order), diameter, radial fill (centre/radius as fractions of
 * the bead's box, inner stop) and premultiplied (r, g, b, a) colours; hi = thumb highlight. */
interface Spot {
  x: number; y: number; z: number; d: number;
  gx: number; gy: number; gr: number; p0: number;
  inner: readonly number[]; outer: readonly number[]; rim: readonly number[]; hi: number;
}

const grey = (v: number, a = 1): readonly number[] => [v * a, v * a, v * a, a]; // premultiplied
const front = (x: number, y: number, z: number): Spot =>
  ({x, y, z, d: 83.11, gx: 0.3956, gy: 0.3545, gr: 0.7157, p0: 0, inner: grey(102), outer: grey(255), rim: grey(255), hi: 0});
const back = (x: number, y: number, z: number, d: number, fillA: number, rimA: number): Spot =>
  ({x, y, z, d, gx: 0.3956, gy: 0.3545, gr: 0.7157, p0: 0, inner: grey(255, fillA), outer: grey(255, fillA), rim: grey(255, rimA), hi: 0});

/**
 * The spots in the order a downward turn moves the beads (Figma frame px). z = Figma's layer order
 * (the team's 5.0 HTML: 10 on top); spots below BEAD_Z_HAND sit behind the 5.x hand.
 */
const SPOTS: readonly Spot[] = [
  {x: 310.5, y: 144.5, z: 10, d: 73, gx: 0.3956, gy: 0.3545, gr: 0.7157, p0: 0, inner: grey(75), outer: grey(171), rim: grey(255, 0.7), hi: 0}, // Frame 11: over the top
  front(260.55, 190.55, 7), // Frame 9
  {x: 238, y: 266, z: 9, d: 84, gx: 0.3525, gy: 0.3156, gr: 0.5667, p0: 0.274, inner: grey(76), outer: grey(255), rim: grey(255), hi: 1}, // Frame 2: under the thumb
  front(238.55, 344.55, 8), // Frame 4
  front(254.55, 416.55, 6), // Frame 8
  {x: 291.5, y: 452.5, z: 5, d: 73, gx: 0.3956, gy: 0.3545, gr: 0.7157, p0: 0, inner: grey(102), outer: grey(102), rim: grey(163), hi: 0}, // Frame 7: round the bottom
  back(332.5, 425.5, 3, 65, 0.2, 0.5), // Ellipse 2389
  back(351.5, 372.5, 2, 65, 0.1, 0.3), // Ellipse 2390
  back(367.95, 312.95, 1, 61.9, 0.1, 0.3), // Ellipse 2391
  back(363.95, 251.95, 2, 61.9, 0.1, 0.3), // Ellipse 2392
  back(352.95, 190.95, 3, 61.9, 0.2, 0.5), // Ellipse 2393
];
/** Beads with z below this sit behind the fingers screen's hand (GS:1935). */
export const BEAD_Z_HAND = 4.5;
const N = SPOTS.length;

/**
 * One turn (smoothstep). The prototype snaps in ~0.3 s; Android slows it to 900 ms only because its
 * lens stream manages ≤ 10 fps. The web app renders at 30 fps on the glasses, so it keeps the
 * prototype's rhythm.
 */
export const BEAD_TURN_MS = 300;
/** Reduce motion: the brief dim that marks a turn (the beads don't move). */
export const BEAD_PULSE_MS = 400;
const RIM = 1.621;
const HI_DX = -0.1444; // Ellipse 2367 (Frame 2's SVG: centre 29.87, 24.87 of 84), as fractions of the bead's diameter
const HI_DY = -0.2039;
const HI_R = 0.0863;
const HI_GLOW = 6.86; // drop-shadow σ 4.46
/** Highlight radii are quantised so each glow is baked once (≤ 0.125 px off). */
const HI_R_STEP = 0.25;
const TRACK_CX = 301.06; // Ellipse 2388: 114.64 × 326.14, turned 5.62° clockwise
const TRACK_CY = 307.55;
const TRACK_W = 114.64;
const TRACK_H = 326.14;
const TRACK_TILT = (5.623 * Math.PI) / 180;
const ARROW_X = 148.07; // Arrow 1 (its SVG, centred on the layer)
const ARROW_Y = 232.35;
const ARROW_PATH =
  'M8.5364 135.038C9.00839 135.325 9.6235 135.175 9.91028 134.703L14.5837 127.012C14.8704 126.54 14.7203 125.924 14.2483 125.638C13.7763 125.351 13.1612 125.501 12.8744 125.973L8.72031 132.81L1.8834 128.656C1.41141 128.369 0.796307 128.519 0.509525 128.991C0.222743 129.463 0.372885 130.078 0.844875 130.365L8.5364 135.038ZM9.05566 0.237061L8.08419 -6.76513e-05C7.74881 1.37391 7.42387 2.74977 7.10937 4.1274L8.08428 4.34997L9.0592 4.57254C9.37149 3.20463 9.69413 1.83847 10.0271 0.474189L9.05566 0.237061ZM6.32666 12.6171L5.34552 12.4238C4.79861 15.1997 4.29367 17.9819 3.8307 20.7692L4.81719 20.9331L5.80367 21.0969C6.26338 18.3292 6.76475 15.5668 7.3078 12.8104L6.32666 12.6171ZM3.55724 29.2905L2.56629 29.1562C2.18651 31.9593 1.84889 34.7666 1.55342 37.5773L2.54794 37.6819L3.54246 37.7864C3.83584 34.9956 4.17109 32.208 4.54818 29.4247L3.55724 29.2905ZM1.79018 46.0997L0.792979 46.025C0.581603 48.8451 0.412493 51.6676 0.285648 54.4916L1.28464 54.5364L2.28363 54.5813C2.40958 51.7773 2.5775 48.9747 2.78738 46.1744L1.79018 46.0997ZM1.03176 62.9845L0.0318708 62.9695C-0.0104322 65.7967 -0.0104322 68.6242 0.0318708 71.4513L1.03176 71.4364L2.03165 71.4214C1.98964 68.6143 1.98964 65.8066 2.03165 62.9995L1.03176 62.9845ZM1.28464 79.8845L0.285648 79.9293C0.412493 82.7533 0.581603 85.5758 0.792979 88.3959L1.79018 88.3212L2.78738 88.2465C2.5775 85.4462 2.40958 82.6436 2.28363 79.8396L1.28464 79.8845ZM2.54794 96.739L1.55342 96.8436C1.84889 99.6543 2.18651 102.462 2.56629 105.265L3.55724 105.13L4.54818 104.996C4.17109 102.213 3.83584 99.4253 3.54246 96.6345L2.54794 96.739ZM4.81719 113.488L3.8307 113.652C4.29367 116.439 4.79861 119.221 5.34552 121.997L6.32666 121.804L7.3078 121.611C6.76475 118.854 6.26338 116.092 5.80367 113.324L4.81719 113.488ZM8.08428 130.071L7.10936 130.293C7.42387 131.671 7.74881 133.047 8.08419 134.421L9.05566 134.184L10.0271 133.947C9.69413 132.582 9.37148 131.216 9.0592 129.848L8.08428 130.071Z';

/** Scene box the bracelet (beads, track, arrow) fits in; used for the group-fade layer. */
const BOX_X = 140;
const BOX_Y = 100;
const BOX_W = 300;
const BOX_H = 400;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (t: number): number => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

let trackSprite: Sprite | null = null;
let arrowSprite: Sprite | null = null;
let layer: CanvasRenderingContext2D | null = null;

/**
 * Ellipse 2388's angular gradient (GS beadTrackShader): stops transparent .501, grey .65 at .644,
 * .6 at .914, transparent .983, placed with Figma's gradientTransform (which maps the ellipse's
 * unit box to gradient space). Baked per pixel once: stroke mask × sweep colour.
 */
function bakeTrack(): Sprite {
  const pad = 4;
  return makeSprite(TRACK_CX - TRACK_H / 2 - pad, TRACK_CY - TRACK_H / 2 - pad, TRACK_CX + TRACK_H / 2 + pad, TRACK_CY + TRACK_H / 2 + pad, (ctx) => {
    ctx.save();
    ctx.translate(TRACK_CX, TRACK_CY);
    ctx.rotate(TRACK_TILT);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, TRACK_W / 2 - 0.5, TRACK_H / 2 - 0.5, 0, 0, Math.PI * 2); // inside stroke
    ctx.stroke();
    ctx.restore();
    const t = ctx.getTransform();
    const ox = -t.e;
    const oy = -t.f;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const px = img.data;
    const cos = Math.cos(-TRACK_TILT);
    const sin = Math.sin(-TRACK_TILT);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = (j * w + i) * 4;
        const mask = px[k + 3]!;
        if (mask === 0) continue;
        // Scene → ellipse-local (unrotated) → unit box → gradient space.
        const sx = ox + i + 0.5 - TRACK_CX;
        const sy = oy + j + 0.5 - TRACK_CY;
        const lx = sx * cos - sy * sin;
        const ly = sx * sin + sy * cos;
        const u = lx / TRACK_W + 0.5;
        const v = ly / TRACK_H + 0.5;
        const gx = 0.0056014 * u + 1.0922309 * v - 0.0489161;
        const gy = -1.0922309 * u + 0.0609913 * v + 1.0156198;
        let f = Math.atan2(gy - 0.5, gx - 0.5) / (2 * Math.PI);
        if (f < 0) f += 1;
        const [grey, alpha] = sweep(f);
        px[k] = grey;
        px[k + 1] = grey;
        px[k + 2] = grey;
        px[k + 3] = Math.round(mask * alpha);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** The sweep's colour at f (0…1): returns [grey level, alpha]. */
function sweep(f: number): [number, number] {
  if (f <= 0.5012 || f >= 0.9829) return [0xa6, 0];
  if (f < 0.6442) return [0xa6, (f - 0.5012) / (0.6442 - 0.5012)];
  if (f < 0.9142) return [Math.round(lerp(0xa6, 0x99, (f - 0.6442) / (0.9142 - 0.6442))), 1];
  return [0x99, 1 - (f - 0.9142) / (0.9829 - 0.9142)];
}

export function warmBeads(): void {
  trackSprite ??= bakeTrack();
  arrowSprite ??= makeSprite(ARROW_X - 2, ARROW_Y - 2, ARROW_X + 17, ARROW_Y + 138, (ctx) => {
    ctx.translate(ARROW_X, ARROW_Y);
    ctx.fillStyle = '#fff';
    ctx.fill(new Path2D(ARROW_PATH));
  });
  layer ??= ctx2d(newCanvas(BOX_W, BOX_H));
}

let prebaked = 0;
/** Bakes the highlight glow sizes a turn passes through (6.25 … 7.25 px), one per frame. */
export function prebakeBeads(): boolean {
  const rs = [6.25, 6.5, 6.75, 7, 7.25];
  if (prebaked < rs.length) glowDotSprite(rs[prebaked++]!, HI_GLOW);
  return prebaked >= rs.length;
}

/** Centripetal Catmull–Rom from p1 to p2 at t: a smooth loop through every spot. */
const curve = {x: 0, y: 0};
function beadCurve(p0: Spot, p1: Spot, p2: Spot, p3: Spot, t: number): void {
  const t1 = Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y));
  const t2 = t1 + Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y));
  const t3 = t2 + Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y));
  const tt = lerp(t1, t2, t);
  const w = (ta: number, tb: number) => (tb - ta < 1e-4 ? 0 : (tt - ta) / (tb - ta));
  const a1x = lerp(p0.x, p1.x, w(0, t1)), a1y = lerp(p0.y, p1.y, w(0, t1));
  const a2x = lerp(p1.x, p2.x, w(t1, t2)), a2y = lerp(p1.y, p2.y, w(t1, t2));
  const a3x = lerp(p2.x, p3.x, w(t2, t3)), a3y = lerp(p2.y, p3.y, w(t2, t3));
  const b1x = lerp(a1x, a2x, w(0, t2)), b1y = lerp(a1y, a2y, w(0, t2));
  const b2x = lerp(a2x, a3x, w(t1, t3)), b2y = lerp(a2y, a3y, w(t1, t3));
  curve.x = lerp(b1x, b2x, w(t1, t2));
  curve.y = lerp(b1y, b2y, w(t1, t2));
}

/** Blend two premultiplied colours and return a CSS colour at [alpha] (or null when fully transparent). */
function pmColor(p: readonly number[], q: readonly number[], s: number, alpha: number): string | null {
  const al = lerp(p[3]!, q[3]!, s);
  if (al <= 0.0001 || alpha <= 0) return null;
  const k = 1 / al;
  const c = (i: number) => Math.min(255, Math.round(lerp(p[i]!, q[i]!, s) * k));
  return `rgba(${c(0)},${c(1)},${c(2)},${(Math.round(al * alpha * 255) / 255).toFixed(4)})`;
}

const bx = new Float64Array(N);
const by = new Float64Array(N);
const bz = new Float64Array(N);
const bk = new Int8Array(N);
const bf = new Float64Array(N);
const order = new Int8Array(N);

/** Where the beads are along the loop (in spots), eased from beadFrom to beadTarget. */
export function beadPos(s: State): number {
  return lerp(s.beadFrom, s.beadTarget, smoothstep((s.now - s.beadStart) / BEAD_TURN_MS));
}

export function drawBeads(ctx: CanvasRenderingContext2D, s: State, a0: number): void {
  warmBeads();
  // Reduce motion: a turn dims the bracelet for a moment instead of moving it.
  const pulse = s.beadPulseAt < 0 ? 0 : Math.sin(Math.min(1, Math.max(0, (s.now - s.beadPulseAt) / BEAD_PULSE_MS)) * Math.PI);
  const a = a0 * (1 - 0.4 * pulse);
  // Fade the bracelet as one picture (CSS opacity), so overlapping beads don't show through.
  if (a >= 0.999 || !layer) {
    drawOpaque(ctx, s);
    return;
  }
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.clearRect(0, 0, BOX_W, BOX_H);
  layer.setTransform(1, 0, 0, 1, -BOX_X, -BOX_Y);
  drawOpaque(layer, s);
  ctx.globalAlpha = a;
  ctx.drawImage(layer.canvas, BOX_X, BOX_Y);
  ctx.globalAlpha = 1;
}

function drawOpaque(ctx: CanvasRenderingContext2D, s: State): void {
  drawBeadTrack(ctx, 1);
  beadLayout(beadPos(s));
  drawBeadSet(ctx, 1, -Infinity, Infinity);
  drawBeadArrow(ctx, 1);
}

/** The thin track behind the beads (Ellipse 2388) at [a]. */
export function drawBeadTrack(ctx: CanvasRenderingContext2D, a: number): void {
  warmBeads();
  if (trackSprite) blit(ctx, trackSprite, a);
}

/** The dashed arrow (Arrow 1) at [a]. */
export function drawBeadArrow(ctx: CanvasRenderingContext2D, a: number): void {
  warmBeads();
  if (arrowSprite) blit(ctx, arrowSprite, a);
}

/**
 * Lays every bead out at bracelet position [pos] (beadLayout, GS:1376-1388) into the shared
 * buffers, back to front; drawBeadSet then draws them.
 */
export function beadLayout(pos: number): void {
  for (let i = 0; i < N; i++) {
    const u = (((i + pos) % N) + N) % N;
    const k = Math.min(N - 1, Math.floor(u));
    const f = u - k;
    const p = SPOTS[k]!;
    const q = SPOTS[(k + 1) % N]!;
    beadCurve(SPOTS[(k + N - 1) % N]!, p, q, SPOTS[(k + 2) % N]!, f);
    bx[i] = curve.x;
    by[i] = curve.y;
    bz[i] = lerp(p.z, q.z, f);
    bk[i] = k;
    bf[i] = f;
    order[i] = i;
  }
  // Back to front (stable insertion sort, like Kotlin's sortedBy).
  for (let i = 1; i < N; i++) {
    const v = order[i]!;
    let j = i - 1;
    while (j >= 0 && bz[order[j]!]! > bz[v]!) {
      order[j + 1] = order[j]!;
      j--;
    }
    order[j + 1] = v;
  }
}

/** Draws the laid-out beads with zMin ≤ z < zMax at [a] (drawBeadSet, GS:1390-1396). */
export function drawBeadSet(ctx: CanvasRenderingContext2D, a: number, zMin: number, zMax: number): void {
  if (a <= 0.003) return;
  for (let n = 0; n < N; n++) {
    const i = order[n]!;
    const z = bz[i]!;
    if (z < zMin || z >= zMax) continue;
    const k = bk[i]!;
    drawBead(ctx, bx[i]!, by[i]!, SPOTS[k]!, SPOTS[(k + 1) % N]!, smoothstep(bf[i]!), a);
  }
}

/** One bead between spots p and q, s of the way: size, radial fill, rim and highlight blended. */
function drawBead(ctx: CanvasRenderingContext2D, x: number, y: number, p: Spot, q: Spot, s: number, a: number): void {
  const d = lerp(p.d, q.d, s);
  const r = d / 2;
  const ci = pmColor(p.inner, q.inner, s, a);
  const co = pmColor(p.outer, q.outer, s, a);
  if (ci !== null || co !== null) {
    if (ci === co) ctx.fillStyle = ci!;
    else {
      const p0 = Math.min(0.999, Math.max(0, lerp(p.p0, q.p0, s)));
      const g = ctx.createRadialGradient(
        x - r + lerp(p.gx, q.gx, s) * d, y - r + lerp(p.gy, q.gy, s) * d, 0,
        x - r + lerp(p.gx, q.gx, s) * d, y - r + lerp(p.gy, q.gy, s) * d, Math.max(1, lerp(p.gr, q.gr, s) * d),
      );
      const inner = ci ?? 'rgba(0,0,0,0)';
      g.addColorStop(0, inner);
      g.addColorStop(p0, inner);
      g.addColorStop(1, co ?? 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const rim = pmColor(p.rim, q.rim, s, a);
  if (rim !== null) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = RIM;
    ctx.beginPath();
    ctx.arc(x, y, r - RIM / 2, 0, Math.PI * 2); // the rim sits inside the bead, as in Figma
    ctx.stroke();
  }
  const hi = lerp(p.hi, q.hi, s);
  if (hi > 0.003) {
    const hr = Math.round((HI_R * d) / HI_R_STEP) * HI_R_STEP;
    drawGlowDot(ctx, x + HI_DX * d, y + HI_DY * d, hr, a * hi, HI_GLOW);
  }
}
