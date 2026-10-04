// Simulated view (?sim=1), for people who scan a QR code on a phone or open the link on a desktop,
// in the style of the earlier momo-lens-simulator.html: the desk photo seen through the glasses,
// a dark frame over everything except two rounded lens openings (left and right), and the Momo
// display (the lens canvas, background colour and all) as a rounded block in the right lens, the
// eye Meta Ray-Ban Display shows in. Photo, vignette and frame are baked once per resize. Purely
// visual; the session plays by itself.

/** The glasses' box (it holds both lenses), width : height; the frame darkens the rest of the screen. */
const BOX_ASPECT = 1.7;
/** Lens openings across the box (simulator: 3–48 % and 52–97 %, 13–87 % tall, radius 13 % of width). */
const LENSES = [
  {x0: 0.03, x1: 0.48},
  {x0: 0.52, x1: 0.97},
] as const;
const LENS_Y0 = 0.13;
const LENS_Y1 = 0.87;
const LENS_RADIUS = 0.13;
/** The display block: side relative to the lens height, centred a little above the lens middle. */
const DISPLAY_SCALE = 0.6;
const DISPLAY_CY = 0.46;
/** The display's own corner radius (Figma frame 17: 18 of 600). */
const DISPLAY_CORNER = 18 / 600;
/** The display is see-through on the glasses: let the room show through a little. */
const DISPLAY_ALPHA = 0.8;

type Box = {x: number; y: number; w: number; h: number};

export interface SimView {
  /** Draw the view with the current lens frame in the right lens (after the lens canvas is drawn). */
  draw(lens: HTMLCanvasElement): void;
}

export function createSimView(photoUrl: string): SimView {
  const view = document.createElement('canvas');
  view.className = 'sim-world';
  view.setAttribute('aria-hidden', 'true');
  document.body.prepend(view);
  const ctx = view.getContext('2d', {alpha: false});
  if (!ctx) throw new Error('2D canvas unavailable');

  const backdrop = document.createElement('canvas');
  const photo = new Image();
  let photoReady = false;
  let rightLens: Box = {x: 0, y: 0, w: 0, h: 0};

  function layout(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(window.innerWidth * dpr));
    const H = Math.max(1, Math.round(window.innerHeight * dpr));
    view.width = backdrop.width = W;
    view.height = backdrop.height = H;
    const b = backdrop.getContext('2d');
    if (!b) return;

    // The glasses' box, as large as fits (landscape fills the screen; portrait gets a band).
    const bw = Math.min(W, H * BOX_ASPECT);
    const bh = bw / BOX_ASPECT;
    const box: Box = {x: (W - bw) / 2, y: (H - bh) / 2, w: bw, h: bh};
    const lenses: Box[] = LENSES.map((l) => ({
      x: box.x + l.x0 * bw,
      y: box.y + LENS_Y0 * bh,
      w: (l.x1 - l.x0) * bw,
      h: (LENS_Y1 - LENS_Y0) * bh,
    }));
    rightLens = lenses[1]!;
    const radius = Math.min(LENS_RADIUS * bw, lenses[0]!.h / 2);

    // The world: the desk photo (cover, focused on the desk line) with a vignette.
    b.fillStyle = '#111';
    b.fillRect(0, 0, W, H);
    if (photoReady) {
      const s = Math.max(W / photo.width, H / photo.height);
      b.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) * 0.52, photo.width * s, photo.height * s);
    }
    const v = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.45)');
    b.fillStyle = v;
    b.fillRect(0, 0, W, H);

    // The frame: dark everywhere except the two lens openings, cut with a soft edge.
    const frame = document.createElement('canvas');
    frame.width = W;
    frame.height = H;
    const f = frame.getContext('2d');
    if (f) {
      f.fillStyle = 'rgba(7,7,8,.97)';
      f.fillRect(0, 0, W, H);
      f.globalCompositeOperation = 'destination-out';
      f.shadowColor = '#000';
      f.shadowBlur = bw * 0.02;
      for (const l of lenses) {
        f.beginPath();
        f.roundRect(l.x, l.y, l.w, l.h, radius);
        f.fill();
      }
      f.globalCompositeOperation = 'source-over';
      f.shadowBlur = 0;
      f.strokeStyle = 'rgba(255,255,255,.05)';
      f.lineWidth = 2;
      for (const l of lenses) {
        f.beginPath();
        f.roundRect(l.x, l.y, l.w, l.h, radius);
        f.stroke();
      }
      b.drawImage(frame, 0, 0);
    }

    // A quiet label under the glasses; on a portrait phone, a hint to turn it.
    const fs = Math.max(11 * dpr, Math.min(15 * dpr, bw * 0.024));
    b.fillStyle = 'rgba(255,255,255,.55)';
    b.font = `300 ${fs}px "Elms Sans", sans-serif`;
    b.textAlign = 'center';
    b.textBaseline = 'middle';
    const below = Math.min(H - fs * 3, box.y + bh + fs * 1.4);
    b.fillText('Momo · simulated view through the glasses', W / 2, below);
    if (H > W) b.fillText('Turn your phone sideways for a larger view', W / 2, below + fs * 1.6);
  }

  photo.onload = () => {
    photoReady = true;
    layout();
  };
  photo.src = photoUrl;
  layout();
  window.addEventListener('resize', layout);
  // The label uses Elms Sans: re-bake once the font has loaded.
  void document.fonts.ready.then(layout);

  return {
    draw(lens) {
      ctx.drawImage(backdrop, 0, 0);
      // The display block, with its own background colour, in the right lens; clipped to its
      // rounded corners so the lens canvas's black corner pixels don't show.
      const l = rightLens;
      const s = l.h * DISPLAY_SCALE;
      const x = l.x + (l.w - s) / 2;
      const y = l.y + l.h * DISPLAY_CY - s / 2;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, s * DISPLAY_CORNER);
      ctx.clip();
      ctx.globalAlpha = DISPLAY_ALPHA;
      ctx.drawImage(lens, x, y, s, s);
      ctx.restore();
    },
  };
}
