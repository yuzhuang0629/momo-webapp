// Simulated view (?sim=1), for people who scan a QR code on a phone or open the link on a desktop:
// a pair of clear-acetate Wayfarer-style glasses on a plain background, drawn in proportion, with
// the Momo display (the lens canvas, background colour and all) as a rounded block inside the
// right lens, the eye Meta Ray-Ban Display shows in. The lenses themselves are clear. Purely
// visual; the session plays by itself. The frame is an original drawing (no logos).

const PAGE_TOP = '#EEEBE4';
const PAGE_BOTTOM = '#DCD8CF';
const CAPTION_COLOR = 'rgba(40,40,40,.5)';
/** The front of the frame, width : height. */
const FRAME_ASPECT = 2.85;
/** The display block, relative to the lens height, centred in the right lens. */
const DISPLAY_SCALE = 0.78;
/** The display's own corner radius (Figma frame 17: 18 of 600). */
const DISPLAY_CORNER = 18 / 600;

/** Lens boxes in frame coordinates (0…1); the left lens mirrors the right. */
const RIGHT_LENS = {x0: 0.54, x1: 0.94, y0: 0.16, y1: 0.87};
const LEFT_LENS = {x0: 1 - RIGHT_LENS.x1, x1: 1 - RIGHT_LENS.x0, y0: RIGHT_LENS.y0, y1: RIGHT_LENS.y1};

/** A Wayfarer-ish right lens in its own box (u = 1 is the outer edge): wide top, tapered bottom. */
const LENS_SHAPE: ReadonlyArray<readonly number[]> = [
  [0.04, 0.06], // move
  [0.35, 0.0, 0.75, -0.01, 0.97, 0.02], // top edge
  [1.0, 0.15, 0.99, 0.45, 0.93, 0.62], // outer side
  [0.88, 0.85, 0.82, 0.97, 0.7, 0.98], // outer bottom corner
  [0.55, 1.0, 0.35, 1.0, 0.22, 0.97], // bottom
  [0.08, 0.94, 0.01, 0.78, 0.02, 0.55], // inner bottom corner
  [0.03, 0.3, 0.02, 0.12, 0.04, 0.06], // inner side
];

type Box = {x: number; y: number; w: number; h: number};

export interface SimView {
  /** Draw the glasses with the current lens frame in the right lens (after the lens canvas is drawn). */
  draw(lens: HTMLCanvasElement): void;
}

function canvas2d(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

export function createSimView(): SimView {
  const view = document.createElement('canvas');
  view.className = 'sim-world';
  view.setAttribute('aria-hidden', 'true');
  document.body.prepend(view);
  const ctx = view.getContext('2d', {alpha: false});
  if (!ctx) throw new Error('2D canvas unavailable');

  let dpr = 1;
  let frame: Box = {x: 0, y: 0, w: 0, h: 0};
  let right: Box = frame;
  /** Page, shadow, clear frame and lens sheen: everything but the display, baked on resize. */
  let backdrop = canvas2d(1, 1);

  function lensPath(b: Box, mirror: boolean): Path2D {
    const p = new Path2D();
    const X = (u: number) => b.x + (mirror ? 1 - u : u) * b.w;
    const Y = (v: number) => b.y + v * b.h;
    const [m, ...curves] = LENS_SHAPE;
    p.moveTo(X(m![0]!), Y(m![1]!));
    for (const c of curves) p.bezierCurveTo(X(c[0]!), Y(c[1]!), X(c[2]!), Y(c[3]!), X(c[4]!), Y(c[5]!));
    p.closePath();
    return p;
  }

  function layout(): void {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(window.innerWidth * dpr));
    const H = Math.max(1, Math.round(window.innerHeight * dpr));
    view.width = W;
    view.height = H;
    const w = Math.min(W * 0.9, H * 0.78 * FRAME_ASPECT);
    const h = w / FRAME_ASPECT;
    frame = {x: (W - w) / 2, y: H * 0.45 - h / 2, w, h};
    const box = (l: typeof RIGHT_LENS): Box => ({
      x: frame.x + l.x0 * w,
      y: frame.y + l.y0 * h,
      w: (l.x1 - l.x0) * w,
      h: (l.y1 - l.y0) * h,
    });
    right = box(RIGHT_LENS);
    const left = box(LEFT_LENS);
    const rightPath = lensPath(right, false);
    const leftPath = lensPath(left, true);

    // 1. The frame as a solid mask: rims round both lenses, the brow bar, the bridge and the hinge
    //    stubs, painted in one colour (so overlaps don't double up), then the lenses cut out.
    const mask = canvas2d(W, H);
    mask.fillStyle = '#000';
    mask.strokeStyle = '#000';
    mask.lineJoin = 'round';
    mask.lineWidth = h * 0.11;
    for (const p of [leftPath, rightPath]) {
      mask.fill(p);
      mask.stroke(p);
    }
    mask.beginPath();
    mask.roundRect(frame.x + w * 0.025, frame.y + h * 0.02, w * 0.95, h * 0.17, h * 0.085); // brow bar
    mask.roundRect(frame.x + w * 0.45, frame.y + h * 0.12, w * 0.1, h * 0.13, h * 0.05); // bridge
    mask.roundRect(frame.x - w * 0.006, frame.y + h * 0.05, w * 0.04, h * 0.12, h * 0.04); // left hinge
    mask.roundRect(frame.x + w * 0.966, frame.y + h * 0.05, w * 0.04, h * 0.12, h * 0.04); // right hinge
    mask.fill();
    mask.globalCompositeOperation = 'destination-out';
    mask.fill(leftPath);
    mask.fill(rightPath);

    // 2. Clear acetate: the mask tinted a translucent milky white, lighter along the top.
    const acetate = canvas2d(W, H);
    acetate.drawImage(mask.canvas, 0, 0);
    acetate.globalCompositeOperation = 'source-in';
    const body = acetate.createLinearGradient(0, frame.y, 0, frame.y + h);
    body.addColorStop(0, 'rgba(255,255,255,.78)');
    body.addColorStop(0.5, 'rgba(250,249,246,.55)');
    body.addColorStop(1, 'rgba(240,238,233,.62)');
    acetate.fillStyle = body;
    acetate.fillRect(0, 0, W, H);

    // 3. The backdrop: page gradient, a soft shadow, a thin outline, the acetate, highlights.
    const b = canvas2d(W, H);
    const page = b.createLinearGradient(0, 0, 0, H);
    page.addColorStop(0, PAGE_TOP);
    page.addColorStop(1, PAGE_BOTTOM);
    b.fillStyle = page;
    b.fillRect(0, 0, W, H);
    b.save();
    b.filter = `blur(${Math.round(h * 0.06)}px)`;
    b.globalAlpha = 0.16;
    b.drawImage(mask.canvas, 0, h * 0.12);
    b.restore();
    // Outline: the mask drawn darker a hair's width around, under the acetate.
    b.save();
    b.globalAlpha = 0.22;
    const o = Math.max(1, dpr * 0.9);
    for (const [dx, dy] of [[o, 0], [-o, 0], [0, o], [0, -o]] as const) b.drawImage(mask.canvas, dx, dy);
    b.restore();
    b.drawImage(acetate.canvas, 0, 0);
    // Highlights: a bright streak along the brow bar and a faint glint on each rim.
    b.save();
    b.globalCompositeOperation = 'source-atop';
    b.strokeStyle = 'rgba(255,255,255,.55)';
    b.lineCap = 'round';
    b.lineWidth = Math.max(1, h * 0.01);
    b.beginPath();
    b.moveTo(frame.x + w * 0.06, frame.y + h * 0.06);
    b.lineTo(frame.x + w * 0.94, frame.y + h * 0.06);
    b.stroke();
    b.restore();
    // Clear lenses: no colour, just a faint diagonal reflection.
    for (const [p, l] of [[leftPath, left], [rightPath, right]] as const) {
      b.save();
      b.clip(p);
      const g = b.createLinearGradient(l.x, l.y, l.x + l.w, l.y + l.h);
      g.addColorStop(0, 'rgba(255,255,255,.35)');
      g.addColorStop(0.3, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      b.fillStyle = g;
      b.fillRect(l.x, l.y, l.w, l.h);
      b.restore();
      b.save();
      b.strokeStyle = 'rgba(0,0,0,.12)';
      b.lineWidth = Math.max(1, dpr * 0.8);
      b.stroke(p);
      b.restore();
    }
    // The label under the glasses; on a portrait phone, a hint to turn it.
    const fs = Math.max(11 * dpr, Math.min(16 * dpr, w * 0.028));
    b.fillStyle = CAPTION_COLOR;
    b.font = `300 ${fs}px "Elms Sans", sans-serif`;
    b.textAlign = 'center';
    b.textBaseline = 'top';
    const below = frame.y + h + fs * 2.2;
    b.fillText('Momo · simulated view through the glasses', W / 2, below);
    if (H > W) b.fillText('Turn your phone sideways for a larger view', W / 2, below + fs * 1.6);
    backdrop = b;
  }

  layout();
  window.addEventListener('resize', layout);
  // The caption uses Elms Sans: re-bake once the font has loaded.
  void document.fonts.ready.then(layout);

  return {
    draw(lens) {
      ctx.drawImage(backdrop.canvas, 0, 0);
      // The display block with its own background colour, in the right lens; clipped to its
      // rounded corners so the lens canvas's black corner pixels don't show.
      const s = right.h * DISPLAY_SCALE;
      const x = right.x + (right.w - s) / 2;
      const y = right.y + (right.h - s) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, s * DISPLAY_CORNER);
      ctx.clip();
      ctx.drawImage(lens, x, y, s, s);
      ctx.restore();
    },
  };
}
