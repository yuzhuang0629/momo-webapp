// Simulated view (?sim=1), for people who scan a QR code on a phone or open the link on a desktop:
// a pair of Wayfarer-style glasses on a plain background, drawn in proportion, with the Momo
// display inside the right lens (the eye Meta Ray-Ban Display shows in). Each lens is filled with
// the lens background colour, so the display reads as lens-shaped rather than square; the lens
// image is laid over it with 'lighten' so its background and black corners vanish. Purely visual; the
// session plays by itself. The frame is an original drawing (no logos).

const PAGE_BG = '#E7E3DA';
const FRAME = '#151515';
const CAPTION_COLOR = 'rgba(30,30,30,.55)';
/** The front of the frame, width : height. */
const FRAME_ASPECT = 2.85;
/** Display size relative to the lens height (it is centred in the right lens). */
const DISPLAY_SCALE = 0.98;

/** Lens boxes in frame coordinates (0…1); the left lens mirrors the right. */
const RIGHT_LENS = {x0: 0.535, x1: 0.945, y0: 0.15, y1: 0.88};
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
  /** Composite the current lens frame into the glasses (call after the lens canvas is drawn). */
  draw(lens: HTMLCanvasElement): void;
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
  let left: Box = frame;
  let rightPath = new Path2D();
  let leftPath = new Path2D();

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
    view.width = Math.max(1, Math.round(window.innerWidth * dpr));
    view.height = Math.max(1, Math.round(window.innerHeight * dpr));
    const w = Math.min(view.width * 0.92, view.height * 0.8 * FRAME_ASPECT);
    const h = w / FRAME_ASPECT;
    frame = {x: (view.width - w) / 2, y: view.height * 0.46 - h / 2, w, h};
    const box = (l: typeof RIGHT_LENS): Box => ({
      x: frame.x + l.x0 * w,
      y: frame.y + l.y0 * h,
      w: (l.x1 - l.x0) * w,
      h: (l.y1 - l.y0) * h,
    });
    right = box(RIGHT_LENS);
    left = box(LEFT_LENS);
    rightPath = lensPath(right, false);
    leftPath = lensPath(left, true);
  }

  /** The black front: a rim around each lens, the brow bar, the bridge and the hinge stubs. */
  function drawFrame(): void {
    const {x, y, w, h} = frame;
    ctx!.fillStyle = FRAME;
    ctx!.strokeStyle = FRAME;
    ctx!.lineJoin = 'round';
    ctx!.lineWidth = h * 0.14;
    for (const p of [leftPath, rightPath]) {
      ctx!.fill(p);
      ctx!.stroke(p);
    }
    ctx!.beginPath();
    ctx!.roundRect(x + w * 0.02, y, w * 0.96, h * 0.22, h * 0.08); // brow bar
    ctx!.roundRect(x + w * 0.44, y + h * 0.1, w * 0.12, h * 0.2, h * 0.06); // bridge
    ctx!.roundRect(x - w * 0.012, y + h * 0.04, w * 0.05, h * 0.16, h * 0.04); // left hinge
    ctx!.roundRect(x + w * 0.962, y + h * 0.04, w * 0.05, h * 0.16, h * 0.04); // right hinge
    ctx!.fill();
    // A soft sheen along the top of the frame.
    const g = ctx!.createLinearGradient(0, y, 0, y + h * 0.22);
    g.addColorStop(0, 'rgba(255,255,255,.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx!.fillStyle = g;
    ctx!.beginPath();
    ctx!.roundRect(x + w * 0.03, y + h * 0.015, w * 0.94, h * 0.08, h * 0.04);
    ctx!.fill();
  }

  /** A faint diagonal reflection across a lens, so it reads as glass. */
  function drawSheen(p: Path2D, b: Box): void {
    ctx!.save();
    ctx!.clip(p);
    const g = ctx!.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, 'rgba(255,255,255,.10)');
    g.addColorStop(0.35, 'rgba(255,255,255,0)');
    ctx!.fillStyle = g;
    ctx!.fillRect(b.x, b.y, b.w, b.h);
    ctx!.restore();
  }

  layout();
  window.addEventListener('resize', layout);

  return {
    draw(lens) {
      const W = view.width;
      const H = view.height;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = PAGE_BG;
      ctx.fillRect(0, 0, W, H);
      drawFrame();

      // The lens background as the display currently shows it (it fades while finding the object):
      // sampled from inside the lens canvas's left edge, which only ever shows the background.
      const lctx = lens.getContext('2d');
      const px = lctx ? lctx.getImageData(10, 300, 1, 1).data : null;
      const tint = px ? `rgb(${px[0]},${px[1]},${px[2]})` : '#3F4A14';

      for (const [p, b] of [[leftPath, left], [rightPath, right]] as const) {
        ctx.save();
        ctx.clip(p);
        ctx.fillStyle = tint;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        if (p === rightPath) {
          // The display, centred in the lens; 'lighten' keeps the lens colour where the display shows
          // its own background or black corners, so only its light content stands out (no square).
          const s = b.h * DISPLAY_SCALE;
          ctx.globalCompositeOperation = 'lighten';
          ctx.drawImage(lens, b.x + (b.w - s) / 2, b.y + (b.h - s) / 2, s, s);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
        drawSheen(p, b);
      }

      // A quiet label under the glasses; on a portrait phone, a hint to turn it.
      const fs = Math.max(11 * dpr, Math.min(16 * dpr, frame.w * 0.028));
      ctx.fillStyle = CAPTION_COLOR;
      ctx.font = `300 ${fs}px "Elms Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const below = frame.y + frame.h + fs * 2;
      ctx.fillText('Momo · simulated view through the glasses', W / 2, below);
      if (H > W) ctx.fillText('Turn your phone sideways for a larger view', W / 2, below + fs * 1.6);
    },
  };
}
